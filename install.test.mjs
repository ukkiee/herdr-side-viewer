// node --test install.test.mjs (or bun test install.test.mjs): install.mjs against a stand-in
// app home and a stand-in herdr-app, in temporary folders only: the order of its steps, where it
// stops having changed nothing, how it copies the mod, how it merges keys and which notes it
// prints.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { install, mergeKeys, replaceKeys, atLeast } from "./install.mjs";

// replaceKeys writes the merged text over the person's keys.json the way install.mjs does.
test("replacing keys.json keeps its permissions, and a link stays a link", () => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "side-viewer-keys-"));
  try {
    const real = path.join(dir, "dotfiles", "keys.json"), link = path.join(dir, "keys.json");
    fs.mkdirSync(path.dirname(real));
    fs.writeFileSync(real, "{}\n", { mode: 0o600 });
    fs.chmodSync(real, 0o600);
    fs.symlinkSync(real, link);
    replaceKeys({ fs, path }, link, '{"global":{}}\n', 4242);
    assert.equal(fs.readFileSync(link, "utf8"), '{"global":{}}\n');
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
    assert.equal(fs.statSync(real).mode & 0o777, 0o600);
    assert.deepEqual(fs.readdirSync(path.dirname(real)), ["keys.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a keys.json readable by others stays so", () => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "side-viewer-keys-"));
  try {
    const file = path.join(dir, "keys.json");
    fs.writeFileSync(file, "{}\n");
    fs.chmodSync(file, 0o644);
    replaceKeys({ fs, path }, file, "{ }\n", 4242);
    assert.equal(fs.statSync(file).mode & 0o777, 0o644);
    assert.equal(fs.readFileSync(file, "utf8"), "{ }\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The binding the mod expects: cmd-o in global opens the path picker.
const wanted = { global: { "cmd-o": "mod.open:side-viewer" } };

test("without a keys.json nothing is written and the line to add by hand is given", () => {
  const result = mergeKeys(null, wanted);
  assert.equal(result.text, null);
  assert.ok(result.lines.some((line) => line.includes('"cmd-o": "mod.open:side-viewer"')));
});

// A keys.json shaped like the example in Herdr's AGENTS.md ("Keys: keys.json").
const person = {
  global: {
    "ctrl-shift-t": "tab.new",
    "ctrl-shift-o": "pane.split:right",
    "alt-1": "space.select:1",
    "ctrl-shift-r": { command: "layout.resize", args: { id: "sidebar", px: 240 } },
  },
  terminal: { "ctrl-shift-c": "terminal.copy", "ctrl-left": "send:\u001bb", "ctrl-1": "terminal" },
  "layout:terminals": { "ctrl-shift-pagedown": "space.next" },
  "mod:editor": { "ctrl-s": "editor.save" },
};

test("a free cmd-o is added to global and every other key and section stays as it was", () => {
  const result = mergeKeys(JSON.stringify(person, null, 2), wanted);
  const written = JSON.parse(result.text);
  assert.deepEqual(written, {
    global: {
      "ctrl-shift-t": "tab.new",
      "ctrl-shift-o": "pane.split:right",
      "alt-1": "space.select:1",
      "ctrl-shift-r": { command: "layout.resize", args: { id: "sidebar", px: 240 } },
      "cmd-o": "mod.open:side-viewer",
    },
    terminal: { "ctrl-shift-c": "terminal.copy", "ctrl-left": "send:\u001bb", "ctrl-1": "terminal" },
    "layout:terminals": { "ctrl-shift-pagedown": "space.next" },
    "mod:editor": { "ctrl-s": "editor.save" },
  });
  assert.ok(result.lines.some((line) => line.includes("cmd-o")));
});

test("a keys.json that already has the line is left as it is", () => {
  const text = '{\n  "global": { "cmd-o": "mod.open:side-viewer", "alt-1": "space.select:1" }\n}\n';
  const result = mergeKeys(text, wanted);
  assert.equal(result.text, null);
  assert.ok(result.lines.some((line) => line.includes("cmd-o")), "says the key is already there");
});

test("merging twice leaves one line and the second time writes nothing", () => {
  const once = mergeKeys(JSON.stringify(person), wanted);
  const twice = mergeKeys(once.text, wanted);
  assert.equal(twice.text, null);
  assert.equal(once.text.split('"cmd-o"').length - 1, 1);
});

// cmd-o bound to another action in any section stays the person's, and they are told.
for (const [section, action] of [
  ["global", "app.palette"],
  ["terminal", "terminal"],
  ["layout:terminals", "space.next"],
  ["mod:editor", { command: "editor.open", args: {} }],
]) {
  test(`cmd-o bound in ${section} is left as it is and the person is told`, () => {
    const keys = { global: { "alt-1": "space.select:1" } };
    (keys[section] ??= {})["cmd-o"] = action;
    const result = mergeKeys(JSON.stringify(keys), wanted);
    assert.equal(result.text, null);
    const told = result.lines.join("\n");
    assert.match(told, /cmd-o/);
    assert.ok(told.includes(section), `names the section: ${told}`);
  });
}

test("a keys.json that is not valid JSON is not written and the line to add by hand is given", () => {
  const result = mergeKeys('{ "global": { "alt-1": "space.select:1", }', wanted);
  assert.equal(result.text, null);
  assert.ok(result.lines.some((line) => line.includes('"cmd-o": "mod.open:side-viewer"')));
});

test("a keys.json that is JSON but not an object of sections is not written", () => {
  for (const text of ["null", "[]", '{ "global": "cmd-o" }']) {
    const result = mergeKeys(text, wanted);
    assert.equal(result.text, null, text);
    assert.ok(result.lines.some((line) => line.includes('"cmd-o": "mod.open:side-viewer"')), text);
  }
});

test("a keys.json without a global section gets one", () => {
  const result = mergeKeys('{ "terminal": { "ctrl-1": "terminal" } }', wanted);
  assert.deepEqual(JSON.parse(result.text), {
    terminal: { "ctrl-1": "terminal" },
    global: { "cmd-o": "mod.open:side-viewer" },
  });
});

test("a version is new enough from 0.1.17 on", () => {
  for (const version of ["0.1.17", "0.1.18", "0.2.0", "1.0", "0.1.17-beta", "0.1.20.3"]) assert.equal(atLeast(version, "0.1.17"), true, version);
  for (const version of ["0.1.16", "0.0.99", "0.1", "", "v0.1.18", "nothing"]) assert.equal(atLeast(version, "0.1.17"), false, version);
});

// ---- install, against a stand-in repository, app home and herdr-app

const put = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

// Every file under dir, in subfolders too, hidden ones included.
const names = (dir, rel = "") => (fs.existsSync(`${dir}/${rel}`) ? fs.readdirSync(`${dir}/${rel}`, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? names(dir, `${rel}${e.name}/`) : [`${rel}${e.name}`])).sort() : []);
// Every file with its bytes: what "nothing was changed" is checked against.
const snapshot = (dir) => Object.fromEntries(names(dir).map((n) => [n, fs.readFileSync(`${dir}/${n}`, "utf8")]));

const KEYS = { global: { "cmd-o": "mod.open:side-viewer" } };
const INSTALLED = ["core/app/machine.js", "gpui-kit.d.ts", "icons/x.svg", "link.js", "main.js", "mod.json"];

// A repository (here) whose mod has modules in subfolders, tests and the file herdr-app check
// writes, and an app home Herdr has opened: its keys.json and the mod's data folder are there.
const withSetup = (fn) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "side-viewer-install-")));
  try {
    const here = `${dir}/repo`, home = `${dir}/home`;
    const source = `${here}/mods/side-viewer`;
    put(`${source}/main.js`, "export default 1;\n");
    put(`${source}/link.js`, "export default 2;\n");
    put(`${source}/mod.json`, "{}\n");
    put(`${source}/gpui-kit.d.ts`, "declare module 'gpui-kit';\n");
    put(`${source}/core/app/machine.js`, "export const machine = 1;\n");
    put(`${source}/core/app/machine.test.mjs`, "the test of machine.js\n");
    put(`${source}/layers.test.mjs`, "the layer test\n");
    put(`${source}/icons/x.svg`, "<svg/>\n");
    put(`${here}/keys.json`, JSON.stringify(KEYS, null, 2) + "\n");
    put(`${home}/keys.json`, JSON.stringify({ global: { "alt-1": "space.select:1" } }, null, 2) + "\n");
    put(`${home}/data/side-viewer/request.json`, "{}\n");
    fn({ dir, here, home, source, mod: `${home}/mods/side-viewer`, router: `${dir}/Side Viewer Router.app` });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

// A stand-in for herdr-app: answers --version, check and status as Herdr does and records each
// call with how its output was to be shown.
const fakeHerdr = ({ version = "herdr-app 0.1.18\n", missing = false, check = 0, layout = "mine" } = {}) => {
  const calls = [];
  const herdr = (args, output) => {
    calls.push(`${args.join(" ")} [${output}]`);
    if (missing) return { code: 127, stdout: "", missing: true };
    if (args[0] === "--version") return { code: 0, stdout: version, missing: false };
    if (args[0] === "check") return { code: check, stdout: "", missing: false };
    if (args[0] === "status") {
      if (layout === null) return { code: 1, stdout: "", missing: false };
      return { code: 0, stdout: JSON.stringify({ zoom: 1, layout, floats: {} }, null, 2) + "\n", missing: false };
    }
    return { code: 2, stdout: "", missing: false };
  };
  return { herdr, calls };
};

const run = (paths, herdr, { useFs = fs, platform = "darwin" } = {}) => {
  const out = [], err = [];
  const code = install({
    fs: useFs, path, herdr, platform, here: paths.here, home: paths.home, router: paths.router, pid: 4242,
    log: (l) => out.push(l), warn: (l) => err.push(l),
  });
  return { code, out, err };
};

// fs with each write, rename and removal recorded in order, as "op path-from-root".
const spyFs = (root, ops) => {
  const rel = (p) => p.slice(root.length + 1);
  return {
    ...fs,
    writeFileSync: (p, ...a) => { ops.push(`write ${rel(p)}`); return fs.writeFileSync(p, ...a); },
    renameSync: (a, b) => { ops.push(`rename ${rel(b)}`); return fs.renameSync(a, b); },
    rmSync: (p, ...a) => { ops.push(`rm ${rel(p)}`); return fs.rmSync(p, ...a); },
    unlinkSync: (p) => { ops.push(`unlink ${rel(p)}`); return fs.unlinkSync(p); },
  };
};

test("a first install checks Herdr, copies the mod without its tests, merges the key and says Installed.", () => {
  withSetup((paths) => {
    const { herdr, calls } = fakeHerdr();
    const r = run(paths, herdr);
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.deepEqual(calls, ["--version [captured]", `check ${paths.source} [shown]`, "status [captured]"]);
    assert.deepEqual(names(paths.mod), INSTALLED, "the mod without its tests, subfolders included");
    assert.deepEqual(r.out, [
      "6 files updated, 0 already the same.",
      `Shortcut keys (${paths.home}/keys.json):`,
      '  cmd-o → "mod.open:side-viewer" (global)',
      "",
      "Installed.",
    ]);
    assert.deepEqual(r.err, []);
    assert.deepEqual(JSON.parse(fs.readFileSync(`${paths.home}/keys.json`, "utf8")), { global: { "alt-1": "space.select:1", "cmd-o": "mod.open:side-viewer" } });
    assert.equal(fs.readFileSync(`${paths.home}/data/side-viewer/request.json`, "utf8"), "{}\n", "the data folder is not touched");
  });
});

test("installing again writes, renames and removes nothing", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    const before = snapshot(paths.home), ops = [];
    const r = run(paths, fakeHerdr().herdr, { useFs: spyFs(paths.home, ops) });
    assert.equal(r.code, 0);
    assert.deepEqual(ops, []);
    assert.equal(r.out[0], "0 files updated, 6 already the same.");
    assert.equal(r.out[2], '  cmd-o → "mod.open:side-viewer" (global): already there.');
    assert.deepEqual(snapshot(paths.home), before);
  });
});

