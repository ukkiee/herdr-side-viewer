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
};

function extensionOf(file) {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

// `groups` is extensions.json: the handed-over extensions by view. Returns
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

// What a finished read does to the content on screen:
// "keep": nothing changed, so nothing is redrawn and the scroll position stays.
// "retext": the code changed; its editor takes the new text and keeps its place.
// "replace": anything else.
export function refreshOf(shown, next) {
  if (shown.state !== next.state) return "replace";
  const same = shown.text === next.text && shown.language === next.language && shown.path === next.path
    && shown.size?.width === next.size?.width && shown.size?.height === next.size?.height;
  if (same) return "keep";
  if (next.state === "code" && shown.editor && shown.language === next.language) return "retext";
  return "replace";
}
