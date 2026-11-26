#!/bin/sh
# Draws a long markdown document the way the viewer does, in Herdr's own script engine
# (`herdr-app check`), and fails when a render() comes near the 50 ms Herdr allows one
# (RECIPE.md, Watch out). It draws the viewer's column and the largest chunk, each a few
# times, and passes while both stay under LIMIT_MS. Needs herdr-app and node.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
limit=${LIMIT_MS:-25}
runs=3
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
probe="$work/side-viewer"
cp -R "$here/mods/side-viewer" "$probe"

# The samples, sixteen times over: about 67 KB, three times the longest document seen stopped.
node --input-type=module - "$here/docs/samples" "$probe/budget-fixture.js" <<'EOF'
import fs from "node:fs";
const [samples, out] = process.argv.slice(2);
const one = ["markdown-sample.md", "markdown-sample.en.md", "code-sample.md"]
  .map((name) => fs.readFileSync(`${samples}/${name}`, "utf8")).join("\n\n");
const text = Array.from({ length: 16 }, () => one).join("\n\n");
fs.writeFileSync(out, `export const DOC = ${JSON.stringify(text)};\nexport const FILE = "/tmp/budget/long.md";\n`);
EOF

measure() {
  part=$1
  sed "s/@PART@/$part/" > "$probe/main.js" <<'EOF'
import { View } from "gpui-kit";
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
    if ("@PART@" === "column") {
      const shown = this.document.shown(FILE);
      renderMarkdown(t, { file: FILE, empty: false, chunks: shown.views, doc: shown.doc, generation: shown.generation, onLink: () => {}, tr });
    } else {
      renderChunk(t, {
        blocks: largest.blocks, start: largest.start, doc: this.document.doc, generation: 1, onLink: () => {},
        takeCard: this.cards.drawing(largest.from), images, onTerminal: () => {}, onCheckbox: () => {}, tr,
      });
    }
    throw new Error(`[budget] ${Date.now() - start} ms, ${this.document.views.length} chunks`);
  }
}
EOF
  worst=0
  i=0
  while [ "$i" -lt "$runs" ]; do
    out=$(herdr-app check "$probe" 2>&1 || true)
    case "$out" in
      *"[budget] "*) ;;
      *interrupted*) echo "$part: render() was stopped (interrupted)" >&2; return 1 ;;
      *) echo "$part: unexpected check output:" >&2; echo "$out" >&2; return 1 ;;
    esac
    ms=$(printf '%s\n' "$out" | sed -n 's/.*\[budget\] \([0-9]*\) ms, \([0-9]*\) chunks.*/\1/p' | head -n 1)
    chunks=$(printf '%s\n' "$out" | sed -n 's/.*\[budget\] \([0-9]*\) ms, \([0-9]*\) chunks.*/\2/p' | head -n 1)
    [ "$ms" -gt "$worst" ] && worst=$ms
    i=$((i + 1))
  done
  echo "$part: at most $worst ms over $runs draws ($chunks chunks; limit $limit ms)"
  [ "$worst" -le "$limit" ]
}

measure column
measure chunk
