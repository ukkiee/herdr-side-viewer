// The sent conversation: the conversation pane that last sent a file to the viewers of its tab.
// No Herdr imports, so it runs under `node --test`.
//
// Herdr's shared state keeps it under CONVERSATIONS_KEY as { <tab id>: <pane id> }. A viewer
// writes it when it takes a request that names its conversation, or first starts with an
// opening that names one (afterRequest, afterStart), and takes its tab out on a request or an opening
// without one. The shell pane's folder (terminal-insert.js shellFolder) and the path picker's
// conversation (path-picker.js conversationOf) follow it while that pane is still a terminal
// in the tab, and fall back to the tab's first agent terminal otherwise.
// Setting shared state draws every mod again, so the caller sets it only when the map changed.

import { addressOf } from "./machine.js";
import { viewerPaneOf } from "./terminal-insert.js";

export const CONVERSATIONS_KEY = "side-viewer.conversations";

// The openings viewers took, latest last, under OPENINGS_KEY, each as { id, tab }: the tab
// whose memory it changed, or null while that tab is not known; it is filled in with the tab
// of the conversation the opening named, once panes() lists that pane, on a later start of
// the same opening (takeOpening) or on a request the same copy takes (afterRequest). A copy
// starts again with the same props when a mod file is saved, when the app restarts and its
// tab shows, and first starts when its tab first shows, which may be long after the split.
// Only the first start of an opening may change the memory: a later one would put back a
// conversation that requests since replaced or took out.
export const OPENINGS_KEY = "side-viewer.openings";

// How many openings of tabs panes() does not list, or of no tab, are kept. An opening pushed
// out by that many newer ones could be taken again, by a copy that has not started since.
// Openings of tabs on screen are all kept, so a live viewer's never is; a remote tab hidden
// while its machine is cut off counts as gone, so the limit leaves room for its openings.
export const OPENINGS_KEPT = 50;

// The same characters as a request's id (open.sh, the path picker), which the opening reuses.
const OPENING_ID = /^[A-Za-z0-9_-]+$/;

// What a viewer starting with `props` does to the shared state: { conversations, openings },
// the values given when nothing changes. open.sh and the path picker split it off with `id`,
// the opening's id, and the conversation's pane id without its machine prefix (machine.js
// addressOf). An id not taken yet is added to the openings; its conversation is remembered
// for its tab (nothing when the space or the pane is not listed), and an opening without one
// forgets the viewer's tab (forgottenTabOf). An id already taken changes no memory; if it was
// kept with no tab, it gets its conversation's tab once panes() lists that pane (sureTabOf),
// so it is kept like any opening of a tab on screen. Props without an id, an older router's or a viewer tab's, change
// nothing.
//   conversations: shared(CONVERSATIONS_KEY); openings: shared(OPENINGS_KEY); spaces: Herdr's
//   spaces(); panes: herdr panes(); viewer: the viewer's pane id or null; focused: herdr focused()
export function takeOpening({ conversations, openings, props, spaces, panes, viewer, focused }) {
  const id = props?.id;
  const taken = openingsOf(openings);
  if (typeof id !== "string" || !OPENING_ID.test(id)) return { conversations, openings };
  if (taken.some((o) => o.id === id)) {
    const tab = sureTabOf({ props, spaces, panes });
    if (!tab || !taken.some((o) => o.id === id && o.tab === null)) return { conversations, openings };
    return { conversations, openings: taken.map((o) => (o.id === id && o.tab === null ? { id, tab } : o)) };
  }
  let tab;
  let after;
  if (typeof props.conversation === "string") {
    const conversation = addressOf(props.conversation, props, spaces);
    tab = panes.find((p) => p.pane === conversation)?.tab ?? null;
    after = rememberConversation(conversations, conversation, panes);
  } else {
    tab = forgottenTabOf({ viewer, focused, panes });
    after = forgetConversation(conversations, tab, panes);
  }
  return { conversations: after, openings: keptOpenings([...taken, { id, tab }], panes) };
}

// What a copy's start does to the shared state, from Herdr's own values: { conversations,
// openings, unfilled }, as takeOpening decides for the opening in its props. `unfilled` is that
// opening, { id, conversation, space } as its props name them, while it is kept with no tab and
// names a conversation; else null. The copy keeps it and hands it to afterRequest, so the tab is
// filled as soon as a request shows the conversation, without waiting for another start.
//   given: the props init got; props: herdr props(); focused: herdr focused(); panes: herdr
//   panes(); spaces: herdr spaces(); conversations, openings: the two shared values
export function afterStart({ given, props, focused, panes, spaces, conversations, openings }) {
  const opening = { ...given, ...props };
  const viewer = viewerPaneOf({ props, focused, panes });
  const after = takeOpening({ conversations, openings, props: opening, spaces, panes, viewer, focused });
  const tabless = openingsOf(after.openings).some((o) => o.id === opening.id && o.tab === null);
  const unfilled = tabless && typeof opening.conversation === "string" ? { id: opening.id, conversation: opening.conversation, space: opening.space } : null;
  return { conversations: after.conversations, openings: after.openings, unfilled };
}

