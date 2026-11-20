// node --test: the sent conversation each tab remembers, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONVERSATIONS_KEY, rememberConversation, forgetConversation, sentConversation, openedConversation } from "./sent-conversation.js";

// Herdr's panes(): a terminal pane, or a mod pane (terminal null).
const terminalPane = (pane, tab, terminal, cwd) => ({ pane, tab, terminal, cwd, status: null, program: { key: "shell", agent: false, shell: true } });
const modPane = (pane, tab, mod = "side-viewer") => ({ pane, tab, terminal: null, mod, cwd: null, status: null });

// Two conversations side by side in tab1 with a viewer; one conversation in tab2.
const PANES = [
  terminalPane("p1", "tab1", "t1", "/work/a"),
  terminalPane("p2", "tab1", "t2", "/work/b"),
  modPane("p3", "tab1"),
  terminalPane("p4", "tab2", "t4", "/work/c"),
];

test("the memory lives in Herdr's shared state under one key", () => {
  assert.equal(CONVERSATIONS_KEY, "side-viewer.conversations");
});

test("a sent conversation is remembered for its own tab", () => {
  assert.deepEqual(rememberConversation({}, "p2", PANES), { tab1: "p2" });
  assert.deepEqual(rememberConversation({ tab1: "p1", tab2: "p4" }, "p2", PANES), { tab1: "p2", tab2: "p4" });
});

test("an empty or broken memory starts as no memory", () => {
  for (const broken of [undefined, null, "p1", 7, ["p1"]]) {
    assert.deepEqual(rememberConversation(broken, "p4", PANES), { tab2: "p4" }, String(broken));
  }
});

test("remembering drops tabs that are gone", () => {
  assert.deepEqual(rememberConversation({ tab9: "p9", tab2: "p4" }, "p1", PANES), { tab2: "p4", tab1: "p1" });
});

test("a conversation pane not in panes() leaves the memory as it was", () => {
  const before = { tab1: "p1", tab9: "p9" };
  assert.deepEqual(rememberConversation(before, "p8", PANES), before);
  assert.deepEqual(rememberConversation(before, null, PANES), before);
});

test("forgetting takes out that tab, and tabs that are gone", () => {
  assert.deepEqual(forgetConversation({ tab1: "p2", tab2: "p4", tab9: "p9" }, "tab1", PANES), { tab2: "p4" });
  assert.deepEqual(forgetConversation({ tab2: "p4" }, "tab1", PANES), { tab2: "p4" });
  assert.deepEqual(forgetConversation(undefined, "tab1", PANES), {});
});

test("the sent conversation is the remembered terminal pane of that tab", () => {
  assert.equal(sentConversation({ tab1: "p2" }, "tab1", PANES), PANES[1]);
  assert.equal(sentConversation({ tab1: "p2", tab2: "p4" }, "tab2", PANES), PANES[3]);
});

test("there is none when nothing is remembered for the tab", () => {
  assert.equal(sentConversation({}, "tab1", PANES), null);
  assert.equal(sentConversation(undefined, "tab1", PANES), null);
  assert.equal(sentConversation({ tab1: "p2" }, null, PANES), null);
});

test("a remembered pane that closed or moved to another tab is not the tab's conversation", () => {
  assert.equal(sentConversation({ tab1: "p8" }, "tab1", PANES), null);
  assert.equal(sentConversation({ tab1: "p4" }, "tab1", PANES), null);
});

test("a remembered mod pane or the pane left out is not a conversation", () => {
  assert.equal(sentConversation({ tab1: "p3" }, "tab1", PANES), null);
  assert.equal(sentConversation({ tab1: "p2" }, "tab1", PANES, "p2"), null);
  assert.equal(sentConversation({ tab1: "p2" }, "tab1", PANES, "p1"), PANES[1]);
});

// A viewer's props as open.sh or the path picker split it off, opened at AT (unix seconds).
const AT = 1800000000;
const opened = (more) => ({ file: "/work/a/plan.md", space: "s1", conversation: "p2", at: AT, ...more });
// spaces(): this Mac's space s1, and the space s3 of a machine this screen calls studio.
const SPACES = [{ id: "s1", machine: null }, { id: "studio/s3", machine: "studio" }];

test("a viewer opened just now takes the conversation its props name", () => {
  assert.equal(openedConversation(opened(), { now: AT * 1000 + 2000, spaces: SPACES }), "p2");
  assert.equal(openedConversation(opened(), { now: (AT + 30) * 1000, spaces: SPACES }), "p2");
});

test("a copy started again later, or props without the time they were opened, take no conversation", () => {
  assert.equal(openedConversation(opened(), { now: (AT + 31) * 1000, spaces: SPACES }), null);
  assert.equal(openedConversation(opened({ at: undefined }), { now: AT * 1000, spaces: SPACES }), null);
  assert.equal(openedConversation(opened({ at: String(AT) }), { now: AT * 1000, spaces: SPACES }), null);
  assert.equal(openedConversation(opened({ conversation: undefined }), { now: AT * 1000, spaces: SPACES }), null);
  assert.equal(openedConversation(undefined, { now: AT * 1000, spaces: SPACES }), null);
});

test("a remote viewer finds its conversation under the prefix this screen gives the machine", () => {
  const props = opened({ space: "s3", conversation: "p7" });
  assert.equal(openedConversation(props, { now: AT * 1000, spaces: SPACES }), "studio/p7");
  const mini = [{ id: "mini/s3", machine: "mini" }];
  assert.equal(openedConversation(props, { now: AT * 1000, spaces: mini }), "mini/p7");
  const panes = [terminalPane("studio/p7", "studio/tab5", "studio/t7", "/b"), modPane("studio/p8", "studio/tab5")];
  const found = openedConversation(props, { now: AT * 1000, spaces: SPACES });
  assert.deepEqual(rememberConversation({}, found, panes), { "studio/tab5": "studio/p7" });
});

test("a viewer whose space is not listed yet takes no conversation", () => {
  assert.equal(openedConversation(opened({ space: "s9" }), { now: AT * 1000, spaces: SPACES }), null);
});

test("a viewer without a space value is on this Mac and takes the id as it is", () => {
  assert.equal(openedConversation(opened({ space: undefined }), { now: AT * 1000, spaces: [] }), "p2");
});
