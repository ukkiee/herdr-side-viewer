// One viewer's unsaved edits, by file. No Herdr imports, so it runs under `node --test`.
// Every function returns new edits and leaves the ones it was given alone.
//
// Only a file with unsaved edits has an entry: { disk, text }, where `disk` is the file's
// text as last read before the edit (the `expected` of its save) and `text` the edited text.
// A file without an entry shows what is on disk.

export function noEdits() {
  return {};
}

export function unsaved(edits, file) {
  return Boolean(file && edits[file]);
}

// The text to show and edit for `file`, whose last read gave `disk`.
export function shownText(edits, file, disk) {
  return edits[file]?.text ?? disk;
}

// The editor of `file` now holds `text`; `disk` is the file's text as last read.
export function typed(edits, file, disk, text) {
  if (!file) return edits;
  const entry = edits[file];
  const base = entry?.disk ?? disk;
  if (text === base && !holds(entry)) return without(edits, file);
  return { ...edits, [file]: { ...entry, disk: base, text } };
}

// What saving `file` writes, as the arguments of writeTextFile: { path, text, expected }.
// Null when there is nothing to save, so cmd+S on an unedited file does nothing.
export function saveOf(edits, file) {
  const entry = file ? edits[file] : null;
  if (!entry) return null;
  return { path: file, text: entry.text, expected: entry.disk };
}

// A save of `file` wrote `text`, which is now the file's disk text. Typing that landed while
// the save was under way stays unsaved, against the saved text.
export function saved(edits, file, text) {
  const entry = edits[file];
  if (!entry) return edits;
  if (entry.text === text) return without(edits, file);
  return { ...edits, [file]: { disk: text, text: entry.text } };
}

// A read of `file` found `text` on disk: a string, null when the file is gone, or undefined
// when it could not be read. Returns { edits, step }. "show": put the read on screen, as v1
// did. "keep": the file has edits, which stay on screen as they are; a disk that no longer
// holds the text the edit started from raises the bar instead of replacing them.
export function diskRead(edits, file, text) {
  const entry = file ? edits[file] : null;
  if (!entry) return { edits, step: "show" };
  if (text === undefined) return { edits, step: "keep" };
  // The disk caught up with the edit, as when the viewer's own save is read back.
  if (text === entry.text) return { edits: without(edits, file), step: "show" };
  if (text === entry.disk) return { edits: withBar(edits, file, null), step: "keep" };
  const bar = text === null ? { kind: "failed", reason: "deleted" } : { kind: "conflict", disk: text };
  return { edits: withBar(edits, file, bar), step: "keep" };
}

const MESSAGES = {
  conflict: "밖에서 바뀌었습니다",
  deleted: "파일이 지워졌습니다.",
};

// What the bar above the content says for `file`, as { kind, message }, or null for no bar.
// "conflict" carries the two buttons (discard and overwrite); "failed" only says why.
export function barOf(edits, file) {
  const bar = file ? edits[file]?.bar : null;
  if (!bar) return null;
  return { kind: bar.kind, message: MESSAGES[bar.kind === "conflict" ? "conflict" : bar.reason] };
}

// A bar that stays while typing, even typing back to the text read before: the disk no longer
// holds that text, so the edit is still not on disk.
function holds(entry) {
  return entry?.bar?.kind === "conflict" || entry?.bar?.reason === "deleted";
}

function withBar(edits, file, bar) {
  const { disk, text } = edits[file];
  return { ...edits, [file]: bar ? { disk, text, bar } : { disk, text } };
}

function without(edits, file) {
  if (!edits[file]) return edits;
  const rest = { ...edits };
  delete rest[file];
  return rest;
}
