// Splits a markdown document into the blocks the markdown view draws one by one. Text inside
// a block (links, bold, italic, inline code, strikethrough) is left as written: the view
// hands it to a TextView. No Herdr imports, so it runs under `node --test`.
//
// parseMarkdown(text) returns { blocks, footnotes, references }:
//   blocks      the document's blocks, in order. Each is one of:
//     { type: "heading", level, text }               level 1..6
//     { type: "paragraph", text }                    the lines as written, joined by "\n"
//     { type: "list", kind, items }                  kind of the first item
//         item: { kind: "bullet" | "ordered" | "task", number?, checked?, blocks }
//               number only on "ordered", checked only on "task"; blocks are the item's
//               own content, nested lists and code blocks included. A "task" item also
//               has `line`, the 0-based source line of its box (checkbox.js), kept out of
//               the item's enumerable fields
//     { type: "quote", blocks }
//     { type: "table", align, header, rows }         align: "left" | "center" | "right" per column
//     { type: "rule" }
//     { type: "image", alt, src }                    an image alone on its line
//     { type: "code", lang, text }                   lang is "" when the fence names none
//   footnotes   [{ label, number, text }], numbered by first reference in the document;
//               definitions never referenced come last
//   references  link reference definitions ("[name]: url") as written. A TextView only sees
//               one block, so the view appends these for reference-style links to resolve.
//
// Every line keeps its source line number (`at`) through quotes and list items, so a block
// can say which source line it came from.

const FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])(?=[ \t]|$)([ \t]*)(.*)$/;
const TASK = /^\[([ xX])\](?:[ \t]+|$)(.*)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const DELIMITER = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const IMAGE = /^ {0,3}!\[([^\]]*)\]\([ \t]*(?:<([^>]+)>|([^)\s]+))(?:[ \t]+"[^"]*")?[ \t]*\)[ \t]*$/;
const FOOTNOTE = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
const REFERENCE = /^ {0,3}\[[^\]^][^\]]*\]:[ \t]*\S+/;
const FOOTNOTE_REF = /\[\^([^\]\s]+)\]/g;
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

const isBlank = (text) => /^[ \t]*$/.test(text);

// Leading tabs count as four columns, so indentation can be compared by spaces.
function expandTabs(text) {
  const lead = text.match(/^[ \t]*/)[0];
  let out = "";
  for (const ch of lead) out += ch === "\t" ? " ".repeat(4 - (out.length % 4)) : ch;
  return out + text.slice(lead.length);
}

const indentOf = (text) => text.match(/^ */)[0].length;
const dedent = (text, columns) => text.slice(Math.min(columns, indentOf(text)));

function listItem(text) {
  const m = ITEM.exec(text);
  if (!m) return null;
  const ordered = /\d/.test(m[2][0]);
  const gap = m[4] === "" ? 1 : m[3].length;
  // More than four spaces after the marker is code inside the item, which then starts one column in.
  const content = m[1].length + m[2].length + (gap > 4 ? 1 : gap);
  const rest = gap > 4 ? " ".repeat(gap - 1) + m[4] : m[4];
  const task = ordered ? null : TASK.exec(rest);
  if (task) return { kind: "task", checked: task[1] !== " ", content, first: task[2] };
  if (ordered) return { kind: "ordered", number: Number(m[2].slice(0, -1)), content, first: rest };
  return { kind: "bullet", content, first: rest };
}

function splitRow(text) {
  let row = text.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

// A header row followed by a delimiter row with the same number of cells.
function tableAt(lines, i) {
  if (i + 1 >= lines.length || !lines[i].text.includes("|")) return null;
  const delimiter = lines[i + 1].text;
  if (!delimiter.includes("-") || !DELIMITER.test(delimiter)) return null;
  const header = splitRow(lines[i].text);
  const align = splitRow(delimiter).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    return left && right ? "center" : right ? "right" : "left";
  });
  return header.length === align.length ? { header, align } : null;
}

