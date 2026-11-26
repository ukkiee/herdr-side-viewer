import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "./markdown-blocks.js";
import { toggleCheckbox } from "./checkbox.js";

// The task items of a document, in order, as the rendering finds them.
function tasks(text) {
  const found = [];
  const walk = (blocks) => {
    for (const block of blocks) {
      if (block.type === "quote") walk(block.blocks);
      if (block.type !== "list") continue;
      for (const item of block.items) {
        if (item.kind === "task") found.push(item);
        walk(item.blocks);
      }
    }
  };
  walk(parseMarkdown(text).blocks);
  return found;
}

test("clicking an open box checks it, and a checked box, x or X, opens", () => {
  const text = "- [ ] open\n- [x] done\n* [X] DONE\n";
  const [open, done, big] = tasks(text);
  assert.equal(toggleCheckbox(text, open.line), "- [x] open\n- [x] done\n* [X] DONE\n");
  assert.equal(toggleCheckbox(text, done.line), "- [ ] open\n- [ ] done\n* [X] DONE\n");
  assert.equal(toggleCheckbox(text, big.line), "- [ ] open\n- [x] done\n* [ ] DONE\n");
});

test("only the item's own box changes, not a box written later in its text", () => {
  const text = "- [ ] read [ ] and [x] in the text\n";
  const [item] = tasks(text);
  assert.equal(toggleCheckbox(text, item.line), "- [x] read [ ] and [x] in the text\n");
});

test("a box inside a code block is not an item, and the lines around it stay as written", () => {
  const text = "# Plan\n\n```md\n- [ ] in code\n```\n\n- [ ] real\n";
  const found = tasks(text);
  assert.equal(found.length, 1);
  assert.equal(toggleCheckbox(text, found[0].line), "# Plan\n\n```md\n- [ ] in code\n```\n\n- [x] real\n");
});

test("boxes in quotes and nested lists change on their own source line", () => {
  const text = "> - [ ] quoted\n> > * [x] twice\n\n1. step\n   - [ ] under it\n2. - [X] same line\n";
  const [quoted, twice, under, same] = tasks(text);
  assert.equal(toggleCheckbox(text, quoted.line), "> - [x] quoted\n> > * [x] twice\n\n1. step\n   - [ ] under it\n2. - [X] same line\n");
  assert.equal(toggleCheckbox(text, twice.line), "> - [ ] quoted\n> > * [ ] twice\n\n1. step\n   - [ ] under it\n2. - [X] same line\n");
  assert.equal(toggleCheckbox(text, under.line), "> - [ ] quoted\n> > * [x] twice\n\n1. step\n   - [x] under it\n2. - [X] same line\n");
  assert.equal(toggleCheckbox(text, same.line), "> - [ ] quoted\n> > * [x] twice\n\n1. step\n   - [ ] under it\n2. - [ ] same line\n");
});

test("windows line endings and tabs stay as they were", () => {
  const text = "intro\r\n\r\n-\t[ ] tabbed\r\n- [x] last";
  const [tabbed, last] = tasks(text);
  assert.equal(toggleCheckbox(text, tabbed.line), "intro\r\n\r\n-\t[x] tabbed\r\n- [x] last");
  assert.equal(toggleCheckbox(text, last.line), "intro\r\n\r\n-\t[ ] tabbed\r\n- [ ] last");
});

test("a line without a box gives null", () => {
  assert.equal(toggleCheckbox("# Title\n- plain\n", 0), null);
  assert.equal(toggleCheckbox("# Title\n- plain\n", 1), null);
  assert.equal(toggleCheckbox("- [ ] one\n", 5), null);
});
