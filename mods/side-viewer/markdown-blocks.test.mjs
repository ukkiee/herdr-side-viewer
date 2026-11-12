// node --test: splitting a markdown document into the blocks the markdown view draws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown, withFootnoteMarks } from "./markdown-blocks.js";

const blocks = (text) => parseMarkdown(text).blocks;

test("headings keep their level and lose the hashes", () => {
  assert.deepEqual(blocks("# One\n## Two ##\n#### Four\n####### seven"), [
    { type: "heading", level: 1, text: "One" },
    { type: "heading", level: 2, text: "Two" },
    { type: "heading", level: 4, text: "Four" },
    { type: "paragraph", text: "####### seven" },
  ]);
});

test("lines run together into one paragraph until a blank line", () => {
  assert.deepEqual(blocks("first line\nsecond **bold** line\n\nnext paragraph\n"), [
    { type: "paragraph", text: "first line\nsecond **bold** line" },
    { type: "paragraph", text: "next paragraph" },
  ]);
});

const para = (text) => ({ type: "paragraph", text });

test("an indented item is a list inside the item above it", () => {
  const sample = "- 첫 번째 항목\n- 두 번째 항목\n  - 들여쓴 항목\n  - 또 하나\n- 세 번째 항목";
  assert.deepEqual(blocks(sample), [{
    type: "list", kind: "bullet", items: [
      { kind: "bullet", blocks: [para("첫 번째 항목")] },
      { kind: "bullet", blocks: [para("두 번째 항목"), {
        type: "list", kind: "bullet", items: [
          { kind: "bullet", blocks: [para("들여쓴 항목")] },
          { kind: "bullet", blocks: [para("또 하나")] },
        ],
      }] },
      { kind: "bullet", blocks: [para("세 번째 항목")] },
    ],
  }]);
});

test("numbered items keep the number written", () => {
  assert.deepEqual(blocks("3. three\n4) four"), [{
    type: "list", kind: "ordered", items: [
      { kind: "ordered", number: 3, blocks: [para("three")] },
      { kind: "ordered", number: 4, blocks: [para("four")] },
    ],
  }]);
});

test("a checkbox item says whether it is checked, with x or X", () => {
  assert.deepEqual(blocks("- [x] 끝난 할 일\n- [ ] 남은 할 일\n* [X] big"), [{
    type: "list", kind: "task", items: [
      { kind: "task", checked: true, blocks: [para("끝난 할 일")] },
      { kind: "task", checked: false, blocks: [para("남은 할 일")] },
      { kind: "task", checked: true, blocks: [para("big")] },
    ],
  }]);
});

test("lists of different kinds split by a blank line are drawn apart", () => {
  const sample = "- 세 번째 항목\n\n1. 순서 있는 목록\n2. 두 번째\n\n- [x] 끝난 할 일\n\n- point";
  assert.deepEqual(blocks(sample).map((b) => [b.type, b.kind, b.items.length]), [
    ["list", "bullet", 1],
    ["list", "ordered", 2],
    ["list", "task", 1],
    ["list", "bullet", 1],
  ]);
});

test("items of the same kind split by a blank line stay one list", () => {
  assert.deepEqual(blocks("- a\n\n- b\n\n\n- c").map((b) => b.items.length), [3]);
});

test("an indented line after a blank line carries the item on", () => {
  assert.deepEqual(blocks("1. step\n\n   more about the step\n2. next"), [{
    type: "list", kind: "ordered", items: [
      { kind: "ordered", number: 1, blocks: [para("step"), para("more about the step")] },
      { kind: "ordered", number: 2, blocks: [para("next")] },
    ],
  }]);
});

test("an unindented line after a blank line ends the list", () => {
  assert.deepEqual(blocks("- item\n\nafter the list"), [
    { type: "list", kind: "bullet", items: [{ kind: "bullet", blocks: [para("item")] }] },
    para("after the list"),
  ]);
});

test("a line right under an item continues its text, indented or not", () => {
  assert.deepEqual(blocks("- wraps\n  here\n- and\nlazily"), [{
    type: "list", kind: "bullet", items: [
      { kind: "bullet", blocks: [para("wraps\nhere")] },
      { kind: "bullet", blocks: [para("and\nlazily")] },
    ],
  }]);
});

test("a code block under an item belongs to the item", () => {
  assert.deepEqual(blocks("- run this:\n\n  ```sh\n  npm test\n\n  npm run build\n  ```\n- done"), [{
    type: "list", kind: "bullet", items: [
      { kind: "bullet", blocks: [para("run this:"), { type: "code", lang: "sh", text: "npm test\n\nnpm run build" }] },
      { kind: "bullet", blocks: [para("done")] },
    ],
  }]);
});