test("only a changed file is written, and what the repository does not hold is removed after the writes", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    put(`${paths.source}/core/app/machine.js`, "export const machine = 2;\n");
    put(`${paths.source}/core/domain/rules.js`, "export const rules = 1;\n");
    // What an older version left: a module, a folder, and a test an older install copied.
    put(`${paths.mod}/old.js`, "old\n");
    put(`${paths.mod}/old-folder/x.js`, "old\n");
    put(`${paths.mod}/core/app/machine.test.mjs`, "old test\n");
    const ops = [];
    const r = run(paths, fakeHerdr().herdr, { useFs: spyFs(paths.home, ops) });
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.equal(r.out[0], "2 files updated, 5 already the same, 3 removed.");
    const copied = ops.filter((op) => op.includes("mods/side-viewer/"));
    assert.deepEqual(copied.slice(0, 4), [
      "write mods/side-viewer/core/app/.machine.js.4242.tmp",
      "write mods/side-viewer/core/domain/.rules.js.4242.tmp",
      "rename mods/side-viewer/core/app/machine.js",
      "rename mods/side-viewer/core/domain/rules.js",
    ]);
    assert.deepEqual(copied.slice(4).sort(), [
      "rm mods/side-viewer/core/app/machine.test.mjs",
      "rm mods/side-viewer/old-folder",
      "rm mods/side-viewer/old.js",
    ]);
    assert.deepEqual(names(paths.mod), [...INSTALLED, "core/domain/rules.js"].sort());
    assert.equal(fs.readFileSync(`${paths.mod}/core/app/machine.js`, "utf8"), "export const machine = 2;\n");
    assert.equal(fs.readFileSync(`${paths.home}/data/side-viewer/request.json`, "utf8"), "{}\n");
  });
});

