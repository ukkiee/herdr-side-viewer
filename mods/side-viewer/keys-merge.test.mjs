// node --test: merging the keys the mod expects into the person's keys.json, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { mergeKeys, replaceKeys } from "./keys-merge.js";

// replaceKeys writes the merged text over the person's keys.json the way install.sh does.
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

// The binding from the spec (AC-5): cmd-o in global opens the path picker.
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

// AC-5: cmd-o bound to another action in any section stays the person's, and they are told.
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
