// node --test: open.sh against a fake `herdr-app`, a fake `open` and a throwaway data folder.
// Nothing here reaches the real Herdr window or the real default apps.
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const HERDR_FRONT = "/Users/someone/Applications/Herdr.app";

// Stands in for herdr-app: logs one argument per line and an empty line after each call, then
// answers as the scene says. `side-viewer.show` wakes the scene's showing viewers before it
// answers, unless the scene keeps them asleep for the test to wake.
const FAKE_HERDR = `#!/bin/sh
{ for a in "$@"; do printf '%s\\n' "$a"; done; echo; } >> "$FAKE_STATE/herdr.log"
if [ "$2" = side-viewer.show ] && [ -e "$FAKE_STATE/viewers" ] && [ ! -e "$FAKE_STATE/viewers-asleep" ]; then
  "$FAKE_NODE" "$FAKE_STATE/viewers.mjs"
fi
[ -e "$FAKE_STATE/herdr-sleep" ] && sleep "$(cat "$FAKE_STATE/herdr-sleep")"
if [ "$2" = side-viewer.show ] && [ -e "$FAKE_STATE/show-out" ]; then cat "$FAKE_STATE/show-out"; exit 1; fi
cat "$FAKE_STATE/herdr-out" 2>/dev/null || echo '{ "pane": "p9" }'
exit "$(cat "$FAKE_STATE/herdr-exit" 2>/dev/null || echo 0)"
`;

// Stands in for the side viewers showing in the tab: each takes the waiting request the way
// main.js does, through request.js, and logs the file it would show.
const FAKE_VIEWERS = `
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { takeRequest } from ${JSON.stringify(pathToFileURL(join(here, "request.js")).href)};
const files = {
  read: async (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } },
  create: async (path, text) => writeFileSync(path, text, { flag: "wx" }),
};
const count = Number(readFileSync(process.env.FAKE_STATE + "/viewers", "utf8"));
for (let i = 0; i < count; i++) {
  const request = await takeRequest(files, { folder: process.env.SIDE_VIEWER_DATA, answered: null, now: Date.now() });
  if (request) appendFileSync(process.env.FAKE_STATE + "/viewer.log", request.file + "\\n");
}
`;

// Stands in for /usr/bin/open: logs one argument per line.
const FAKE_OPEN = `#!/bin/sh
for a in "$@"; do printf '%s\\n' "$a"; done >> "$FAKE_STATE/open.log"
`;

