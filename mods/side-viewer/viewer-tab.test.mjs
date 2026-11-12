// node --test: what a viewer tab is given when it opens, and where it goes, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handoffFile, handoffId, handoffText, handoffFrom, tabProps, viewerTabOf, tabName } from "./viewer-tab.js";

const NOW = 1_800_000_000_000;
const FILE = "/work/notes/plan.md";
const EDIT = { disk: "# Plan\n", text: "# Plan!\n" };

test("a handoff written for a new tab gives that tab the file and its edits", () => {
  const id = handoffId(NOW, 0.5);
  const text = handoffText({ id, file: FILE, edit: EDIT, now: NOW });
  assert.deepEqual(handoffFrom(text, { id, now: NOW + 300 }), { file: FILE, edit: EDIT });
});

test("the handoff has its own file in the data folder, named by its id", () => {
  const id = handoffId(NOW, 0.25);
  assert.match(handoffFile(id), /^handoff-[A-Za-z0-9_-]+\.json$/);
  assert.notEqual(handoffId(NOW, 0.25), handoffId(NOW, 0.75));
  assert.notEqual(handoffId(NOW, 0.25), handoffId(NOW + 1, 0.25));
});

test("a conflict bar and a Korean path with quotes come through intact", () => {
  const file = '/work/내 문서/it\'s "final" a\\b 계획.md';
  const edit = { disk: "one\n", text: "mine\n", bar: { kind: "conflict", disk: "theirs\n" } };
  const text = handoffText({ id: "a1", file, edit, now: NOW });
  assert.deepEqual(handoffFrom(text, { id: "a1", now: NOW }), { file, edit });
});

test("an old handoff is not taken, so a tab that comes back later does not take edits again", () => {
  const text = handoffText({ id: "a1", file: FILE, edit: EDIT, now: NOW });
  assert.notEqual(handoffFrom(text, { id: "a1", now: NOW + 20_000 }), null);
  assert.equal(handoffFrom(text, { id: "a1", now: NOW + 10 * 60_000 }), null);
});

test("a handoff for another tab is not taken", () => {
  const text = handoffText({ id: "a1", file: FILE, edit: EDIT, now: NOW });
  assert.equal(handoffFrom(text, { id: "b2", now: NOW }), null);
});

test("a viewer tab's props name its file and its handoff, and say it is a viewer tab", () => {
  assert.deepEqual(viewerTabOf(tabProps({ file: FILE, handoff: "a1" })), { file: FILE, handoff: "a1" });
  assert.deepEqual(viewerTabOf(tabProps({ file: FILE, handoff: null })), { file: FILE, handoff: null });
});

test("the props of a viewer beside a conversation are not a viewer tab's", () => {
  for (const props of [null, undefined, {}, { file: FILE }, { file: FILE, handoff: "a1" }]) {
    assert.equal(viewerTabOf(props), null, JSON.stringify(props));
  }
});

test("a handoff id that could reach outside the data folder is dropped", () => {
  const props = { ...tabProps({ file: FILE, handoff: "a1" }), handoff: "../escape" };
  assert.deepEqual(viewerTabOf(props), { file: FILE, handoff: null });
});

test("the tab is named by the file, as the header names it", () => {
  assert.equal(tabName("/work/notes/계획 v2.md"), "계획 v2.md");
});

test("a missing or broken handoff is ignored", () => {
  for (const broken of [null, undefined, "", "not json", "null", "[]", '{"id":"a1"', "7"]) {
    assert.equal(handoffFrom(broken, { id: "a1", now: NOW }), null, String(broken));
  }
  const noFile = JSON.stringify({ id: "a1", at: NOW / 1000, edit: EDIT });
  assert.equal(handoffFrom(noFile, { id: "a1", now: NOW }), null);
  const relative = JSON.stringify({ id: "a1", at: NOW / 1000, file: "notes/plan.md", edit: EDIT });
  assert.equal(handoffFrom(relative, { id: "a1", now: NOW }), null);
});
