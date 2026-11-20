// node --test: the sent conversation each tab remembers, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONVERSATIONS_KEY, OPENINGS_KEY, OPENINGS_KEPT, rememberConversation, forgetConversation, sentConversation, takeOpening, forgottenTabOf } from "./sent-conversation.js";

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

// A viewer's props as open.sh or the path picker split it off, with the opening's id.
const opened = (more) => ({ file: "/work/a/plan.md", space: "s1", conversation: "p2", id: "1800000000-41", ...more });
// spaces(): this Mac's space s1, and the space s3 of a machine this screen calls studio.
const SPACES = [{ id: "s1", machine: null }, { id: "studio/s3", machine: "studio" }];
// A viewer p3 of tab1 starting with `props`, with the focus in tab2, against the shared state `state`.
const start = (state, props, { panes = PANES, spaces = SPACES, viewer = "p3" } = {}) =>
  takeOpening({ ...state, props, spaces, panes, viewer, focused: { tab: "tab2", pane: "p4" } });
// The memory after a request as main.js keeps it: its conversation remembered, or the viewer's tab forgotten.
const request = (state, conversation) => ({
  ...state,
  conversations: conversation ? rememberConversation(state.conversations, conversation, PANES) : forgetConversation(state.conversations, "tab1", PANES),
});
const EMPTY = { conversations: undefined, openings: undefined };

test("the openings taken live in Herdr's shared state under their own key", () => {
  assert.equal(OPENINGS_KEY, "side-viewer.openings");
});

test("a viewer's first start remembers the conversation its opening names, and keeps the opening's id", () => {
  assert.deepEqual(start(EMPTY, opened({ conversation: "p1" })), { conversations: { tab1: "p1" }, openings: ["1800000000-41"] });
});

test("an opening taken once, then a request from another conversation: the copy starting again keeps the request's", () => {
  const a = start(EMPTY, opened({ conversation: "p1" }));
  const b = request(a, "p2");
  assert.deepEqual(b.conversations, { tab1: "p2" });
  const again = start(b, opened({ conversation: "p1" }));
  assert.deepEqual(again, b);
  assert.deepEqual(start(again, opened({ conversation: "p1" })), b);
});

test("an opening taken once, then a request without a conversation: starting again leaves the tab forgotten", () => {
  const a = start(EMPTY, opened({ conversation: "p1" }));
  const gone = request(a, null);
  assert.deepEqual(gone.conversations, {});
  assert.deepEqual(start(gone, opened({ conversation: "p1" })), gone);
});

test("an opening first shown long after it was made is still taken", () => {
  const before = { conversations: { tab1: "p1" }, openings: ["1700000000-7"] };
  const late = start(before, opened({ conversation: "p2", id: "1800000000-99" }));
  assert.deepEqual(late, { conversations: { tab1: "p2" }, openings: ["1700000000-7", "1800000000-99"] });
});

test("a new opening without a conversation forgets the viewer's own tab once", () => {
  const before = { conversations: { tab1: "p2", tab2: "p4" }, openings: [] };
  const taken = start(before, opened({ conversation: undefined }));
  assert.deepEqual(taken, { conversations: { tab2: "p4" }, openings: ["1800000000-41"] });
  const b = request(taken, "p1");
  assert.deepEqual(start(b, opened({ conversation: undefined })), b);
});

test("a viewer not found among the panes forgets the focused tab for an opening without a conversation", () => {
  const before = { conversations: { tab1: "p2", tab2: "p4" }, openings: [] };
  assert.deepEqual(start(before, opened({ conversation: undefined }), { viewer: null }).conversations, { tab1: "p2" });
});

test("props without an opening id, as an older router's, leave the memory as it was", () => {
  const before = { conversations: { tab1: "p2" }, openings: ["1700000000-7"] };
  for (const props of [opened({ id: undefined }), opened({ id: undefined, conversation: undefined }), opened({ id: 7 }), opened({ id: "" }), opened({ id: "a b" }), undefined]) {
    assert.deepEqual(start(before, props), before, JSON.stringify(props));
  }
});

test("a viewer tab's props name no opening and change nothing", () => {
  const before = { conversations: { tab1: "p2" }, openings: [] };
  assert.deepEqual(start(before, { file: "/work/a/plan.md", viewerTab: true, space: "s1" }), before);
});

test("only the latest openings are kept", () => {
  const many = Array.from({ length: OPENINGS_KEPT }, (_, n) => `1700000000-${n}`);
  const taken = start({ conversations: {}, openings: many }, opened({ id: "1800000000-new" }));
  assert.equal(taken.openings.length, OPENINGS_KEPT);
  assert.equal(taken.openings[0], "1700000000-1");
  assert.equal(taken.openings.at(-1), "1800000000-new");
});

test("a broken list of openings starts as none taken", () => {
  for (const broken of [null, "x", 7, { a: 1 }, [7, null]]) {
    const taken = start({ conversations: {}, openings: broken }, opened());
    assert.deepEqual(taken.conversations, { tab1: "p2" }, JSON.stringify(broken));
  }
});

test("an opening whose conversation is not on screen yet is taken without changing the memory", () => {
  const before = { conversations: { tab1: "p1" }, openings: [] };
  const unlisted = start(before, opened({ space: "s9" }));
  assert.deepEqual(unlisted, { conversations: { tab1: "p1" }, openings: ["1800000000-41"] });
  assert.deepEqual(start(unlisted, opened({ space: "s9" }), { spaces: [...SPACES, { id: "s9", machine: null }] }), unlisted);
});

test("a remote viewer finds its conversation under the prefix this screen gives the machine", () => {
  const props = opened({ space: "s3", conversation: "p7" });
  const panes = [terminalPane("studio/p7", "studio/tab5", "studio/t7", "/b"), modPane("studio/p8", "studio/tab5")];
  assert.deepEqual(start(EMPTY, props, { panes, viewer: "studio/p8" }).conversations, { "studio/tab5": "studio/p7" });
  const mini = [{ id: "mini/s3", machine: "mini" }];
  const miniPanes = [terminalPane("mini/p7", "mini/tab5", "mini/t7", "/b")];
  assert.deepEqual(start(EMPTY, props, { panes: miniPanes, spaces: mini }).conversations, { "mini/tab5": "mini/p7" });
});

test("a viewer without a space value is on this Mac and takes the id as it is", () => {
  assert.deepEqual(start(EMPTY, opened({ space: undefined }), { spaces: [] }).conversations, { tab1: "p2" });
});

test("a request without a conversation forgets the viewer's own tab, even with the focus in another", () => {
  assert.equal(forgottenTabOf({ viewer: "p3", focused: { tab: "tab2", pane: "p4" }, panes: PANES }), "tab1");
});

test("a viewer not found among the panes forgets the focused tab", () => {
  assert.equal(forgottenTabOf({ viewer: null, focused: { tab: "tab2", pane: "p4" }, panes: PANES }), "tab2");
  assert.equal(forgottenTabOf({ viewer: "p9", focused: { tab: "tab2", pane: "p4" }, panes: PANES }), "tab2");
  assert.equal(forgottenTabOf({ viewer: null, focused: null, panes: PANES }), null);
});
