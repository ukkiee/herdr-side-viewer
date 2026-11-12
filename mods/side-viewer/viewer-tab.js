// The viewer tab: a tab whose only pane is a side viewer. No Herdr imports, so it runs under
// `node --test`; main.js runs the tab commands with what this module works out.
//
// "Open in a new tab" makes the tab with `tab.new {name, space, mod: "side-viewer", props}`.
// Props are saved with the tab, so they carry only the file and, when the file had unsaved
// edits, the id of a handoff file in the data folder that holds them (as request.js does for
// open.sh): { file, viewerTab: true, handoff? }. The handoff file is
// {"id": "...", "file": "/abs/path", "at": <unix seconds>, "edit": {disk, text, bar?}},
// the entry of edit-state.js's takeEdit.

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
