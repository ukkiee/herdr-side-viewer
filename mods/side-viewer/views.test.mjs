// node --test: which view a file gets, its syntax language, and what stops it being drawn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { viewOf, blockerOf, readProbe, PROBE, showsLoading, refreshOf, waitsForRead, settledProbe, sameProbe } from "./views.js";

const groups = JSON.parse(readFileSync(new URL("./extensions.json", import.meta.url), "utf8"));
const probe = (bytes) => ({ found: true, readable: true, bytes, modified: 1, head: [] });

test("markdown extensions get the markdown view", () => {
  for (const name of ["plan.md", "PLAN.MARKDOWN", "page.mdx"]) {
    assert.equal(viewOf(`/work/${name}`, groups).view, "markdown", name);
  }
});

test("image extensions get the image view", () => {
  for (const ext of ["png", "jpg", "jpeg", "jpe", "gif", "webp", "svg", "svgz"]) {
    assert.equal(viewOf(`/work/shot.${ext}`, groups).view, "image", ext);
  }
  assert.equal(viewOf("/work/SHOT.PNG", groups).view, "image");
});

test("every other listed extension gets the code view", () => {
  for (const ext of groups.code) assert.equal(viewOf(`/work/file.${ext}`, groups).view, "code", ext);
  assert.equal(viewOf("/work/main.c++", groups).view, "code");
});

test("a file outside the handed-over extensions has no view", () => {
  assert.equal(viewOf("/work/report.pdf", groups), null);
  assert.equal(viewOf("/work/page.html", groups), null);
  assert.equal(viewOf("/work/README", groups), null);
  assert.equal(viewOf("/work/notes.md/README", groups), null);
  assert.equal(viewOf("/work/plan.md", null), null);
});

test("code files get their editor language", () => {
  const language = (name) => viewOf(`/work/${name}`, groups).language;
  assert.equal(language("app.js"), "javascript");
  assert.equal(language("app.mjs"), "javascript");
  assert.equal(language("data.json"), "json");
  assert.equal(language("ci.yml"), "yaml");
  assert.equal(language("tool.py"), "python");
  assert.equal(language("main.rs"), "rust");
  assert.equal(language("main.go"), "go");
  assert.equal(language("run.sh"), "bash");
  assert.equal(language("util.h"), "c");
  assert.equal(language("util.cc"), "cpp");
  assert.equal(language("job.rbw"), "ruby");
});

test("TypeScript and JSX use JavaScript colors", () => {
  for (const name of ["app.ts", "app.tsx", "app.jsx"]) {
    assert.equal(viewOf(`/work/${name}`, groups).language, "javascript", name);
  }
});

test("extensions without a known language are drawn without colors", () => {
  assert.equal(viewOf("/work/server.log", groups).language, null);
  assert.equal(viewOf("/work/table.csv", groups).language, null);
});

test("text is drawn up to exactly 1 MB and not beyond", () => {
  for (const name of ["app.ts", "plan.md"]) {
    const found = viewOf(`/work/${name}`, groups);
    assert.equal(blockerOf(found, probe(1048576)), null);
    assert.equal(blockerOf(found, probe(1048577)), "large");
  }
});

test("an image is drawn up to exactly 20 MB and not beyond", () => {
  const found = viewOf("/work/shot.png", groups);
  assert.equal(blockerOf(found, probe(1048577)), null);
  assert.equal(blockerOf(found, probe(20971520)), null);
  assert.equal(blockerOf(found, probe(20971521)), "large");
});

test("a file that is gone, unreadable, empty or of no view is stopped with its reason", () => {
  const found = viewOf("/work/app.ts", groups);
  assert.equal(blockerOf(null, probe(10)), "unsupported");
  assert.equal(blockerOf(found, { found: false }), "missing");
  assert.equal(blockerOf(found, { found: true, readable: false }), "unreadable");
  assert.equal(blockerOf(found, probe(0)), "empty");
});

// The probe is the script the mod runs to learn about a file before reading it.
const run = (file) => readProbe(spawnSync("sh", ["-c", PROBE, "sh", file], { encoding: "utf8" }).stdout);

test("the probe reports a file's size and first bytes without reading it into the mod", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-probe-"));
  const file = join(dir, "a b.txt");
  writeFileSync(file, "GIF89a" + "x".repeat(5000));
  const seen = run(file);
  assert.equal(seen.found, true);
  assert.equal(seen.readable, true);
  assert.equal(seen.bytes, 5006);
  assert.equal(seen.head.length, 4096);
  assert.deepEqual(seen.head.slice(0, 6), [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  assert.ok(seen.modified > 0);
});

test("the probe tells a missing file from one that cannot be read", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-probe-"));
  assert.deepEqual(run(join(dir, "none.txt")), { found: false });
  assert.deepEqual(run(dir), { found: true, readable: false });
  const locked = join(dir, "locked.txt");
  writeFileSync(locked, "secret");
  chmodSync(locked, 0o000);
  assert.deepEqual(run(locked), { found: true, readable: false });
  assert.deepEqual(readProbe(""), { found: true, readable: false });
});

