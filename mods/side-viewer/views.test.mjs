// node --test: which view a file gets, its syntax language, and what stops it being drawn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { viewOf, blockerOf, readProbe, PROBE, showsLoading, refreshOf, waitsForRead, settledProbe, sameProbe, editable, editorOf, imageState, switchable, editedContentOf, opensInTab } from "./views.js";

import { contentOf } from "./document.js";
import { noEdits, typed, diskRead, shownText, barOf } from "./edit-state.js";

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

test("a file outside the listed extensions has no view", () => {
  assert.equal(viewOf("/work/report.pdf", groups), null);
  assert.equal(viewOf("/work/page.xhtml", groups), null);
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

test("html files, with the extensions macOS gives the same file type, open in the code view with HTML colors", () => {
  // macOS files html, htm, shtml and shtm under one type (public.html), so taking over
  // html brings all four to the router.
  for (const name of ["page.html", "page.htm", "page.shtml", "page.shtm", "INDEX.HTML"]) {
    assert.deepEqual(viewOf(`/work/${name}`, groups), { view: "code", language: "html" }, name);
  }
  assert.equal(editable(viewOf("/work/page.html", groups).view, false), true);
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

test("a file that is gone, unreadable or of no view is stopped with its reason", () => {
  const found = viewOf("/work/app.ts", groups);
  assert.equal(blockerOf(null, probe(10)), "unsupported");
  assert.equal(blockerOf(found, { found: false }), "missing");
  assert.equal(blockerOf(found, { found: true, readable: false }), "unreadable");
});

test("an empty markdown or code file is read into its editable view; an empty picture gets the empty notice", () => {
  for (const name of ["plan.md", "app.ts", "server.log"]) {
    assert.equal(blockerOf(viewOf(`/work/${name}`, groups), probe(0)), null, name);
  }
  for (const name of ["logo.svg", "shot.png", "logo.svgz"]) {
    assert.equal(blockerOf(viewOf(`/work/${name}`, groups), probe(0)), "empty", name);
  }
  assert.equal(editable("code", false), true);
  assert.equal(editable("markdown", true), true);
  assert.equal(editable("markdown", false), false);
  assert.equal(editable("empty", true), false);
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

test("typing goes into the markdown source and the code view, nowhere else", () => {
  assert.equal(editable("markdown", true), true);
  assert.equal(editable("code", false), true);
  assert.equal(editable("code", true), true);
  assert.equal(editable("markdown", false), false);
  assert.equal(editable("image", false), false);
  for (const notice of ["none", "loading", "empty", "missing", "unreadable", "unsupported", "large"]) {
    assert.equal(editable(notice, false), false, notice);
    assert.equal(editable(notice, true), false, notice);
  }
});

test("the markdown source's editor wraps long lines, the code view's does not", () => {
  assert.deepEqual(editorOf("markdown"), { soft_wrap: true });
  assert.deepEqual(editorOf("code"), { soft_wrap: false });
  assert.equal(editorOf("image"), null);
  assert.equal(editorOf("missing"), null);
});

test("an svg is drawn as a picture that also has its source; svgz and other images have none", () => {
  assert.equal(imageState("/work/logo.svg", "svg", 900), "svg");
  assert.equal(imageState("/work/LOGO.SVG", "svg", 900), "svg");
  // svgz is compressed: there is no text to show or edit.
  assert.equal(imageState("/work/logo.svgz", "svgz", 900), "image");
  // An svgz file that holds plain svg text is still an svgz to the user.
  assert.equal(imageState("/work/logo.svgz", "svg", 900), "image");
  assert.equal(imageState("/work/shot.png", "png", 900), "image");
  // The source is read as text, so it has the text views' limit.
  assert.equal(imageState("/work/logo.svg", "svg", 1024 * 1024), "svg");
  assert.equal(imageState("/work/logo.svg", "svg", 1024 * 1024 + 1), "image");
});

test("the rendering and source switch is on markdown and svg, nowhere else", () => {
  assert.equal(switchable("markdown"), true);
  assert.equal(switchable("svg"), true);
  for (const state of ["image", "code", "none", "loading", "empty", "missing", "unreadable", "unsupported", "large"]) {
    assert.equal(switchable(state), false, state);
  }
});

test("an svg takes typing in its source only; the picture and other images never do", () => {
  assert.equal(editable("svg", true), true);
  assert.equal(editable("svg", false), false);
  assert.equal(editable("image", true), false);
});

test("an svg's source is edited with XML colors and wraps long lines like the markdown source", () => {
  assert.deepEqual(editorOf("svg"), { soft_wrap: true, language: "xml" });
});

test("a changed svg keeps its source editor and only gets the new text", () => {
  const shown = { state: "svg", text: "<svg/>", path: "data/side-viewer/images/a-6-1.svg", size: null, theme: "#1", editor: {} };
  const next = { state: "svg", text: "<svg />", path: "data/side-viewer/images/a-7-2.svg", size: null, theme: "#1" };
  assert.equal(refreshOf(shown, next), "retext");
  assert.equal(refreshOf(shown, { ...next, theme: "#2" }), "replace");
  assert.equal(refreshOf(shown, { ...shown, editor: undefined }), "keep");
  assert.equal(refreshOf(shown, { ...next, state: "image" }), "replace");
});

test("a file with unsaved edits that is now gone, empty or too large comes back as its view, not a notice", () => {
  const md = viewOf("/work/plan.md", groups);
  for (const state of ["missing", "empty", "large", "unreadable"]) {
    assert.deepEqual(editedContentOf("/work/plan.md", { state }, md, "# plan\n"), { state: "markdown", text: "# plan\n" }, state);
  }
  assert.deepEqual(editedContentOf("/work/main.py", { state: "missing" }, viewOf("/work/main.py", groups), "x = 1\n"),
    { state: "code", text: "x = 1\n", language: "python" });
  assert.deepEqual(editedContentOf("/work/logo.svg", { state: "missing" }, viewOf("/work/logo.svg", groups), "<svg/>"),
    { state: "svg", text: "<svg/>", path: null, size: null });
});

test("an edited markdown or code file emptied outside keeps the edits on screen and raises the changed-outside bar", () => {
  for (const [file, before] of [["/work/plan.md", "# plan\n"], ["/work/main.py", "x = 1\n"]]) {
    const found = viewOf(file, groups);
    // The viewer's read of the emptied file, as main.js does it: no blocker, then contentOf.
    assert.equal(blockerOf(found, probe(0)), null, file);
    const read = contentOf(file, "", found);
    const edits = typed(noEdits(), file, before, before + "more\n");
    const step = diskRead(edits, file, "");
    assert.equal(step.step, "keep", file);
    const content = editedContentOf(file, read, found, step.edits[file].disk);
    assert.equal(content.state, found.view, file);
    assert.equal(shownText(step.edits, file, content.text), before + "more\n", file);
    assert.deepEqual(barOf(step.edits, file), { kind: "conflict", message: "밖에서 바뀌었습니다" }, file);
  }
});

test("an edited svg that grew past the text limit or stopped being svg comes back as its source, other pictures do not", () => {
  const svg = viewOf("/work/logo.svg", groups);
  const grown = { state: "image", path: "/work/logo.svg", size: { width: 10, height: 10 } };
  assert.deepEqual(editedContentOf("/work/logo.svg", grown, svg, "<svg/>"), { state: "svg", text: "<svg/>", path: null, size: null });
  assert.deepEqual(editedContentOf("/work/logo.svg", { state: "unsupported" }, svg, "<svg/>"), { state: "svg", text: "<svg/>", path: null, size: null });
  const png = viewOf("/work/shot.png", groups);
  const picture = { state: "image", path: "/work/shot.png", size: { width: 10, height: 10 } };
  assert.equal(editedContentOf("/work/shot.png", picture, png, "x"), picture);
  assert.deepEqual(editedContentOf("/work/shot.png", { state: "unsupported" }, png, "x"), { state: "unsupported" });
});

test("a read that can be drawn, or a file without edits, keeps the read's own content", () => {
  const md = viewOf("/work/plan.md", groups);
  const read = { state: "markdown", text: "# new\n" };
  assert.equal(editedContentOf("/work/plan.md", read, md, "# plan\n"), read);
  assert.equal(editedContentOf("/work/plan.md", null, md, "# plan\n"), null);
  assert.deepEqual(editedContentOf("/work/plan.md", { state: "missing" }, md, undefined), { state: "missing" });
  assert.deepEqual(editedContentOf("/work/plan.md", { state: "unsupported" }, null, "# plan\n"), { state: "unsupported" });
  assert.deepEqual(editedContentOf("/work/shot.png", { state: "missing" }, viewOf("/work/shot.png", groups), "x"), { state: "missing" });
});

test("only drawn content offers a new tab; a notice offers the original app and Finder alone", () => {
  for (const state of ["markdown", "code", "image", "svg"]) assert.equal(opensInTab(state), true, state);
  for (const state of ["none", "loading", "empty", "missing", "unreadable", "unsupported", "large"]) {
    assert.equal(opensInTab(state), false, state);
  }
});
