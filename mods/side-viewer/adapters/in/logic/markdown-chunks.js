// A long markdown document is drawn in chunks: runs of its top-level blocks, each drawn by a
// view of its own (markdown-document.js). Herdr stops a render() that runs past 50 ms and
// keeps the last drawing under the banner "This view could not be re-rendered", and one
// render() over a whole long document can run that long, the parse alone a fair part of it.
// So the document is parsed once per text, outside render(), and each chunk is drawn in a
// render() of its own, which only draws its own blocks. No Herdr imports, so it runs under
// `node --test`.
import { parseMarkdown } from "../../../core/domain/markdown-blocks.js";

// How much one chunk holds: characters of text, plus PER_PART for each block, list item and
// table cell, since each of those costs elements of its own to draw. A single block larger
// than this (a long table, say) is still one chunk: blocks are never split.
export const CHUNK_SIZE = 4000;
const PER_PART = 40;

// The drawing size of one block, as CHUNK_SIZE counts it.
export function sizeOf(block) {
  switch (block.type) {
    case "list":
      return PER_PART + block.items.reduce((sum, item) => sum + PER_PART + sizesOf(item.blocks), 0);
    case "quote":
      return PER_PART + sizesOf(block.blocks);
    case "table":
      return PER_PART + [block.header, ...block.rows]
        .reduce((sum, row) => sum + row.reduce((cells, cell) => cells + PER_PART + String(cell ?? "").length, 0), 0);
    case "image":
      return PER_PART + String(block.src ?? "").length;
    default:
      return PER_PART + String(block.text ?? "").length;
  }
}

const sizesOf = (blocks) => (blocks ?? []).reduce((sum, block) => sum + sizeOf(block), 0);

// The chunks of `blocks`, as [{ start, end }] ranges of indices in order, covering every
// block once. A chunk takes blocks until the next would take it past `limit`.
export function chunksOf(blocks, limit = CHUNK_SIZE) {
  const chunks = [];
  let start = 0;
  let size = 0;
  blocks.forEach((block, index) => {
    const own = sizeOf(block);
    if (index > start && size + own > limit) {
      chunks.push({ start, end: index });
      start = index;
      size = 0;
    }
    size += own;
  });
  if (start < blocks.length) chunks.push({ start, end: blocks.length });
  return chunks;
}

// How many code blocks `blocks` hold, inside lists and quotes too, in the order code-card.js
// makes cards for them: a chunk's first card is the count of the chunks before it.
export function codeCountOf(blocks) {
  let count = 0;
  for (const block of blocks ?? []) {
    if (block.type === "code") count++;
    else if (block.type === "quote") count += codeCountOf(block.blocks);
    else if (block.type === "list") for (const item of block.items) count += codeCountOf(item.blocks);
  }
  return count;
}

// The parse of the last texts a viewer copy showed, so the drawing, the code cards and the
// image copies share one parse per text. Each copy keeps its own (main.js).
export function parseMemo() {
  return [];
}

const KEPT = 2;

export function parsedOf(memo, text) {
  const found = memo.find((entry) => entry.text === text);
  if (found) return found.doc;
  const doc = parseMarkdown(text);
  memo.unshift({ text, doc });
  memo.length = Math.min(memo.length, KEPT);
  return doc;
}
