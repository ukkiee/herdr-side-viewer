// node --test: which app "open in the original app" names. The second half runs the router's
// open-original.sh against a fake `open`, to hold the two to the same answer.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTER_ID, originalApps, openOriginalCommands } from "./original.js";

const here = dirname(fileURLToPath(import.meta.url));
const EXTENSIONS = readFileSync(join(here, "extensions.json"), "utf8");
const RECORD = "md\tcom.example.Editor\npng\tcom.example.Pictures\nts\tcom.example.Editor\n";

test("the recorded original app comes first, the built-in default second", () => {
  assert.deepEqual(originalApps("/a/notes.md", RECORD, EXTENSIONS), ["com.example.Editor", "com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a/shot.PNG", RECORD, EXTENSIONS), ["com.example.Pictures", "com.apple.Preview"]);
});

test("without a record the default is TextEdit, or Preview for an image", () => {
  assert.deepEqual(originalApps("/a/notes.md", null, EXTENSIONS), ["com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a/notes.mdx", RECORD, EXTENSIONS), ["com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a/shot.webp", "", EXTENSIONS), ["com.apple.Preview"]);
  assert.deepEqual(originalApps("/a/Makefile", RECORD, EXTENSIONS), ["com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a.d/README", RECORD, EXTENSIONS), ["com.apple.TextEdit"]);
});

test("a record naming the router is ignored, so the file cannot come back", () => {
  const record = `md\t${ROUTER_ID}\npng\t${ROUTER_ID}\n`;
  assert.deepEqual(originalApps("/a/notes.md", record, EXTENSIONS), ["com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a/shot.png", record, EXTENSIONS), ["com.apple.Preview"]);
});

test("a damaged record or extension list falls back to the default", () => {
  assert.deepEqual(originalApps("/a/notes.md", "md\n\n\tx\nmd com.example.Spaces\n", EXTENSIONS), ["com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a/shot.png", RECORD, "not json"), ["com.example.Pictures", "com.apple.TextEdit"]);
  assert.deepEqual(originalApps("/a/shot.png", null, null), ["com.apple.TextEdit"]);
});

test("every command names an app with -b: none leaves the choice to the default app", () => {
  assert.deepEqual(openOriginalCommands("/a/my notes.md", RECORD, EXTENSIONS), [
    ["open", ["-b", "com.example.Editor", "/a/my notes.md"]],
    ["open", ["-b", "com.apple.TextEdit", "/a/my notes.md"]],
  ]);
});

test("the router id is the one the router app is built with", () => {
  assert.ok(readFileSync(join(here, "router", "build.sh"), "utf8").includes(`<string>${ROUTER_ID}</string>`));
});

// Runs router/open-original.sh with a fake `open` and returns the app it named first.
function scriptOpens(file, record) {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-original-"));
  const bin = join(dir, "bin");
  const data = join(dir, "data");
  for (const d of [bin, data]) mkdirSync(d);
  writeFileSync(join(bin, "open"), `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done >> "${dir}/open.log"\n`);
  chmodSync(join(bin, "open"), 0o755);
  if (record !== null) writeFileSync(join(data, "original-apps.tsv"), record);
  const run = spawnSync("/bin/sh", [join(here, "router", "open-original.sh"), file], {
    env: { PATH: `${bin}:/usr/bin:/bin`, SIDE_VIEWER_DATA: data, SIDE_VIEWER_ROUTER_ID: ROUTER_ID },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const log = existsSync(join(dir, "open.log")) ? readFileSync(join(dir, "open.log"), "utf8").trimEnd().split("\n") : [];
  return log;
}

test("the mod names the same app as the router's open-original.sh", { skip: process.platform !== "darwin" }, () => {
  const scenes = [
    ["/a/notes.md", RECORD],
    ["/a/shot.PNG", RECORD],
    ["/a/notes.mdx", RECORD],
    ["/a/shot.jpg", null],
    ["/a/main.ts", `ts\t${ROUTER_ID}\n`],
    ["/a/Makefile", RECORD],
  ];
  for (const [file, record] of scenes) {
    const [command, args] = openOriginalCommands(file, record, EXTENSIONS)[0];
    assert.deepEqual(scriptOpens(file, record), args, `${file} via ${command}`);
  }
});