test("a write that fails leaves no half file and the installed mod as it was", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    put(`${paths.source}/main.js`, "export default 10;\n");
    put(`${paths.source}/link.js`, "export default 20;\n");
    put(`${paths.mod}/old.js`, "old\n");
    const before = snapshot(paths.home);
    let writes = 0;
    const failing = { ...fs, writeFileSync: (...a) => { if (++writes === 2) throw new Error("ENOSPC: no space left on device"); return fs.writeFileSync(...a); } };
    const r = run(paths, fakeHerdr().herdr, { useFs: failing });
    assert.equal(r.code, 1);
    assert.deepEqual(r.err, [`Cannot copy to ${paths.mod}: ENOSPC: no space left on device. Files already there are whole.`]);
    assert.deepEqual(snapshot(paths.home), before, "no temporary file, nothing removed");
  });
});

// Each check stops before anything is written; an older install stays as it was.
for (const [name, options, err, calls] of [
  ["not on macOS", { platform: "linux" }, ["Side Viewer is macOS only."], []],
  ["herdr-app not on PATH", { herdr: { missing: true } },
    ["herdr-app not found on PATH: install the Herdr app (https://herdr.dev), then run this again."], ["--version [captured]"]],
  ["Herdr older than 0.1.17", { herdr: { version: "herdr-app 0.1.16\n" } },
    ["Side Viewer needs Herdr 0.1.17 or newer; herdr-app says '0.1.16'. Update Herdr (Settings > Updates), then run this again."], ["--version [captured]"]],
  ["a herdr-app that prints no version", { herdr: { version: "" } },
    ["Side Viewer needs Herdr 0.1.17 or newer; herdr-app says 'nothing'. Update Herdr (Settings > Updates), then run this again."], ["--version [captured]"]],
]) {
  test(`${name}: stops with a line on stderr and changes nothing`, () => {
    withSetup((paths) => {
      put(`${paths.mod}/old.js`, "an older install\n");
      const before = snapshot(paths.home);
      const fake = fakeHerdr(options.herdr);
      const r = run(paths, fake.herdr, { platform: options.platform });
      assert.equal(r.code, 1);
      assert.deepEqual(r.err, err);
      assert.deepEqual(r.out, []);
      assert.deepEqual(fake.calls, calls);
      assert.deepEqual(snapshot(paths.home), before);
    });
  });
}

