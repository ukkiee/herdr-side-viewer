// node --test: a code block's language, label and shell flag, and how tall its card is drawn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { codeLanguageOf } from "./code-blocks.js";

test("shell languages and a block without one are labeled Shell", () => {
  for (const lang of ["", "sh", "shell", "bash", "zsh", "fish", "console", "Bash", "SH"]) {
    const found = codeLanguageOf(lang);
    assert.equal(found.label, "Shell", lang);
    assert.equal(found.shell, true, lang);
  }
});

test("a written shell language is colored as bash; no language draws plain", () => {
  assert.equal(codeLanguageOf("sh").language, "bash");
  assert.equal(codeLanguageOf("zsh").language, "bash");
  assert.equal(codeLanguageOf("").language, null);
});

test("known languages get their name and the code view's colors", () => {
  const cases = [
    ["js", "JavaScript", "javascript"],
    ["javascript", "JavaScript", "javascript"],
    ["ts", "TypeScript", "javascript"],
    ["typescript", "TypeScript", "javascript"],
    ["python", "Python", "python"],
    ["py", "Python", "python"],
    ["rust", "Rust", "rust"],
    ["go", "Go", "go"],
    ["json", "JSON", "json"],
    ["yaml", "YAML", "yaml"],
    ["cpp", "C++", "cpp"],
    ["sql", "SQL", "sql"],
  ];
  for (const [lang, label, language] of cases) {
    assert.deepEqual(codeLanguageOf(lang), { label, language, shell: false }, lang);
  }
});

test("language names are matched without case", () => {
  assert.deepEqual(codeLanguageOf("Python"), { label: "Python", language: "python", shell: false });
});

test("mermaid is labeled Mermaid and drawn as plain code", () => {
  assert.deepEqual(codeLanguageOf("mermaid"), { label: "Mermaid", language: null, shell: false });
});

test("any other language is labeled Code without colors", () => {
  for (const lang of ["diff", "brainfuck", "text"]) {
    assert.deepEqual(codeLanguageOf(lang), { label: "Code", language: null, shell: false }, lang);
  }
});
