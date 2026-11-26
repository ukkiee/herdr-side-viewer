// Draws a long markdown document the way the viewer does, in Herdr's own script engine
// (`herdr-app check`), and fails when a render() comes near the 50 ms Herdr allows one
// (RECIPE.md, Watch out). It draws the viewer's column and the largest chunk, each a few
// times, and passes while both stay under LIMIT_MS.
//   bun tools/render-budget.mjs [mod-dir]      (node works too)
// mod-dir defaults to mods/side-viewer; pass another copy to measure it instead.
// LIMIT_MS (default 25) is the most one draw may take. Needs herdr-app on PATH.
//
// The check runs on a temporary copy of the mod: its main.js is replaced by a harness that
// throws "[budget] N ms, M chunks" from render(), the only way to get a number out of
// `herdr-app check`. A render() Herdr stops reads as "interrupted" and fails outright.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mod = resolve(process.argv[2] ?? join(root, "mods/side-viewer"));
const limit = limitOf(process.env.LIMIT_MS);
const runs = 3;

// Unset or empty means 25. Anything but a positive whole number is refused before any draw:
// Number() would read "" as 0, and "Infinity", "1.5" or "1e2" as limits no one meant.
function limitOf(text) {
  if (text === undefined || text === "") return 25;
  if (!/^[1-9][0-9]*$/.test(text) || !Number.isSafeInteger(Number(text))) return null;
  return Number(text);
}

// Writes a new plain file in place of whatever is at path, so a link copied from the source
// cannot carry the write back to the file it points at.
function writeFresh(path, text) {
  rmSync(path, { force: true });
  writeFileSync(path, text, { flag: "wx" });
}

// The samples, sixteen times over: about 67 KB, three times the longest document seen stopped.
function fixture() {
  const samples = join(root, "docs/samples");
  const one = ["markdown-sample.md", "markdown-sample.en.md", "code-sample.md"]
    .map((name) => readFileSync(join(samples, name), "utf8")).join("\n\n");
  const text = Array.from({ length: 16 }, () => one).join("\n\n");
  return `export const DOC = ${JSON.stringify(text)};\nexport const FILE = "/tmp/budget/long.md";\n`;
}

const harness = (part) => `import { View } from "gpui-kit";
import { theme } from "herdr";
import { renderMarkdown, renderChunk } from "./adapters/in/viewer/markdown-view.js";
import { MarkdownDocument } from "./adapters/in/viewer/markdown-document.js";
import { sizeOf, parseMemo, parsedOf } from "./adapters/in/logic/markdown-chunks.js";
import { CodeCards } from "./adapters/in/viewer/code-card.js";
import { translator } from "./core/i18n/i18n.js";
import { DOC, FILE } from "./budget-fixture.js";

const WANT = { file: FILE, text: DOC, generation: 1, cards: 0, lang: "en" };

export default class Budget extends View {
  init(_props, cx) {
    const memo = parseMemo();
    this.document = new MarkdownDocument({ parse: (text) => parsedOf(memo, text), draw: () => null, ring: () => null });
    this.document.sync(WANT, cx);
    this.cards = new CodeCards();
  }

  render() {
    const t = theme();
    const tr = translator("en");
    const size = (part) => part.blocks.reduce((sum, block) => sum + sizeOf(block), 0);
    const largest = this.document.parts.reduce((a, b) => (size(b) > size(a) ? b : a));
    const images = { of: () => ({ state: "loading" }), room: () => null, setRoom: () => {} };
    const start = Date.now();
    if ("${part}" === "column") {
      const shown = this.document.shown(FILE);
      renderMarkdown(t, { file: FILE, empty: false, chunks: shown.views, doc: shown.doc, generation: shown.generation, onLink: () => {}, tr });
    } else {
      renderChunk(t, {
        blocks: largest.blocks, start: largest.start, doc: this.document.doc, generation: 1, onLink: () => {},
        takeCard: this.cards.drawing(largest.from), images, onTerminal: () => {}, onCheckbox: () => {}, tr,
      });
    }
    throw new Error(\`[budget] \${Date.now() - start} ms, \${this.document.views.length} chunks\`);
  }
}
`;

// Returns true when every draw of the part stays within the limit; stops at the first
// draw that is interrupted or prints no budget line.
function measure(probe, part) {
  writeFresh(join(probe, "main.js"), harness(part));
  let worst = 0;
  let chunks = "";
  for (let i = 0; i < runs; i++) {
    const r = spawnSync("herdr-app", ["check", probe], { encoding: "utf8", timeout: 120000 });
    if (r.error) throw r.error;
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const found = out.match(/\[budget\] (\d+) ms, (\d+) chunks/);
    if (!found) {
      if (out.includes("interrupted")) console.error(`${part}: render() was stopped (interrupted)`);
      else console.error(`${part}: unexpected check output:\n${out.trimEnd()}`);
      return false;
    }
    worst = Math.max(worst, Number(found[1]));
    chunks = found[2];
  }
  console.log(`${part}: at most ${worst} ms over ${runs} draws (${chunks} chunks; limit ${limit} ms)`);
  return worst <= limit;
}

function run() {
  const work = mkdtempSync(join(tmpdir(), "render-budget-"));
  try {
    const probe = join(work, "side-viewer");
    // The copy follows every link, mod-dir itself included: cpSync keeps links by default, and a
    // kept link would send the harness and fixture writes into the source.
    cpSync(realpathSync(mod), probe, { recursive: true, dereference: true });
    writeFresh(join(probe, "budget-fixture.js"), fixture());
    return measure(probe, "column") && measure(probe, "chunk");
  } catch (error) {
    if (error.code === "ENOENT" && error.path === "herdr-app") console.error("herdr-app is not on PATH");
    else console.error(error);
    return false;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// exitCode, not exit(): a piped stdout on macOS is written asynchronously and exit() can cut it.
if (limit === null) {
  console.error(`LIMIT_MS must be a positive whole number of milliseconds, got ${JSON.stringify(process.env.LIMIT_MS)}`);
  process.exitCode = 2;
} else {
  process.exitCode = run() ? 0 : 1;
}