function world({ herdr = true, installed = true, record } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-open-"));
  const state = join(dir, "state");
  const data = join(dir, "data");
  const bin = join(dir, "bin");
  const appHome = join(dir, "herdr-home");
  for (const d of [state, data, bin, appHome]) mkdirSync(d);
  if (installed) {
    mkdirSync(join(appHome, "mods", "side-viewer"), { recursive: true });
    writeFileSync(join(appHome, "mods", "side-viewer", "main.js"), "");
  }
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
    HERDR_APP_HOME: appHome,
    SIDE_VIEWER_HERDR_APP: herdrApp,
    SIDE_VIEWER_ROUTER_ID: "test.side-viewer-router",
    FAKE_NODE: process.execPath,
  };
  const lines = (name) => (existsSync(join(state, name)) ? readFileSync(join(state, name), "utf8").trimEnd().split("\n") : []);
  return {
    dir,
    env,
    open: (file, front, extra = {}) => spawnSync("/bin/sh", [join(here, "open.sh"), file, front], { env: { ...env, ...extra }, encoding: "utf8" }),
    herdrSays: (out, code = 0) => {
      writeFileSync(join(state, "herdr-out"), out);
      writeFileSync(join(state, "herdr-exit"), String(code));
    },
    herdrHangs: (seconds) => writeFileSync(join(state, "herdr-sleep"), String(seconds)),
    // Side viewers showing in the current tab. `asleep` ones are not woken by the show command,
    // only by wakeViewers(), so a scene can wake them after open.sh has finished.
    viewersShowing: (count = 1, { asleep = false } = {}) => {
      writeFileSync(join(state, "viewers.mjs"), FAKE_VIEWERS);
      writeFileSync(join(state, "viewers"), String(count));
      if (asleep) writeFileSync(join(state, "viewers-asleep"), "");
    },
    wakeViewers: () => {
      const r = spawnSync(process.execPath, [join(state, "viewers.mjs")], { env, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
    },
    // The show command itself fails, as it may when no viewer is showing.
    showFails: (out) => writeFileSync(join(state, "show-out"), out),
    // What herdr-app was called with: one entry per call, one argument per item.
    herdrCalls: () => {
      const calls = [[]];
      for (const line of lines("herdr.log")) line === "" ? calls.push([]) : calls.at(-1).push(line);
      return calls.filter((call) => call.length);
    },
    // The arguments of the pane.split call, or undefined when no pane was opened.
    splitArgs() {
      return this.herdrCalls().find((call) => call[1] === "pane.split");
    },
    // The files the showing viewers took, in order.
    shownInViewer: () => lines("viewer.log"),
    // What `open` was called with, one argument per entry.
    openArgs: () => lines("open.log"),
  };
}

test("with Herdr in front, the file opens in a side viewer pane split to the right", () => {
  const w = world();
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.splitArgs(), ["do", "pane.split", "--direction", "right", "--mod", "side-viewer", "--props", '{"file":"/work/notes/plan.md"}']);
  assert.deepEqual(w.openArgs(), []);
});

test("a side viewer showing in the current tab takes the file, and no pane is opened", () => {
  const w = world();
  w.viewersShowing();
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.herdrCalls(), [["do", "side-viewer.show"]]);
  assert.deepEqual(w.shownInViewer(), ["/work/notes/plan.md"]);
  assert.deepEqual(w.openArgs(), []);
});

test("when no viewer answers, as when the only one is in another tab, a new pane is opened", () => {
  const w = world();
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.herdrCalls().map((call) => call[1]), ["side-viewer.show", "pane.split"]);
  assert.deepEqual(w.openArgs(), []);
});

test("when the show command itself fails, a new pane is still opened", () => {
  const w = world();
  w.showFails('{ "error": "no mod is showing" }');
  w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.ok(w.splitArgs());
  assert.deepEqual(w.openArgs(), []);
});

test("of two viewers showing in the current tab, one takes the file", () => {
  const w = world();
  w.viewersShowing(2);
  w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.deepEqual(w.shownInViewer(), ["/work/notes/plan.md"]);
  assert.equal(w.splitArgs(), undefined);
});

test("a viewer that wakes after the new pane was asked for does not take the file as well", () => {
  const w = world();
  w.viewersShowing(1, { asleep: true });
  w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.ok(w.splitArgs());
  // Well inside the 5 s a request stays fresh, so only the claimed answer stops the viewer.
  w.wakeViewers();
  assert.deepEqual(w.shownInViewer(), [], "the viewer took the file as well");
});

test("each file opened is a request of its own, so the same viewer takes one after another", () => {
  const w = world();
  w.viewersShowing();
  w.open("/work/a.md", HERDR_FRONT);
  w.open("/work/b.md", HERDR_FRONT);
  assert.deepEqual(w.shownInViewer(), ["/work/a.md", "/work/b.md"]);
  assert.equal(w.splitArgs(), undefined);
});

test("the request reaches a showing viewer even before the data folder exists", () => {
  const w = world();
  w.viewersShowing();
  const data = join(w.dir, "not-made-yet", "side-viewer");
  w.open("/work/notes/plan.md", HERDR_FRONT, { SIDE_VIEWER_DATA: data });
  assert.deepEqual(w.shownInViewer(), ["/work/notes/plan.md"]);
});

