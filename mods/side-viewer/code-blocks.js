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
