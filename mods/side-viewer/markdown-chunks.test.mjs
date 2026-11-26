import { test } from "node:test";
import assert from "node:assert/strict";
import { CHUNK_SIZE, sizeOf, chunksOf, codeCountOf, parseMemo, parsedOf } from "./markdown-chunks.js";
import { parseMarkdown } from "./markdown-blocks.js";

const paragraph = (length) => ({ type: "paragraph", text: "x".repeat(length) });

test("a short document is one chunk", () => {
  const { blocks } = parseMarkdown("# Title\n\nSome text.\n\n- one\n- two\n");
  assert.deepEqual(chunksOf(blocks), [{ start: 0, end: blocks.length }]);
});

test("an empty document has no chunks", () => {
  assert.deepEqual(chunksOf([]), []);
});

test("chunks cover every block once, in order, and none passes the limit unless one block does", () => {
  const blocks = Array.from({ length: 50 }, (_, index) => paragraph(300 + (index % 7) * 90));
  const chunks = chunksOf(blocks);
  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].start, 0);
  assert.equal(chunks.at(-1).end, blocks.length);
  for (let i = 1; i < chunks.length; i++) assert.equal(chunks[i].start, chunks[i - 1].end);
  for (const { start, end } of chunks) {
    assert.ok(end > start);
    const size = blocks.slice(start, end).reduce((sum, block) => sum + sizeOf(block), 0);
    assert.ok(size <= CHUNK_SIZE, `chunk ${start}..${end} holds ${size}`);
  }
});

test("a block larger than the limit is a chunk of its own, never split", () => {
  const blocks = [paragraph(100), paragraph(CHUNK_SIZE * 3), paragraph(100)];
  assert.deepEqual(chunksOf(blocks), [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }]);
});

test("list items, quotes and table cells count toward a block's size", () => {
  const { blocks } = parseMarkdown([
    "- a", "- b", "- c", "",
    "> quoted", "",
    "| h1 | h2 |", "| --- | --- |", "| a | b |", "| c | d |", "",
  ].join("\n"));
  const [list, quote, table] = blocks;
  assert.ok(sizeOf(list) > sizeOf({ type: "paragraph", text: "abc" }));
  assert.ok(sizeOf(quote) > sizeOf({ type: "paragraph", text: "quoted" }));
  assert.ok(sizeOf(table) >= 6 * 40);
});

test("code blocks are counted inside lists and quotes, as the cards are made", () => {
  const { blocks } = parseMarkdown([
    "```sh", "echo 1", "```", "",
    "- item", "", "  ```js", "  x()", "  ```", "",
    "> ```", "> quoted", "> ```", "",
  ].join("\n"));
  assert.equal(codeCountOf(blocks), 3);
  assert.equal(codeCountOf(blocks.slice(1)), 2);
});

test("the memo parses a text once and keeps the last two texts", () => {
  const memo = parseMemo();
  const a = parsedOf(memo, "# A");
  assert.equal(parsedOf(memo, "# A"), a);
  const b = parsedOf(memo, "# B");
  assert.equal(parsedOf(memo, "# A"), a);
  parsedOf(memo, "# C");
  parsedOf(memo, "# B");
  assert.notEqual(parsedOf(memo, "# A"), a);
  assert.equal(b.blocks[0].text, "B");
});
