// One viewer's unsaved edits, by file. No Herdr imports, so it runs under `node --test`.
// Every function returns new edits and leaves the ones it was given alone.
//
// Only a file with unsaved edits has an entry: { disk, text }, where `disk` is the file's
// text as last read before the edit (the `expected` of its save) and `text` the edited text.
// A file without an entry shows what is on disk. An entry may also carry `bar`, what the bar
// above the content shows: { kind: "conflict", disk } when the disk now holds `disk` instead,
// or { kind: "failed", reason, detail? } when a save failed or the file was deleted (barOf).

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

// The bar's "discard my edits and read again": the file shows what is on disk.
export function discarded(edits, file) {
  return without(edits, file);
}

// The bar's "overwrite with mine": the edit now stands against the disk text the bar found,
// so the save that follows (saveOf) expects that text and replaces it. Without a conflict
// the edits are left as they are.
export function overwritten(edits, file) {
  const entry = file ? edits[file] : null;
  if (entry?.bar?.kind !== "conflict") return edits;
  if (entry.text === entry.bar.disk) return without(edits, file);
  return { ...edits, [file]: { disk: entry.bar.disk, text: entry.text } };
}

// writeTextFile's own limit (Herdr's mod_files.rs), counted in UTF-8 bytes.
export const SAVE_LIMIT = 1024 * 1024;

// Saving `file`, as { edits, write }: `write` is what to pass to writeTextFile (saveOf), or
// null when nothing is written. Text over SAVE_LIMIT is stopped here and the bar says so.
export function startSave(edits, file) {
  const write = saveOf(edits, file);
  if (!write) return { edits, write: null };
  if (utf8Bytes(write.text) > SAVE_LIMIT) return { edits: withBar(edits, file, { kind: "failed", reason: "large" }), write: null };
  return { edits, write };
}

// What a rejection of writeTextFile means: "changed" (the file no longer holds `expected`;
// Herdr says the same when the file is gone, so read it again to tell which), "permission",
// "large", or "other". Matched on Herdr's wording in mod_files.rs and Rust's io errors.
export function refusalOf(error) {
  const message = messageOf(error);
  if (/^The file changed /.test(message)) return "changed";
  if (/exceeds 1 MiB/.test(message)) return "large";
  if (/\(os error (13|1|30)\)/.test(message)) return "permission";
  return "other";
}

// A save of `file` was refused for a reason other than a change on disk: the edits stay,
// and the bar says why.
export function saveFailed(edits, file, error) {
  if (!file || !edits[file]) return edits;
  const reason = refusalOf(error);
  const bar = { kind: "failed", reason, ...(reason === "other" ? { detail: messageOf(error) } : {}) };
  return withBar(edits, file, bar);
}

// Handing `file`'s edits to a new viewer tab, as { edits, edit }: `edit` is the file's entry,
// bar included, or null when it has none; `edits` no longer holds it, so this viewer shows
// the disk text.
export function takeEdit(edits, file) {
  const entry = file ? edits[file] : null;
  if (!entry) return { edits, edit: null };
  return { edits: without(edits, file), edit: { ...entry } };
}

// The viewer tab receiving an entry that takeEdit gave, through the handoff file. Anything
// that is not an entry puts nothing in.
export function putEdit(edits, file, edit) {
  if (!file || typeof edit?.disk !== "string" || typeof edit?.text !== "string") return edits;
  const { disk, text, bar } = edit;
  return { ...edits, [file]: bar && typeof bar === "object" ? { disk, text, bar } : { disk, text } };
}

const MESSAGES = {
  conflict: "밖에서 바뀌었습니다",
  deleted: "파일이 지워졌습니다.",
  permission: "이 파일에 쓸 권한이 없습니다.",
  large: "저장하기에는 너무 큽니다.",
};

// What the bar above the content says for `file`, as { kind, message }, or null for no bar.
// "conflict" carries the two buttons (discard and overwrite); "failed" only says why.
export function barOf(edits, file) {
  const bar = file ? edits[file]?.bar : null;
  if (!bar) return null;
  if (bar.kind === "conflict") return { kind: bar.kind, message: MESSAGES.conflict };
  return { kind: bar.kind, message: MESSAGES[bar.reason] ?? `저장하지 못했습니다: ${bar.detail}` };
}

function messageOf(error) {
  return String(error?.message ?? error ?? "");
}

// Written out because the mod's runtime is not known to have TextEncoder. A lone surrogate
// counts as the three bytes of the U+FFFD it becomes.
function utf8Bytes(text) {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
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
