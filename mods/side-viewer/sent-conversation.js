// The sent conversation: the conversation pane that last sent a file to the viewers of its tab.
// No Herdr imports, so it runs under `node --test`.
//
// Herdr's shared state keeps it under CONVERSATIONS_KEY as { <tab id>: <pane id> }. A viewer
// writes it when it takes a request that names its conversation, or starts with one in its
// props, and takes its tab out on a request without one. The shell pane's folder
// (terminal-insert.js shellFolder) and the path picker's conversation (path-picker.js
// conversationOf) follow it while that pane is still a terminal in the tab, and fall back to
// the tab's first agent terminal otherwise.
// Setting shared state draws every mod again, so the caller sets it only when the map changed.

export const CONVERSATIONS_KEY = "side-viewer.conversations";

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
