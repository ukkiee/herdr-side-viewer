// What the side viewer shows for a file and the text read from it. No Herdr imports, so it
// runs under `node --test`. Which view a file gets is decided in views.js.
import { wordsOf } from "./i18n.js";

// Message keys (messages-body.js).
const NOTICES = {
  large: "body.large",
  none: "body.none",
  loading: "body.loading",
  empty: "body.empty",
  missing: "body.missing",
  unreadable: "body.unreadable",
  unsupported: "body.unsupported",
};

// The text shown in place of the content in tr's language (i18n.js), or null for a state
// that draws the content.
export function noticeFor(state, tr) {
  return typeof NOTICES[state] === "string" ? wordsOf(tr)(NOTICES[state]) : null;
}

// `text` is what reading the file gave: a string, or null when the file is not there.
// `found` is the file's view from views.js (null: no view for this file).
// Returns { state, text?, language? }; "markdown" and "code" are the states with text to draw.
// Empty or blank text still gets its view, so a new file can be written in at once.
export function contentOf(file, text, found) {
  if (!file) return { state: "none" };
  if (!found || (found.view !== "markdown" && found.view !== "code")) return { state: "unsupported" };
  if (text === null || text === undefined) return { state: "missing" };
  if (found.view === "code") return { state: "code", text, language: found.language };
  return { state: "markdown", text };
}

// The header's two parts: the file name, and its folder with the home folder shortened to "~".
export function labelOf(file, home) {
  const cut = file.lastIndexOf("/");
  const name = file.slice(cut + 1);
  let folder = file.slice(0, cut) || "/";
  if (home && (folder === home || folder.startsWith(home + "/"))) folder = "~" + folder.slice(home.length);
  return { name, folder };
}