test("a failed herdr-app check stops with its exit code and changes nothing", () => {
  withSetup((paths) => {
    put(`${paths.mod}/old.js`, "an older install\n");
    const before = snapshot(paths.home);
    const fake = fakeHerdr({ check: 3 });
    const r = run(paths, fake.herdr);
    assert.equal(r.code, 3);
    assert.deepEqual(fake.calls, ["--version [captured]", `check ${paths.source} [shown]`]);
    assert.deepEqual([r.out, r.err], [[], []]);
    assert.deepEqual(snapshot(paths.home), before);
  });
});

test("without a keys.json none is made and the line to add by hand is printed", () => {
  withSetup((paths) => {
    fs.rmSync(`${paths.home}/keys.json`);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0);
    assert.deepEqual(r.out.slice(1, 4), [
      `Shortcut keys (${paths.home}/keys.json):`,
      "  No keys.json yet: once Herdr has written one, add by hand:",
      '    in "global": "cmd-o": "mod.open:side-viewer"',
    ]);
    assert.equal(fs.existsSync(`${paths.home}/keys.json`), false);
  });
});

test("a keys.json that cannot be read is left as it is and the repository's keys are printed", () => {
  withSetup((paths) => {
    fs.rmSync(`${paths.home}/keys.json`);
    fs.mkdirSync(`${paths.home}/keys.json`);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0);
    assert.equal(r.err.length, 1);
    assert.match(r.err[0], /EISDIR/);
    assert.deepEqual(r.out.slice(1), [
      `Shortcut keys (${paths.home}/keys.json):`,
      "keys.json was not changed. Add these keys to it by hand:",
      JSON.stringify(KEYS, null, 2),
      "",
      "Installed.",
    ]);
  });
});