test("reading the same file again shows no loading notice, opening another file does", () => {
  assert.equal(showsLoading("/w/a.md", "/w/a.md"), false);
  assert.equal(showsLoading("/w/a.md", "/w/b.md"), true);
  assert.equal(showsLoading(null, "/w/a.md"), true);
});

test("a second read that gives the same content changes nothing on screen", () => {
  assert.equal(refreshOf({ state: "markdown", text: "# A" }, { state: "markdown", text: "# A" }), "keep");
  assert.equal(refreshOf({ state: "code", text: "x", language: "go", editor: {} }, { state: "code", text: "x", language: "go" }), "keep");
  const image = { state: "image", path: "data/side-viewer/images/a-1-1.png", size: { width: 2, height: 1 } };
  assert.equal(refreshOf(image, { ...image, size: { width: 2, height: 1 } }), "keep");
  assert.equal(refreshOf({ state: "missing" }, { state: "missing" }), "keep");
});

test("changed content replaces what is shown", () => {
  assert.equal(refreshOf({ state: "markdown", text: "# A" }, { state: "markdown", text: "# B" }), "replace");
  assert.equal(refreshOf({ state: "markdown", text: "# A" }, { state: "missing" }), "replace");
  assert.equal(refreshOf({ state: "missing" }, { state: "unreadable" }), "replace");
  assert.equal(refreshOf({ state: "loading" }, { state: "markdown", text: "# A" }), "replace");
  const image = { state: "image", path: "data/side-viewer/images/a-1-1.png", size: null };
  assert.equal(refreshOf(image, { ...image, path: "data/side-viewer/images/a-1-2.png" }), "replace");
  assert.equal(refreshOf({ state: "code", text: "x", language: "go", editor: {} }, { state: "code", text: "x", language: null }), "replace");
});

test("a read of the same file in progress is waited for, a read of another file is not", () => {
  // Starting again would throw away the read under way: a file written faster than it can
  // be read would then never get on screen.
  assert.equal(waitsForRead("/w/a.log", "/w/a.log"), true);
  // Another file was opened: the earlier read is of no use any more.
  assert.equal(waitsForRead("/w/a.log", "/w/b.log"), false);
  assert.equal(waitsForRead(null, "/w/a.log"), false);
  assert.equal(waitsForRead(null, null), false);
});

test("a file with the size and time of the last read is not read again", () => {
  const last = { file: "/w/a.md", bytes: 10, modified: 100 };
  const seen = (bytes, modified) => ({ found: true, readable: true, bytes, modified, head: [] });
  assert.equal(sameProbe(last, "/w/a.md", seen(10, 100)), true);
  assert.equal(sameProbe(last, "/w/a.md", seen(11, 100)), false);
  assert.equal(sameProbe(last, "/w/a.md", seen(10, 101)), false);
  assert.equal(sameProbe(last, "/w/b.md", seen(10, 100)), false);
  assert.equal(sameProbe(null, "/w/a.md", seen(10, 100)), false);
  assert.equal(sameProbe(last, "/w/a.md", { found: false }), false);
  assert.equal(sameProbe(last, "/w/a.md", { found: true, readable: false }), false);
});

test("a probe is only remembered once the file's time is safely in the past", () => {
  const seen = { found: true, readable: true, bytes: 10, modified: 100, head: [] };
  assert.deepEqual(settledProbe("/w/a.md", seen, 102), { file: "/w/a.md", bytes: 10, modified: 100 });
  // The time is in whole seconds: a second write in the same second would look the same.
  assert.equal(settledProbe("/w/a.md", seen, 100), null);
  assert.equal(settledProbe("/w/a.md", seen, 101), null);
  assert.equal(settledProbe("/w/a.md", { found: false }, 200), null);
  assert.equal(settledProbe("/w/a.md", { found: true, readable: false }, 200), null);
});

test("code drawn under another theme gets a new editor, whose colors are fixed when it is made", () => {
  const shown = { state: "code", text: "x", language: "go", theme: "#111 #222", editor: {} };
  assert.equal(refreshOf(shown, { state: "code", text: "x", language: "go", theme: "#111 #222" }), "keep");
  assert.equal(refreshOf(shown, { state: "code", text: "x", language: "go", theme: "#eee #ddd" }), "replace");
  // New text and a new theme at once: the editor is still rebuilt.
  assert.equal(refreshOf(shown, { state: "code", text: "y", language: "go", theme: "#eee #ddd" }), "replace");
  assert.equal(refreshOf(shown, { state: "code", text: "y", language: "go", theme: "#111 #222" }), "retext");
});

test("changed code in the same language keeps its editor and only gets the new text", () => {
  assert.equal(refreshOf({ state: "code", text: "x", language: "go", editor: {} }, { state: "code", text: "y", language: "go" }), "retext");
  assert.equal(refreshOf({ state: "code", text: "x", language: "go" }, { state: "code", text: "y", language: "go" }), "replace");
});
