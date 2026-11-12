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
  const base = edits[file]?.disk ?? disk;
  if (text === base) return without(edits, file);
  return { ...edits, [file]: { disk: base, text } };
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

function without(edits, file) {
  if (!edits[file]) return edits;
  const rest = { ...edits };
  delete rest[file];
  return rest;
}