for (const layout of ["main", "terminals", "win98"]) {
  test(`the layout ${layout}, one Herdr ships, gets a note on cloning it`, () => {
    withSetup((paths) => {
      const r = run(paths, fakeHerdr({ layout }).herdr);
      assert.equal(r.code, 0);
      assert.deepEqual(r.out.slice(-4), [
        `Note: the layout in use, '${layout}', is one Herdr ships, so cmd-clicks do not reach the viewer yet.`,
        `  Clone it with: herdr-app do layout.clone --name ${layout}   (Herdr shows the copy and turns the viewer on there)`,
        "",
        "Installed.",
      ]);
    });
  });
}

test("with no Herdr window the layout is not checked and the note says so", () => {
  withSetup((paths) => {
    const r = run(paths, fakeHerdr({ layout: null }).herdr);
    assert.equal(r.code, 0);
    assert.deepEqual(r.out.slice(-3), [
      'Note: the Herdr window is not open, so the layout was not checked. cmd-clicks reach the viewer only in a personal layout (README.md, "Install").',
      "",
      "Installed.",
    ]);
  });
});

test("an older version's router app gets a note on giving its extensions back", () => {
  withSetup((paths) => {
    fs.mkdirSync(paths.router);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0);
    assert.deepEqual(r.out.slice(-5), [
      "Note: the router app of an older version is still installed. Give its extensions back, then delete it:",
      `  "${paths.router}/Contents/MacOS/SideViewerRouter" --restore`,
      '  (README.md, "Upgrading from the router")',
      "",
      "Installed.",
    ]);
  });
});

// Every entry under dir, links as links and folders as folders, with what each file holds:
// what "nothing was changed there" is checked against where links are in play.
const entries = (dir) => {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(rel ? `${dir}/${rel}` : dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name, p = `${dir}/${r}`;
      if (e.isSymbolicLink()) out[r] = `-> ${fs.readlinkSync(p)}`;
      else if (e.isDirectory()) { out[r] = "<dir>"; walk(r); }
      else out[r] = fs.readFileSync(p, "utf8");
    }
  };
  if (fs.existsSync(dir)) walk("");
  return out;
};

// ---- where the mod goes: links and folders that overlap

test("a mod folder that is a link to this repository's mod stops before anything is written", () => {
  withSetup((paths) => {
    fs.mkdirSync(`${paths.home}/mods`);
    fs.symlinkSync(paths.source, paths.mod);
    const before = entries(paths.dir);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 1);
    assert.deepEqual(r.out, []);
    assert.deepEqual(r.err, [`${paths.mod} is a link to this repository's mod (${paths.source}), so Herdr already runs the mod from there: nothing was copied. To install a copy instead, remove the link (rm "${paths.mod}") and run this again.`]);
    assert.deepEqual(entries(paths.dir), before, "the repository's tests are still there");
  });
});

