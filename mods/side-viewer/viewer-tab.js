// The viewer tab: a tab whose only pane is a side viewer. No Herdr imports, so it runs under
// `node --test`; main.js runs the tab commands with what this module works out.
//
// "Open in a new tab" makes the tab with `tab.new {name, space, mod: "side-viewer", props}`.
// Props are saved with the tab, so they carry only the file and, when the file had unsaved
// edits, the id of a handoff file in the data folder that holds them (as request.js does for
// open.sh): { file, viewerTab: true, handoff? }. The handoff file is
// {"id": "...", "file": "/abs/path", "at": <unix seconds>, "edit": {disk, text, bar?}},
// the entry of edit-state.js's takeEdit.

import { labelOf } from "./document.js";

// The id becomes part of a file name, so it may not carry a path.
const ID = /^[A-Za-z0-9_-]+$/;

// The new tab reads its handoff as it starts, well within this. A tab that comes back later
// (the app restarted with it open) finds an older one and starts from the disk text instead.
const MAX_AGE_SECONDS = 60;

export function handoffFile(id) {
  return `handoff-${id}.json`;
}

// `now` in milliseconds, `random` in [0, 1), as Math.random() gives.
export function handoffId(now, random) {
  return `${Math.floor(now)}-${Math.floor(random * 1e9)}`;
}

export function handoffText({ id, file, edit, now }) {
  return JSON.stringify({ id, file, at: now / 1000, edit });
}

// `text` is what reading the handoff file gave (null when it is not there), `id` the one in
// this tab's props and `now` the time in milliseconds. Returns { file, edit }, or null.
export function handoffFrom(text, { id, now }) {
  if (typeof text !== "string") return null;
  let handoff;
  try {
    handoff = JSON.parse(text);
  } catch {
    return null;
  }
  if (!handoff || typeof handoff !== "object") return null;
  const { file, at, edit } = handoff;
  if (typeof handoff.id !== "string" || !ID.test(handoff.id) || handoff.id !== id) return null;
  if (typeof file !== "string" || !file.startsWith("/")) return null;
  if (typeof at !== "number" || Math.abs(now / 1000 - at) > MAX_AGE_SECONDS) return null;
  return { file, edit: edit ?? null };
}

// The props of a new viewer tab. `handoff` is null when there were no edits to hand over.
export function tabProps({ file, handoff }) {
  return handoff ? { file, viewerTab: true, handoff } : { file, viewerTab: true };
}

// What a copy's props say: { file, handoff } for a viewer tab (handoff null when there is
// none to read), or null for a viewer beside a conversation.
export function viewerTabOf(props) {
  if (props?.viewerTab !== true) return null;
  const handoff = typeof props.handoff === "string" && ID.test(props.handoff) ? props.handoff : null;
  return { file: typeof props.file === "string" ? props.file : null, handoff };
}

// Where the new tab goes: right after the tab the viewer is in, as { space, index } for
// tab.new {space} and tab.move {index} (1 = first). `spaces` is Herdr's spaces(), `focus`
// its focused(), taken while the click on this viewer is handled. Null when either is unknown.
export function placeAfter(spaces, focus) {
  const space = (spaces ?? []).find((s) => s.id === focus?.space);
  const tab = space?.tabs.find((t) => t.id === focus.tab);
  if (!tab) return null;
  return { space: space.id, index: tab.index + 1 };
}

// tab.new returns nothing, so the new tab is the one `space` has in `after` and did not
// have in `before` (both spaces()). Null until it shows up.
export function newTabOf(before, after, space) {
  const known = new Set((before ?? []).find((s) => s.id === space)?.tabs.map((t) => t.id) ?? []);
  return (after ?? []).find((s) => s.id === space)?.tabs.find((t) => !known.has(t.id))?.id ?? null;
}

// The tab a viewer tab renames when its file changes: the shown tab (focused()), as long as a
// side viewer is in it (panes()). A viewer tab only changes its file while it is shown: a
// click in it, or an open request, which only a showing copy takes.
export function ownTab(focus, panes) {
  const tab = focus?.tab;
  if (!tab) return null;
  return (panes ?? []).some((p) => p.tab === tab && p.mod === "side-viewer") ? tab : null;
}

// The tab's name: the file name, as the header shows it.
export function tabName(file) {
  return labelOf(file, "").name;
}
