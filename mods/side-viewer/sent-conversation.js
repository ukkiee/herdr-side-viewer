// The sent conversation: the conversation pane that last sent a file to the viewers of its tab.
// No Herdr imports, so it runs under `node --test`.
//
// Herdr's shared state keeps it under CONVERSATIONS_KEY as { <tab id>: <pane id> }. A viewer
// writes it when it takes a request that names its conversation, or is opened with one in its
// props (openedConversation), and takes its tab out on a request without one. The shell pane's folder
// (terminal-insert.js shellFolder) and the path picker's conversation (path-picker.js
// conversationOf) follow it while that pane is still a terminal in the tab, and fall back to
// the tab's first agent terminal otherwise.
// Setting shared state draws every mod again, so the caller sets it only when the map changed.

import { addressOf } from "./machine.js";

export const CONVERSATIONS_KEY = "side-viewer.conversations";

// How long after its opener's `at` a viewer counts as just opened. A copy starts again with the
// same props when the app restarts and its tab shows, or when a mod file is saved; that is no
// new send, so it must not put back a conversation later requests replaced or took out.
export const OPENED_WITHIN_SECONDS = 30;

// The conversation (a pane address on this screen) a viewer starting at `now` takes from its
// props, or null. open.sh and the path picker put the conversation's pane id there without its
// machine prefix (machine.js addressOf), with `at`, the unix seconds they opened it. Props
// without `at`, or with one more than OPENED_WITHIN_SECONDS away, give null: the viewer then
// neither remembers nor forgets anything for them.
//   props: the viewer's props; now: ms; spaces: Herdr's spaces()
export function openedConversation(props, { now, spaces }) {
  const at = props?.at;
  if (typeof at !== "number" || Math.abs(now / 1000 - at) > OPENED_WITHIN_SECONDS) return null;
  return addressOf(props.conversation, props, spaces);
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