test("a mod folder that is a link to another folder stops and leaves that folder as it was", () => {
  withSetup((paths) => {
    put(`${paths.dir}/personal/notes.md`, "mine\n");
    put(`${paths.dir}/personal/core/app/plan.md`, "mine too\n");
    fs.mkdirSync(`${paths.home}/mods`);
    fs.symlinkSync(`${paths.dir}/personal`, paths.mod);
    const before = entries(paths.dir);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 1);
    assert.deepEqual(r.err, [`${paths.mod} is a link to ${paths.dir}/personal: nothing was copied, as installing removes what the mod does not hold. Remove the link (rm "${paths.mod}") and run this again.`]);
    assert.deepEqual(entries(paths.dir), before);
  });
});

test("a mods folder that is a link to the repository's mods stops before anything is written", () => {
  withSetup((paths) => {
    fs.symlinkSync(`${paths.here}/mods`, `${paths.home}/mods`);
    const before = entries(paths.dir);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 1);
    assert.deepEqual(r.err, [`${paths.mod} and this repository's mod (${paths.source}) are the same folder or one holds the other: nothing was copied. Install into an app home outside the repository's mod.`]);
    assert.deepEqual(entries(paths.dir), before);
  });
});

test("an app home inside the repository's mod stops before anything is written", () => {
  withSetup((paths) => {
    const home = `${paths.source}/home`;
    const before = entries(paths.dir);
    const r = run({ ...paths, home }, fakeHerdr().herdr);
    assert.equal(r.code, 1);
    assert.match(r.err.join("\n"), /are the same folder or one holds the other: nothing was copied/);
    assert.deepEqual(entries(paths.dir), before);
  });
});

test("a repository inside the installed mod stops before anything is written", () => {
  withSetup((paths) => {
    const here = `${paths.mod}/repo`;
    fs.cpSync(paths.here, here, { recursive: true });
    const before = entries(paths.dir);
    const r = run({ ...paths, here }, fakeHerdr().herdr);
    assert.equal(r.code, 1);
    assert.match(r.err.join("\n"), /are the same folder or one holds the other: nothing was copied/);
    assert.deepEqual(entries(paths.dir), before);
  });
});

test("a mods folder that is a link to a folder of mods installs there and leaves the other mods", () => {
  withSetup((paths) => {
    put(`${paths.dir}/dotfiles/mods/other/main.js`, "another mod\n");
    fs.symlinkSync(`${paths.dir}/dotfiles/mods`, `${paths.home}/mods`);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.deepEqual(names(`${paths.dir}/dotfiles/mods/side-viewer`), INSTALLED);
    assert.equal(fs.readFileSync(`${paths.dir}/dotfiles/mods/other/main.js`, "utf8"), "another mod\n");
  });
});

test("a link inside the installed mod is replaced or removed, never followed", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    put(`${paths.dir}/outside/app/machine.js`, "outside\n");
    put(`${paths.dir}/outside/app/keep.md`, "keep\n");
    put(`${paths.dir}/outside-main.js`, "export default 1;\n");
    fs.rmSync(`${paths.mod}/core`, { recursive: true });
    fs.symlinkSync(`${paths.dir}/outside`, `${paths.mod}/core`);
    fs.rmSync(`${paths.mod}/main.js`);
    fs.symlinkSync(`${paths.dir}/outside-main.js`, `${paths.mod}/main.js`);
    fs.symlinkSync(`${paths.dir}/outside`, `${paths.mod}/extra`);
    const outside = entries(`${paths.dir}/outside`);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.deepEqual(entries(`${paths.dir}/outside`), outside);
    assert.equal(fs.readFileSync(`${paths.dir}/outside-main.js`, "utf8"), "export default 1;\n");
    assert.equal(fs.lstatSync(`${paths.mod}/core`).isDirectory(), true);
    assert.equal(fs.lstatSync(`${paths.mod}/main.js`).isFile(), true);
    assert.equal(fs.existsSync(`${paths.mod}/extra`), false);
    assert.deepEqual(names(paths.mod), INSTALLED);
    assert.equal(fs.readFileSync(`${paths.mod}/core/app/machine.js`, "utf8"), "export const machine = 1;\n");
  });
});

// ---- files written beside their targets

