// The sent conversation: the conversation pane that last sent a file to the viewers of its tab.
// No Herdr imports, so it runs under `node --test`.
//
// Herdr's shared state keeps it under CONVERSATIONS_KEY as { <tab id>: <pane id> }. A viewer
// writes it when it takes a request that names its conversation, or first starts with an
// opening that names one (takeOpening), and takes its tab out on a request or an opening
// without one. The shell pane's folder (terminal-insert.js shellFolder) and the path picker's
// conversation (path-picker.js conversationOf) follow it while that pane is still a terminal
// in the tab, and fall back to the tab's first agent terminal otherwise.
// Setting shared state draws every mod again, so the caller sets it only when the map changed.

import { addressOf } from "./machine.js";

export const CONVERSATIONS_KEY = "side-viewer.conversations";

// The ids of the openings viewers took, latest last, under OPENINGS_KEY. A copy starts again
// with the same props when a mod file is saved, when the app restarts and its tab shows, and
// first starts when its tab first shows, which may be long after the split. Only the first
// start of an opening may change the memory: a later one would put back a conversation that
// requests since replaced or took out.
export const OPENINGS_KEY = "side-viewer.openings";

// How many opening ids are kept. An opening pushed out by that many newer ones could be
// taken again, by a copy that has not started since.
export const OPENINGS_KEPT = 50;

// The same characters as a request's id (open.sh, the path picker), which the opening reuses.
const OPENING_ID = /^[A-Za-z0-9_-]+$/;

// What a viewer starting with `props` does to the shared state: { conversations, openings },
// the values given when nothing changes. open.sh and the path picker split it off with `id`,
// the opening's id, and the conversation's pane id without its machine prefix (machine.js
// addressOf). An id not taken yet is added to the openings; its conversation is remembered
// for its tab (nothing when the space or the pane is not listed), and an opening without one
// forgets the viewer's tab (forgottenTabOf). Props without an id, an older router's or a
// viewer tab's, change nothing.
//   conversations: shared(CONVERSATIONS_KEY); openings: shared(OPENINGS_KEY); spaces: Herdr's
//   spaces(); panes: herdr panes(); viewer: the viewer's pane id or null; focused: herdr focused()
export function takeOpening({ conversations, openings, props, spaces, panes, viewer, focused }) {
  const id = props?.id;
  const taken = Array.isArray(openings) ? openings.filter((o) => typeof o === "string") : [];
  if (typeof id !== "string" || !OPENING_ID.test(id) || taken.includes(id)) return { conversations, openings };
  const after =
    typeof props.conversation === "string"
      ? rememberConversation(conversations, addressOf(props.conversation, props, spaces), panes)
      : forgetConversation(conversations, forgottenTabOf({ viewer, focused, panes }), panes);
  return { conversations: after, openings: [...taken, id].slice(-OPENINGS_KEPT) };
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