test("with another app in front, the file goes to its original app and no viewer opens", () => {
  const w = world({ record: "md\tcom.example.Notes\n" });
  const r = w.open("/work/notes/plan.md", "/System/Library/CoreServices/Finder.app");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.openArgs(), ["-b", "com.example.Notes", "/work/notes/plan.md"]);
  assert.deepEqual(w.herdrCalls(), []);
});

test("the running Herdr is also recognised by the name herdr-app", () => {
  const w = world();
  w.open("/work/notes/plan.md", "herdr-app");
  assert.ok(w.splitArgs());
  assert.deepEqual(w.openArgs(), []);
});

test("without a herdr-app program, the file goes to its original app", () => {
  const w = world({ herdr: false, record: "md\tcom.example.Notes\n" });
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.openArgs(), ["-b", "com.example.Notes", "/work/notes/plan.md"]);
});

test("while the side viewer mod is not installed in Herdr, the file goes to its original app", () => {
  const w = world({ installed: false });
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.herdrCalls(), []);
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
});

test("inside the built router app, where every script sits in one folder, both ways still work", () => {
  const w = world({ record: "md\tcom.example.Notes\n" });
  const resources = join(w.dir, "Resources");
  mkdirSync(resources);
  copyFileSync(join(here, "open.sh"), join(resources, "open.sh"));
  for (const name of ["open-original.sh", "lib.sh"]) copyFileSync(join(here, "router", name), join(resources, name));
  copyFileSync(join(here, "extensions.json"), join(resources, "extensions.json"));
  const run = (front) => spawnSync("/bin/sh", [join(resources, "open.sh"), "/work/notes/plan.md", front], { env: w.env, encoding: "utf8" });
  assert.equal(run(HERDR_FRONT).status, 0);
  assert.ok(w.splitArgs());
  assert.equal(run("Finder").status, 0);
  assert.deepEqual(w.openArgs(), ["-b", "com.example.Notes", "/work/notes/plan.md"]);
});

test("when the split command answers with an error, the file goes to its original app", () => {
  const w = world();
  w.herdrSays('{ "error": "no focused pane" }', 1);
  const r = w.open("/work/notes/plan.md", HERDR_FRONT);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(w.splitArgs());
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
  // One wait is enough: a Herdr that did not take the first command is not asked for a pane.
  assert.equal(w.herdrCalls().length, 1);
});

test("a viewer that wakes after Herdr was given up on does not take the file as well", () => {
  const w = world();
  w.herdrHangs(5);
  w.viewersShowing(1, { asleep: true });
  w.open("/work/notes/plan.md", HERDR_FRONT, { SIDE_VIEWER_TIMEOUT: "1" });
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
  // Well inside the 5 s a request stays fresh, so only the claimed answer stops the viewer.
  w.wakeViewers();
  assert.deepEqual(w.shownInViewer(), [], "the viewer took the file as well");
});

test("a path with spaces, quotes, a backslash and Korean reaches the viewer and the original app intact", () => {
  const file = '/work/내 문서/it\'s "final" a\\b 계획.md';
  const w = world();
  w.open(file, HERDR_FRONT);
  const args = w.splitArgs();
  assert.equal(args.length, 8);
  assert.deepEqual(JSON.parse(args[7]), { file });

  const showing = world();
  showing.viewersShowing();
  showing.open(file, HERDR_FRONT);
  assert.deepEqual(showing.shownInViewer(), [file]);

  const other = world({ record: "md\tcom.example.Notes\n" });
  other.open(file, "Finder");
  assert.deepEqual(other.openArgs(), ["-b", "com.example.Notes", file]);
});

test("with no app known to be in front, the file goes to its original app", () => {
  const w = world();
  w.open("/work/notes/plan.md", "");
  assert.deepEqual(w.openArgs(), ["-b", "com.apple.TextEdit", "/work/notes/plan.md"]);
  assert.deepEqual(w.herdrCalls(), []);
});
