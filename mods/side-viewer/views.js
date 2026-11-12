// Which view a file gets, its syntax language, and what stops it being drawn. No Herdr
// imports, so it runs under `node --test`.

export const TEXT_LIMIT = 1024 * 1024;
export const IMAGE_LIMIT = 20 * 1024 * 1024;

// Extension to the code editor's language name. The editor draws a name it does not know
// as plain text, so a wrong guess here costs colors, never an error. TypeScript and JSX
// borrow JavaScript's colors because the editor has none of their own.
const LANGUAGES = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  jscript: "javascript", javascript: "javascript", ts: "javascript", tsx: "javascript",
  json: "json", jsonc: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  css: "css", scss: "scss",
  py: "python", go: "go", rs: "rust", rb: "ruby", rbw: "ruby",
  java: "java", jav: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", cp: "cpp", "c++": "cpp", cc: "cpp", cxx: "cpp",
  sh: "bash", zsh: "bash", sql: "sql", xml: "xml",
  html: "html", htm: "html", shtml: "html", shtm: "html",
};

// A file's extension in lower case, or "" without one.
export function extensionOf(file) {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

// `groups` is extensions.json: the listed extensions by group. Returns
// { view: "markdown" | "image" | "code", language } or null for a file with no view.
// `language` is null when the code view should draw without colors.
export function viewOf(file, groups) {
  if (!file || !groups) return null;
  const extension = extensionOf(file);
  if (!extension) return null;
  for (const view of ["markdown", "image", "code"]) {
    if (!groups[view]?.includes(extension)) continue;
    return { view, language: view === "code" ? LANGUAGES[extension] ?? null : null };
  }
  return null;
}

// The content state an image is drawn in. "svg": a picture that also has its source, the
// file's text, to show and edit; only a file named .svg whose bytes are svg (`kind`, from
// image-copies.js) and small enough to read as text. "image": a picture alone. svgz is
// compressed, so it never has a source, whatever its bytes.
export function imageState(file, kind, bytes) {
  return kind === "svg" && extensionOf(file) === "svg" && bytes <= TEXT_LIMIT ? "svg" : "image";
}

// Whether a content state has the header's "rendering | source" switch: the views with a
// source behind what they draw.
export function switchable(state) {
  return state === "markdown" || state === "svg";
}

// Whether a content state has the header's "open in a new tab": drawn content only. A notice
// keeps v1's two actions, the original app and Finder. A file with unsaved edits always has
// a drawn state, since a notice gives way to their editor (editedContentOf).
export function opensInTab(state) {
  return state === "markdown" || state === "code" || state === "image" || state === "svg";
}

// Whether the body for a content state takes typing: the code view, and the markdown and
// svg views while they show the source (`raw`). Renderings, images and notices do not.
export function editable(state, raw) {
  return state === "code" || (switchable(state) && raw === true);
}

// The editor state options a content state gets once its text is read, or null for one
// drawn without an editor. Sources wrap long lines to the pane; code does not.
export function editorOf(state) {
  if (state === "markdown") return { soft_wrap: true };
  if (state === "svg") return { soft_wrap: true, language: "xml" };
  if (state === "code") return { soft_wrap: false };
  return null;
}

// Why a file is not drawn, as a notice state, or null when it can be read and drawn.
// `found` is what viewOf gave, `probe` what readProbe gave.
export function blockerOf(found, probe) {
  if (!found) return "unsupported";
  if (!probe.found) return "missing";
  if (!probe.readable) return "unreadable";
  if (probe.bytes === 0) return "empty";
  if (probe.bytes > (found.view === "image" ? IMAGE_LIMIT : TEXT_LIMIT)) return "large";
  return null;
}

// The notices a file with unsaved edits can run into after it was drawn and edited.
const EDITED_OVER = new Set(["missing", "empty", "large", "unreadable"]);

// What a read of `file` puts on screen while the file has unsaved edits that started from
// `disk`, and their editor is not up (the viewer came back from another file, or a viewer
// tab took the edits). A notice would hide the edits, so the file's view of `disk` comes up
// instead, and its editor shows the edits; the bar says what happened to the file
// (edit-state.js). `found` is what viewOf gave. Anything else is the read's own `content`.
export function editedContentOf(file, content, found, disk) {
  if (!found || typeof disk !== "string" || !EDITED_OVER.has(content?.state)) return content;
  if (found.view === "markdown") return { state: "markdown", text: disk };
  if (found.view === "code") return { state: "code", text: disk, language: found.language };
  // Only an svg's source can be edited. With no disk copy, it draws from the edits' preview.
  if (extensionOf(file) === "svg") return { state: "svg", text: disk, path: null, size: null };
  return content;
}

// Run as `sh -c PROBE sh <file>`. It tells the size before anything reads the file, so a
// huge file is never pulled into the mod, and gives the first bytes for the image check.
// od's -v keeps repeated lines from collapsing into "*".
export const PROBE = `
[ -e "$1" ] || { echo missing; exit 0; }
{ [ -f "$1" ] && [ -r "$1" ]; } || { echo unreadable; exit 0; }
case "$(uname)" in
  Darwin|*BSD) stat -L -f 'file %z %m' "$1" ;;
  *) stat -L -c 'file %s %Y' "$1" ;;
esac
head -c 4096 "$1" | od -An -v -tx1
`;

// The probe's output as { found, readable, bytes, modified, head }. `modified` is in
// seconds, `head` the first bytes as numbers. Output it cannot make sense of counts as
// a file that cannot be read.
export function readProbe(stdout) {
  const lines = String(stdout ?? "").trim().split("\n");
  if (lines[0] === "missing") return { found: false };
  const stat = /^file (\d+) (\d+)$/.exec(lines[0]);
  if (!stat) return { found: true, readable: false };
  const head = lines.slice(1).join(" ").split(/\s+/).filter(Boolean).map((hex) => parseInt(hex, 16));
  return { found: true, readable: true, bytes: Number(stat[1]), modified: Number(stat[2]), head };
}

// Whether a load shows "loading" first. Reading the shown file again (the file watch, the
// slow recheck) must not: the notice would flash over content that is most likely unchanged.
export function showsLoading(shownFile, file) {
  return shownFile !== file;
}

// Whether a load waits for the read under way instead of starting its own. `reading` is the
// file being read, or null. Starting again would throw the earlier read away, so a file
// written faster than it can be read would never get on screen. The caller reads once more
// when the read ends. A read of another file is simply left behind.
export function waitsForRead(reading, file) {
  return Boolean(file) && reading === file;
}

// What to remember of a probe so the next one can be compared with it, or null when it
// cannot be trusted yet. `now` is in seconds. The file's time is in whole seconds, so a
// file changed this second or the last could change again and look the same.
export function settledProbe(file, probe, now) {
  if (!probe?.found || !probe.readable) return null;
  if (now - probe.modified < 2) return null;
  return { file, bytes: probe.bytes, modified: probe.modified };
}

// Whether the file is as it was at the last read (`last` is what settledProbe gave), so its
// text need not be read again.
export function sameProbe(last, file, probe) {
  return Boolean(last && probe?.found && probe.readable)
    && last.file === file && last.bytes === probe.bytes && last.modified === probe.modified;
}

// What a finished read does to the content on screen:
// "keep": nothing changed, so nothing is redrawn and the scroll position stays.
// "retext": the code or the svg changed; its editor takes the new text and keeps its place
// (an svg also takes its new copy).
// "replace": anything else. That includes code under another theme (`theme` is a mark of
// the syntax colors): an editor's colors are fixed when it is made.
export function refreshOf(shown, next) {
  if (shown.state !== next.state) return "replace";
  const look = shown.language === next.language && shown.theme === next.theme;
  const same = shown.text === next.text && look && shown.path === next.path
    && shown.size?.width === next.size?.width && shown.size?.height === next.size?.height;
  if (same) return "keep";
  if ((next.state === "code" || next.state === "svg") && shown.editor && look) return "retext";
  return "replace";
}
