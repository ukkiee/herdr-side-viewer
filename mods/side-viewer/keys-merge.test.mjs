// node --test: merging the keys the mod expects into the person's keys.json, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeKeys } from "./keys-merge.js";

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
});

test("merging twice leaves one line and the second time writes nothing", () => {
  const once = mergeKeys(JSON.stringify(person), wanted);
  const twice = mergeKeys(once.text, wanted);
  assert.equal(twice.text, null);
  assert.equal(once.text.split('"cmd-o"').length - 1, 1);
});

test("a keys.json without a global section gets one", () => {
  const result = mergeKeys('{ "terminal": { "ctrl-1": "terminal" } }', wanted);
  assert.deepEqual(JSON.parse(result.text), {
    terminal: { "ctrl-1": "terminal" },
    global: { "cmd-o": "mod.open:side-viewer" },
  });
});