test("a file already at the temporary name beside keys.json is neither written through nor removed", () => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "side-viewer-keys-"));
  try {
    const file = path.join(dir, "keys.json"), theirs = path.join(dir, "theirs.json");
    fs.writeFileSync(file, "{}\n");
    fs.writeFileSync(theirs, "theirs\n");
    fs.symlinkSync(theirs, path.join(dir, ".keys.json.4242.tmp"));
    const failing = { ...fs, renameSync: () => { throw new Error("EIO: i/o error, rename"); } };
    assert.throws(() => replaceKeys({ fs: failing, path }, file, "{ }\n", 4242), /EIO/);
    assert.deepEqual(fs.readdirSync(dir).sort(), [".keys.json.4242.tmp", "keys.json", "theirs.json"], "only the file this run made is gone");
    assert.equal(fs.readFileSync(theirs, "utf8"), "theirs\n");
    replaceKeys({ fs, path }, file, "{ }\n", 4242);
    assert.equal(fs.readFileSync(file, "utf8"), "{ }\n");
    assert.equal(fs.readFileSync(theirs, "utf8"), "theirs\n");
    assert.deepEqual(fs.readdirSync(dir).sort(), [".keys.json.4242.tmp", "keys.json", "theirs.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a file already at a temporary name in the mod is neither written through nor cleaned up by a failed copy", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    put(`${paths.source}/main.js`, "export default 10;\n");
    put(`${paths.dir}/theirs.js`, "theirs\n");
    fs.symlinkSync(`${paths.dir}/theirs.js`, `${paths.mod}/.main.js.4242.tmp`);
    const failing = { ...fs, renameSync: () => { throw new Error("EIO: i/o error, rename"); } };
    const r = run(paths, fakeHerdr().herdr, { useFs: failing });
    assert.equal(r.code, 1);
    assert.equal(fs.lstatSync(`${paths.mod}/.main.js.4242.tmp`).isSymbolicLink(), true, "not this run's to remove");
    assert.equal(fs.readFileSync(`${paths.dir}/theirs.js`, "utf8"), "theirs\n");
    assert.deepEqual(names(paths.mod).filter((n) => n.endsWith(".tmp")), [".main.js.4242.tmp"]);
    assert.equal(fs.readFileSync(`${paths.mod}/main.js`, "utf8"), "export default 1;\n");
  });
});

// ---- upgrades that change a name's case or an entry's kind

// macOS volumes are case-insensitive unless formatted otherwise; the test needs one that is.
const caseInsensitive = (() => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "side-viewer-case-"));
  try { fs.writeFileSync(`${dir}/a`, ""); return fs.existsSync(`${dir}/A`); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

test("a file or folder whose name changes only in case is renamed, not removed", { skip: !caseInsensitive && "needs a case-insensitive volume" }, () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    const recase = (from, to) => { fs.renameSync(from, `${from}.recase`); fs.renameSync(`${from}.recase`, to); };
    recase(`${paths.source}/icons/x.svg`, `${paths.source}/icons/X.svg`);
    recase(`${paths.source}/core/app`, `${paths.source}/core/App`);
    put(`${paths.source}/core/App/machine.js`, "export const machine = 2;\n");
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.deepEqual(names(paths.mod), ["core/App/machine.js", "gpui-kit.d.ts", "icons/X.svg", "link.js", "main.js", "mod.json"]);
    assert.equal(fs.readFileSync(`${paths.mod}/core/App/machine.js`, "utf8"), "export const machine = 2;\n");
    assert.equal(fs.readFileSync(`${paths.mod}/icons/X.svg`, "utf8"), "<svg/>\n");
    assert.equal(r.out[0], "1 file updated, 5 already the same.");
  });
});

// The installed mod without what a person keeps beside it, as entries() lists it.
const installedLike = (paths) => Object.fromEntries(Object.entries(entries(paths.source)).filter(([n]) => !n.endsWith(".test.mjs")));

test("a file that became a folder and a folder that became a file are installed", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    put(`${paths.mod}/y`, "an older file\n");
    put(`${paths.mod}/z/module.js`, "an older module\n");
    put(`${paths.source}/y/module.js`, "export const y = 1;\n");
    put(`${paths.source}/z`, "a file now\n");
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.deepEqual(entries(paths.mod), installedLike(paths));
    const again = run(paths, fakeHerdr().herdr);
    assert.equal(again.out[0], "0 files updated, 8 already the same.");
  });
});