test("a quote holds blocks of its own, read by the same rules", () => {
  const sample = "> 인용문이다.\n> 두 번째 줄.\n>\n> - point\n> ```js\n> x()\n> ```\n> > deeper";
  assert.deepEqual(blocks(sample), [{
    type: "quote", blocks: [
      para("인용문이다.\n두 번째 줄."),
      { type: "list", kind: "bullet", items: [{ kind: "bullet", blocks: [para("point")] }] },
      { type: "code", lang: "js", text: "x()" },
      { type: "quote", blocks: [para("deeper")] },
    ],
  }]);
});

test("a table keeps each column's alignment, header and rows", () => {
  const sample = [
    "| 항목 | 왼쪽 정렬 | 가운데 | 오른쪽 |",
    "|---|:---|:---:|---:|",
    "| 첫째 | 짧음 | 가운데 | 1 |",
    "| 둘째 | 조금 더 긴 내용이 들어간 칸 | 중간 | 1,234 |",
  ].join("\n");
  assert.deepEqual(blocks(sample), [{
    type: "table",
    align: ["left", "left", "center", "right"],
    header: ["항목", "왼쪽 정렬", "가운데", "오른쪽"],
    rows: [["첫째", "짧음", "가운데", "1"], ["둘째", "조금 더 긴 내용이 들어간 칸", "중간", "1,234"]],
  }]);
});

test("a table row with too few cells is filled, and an escaped pipe stays in its cell", () => {
  assert.deepEqual(blocks("a | b\n--|--\n`x \\| y`\n\nafter"), [
    { type: "table", align: ["left", "left"], header: ["a", "b"], rows: [["`x | y`", ""]] },
    para("after"),
  ]);
});

test("three dashes, stars or underscores on their own line are a rule", () => {
  assert.deepEqual(blocks("---\n\n* * *\n\n___"), [{ type: "rule" }, { type: "rule" }, { type: "rule" }]);
});

test("an image alone on its line is an image block; one inside text is not", () => {
  assert.deepEqual(blocks("![저장소의 미리보기 그림](../../../preview.png)\n\nsee ![icon](a.png) here"), [
    { type: "image", alt: "저장소의 미리보기 그림", src: "../../../preview.png" },
    para("see ![icon](a.png) here"),
  ]);
});

test("an image path may sit in angle brackets and be followed by a title", () => {
  assert.deepEqual(blocks('![](<my pic.png>)\n![t](/abs/b.svg "title")'), [
    { type: "image", alt: "", src: "my pic.png" },
    { type: "image", alt: "t", src: "/abs/b.svg" },
  ]);
});

test("footnote definitions leave the body and are numbered by first reference", () => {
  const doc = parseMarkdown("각주가 붙은 문장이다.[^b] 또[^a] 다시[^b]\n\n[^a]: first written.\n[^b]: 각주의 내용.\n    둘째 줄.\n[^unused]: never cited.");
  assert.deepEqual(doc.blocks, [para("각주가 붙은 문장이다.[^b] 또[^a] 다시[^b]")]);
  assert.deepEqual(doc.footnotes, [
    { label: "b", number: 1, text: "각주의 내용.\n둘째 줄." },
    { label: "a", number: 2, text: "first written." },
    { label: "unused", number: 3, text: "never cited." },
  ]);
});

test("a footnote reference becomes its number in superscript", () => {
  const footnotes = [{ label: "1", number: 1, text: "" }, { label: "note", number: 12, text: "" }];
  assert.equal(withFootnoteMarks("문장이다.[^1] and[^note], not[^missing]", footnotes), "문장이다.¹ and¹², not[^missing]");
});

test("a fenced code block keeps its language and its lines as written", () => {
  assert.deepEqual(blocks("```js title=x\n  indented\n\n# not a heading\n```\n~~~\nplain\n~~~"), [
    { type: "code", lang: "js", text: "  indented\n\n# not a heading" },
    { type: "code", lang: "", text: "plain" },
  ]);
});

test("a code block left open runs to the end of the document", () => {
  assert.deepEqual(blocks("````md\n```\ninner\n```"), [{ type: "code", lang: "md", text: "```\ninner\n```" }]);
});

test("link reference definitions are kept apart for the view to append", () => {
  const doc = parseMarkdown("See [the spec][spec].\n\n[spec]: ../side-viewer/spec.md");
  assert.deepEqual(doc.blocks, [para("See [the spec][spec].")]);
  assert.deepEqual(doc.references, ["[spec]: ../side-viewer/spec.md"]);
});

test("a line of = or - under a paragraph makes it a heading", () => {
  assert.deepEqual(blocks("Title\n=====\n\nSub\n---"), [
    { type: "heading", level: 1, text: "Title" },
    { type: "heading", level: 2, text: "Sub" },
  ]);
});
