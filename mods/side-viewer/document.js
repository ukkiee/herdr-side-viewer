// What the side viewer shows for a file and the text read from it. No Herdr imports, so it
// runs under `node --test`. Which view a file gets is decided in views.js.
import { wordsOf } from "./i18n.js";

// Message keys (messages-body.js).
const NOTICES = {
  large: "body.large",
  none: "body.none",
  empty: "body.empty",
  missing: "body.missing",
  unreadable: "body.unreadable",
  unsupported: "body.unsupported",
  unreachable: "body.unreachable",
  windows: "body.windows",
};

// The text shown in place of the content in tr's language (i18n.js), or null for a state
// that draws no words: the content, or "loading", which shows a spinner (notice-view.js). `state` is a state's name, or a content whose notice names its
// machine ({ state: "unreachable", machine }).
export function noticeFor(state, tr) {
  const content = typeof state === "object" && state ? state : { state };
  const key = NOTICES[content.state];
  return typeof key === "string" ? wordsOf(tr)(key, { machine: content.machine }) : null;
}

// The content for a read of a file on `machine` that was refused, by the kind of refusal
// (remote-results.js failureOf): the machine out of reach, a Windows machine, or a file that
// cannot be read.
export function failedContentOf(failure, machine) {
  if (failure === "unreachable") return { state: "unreachable", machine };
  if (failure === "windows") return { state: "windows" };
  return { state: "unreadable" };
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