test("a copy that fails while an entry changes kind is finished by running again", () => {
  withSetup((paths) => {
    run(paths, fakeHerdr().herdr);
    put(`${paths.mod}/y`, "an older file\n");
    put(`${paths.mod}/z/module.js`, "an older module\n");
    put(`${paths.source}/y/module.js`, "export const y = 1;\n");
    put(`${paths.source}/z`, "a file now\n");
    const failing = { ...fs, writeFileSync: () => { throw new Error("ENOSPC: no space left on device"); } };
    assert.equal(run(paths, fakeHerdr().herdr, { useFs: failing }).code, 1);
    const r = run(paths, fakeHerdr().herdr);
    assert.equal(r.code, 0, r.err.join("\n"));
    assert.deepEqual(entries(paths.mod), installedLike(paths));
  });
});

// The script as people run it, with a herdr-app on PATH that answers like Herdr and records
// its calls. It runs on macOS only, where the install goes past its first check.
const macOnly = { skip: process.platform !== "darwin" && "install.mjs installs on macOS only" };
const here = path.dirname(fileURLToPath(import.meta.url));

// cli(paths, script) → { r, calls }: runs `node <script>` with the stand-in herdr-app on PATH.
const cli = (paths, script) => {
  const bin = `${paths.dir}/bin`, calls = `${paths.dir}/calls`;
  put(`${bin}/herdr-app`, [
    "#!/bin/sh",
    'echo "$*" >> "$HERDR_FAKE_CALLS"',
    'case "$1" in',
    '  --version) echo "herdr-app 0.1.18" ;;',
    `  status) printf '{\\n  "layout": "main"\\n}\\n' ;;`,
    "esac",
    "",
  ].join("\n"));
  fs.chmodSync(`${bin}/herdr-app`, 0o755);
  const r = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HERDR_APP_HOME: paths.home, SIDE_VIEWER_ROUTER_APP: paths.router, HERDR_FAKE_CALLS: calls },
  });
  return { r, calls: fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").trim().split("\n") : [] };
};

test("running install.mjs installs this repository's mod into HERDR_APP_HOME", macOnly, () => {
  withSetup((paths) => {
    fs.mkdirSync(paths.router);
    const { r, calls } = cli(paths, `${here}/install.mjs`);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(calls, ["--version", `check ${here}/mods/side-viewer`, "status"]);
    const installed = names(paths.mod);
    assert.ok(installed.includes("main.js") && installed.includes("link.js") && installed.includes("mod.json"), installed.join(" "));
    assert.deepEqual(installed.filter((n) => n.endsWith(".test.mjs")), []);
    assert.match(r.stdout, /Note: the layout in use, 'main', is one Herdr ships/);
    assert.ok(r.stdout.includes(`"${paths.router}/Contents/MacOS/SideViewerRouter" --restore`));
    assert.match(r.stdout, /\nInstalled\.\n$/);
    // What Herdr runs is the repository's mod without its tests, every file byte for byte:
    // the mod reads extensions.json and its icons from the installed folder.
    const source = `${here}/mods/side-viewer`;
    const shipped = names(source).filter((n) => !n.endsWith(".test.mjs"));
    assert.deepEqual(installed, shipped);
    for (const n of shipped) assert.ok(fs.readFileSync(`${paths.mod}/${n}`).equals(fs.readFileSync(`${source}/${n}`)), n);
    for (const n of ["extensions.json", "main.js", "link.js", "mod.json"]) assert.ok(installed.includes(n), n);
    assert.ok(installed.some((n) => n.startsWith("icons/") && n.endsWith(".svg")), "the icons");
  });
});

// A checkout reached through a link, as `node ~/code/side-viewer/install.mjs` with ~/code a link.
test("running install.mjs through a link to the repository installs too", macOnly, () => {
  withSetup((paths) => {
    fs.symlinkSync(here, `${paths.dir}/checkout`);
    const { r } = cli(paths, `${paths.dir}/checkout/install.mjs`);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\nInstalled\.\n$/);
    assert.ok(names(paths.mod).includes("extensions.json"), names(paths.mod).join(" "));
  });
});
