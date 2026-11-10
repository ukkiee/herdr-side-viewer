// node --test: open.sh against a fake `herdr-app`, a fake `open` and a throwaway data folder.
// Nothing here reaches the real Herdr window or the real default apps.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const HERDR_FRONT = "/Users/someone/Applications/Herdr.app";

// Stands in for herdr-app: logs one argument per line, then answers as the scene says.
const FAKE_HERDR = `#!/bin/sh
for a in "$@"; do printf '%s\\n' "$a"; done >> "$FAKE_STATE/herdr.log"
[ -e "$FAKE_STATE/herdr-sleep" ] && sleep "$(cat "$FAKE_STATE/herdr-sleep")"
cat "$FAKE_STATE/herdr-out" 2>/dev/null || echo '{ "pane": "p9" }'
exit "$(cat "$FAKE_STATE/herdr-exit" 2>/dev/null || echo 0)"
`;

// Stands in for /usr/bin/open: logs one argument per line.
const FAKE_OPEN = `#!/bin/sh
for a in "$@"; do printf '%s\\n' "$a"; done >> "$FAKE_STATE/open.log"
`;

function world({ herdr = true, record } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-open-"));
  const state = join(dir, "state");
  const data = join(dir, "data");
  const bin = join(dir, "bin");
  for (const d of [state, data, bin]) mkdirSync(d);
  writeFileSync(join(bin, "open"), FAKE_OPEN);
  chmodSync(join(bin, "open"), 0o755);
  const herdrApp = join(dir, "herdr-app");
  if (herdr) {
    writeFileSync(herdrApp, FAKE_HERDR);
    chmodSync(herdrApp, 0o755);
  }
  if (record) writeFileSync(join(data, "original-apps.tsv"), record);
  const env = {
    PATH: `${bin}:/usr/bin:/bin`,
    FAKE_STATE: state,
    SIDE_VIEWER_DATA: data,
    SIDE_VIEWER_HERDR_APP: herdrApp,
    SIDE_VIEWER_ROUTER_ID: "test.side-viewer-router",
  };
  const lines = (name) => (existsSync(join(state, name)) ? readFileSync(join(state, name), "utf8").trimEnd().split("\n") : []);
  return {
    open: (file, front, extra = {}) => spawnSync("/bin/sh", [join(here, "open.sh"), file, front], { env: { ...env, ...extra }, encoding: "utf8" }),
    herdrSays: (out, code = 0) => {
      writeFileSync(join(state, "herdr-out"), out);
      writeFileSync(join(state, "herdr-exit"), String(code));
    },
    herdrHangs: (seconds) => writeFileSync(join(state, "herdr-sleep"), String(seconds)),
    // What herdr-app and `open` were called with, one argument per entry.
    herdrArgs: () => lines("herdr.log"),
    openArgs: () => lines("open.log"),
  };
}

test("with Herdr in front, the file opens in a side viewer pane split to the right", () => {
  const w = world();
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.herdrArgs(), ["do", "pane.split", "--direction", "right", "--mod", "side-viewer", "--props", '{"file":"/work/notes/plan.md"}']);
  assert.deepEqual(w.openArgs(), []);
});

test("with another app in front, the file goes to its original app and no viewer opens", () => {
  const w = world({ record: "md\tcom.example.Notes\n" });
  const r = w.open("/work/notes/plan.md", "/System/Library/CoreServices/Finder.app");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.openArgs(), ["-b", "com.example.Notes", "/work/notes/plan.md"]);
  assert.deepEqual(w.herdrArgs(), []);
});

test("the running Herdr is also recognised by the name herdr-app", () => {
  const w = world();
  w.open("/work/notes/plan.md", "herdr-app");
  assert.equal(w.herdrArgs()[1], "pane.split");
  assert.deepEqual(w.openArgs(), []);
});

test("without a herdr-app program, the file goes to its original app", () => {
  const w = world({ herdr: false, record: "md\tcom.example.Notes\n" });
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.openArgs(), ["-b", "com.example.Notes", "/work/notes/plan.md"]);
});

test("when the split command answers with an error, the file goes to its original app", () => {
  const w = world();
  w.herdrSays('{ "error": "no focused pane" }', 1);
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(w.herdrArgs()[1], "pane.split");
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
});

test("an error in the answer counts even when the command exits 0", () => {
  const w = world();
  w.herdrSays('{ "error": "unknown mod side-viewer" }', 0);
  w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
});

test("a failing exit code counts even without an error in the answer", () => {
  const w = world();
  w.herdrSays("", 1);
  w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
});

test("when Herdr does not answer in time, the file goes to its original app", () => {
  const w = world();
  w.herdrHangs(5);
  const started = Date.now();
  const r = w.open("/work/notes/plan.md", HERDR_FRONT, { SIDE_VIEWER_TIMEOUT: "1" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(Date.now() - started < 4000, "gave up before herdr-app finished");
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
});

test("a path with spaces, quotes, a backslash and Korean reaches the viewer and the original app intact", () => {
  const file = '/work/내 문서/it\'s "final" a\\b 계획.md';
  const w = world();
  w.open(file, HERDR_FRONT);
  const args = w.herdrArgs();
  assert.equal(args.length, 8);
  assert.deepEqual(JSON.parse(args[7]), { file });

  const other = world({ record: "md\tcom.example.Notes\n" });
  other.open(file, "Finder");
  assert.deepEqual(other.openArgs(), ["-b", "com.example.Notes", file]);
});

test("with no app known to be in front, the file goes to its original app", () => {
  const w = world();
  w.open("/work/notes/plan.md", "");
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
  assert.deepEqual(w.herdrArgs(), []);
});