// What a request from `conversation` (null: one that names none) does to the shared state, from
// Herdr's own values: { conversations, openings, unfilled }. Its conversation is remembered for
// its tab, or the viewer's tab forgotten (forgottenTabOf). The copy's `unfilled` opening
// (afterStart) gets the tab of the conversation its props named once panes() lists it, and is
// then dropped; that conversation is not remembered again.
export function afterRequest({ conversation, unfilled, props, focused, panes, spaces, conversations, openings }) {
  let after;
  if (conversation) {
    after = rememberConversation(conversations, conversation, panes);
  } else {
    const viewer = viewerPaneOf({ props, focused, panes });
    after = forgetConversation(conversations, forgottenTabOf({ viewer, focused, panes }), panes);
  }
  if (!unfilled) return { conversations: after, openings, unfilled: null };
  const tab = sureTabOf({ props: unfilled, spaces, panes });
  if (!tab) return { conversations: after, openings, unfilled };
  const taken = openingsOf(openings);
  if (!taken.some((o) => o.id === unfilled.id && o.tab === null)) return { conversations: after, openings, unfilled: null };
  const filled = taken.map((o) => (o.id === unfilled.id && o.tab === null ? { id: o.id, tab } : o));
  return { conversations: after, openings: filled, unfilled: null };
}

// The tab of the conversation an opening's `props` name, as panes() lists it; else null. A
// viewer's own tab is not sure: a mod pane is not told its id, and viewerPaneOf guesses it from
// the focus, which may sit on another tab's viewer.
function sureTabOf({ props, spaces, panes }) {
  const conversation = typeof props.conversation === "string" ? addressOf(props.conversation, props, spaces) : null;
  return conversation == null ? null : panes.find((p) => p.pane === conversation)?.tab ?? null;
}

// The openings in shared(OPENINGS_KEY), anything: a bare id, as an earlier viewer kept it, is
// one with no tab; anything else that is not { id, tab } is dropped.
function openingsOf(openings) {
  if (!Array.isArray(openings)) return [];
  return openings.flatMap((o) => {
    if (typeof o === "string") return [{ id: o, tab: null }];
    if (!o || typeof o !== "object" || typeof o.id !== "string") return [];
    return [{ id: o.id, tab: typeof o.tab === "string" ? o.tab : null }];
  });
}

// `openings` with every one of a tab panes() lists, and the latest OPENINGS_KEPT of the rest,
// in their order.
function keptOpenings(openings, panes) {
  const tabs = new Set(panes.map((p) => p.tab));
  const gone = openings.filter((o) => !tabs.has(o.tab));
  const keptGone = new Set(gone.slice(-OPENINGS_KEPT));
  return openings.filter((o) => tabs.has(o.tab) || keptGone.has(o));
}

// The map with `conversation` (a pane id) remembered for the tab panes() puts it in, and
// tabs panes() no longer has taken out. A pane panes() does not list leaves the map as it was.
//   map: shared(CONVERSATIONS_KEY), anything; panes: herdr panes()
export function rememberConversation(map, conversation, panes) {
  const kept = mapOf(map);
  const tab = panes.find((p) => p.pane === conversation)?.tab;
  if (!tab) return kept;
  return { ...live(kept, panes), [tab]: conversation };
}

// The map without `tab`, and without tabs panes() no longer has.
export function forgetConversation(map, tab, panes) {
  const { [tab]: _gone, ...rest } = live(mapOf(map), panes);
  return rest;
}

// The tab a request without a conversation takes out: the viewer's own, found by its pane
// (terminal-insert.js viewerPaneOf), else the focused tab, or null.
//   viewer: the viewer's pane id or null; focused: herdr focused(); panes: herdr panes()
export function forgottenTabOf({ viewer, focused, panes }) {
  return panes.find((p) => p.pane === viewer)?.tab ?? focused?.tab ?? null;
}

// The pane (from panes()) of the conversation remembered for `tab`, while it is a terminal in
// that tab and not the pane `except` (a viewer's own shell pane); null otherwise.
export function sentConversation(map, tab, panes, except = null) {
  const pane = mapOf(map)[tab];
  if (!tab || !pane || pane === except) return null;
  return panes.find((p) => p.pane === pane && p.tab === tab && p.terminal) ?? null;
}

function mapOf(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  return Object.fromEntries(Object.entries(map).filter(([, pane]) => typeof pane === "string"));
}

function live(map, panes) {
  const tabs = new Set(panes.map((p) => p.tab));
  return Object.fromEntries(Object.entries(map).filter(([tab]) => tabs.has(tab)));
}
