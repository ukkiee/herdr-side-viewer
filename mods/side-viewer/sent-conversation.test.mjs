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

test("a viewer's first start remembers the conversation its opening names, and keeps the opening's id with that conversation's tab", () => {
  assert.deepEqual(start(EMPTY, opened({ conversation: "p1" })), { conversations: { tab1: "p1" }, openings: [{ id: "1800000000-41", tab: "tab1" }] });
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
  const before = { conversations: { tab1: "p1" }, openings: [{ id: "1700000000-7", tab: "tab1" }] };
  const late = start(before, opened({ conversation: "p2", id: "1800000000-99" }));
  assert.deepEqual(late, { conversations: { tab1: "p2" }, openings: [{ id: "1700000000-7", tab: "tab1" }, { id: "1800000000-99", tab: "tab1" }] });
});

test("a new opening without a conversation forgets the viewer's own tab once", () => {
  const before = { conversations: { tab1: "p2", tab2: "p4" }, openings: [] };
  const taken = start(before, opened({ conversation: undefined }));
  assert.deepEqual(taken, { conversations: { tab2: "p4" }, openings: [{ id: "1800000000-41", tab: "tab1" }] });
  const b = request(taken, "p1");
  assert.deepEqual(start(b, opened({ conversation: undefined })), b);
});

test("a viewer not found among the panes forgets the focused tab for an opening without a conversation", () => {
  const before = { conversations: { tab1: "p2", tab2: "p4" }, openings: [] };
  assert.deepEqual(start(before, opened({ conversation: undefined }), { viewer: null }).conversations, { tab1: "p2" });
});

test("props without an opening id, as an older router's, leave the memory as it was", () => {
  const before = { conversations: { tab1: "p2" }, openings: [{ id: "1700000000-7", tab: "tab1" }] };
  for (const props of [opened({ id: undefined }), opened({ id: undefined, conversation: undefined }), opened({ id: 7 }), opened({ id: "" }), opened({ id: "a b" }), undefined]) {
    assert.deepEqual(start(before, props), before, JSON.stringify(props));
  }
});

test("a viewer tab's props name no opening and change nothing", () => {
  const before = { conversations: { tab1: "p2" }, openings: [] };
  assert.deepEqual(start(before, { file: "/work/a/plan.md", viewerTab: true, space: "s1" }), before);
});

// `count` openings taken in a tab that is gone, or with no tab, numbered from `from`.
const closed = (count, from = 0) =>
  Array.from({ length: count }, (_, n) => ({ id: `1700000000-${from + n}`, tab: (from + n) % 2 ? "tab9" : null }));
// `count` openings of tab2 taken in turn by viewers starting there, each naming p4.
const openInTab2 = (state, count) => {
  let now = state;
  for (let n = 0; n < count; n++) now = start(now, opened({ conversation: "p4", id: `1900000000-${n}` }), { viewer: "p4" });
  return now;
};

test("only the latest openings of tabs that are gone, or of no tab, are kept", () => {
  const taken = start({ conversations: {}, openings: closed(OPENINGS_KEPT) }, opened({ id: "1800000000-new", conversation: "p1" }));
  assert.equal(taken.openings.length, OPENINGS_KEPT + 1);
  const after = start({ conversations: {}, openings: closed(OPENINGS_KEPT) }, opened({ id: "1800000000-new", space: "s9" }));
  assert.equal(after.openings.length, OPENINGS_KEPT);
  assert.deepEqual(after.openings[0], { id: "1700000000-1", tab: "tab9" });
  assert.deepEqual(after.openings.at(-1), { id: "1800000000-new", tab: null });
});

test("openings of tabs still on screen are kept however many there are; only the others are cut to the latest", () => {
  const liveOnes = Array.from({ length: OPENINGS_KEPT + 5 }, (_, n) => ({ id: `1600000000-${n}`, tab: n % 2 ? "tab1" : "tab2" }));
  const mixed = [...closed(30), ...liveOnes.slice(0, 20), ...closed(30, 30), ...liveOnes.slice(20)];
  const taken = start({ conversations: {}, openings: mixed }, opened({ id: "1800000000-new", conversation: "p1" }));
  const kept = taken.openings.map((o) => o.id);
  for (const o of liveOnes) assert.ok(kept.includes(o.id), o.id);
  const closedKept = taken.openings.filter((o) => o.tab !== "tab1" && o.tab !== "tab2");
  assert.deepEqual(closedKept, closed(OPENINGS_KEPT, 10));
  assert.equal(taken.openings.at(-1).id, "1800000000-new");
  assert.deepEqual(kept.filter((id) => !id.startsWith("1700000000-")), [...liveOnes.map((o) => o.id), "1800000000-new"]);
});

test("a viewer still on screen starting again after more openings than are kept elsewhere keeps the request that came since", () => {
  const a = start(EMPTY, opened({ conversation: "p1" }));
  const b = request(a, "p2");
  const crowded = openInTab2(b, OPENINGS_KEPT + 3);
  assert.deepEqual(crowded.conversations, { tab1: "p2", tab2: "p4" });
  assert.deepEqual(start(crowded, opened({ conversation: "p1" })), crowded);
});

test("a tab forgotten by a request stays forgotten when its viewer starts again after more openings than are kept", () => {
  const a = start(EMPTY, opened({ conversation: "p1" }));
  const gone = request(a, null);
  const crowded = openInTab2(gone, OPENINGS_KEPT + 3);
  assert.deepEqual(crowded.conversations, { tab2: "p4" });
  assert.deepEqual(start(crowded, opened({ conversation: "p1" })), crowded);
});

test("an opening without a conversation is kept with the tab it forgot, so a request since survives its viewer starting again", () => {
  const a = start({ conversations: { tab1: "p1" }, openings: [] }, opened({ conversation: undefined }));
  assert.deepEqual(a.openings, [{ id: "1800000000-41", tab: "tab1" }]);
  const crowded = openInTab2(request(a, "p2"), OPENINGS_KEPT + 3);
  assert.deepEqual(start(crowded, opened({ conversation: undefined })), crowded);
});

test("openings kept as bare ids, as an earlier viewer kept them, count as taken with no tab", () => {
  const before = { conversations: { tab1: "p2" }, openings: ["1800000000-41"] };
  assert.deepEqual(start(before, opened({ conversation: "p1" })), before);
  const next = start(before, opened({ conversation: "p1", id: "1800000000-42" }));
  assert.deepEqual(next.openings, [{ id: "1800000000-41", tab: null }, { id: "1800000000-42", tab: "tab1" }]);
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
  assert.deepEqual(unlisted, { conversations: { tab1: "p1" }, openings: [{ id: "1800000000-41", tab: null }] });
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
