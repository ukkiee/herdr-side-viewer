// node --test: a code block's language, label and shell flag, and how tall its card is drawn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { codeLanguageOf, wrappedRows, editorRows, cardFill } from "./code-blocks.js";

// At 13px a column is 7.8px wide, so 78px holds 10 columns.
const TEN = 78;

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

test("each line is a row while the card's width is not known", () => {
  assert.equal(wrappedRows("one\ntwo\n\nfour", null, 13), 4);
});

test("lines that fit the card stay one row each", () => {
  assert.equal(wrappedRows("abc\ndef", 1000, 13), 2);
  assert.equal(wrappedRows("a\n\nb", TEN, 13), 3);
});

test("a long line without spaces breaks at the card's width", () => {
  assert.equal(wrappedRows("a".repeat(10), TEN, 13), 1);
  assert.equal(wrappedRows("a".repeat(11), TEN, 13), 2);
  assert.equal(wrappedRows("a".repeat(25), TEN, 13), 3);
});

test("Hangul takes two columns", () => {
  assert.equal(wrappedRows("가".repeat(5), TEN, 13), 1);
  assert.equal(wrappedRows("가".repeat(6), TEN, 13), 2);
});

test("a line wraps between words, so a word that does not fit starts the next row", () => {
  // "aaa " / "bbbbbbbbb " / "ccc"
  assert.equal(wrappedRows("aaa bbbbbbbbb ccc", TEN, 13), 3);
});

test("a dark theme's card fades from surface to background mixed 3:1 with black", () => {
  assert.deepEqual(cardFill({ surface: "#1e1e1e", background: "#404040" }), { top: "#1e1e1e", bottom: "#303030" });
});

test("a light theme's card is plain surface", () => {
  assert.deepEqual(cardFill({ surface: "#f4f4f4", background: "#ffffff" }), { solid: "#f4f4f4" });
});

test("the editor is drawn taller than its rows, by twice or three more, plus one", () => {
  assert.equal(editorRows(1), 5);
  assert.equal(editorRows(3), 7);
  assert.equal(editorRows(10), 21);
});
