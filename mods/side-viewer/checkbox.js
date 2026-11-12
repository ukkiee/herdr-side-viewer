// A click on a checkbox in the markdown rendering changes its source line. No Herdr imports,
// so it runs under `node --test`.

// A task item's box on its source line: quote marks and list markers before it (an item can
// open inside another item, "1. - [ ] x"), then "-", "*" or "+", then the box. The prefix is
// taken as short as it can be, so the box is the first one after the markers and a "[ ]"
// later in the item's text is left alone.
const BOX = /^((?:[ \t]*>[ \t]?|[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)*?[ \t]*[-*+][ \t]+)\[([ xX])\](?=[ \t]|\r|$)/;

// `text` with the box on source line `line` (0-based, a task item's `line` from
// markdown-blocks.js) turned over: "[ ]" becomes "[x]", "[x]" and "[X]" become "[ ]".
// Every other character stays. Null when that line holds no box.
export function toggleCheckbox(text, line) {
  if (typeof text !== "string" || !Number.isInteger(line) || line < 0) return null;
  let start = 0;
  for (let k = 0; k < line; k++) {
    const next = text.indexOf("\n", start);
    if (next < 0) return null;
    start = next + 1;
  }
  const end = text.indexOf("\n", start);
  const source = end < 0 ? text.slice(start) : text.slice(start, end);
  const m = BOX.exec(source);
  if (!m) return null;
  const at = start + m[1].length + 1;
  return text.slice(0, at) + (m[2] === " " ? "x" : " ") + text.slice(at + 1);
}
