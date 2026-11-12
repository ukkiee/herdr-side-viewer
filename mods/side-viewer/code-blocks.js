// What a code block card shows and how tall it is drawn. No Herdr imports, so it runs under
// `node --test`; code-card.js draws the card.
import { viewOf } from "./views.js";

// Fence languages that mean a shell command. A block that names no language counts too,
// the way Warp treats it.
const SHELLS = new Set(["sh", "shell", "bash", "zsh", "fish", "console"]);

// Label, then the file extension whose colors the code view uses (views.js), then the other
// names a fence may use.
const KNOWN = [
  ["JavaScript", "js", "javascript", "mjs", "cjs", "jscript", "node"],
  ["JSX", "jsx"],
  ["TypeScript", "ts", "typescript", "mts", "cts"],
  ["TSX", "tsx"],
  ["JSON", "json", "jsonc", "json5"],
  ["YAML", "yaml", "yml"],
  ["TOML", "toml"],
  ["CSS", "css"],
  ["SCSS", "scss"],
  ["Python", "py", "python", "python3"],
  ["Go", "go", "golang"],
  ["Rust", "rs", "rust"],
  ["Ruby", "rb", "ruby"],
  ["Java", "java"],
  ["Kotlin", "kt", "kotlin", "kts"],
  ["Swift", "swift"],
  ["C", "c", "h"],
  ["C++", "cpp", "c++", "cc", "cxx", "hpp"],
  ["SQL", "sql"],
  ["XML", "xml"],
  ["HTML", "html", "htm", "xhtml"],
];

const BY_NAME = new Map();
for (const [label, extension, ...names] of KNOWN) {
  for (const name of [extension, ...names]) BY_NAME.set(name, { label, extension });
}

// The code view's syntax language for a file extension, or null when it draws plain text.
function colorsOf(extension) {
  return viewOf(`block.${extension}`, { code: [extension] })?.language ?? null;
}

// A fence's language (markdown-blocks.js `lang`) as { label, language, shell }: the name
// shown on the card, the editor's syntax language or null for plain text, and whether the
// block is a shell command.
export function codeLanguageOf(lang) {
  const name = String(lang ?? "").trim().toLowerCase();
  if (!name) return { label: "Shell", language: null, shell: true };
  if (SHELLS.has(name)) return { label: "Shell", language: colorsOf("sh"), shell: true };
  if (name === "mermaid") return { label: "Mermaid", language: null, shell: false };
  const known = BY_NAME.get(name);
  if (!known) return { label: "Code", language: null, shell: false };
  return { label: known.label, language: colorsOf(known.extension), shell: false };
}

// A code font's glyph is about this share of the font size wide.
const GLYPH = 0.6;
const TAB = 4;

// Columns a character takes: two for Hangul and other wide East Asian characters.
function columnsOf(char) {
  if (char === "\t") return TAB;
  const code = char.codePointAt(0);
  const wide = (code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0xa4cf)
    || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe30 && code <= 0xfe4f) || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6) || (code >= 0x1f300 && code <= 0x1faff)
    || (code >= 0x20000 && code <= 0x3fffd);
  return wide ? 2 : 1;
}

// Rows one line takes when wrapped at `fit` columns, between words where it can: a word that
// does not fit moves to the next row, and a word wider than a row breaks inside.
function rowsOf(line, fit) {
  let rows = 1;
  let used = 0;
  for (const word of line.match(/\S+\s*|\s+/g) ?? []) {
    const chars = Array.from(word);
    const ink = chars.reduce((sum, char) => sum + (/\s/.test(char) ? 0 : columnsOf(char)), 0);
    if (used > 0 && used + ink > fit) {
      rows++;
      used = 0;
    }
    for (const char of chars) {
      const width = columnsOf(char);
      // Spaces at the end of a row hang past it rather than starting another.
      if (used + width > fit && !/\s/.test(char)) {
        rows++;
        used = 0;
      }
      used += width;
    }
  }
  return rows;
}

// About how many rows the editor shows `text` in, wrapped to `width` pixels at `fontSize`.
// An estimate: too many rows only leaves room under the code, too few would cut it off.
// Each line is one row while the width is not known (null).
export function wrappedRows(text, width, fontSize) {
  const lines = String(text).split("\n");
  if (!(width > 0)) return lines.length;
  // The small amount keeps float error from losing a column that fits exactly.
  const fit = Math.max(1, Math.floor(width / (GLYPH * fontSize) + 1e-6));
  return lines.reduce((sum, line) => sum + rowsOf(line, fit), 0);
}

// The editor leaves half its height, at least three rows, empty under the last line and
// lets that scroll. Drawn this tall, all of `rows` fit with nothing left to scroll, so a
// wheel over the card scrolls the document instead; the card shows only the first `rows`.
export function editorRows(rows) {
  return Math.max(2 * rows, rows + 3) + 1;
}