// Whether a line ends a paragraph by starting another block.
function interrupts(lines, i) {
  const text = lines[i].text;
  if (isBlank(text) || FENCE.test(text) || HEADING.test(text) || RULE.test(text) || QUOTE.test(text)) return true;
  const item = listItem(text);
  if (item && !isBlank(item.first) && (item.kind !== "ordered" || item.number === 1)) return true;
  return tableAt(lines, i) !== null;
}

function parseBlocks(lines, found) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const text = lines[i].text;
    if (isBlank(text)) {
      i++;
      continue;
    }

    const fence = FENCE.exec(text);
    if (fence && !(fence[2][0] === "`" && fence[3].includes("`"))) {
      const [, indent, marks, info] = fence;
      const close = new RegExp(`^ {0,3}${marks[0] === "`" ? "`" : "~"}{${marks.length},}[ \\t]*$`);
      const body = [];
      i++;
      while (i < lines.length && !close.test(lines[i].text)) body.push(dedent(lines[i++].text, indent.length));
      i++;
      blocks.push({ type: "code", lang: info.trim().split(/\s+/)[0] ?? "", text: body.join("\n") });
      continue;
    }

    if (indentOf(text) >= 4) {
      const body = [];
      while (i < lines.length && (indentOf(lines[i].text) >= 4 || isBlank(lines[i].text))) body.push(dedent(lines[i++].text, 4));
      while (body.length && isBlank(body[body.length - 1])) body.pop();
      blocks.push({ type: "code", lang: "", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(text);
    if (heading) {
      const title = heading[2].trim().replace(/(^|[ \t])#+$/, "").trim();
      blocks.push({ type: "heading", level: heading[1].length, text: title });
      i++;
      continue;
    }

    if (RULE.test(text)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (QUOTE.test(text)) {
      const inner = [];
      while (i < lines.length) {
        const line = lines[i].text;
        if (QUOTE.test(line)) inner.push({ text: line.replace(QUOTE, ""), at: lines[i].at });
        // A line without ">" right after quoted text carries on that text.
        else if (!isBlank(line) && inner.length && !isBlank(inner[inner.length - 1].text) && !interrupts(lines, i)) inner.push(lines[i]);
        else break;
        i++;
      }
      blocks.push({ type: "quote", blocks: parseBlocks(inner, found) });
      continue;
    }

    if (listItem(text)) {
      i = parseList(lines, i, blocks, found);
      continue;
    }

    const footnote = FOOTNOTE.exec(text);
    if (footnote) {
      const body = [footnote[2]];
      i++;
      while (i < lines.length) {
        const line = lines[i].text;
        if (isBlank(line)) {
          let k = i;
          while (k < lines.length && isBlank(lines[k].text)) k++;
          if (k < lines.length && indentOf(lines[k].text) >= 2) {
            for (; i < k; i++) body.push("");
            continue;
          }
          break;
        }
        if (indentOf(line) >= 2 || !interrupts(lines, i) && !FOOTNOTE.test(line) && !REFERENCE.test(line)) body.push(line.trim());
        else break;
        i++;
      }
      found.footnotes.push({ label: footnote[1], text: body.join("\n").trim() });
      continue;
    }

    if (REFERENCE.test(text)) {
      found.references.push(text.trim());
      i++;
      continue;
    }

    const table = tableAt(lines, i);
    if (table) {
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].text.includes("|") && !interrupts(lines, i)) {
        const cells = splitRow(lines[i++].text);
        rows.push(table.header.map((_, column) => cells[column] ?? ""));
      }
      blocks.push({ type: "table", align: table.align, header: table.header, rows });
      continue;
    }

    const image = IMAGE.exec(text);
    if (image) {
      blocks.push({ type: "image", alt: image[1], src: image[2] ?? image[3] });
      i++;
      continue;
    }

    const paragraph = [text.trim()];
    i++;
    let level = 0;
    while (i < lines.length) {
      const setext = SETEXT.exec(lines[i].text);
      if (setext) {
        level = setext[1][0] === "=" ? 1 : 2;
        i++;
        break;
      }
      if (interrupts(lines, i)) break;
      paragraph.push(lines[i++].text.trim());
    }
    const joined = paragraph.join("\n");
    blocks.push(level ? { type: "heading", level, text: joined } : { type: "paragraph", text: joined });
  }
  return blocks;
}

// Reads one list starting at line i into `blocks` and returns the line after it.
function parseList(lines, i, blocks, found) {
  const first = listItem(lines[i].text);
  const list = { type: "list", kind: first.kind, items: [] };
  blocks.push(list);
  let item = first;
  for (;;) {
    // Lines indented under the item belong to it; two spaces are enough, so "1." items can
    // be written with the common two-space indent.
    const under = Math.min(item.content, 2);
    const start = i;
    const own = [{ text: item.first, at: lines[i].at }];
    let fenced = FENCE.test(item.first);
    i++;
    while (i < lines.length) {
      const line = lines[i].text;
      if (isBlank(line)) {
        let k = i;
        while (k < lines.length && isBlank(lines[k].text)) k++;
        if (k < lines.length && (fenced || indentOf(lines[k].text) >= under)) {
          for (; i < k; i++) own.push({ text: "", at: lines[i].at });
          continue;
        }
        break;
      }
      const indented = indentOf(line) >= under;
      // A line that is not indented still carries on the item's last paragraph.
      const lazy = !indented && !fenced && !isBlank(own[own.length - 1].text) && !listItem(line) && !interrupts(lines, i);
      if (!indented && !lazy && !fenced) break;
      const text = indented ? dedent(line, item.content) : line;
      if (FENCE.test(text)) fenced = !fenced;
      own.push({ text, at: lines[i].at });
      i++;
    }
    const entry = { kind: item.kind };
    if (item.kind === "ordered") entry.number = item.number;
    if (item.kind === "task") entry.checked = item.checked;
    entry.blocks = parseBlocks(own, found);
    // Not enumerable, so an item still compares equal to one written without it.
    if (item.kind === "task") Object.defineProperty(entry, "line", { value: lines[start].at });
    list.items.push(entry);

    let k = i;
    while (k < lines.length && isBlank(lines[k].text)) k++;
    const next = k < lines.length ? listItem(lines[k].text) : null;
    if (!next) return i;
    const ordered = (kind) => kind === "ordered";
    // Next to each other, points and checkboxes make one list. After a blank line only an
    // item of the same kind carries the list on.
    const carries = k === i ? ordered(next.kind) === ordered(item.kind) : next.kind === item.kind;
    if (!carries) return i;
    i = k;
    item = next;
  }
}

function inlineTexts(blocks, out) {
  for (const block of blocks) {
    if (block.type === "heading" || block.type === "paragraph") out.push(block.text);
    else if (block.type === "quote") inlineTexts(block.blocks, out);
    else if (block.type === "list") for (const item of block.items) inlineTexts(item.blocks, out);
    else if (block.type === "table") out.push(...block.header, ...block.rows.flat());
  }
  return out;
}

export function parseMarkdown(text) {
  const source = typeof text === "string" ? text : "";
  const lines = source.split(/\r?\n/).map((line, at) => ({ text: expandTabs(line), at }));
  const found = { footnotes: [], references: [] };
  const blocks = parseBlocks(lines, found);

  const defined = new Map();
  for (const note of found.footnotes) if (!defined.has(note.label)) defined.set(note.label, note.text);
  const order = [];
  for (const inline of inlineTexts(blocks, [])) {
    for (const [, label] of inline.matchAll(FOOTNOTE_REF)) {
      if (defined.has(label) && !order.includes(label)) order.push(label);
    }
  }
  for (const label of defined.keys()) if (!order.includes(label)) order.push(label);
  const footnotes = order.map((label, index) => ({ label, number: index + 1, text: defined.get(label) }));

  return { blocks, footnotes, references: found.references };
}

// Replaces each "[^label]" with its footnote's number in superscript digits. Labels without a
// definition stay as written.
export function withFootnoteMarks(text, footnotes) {
  const numbers = new Map((footnotes ?? []).map((note) => [note.label, note.number]));
  return text.replace(FOOTNOTE_REF, (whole, label) => {
    const number = numbers.get(label);
    return number === undefined ? whole : String(number).replace(/\d/g, (digit) => SUPERSCRIPT[digit]);
  });
}
