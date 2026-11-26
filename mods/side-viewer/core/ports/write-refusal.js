// What a refusal of writeTextFile on this Mac means. No Herdr imports, so it runs under
// `node --test`; file-access.js makes the write, and edit-state.js writeFailed takes the
// failure. Another machine's refusals are read in remote-results.js (saveFailureOf).

// What a rejection of writeTextFile means: "changed" (the file no longer holds `expected`;
// Herdr says the same when the file is gone, so read it again to tell which), "permission",
// "large", or "other". Matched on Herdr's wording in mod_files.rs and Rust's io errors.
export function refusalOf(error) {
  const message = messageOf(error);
  if (message.startsWith("The file changed ")) return "changed";
  if (/exceeds 1 MiB/.test(message)) return "large";
  if (/\(os error (13|1|30)\)/.test(message)) return "permission";
  return "other";
}

// A refusal of writeTextFile other than "changed" as the failure of a write (writeFailed):
// { reason: "permission" | "large" } or { reason: "other", detail } with Herdr's own wording.
export function refusalFailureOf(error) {
  const reason = refusalOf(error);
  return reason === "permission" || reason === "large" ? { reason } : { reason: "other", detail: messageOf(error) };
}

// Herdr's own wording, without the "`herdr.writeTextFile`: " Herdr puts in front of every
// API error: refusalOf anchors on the start of that wording, and hovering the status shows it.
function messageOf(error) {
  return String(error?.message ?? error ?? "").replace(/^`herdr\.[\w.]+`: /, "");
}
