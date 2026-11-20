// node --test: the sent conversation each tab remembers, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONVERSATIONS_KEY, rememberConversation, forgetConversation, sentConversation } from "./sent-conversation.js";

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
