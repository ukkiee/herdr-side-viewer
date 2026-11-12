// The markdown view's body. It only draws: the text and the switch come from main.js, and a
// click on a link goes back through onLink.
//
// markdown: {
//   text,         the file's text
//   raw,          whether to show the source instead of the rendering
//   generation,   main.js's count of content replacements
//   file,         the shown file, for the folder and name at the top
//   onLink: (url, cx) => void
//   images,       the document's image copies (markdown-image-loader.js, forDocument)
// }
//
// The rendering draws markdown-blocks.js's blocks one by one, each kind in its own function:
// renderHeading, renderParagraph, renderList (renderMarker, renderCheckbox), renderQuote,
// renderTable, renderRule, renderImageBlock, renderCodeBlock, renderFootnotes. Text inside a
// block is a TextView: a mod has no way to style single characters, and TextView keeps links,
// bold, italic, inline code and strikethrough working.
import { div, image } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { home } from "herdr";
import { rawMarkdown } from "./links.js";
import { labelOf } from "./document.js";
import { parseMarkdown, withFootnoteMarks } from "./markdown-blocks.js";
import { imageBoxOf } from "./markdown-images.js";

const BODY = 13;
const HEADING_SIZE = { 1: 24, 2: 19, 3: 16 };
// One line of body text, so a list marker sits level with the item's first line.
const LINE = 20;

// The view is drawn again on every notify; the text only changes with a new generation.
let parsed = { text: null, doc: null };
function documentOf(text) {
  if (parsed.text !== text) parsed = { text, doc: parseMarkdown(text) };
  return parsed.doc;
}

export function renderMarkdown(t, { text, raw, generation, file, onLink, images }) {
  const scroll = div().id("side-viewer-scroll").flex_1().min_h(0).overflow_y_scrollbar();
  if (raw) {
    // The source is drawn by the same element, fenced as one code block.
    // The element needs a new id to draw new text, so the id carries the generation.
    return scroll.child(h_flex().w_full().justify_center()
      .child(v_flex().flex_1().min_w(0).max_w(860).overflow_hidden().px(28).py(24).text_size(14)
        .child(TextView.markdown(`side-viewer-markdown-${generation}-source`, rawMarkdown(text))
          .selectable(true).on_link_click((url, cx) => onLink(url, cx)))));
  }
  const doc = documentOf(text);
  const ctx = {
    t, onLink, footnotes: doc.footnotes,
    images,
    // A TextView sees one block, so reference-style links need the definitions next to them.
    references: doc.references.length ? `\n\n${doc.references.join("\n")}` : "",
    // A TextView keeps drawing its first text under the same id. Unsaved edits change the
    // text without a new generation, so the id also carries a hash of what it draws.
    id: (key, drawn) => `side-viewer-md-${generation}-${key}-${hashOf(drawn)}`,
  };
  return scroll.child(v_flex().w_full().min_w(0).overflow_hidden().px(28).py(24).gap(12).text_size(BODY)
    .when(Boolean(file), (el) => el.child(renderTitle(t, file)))
    .children(renderBlocks(ctx, doc.blocks, "b", 0))
    .when(doc.footnotes.length > 0, (el) => el.child(renderFootnotes(ctx))));
}

// The folder, dimmed, then the file name.
function renderTitle(t, file) {
  const { name, folder } = labelOf(file, home());
  return h_flex().min_w(0).gap(4).text_size(12).mb(4)
    .child(div().min_w(0).truncate().text_color(t.muted).child(folder === "/" ? "/" : `${folder}/`))
    .child(div().flex_none().font_semibold().child(name));
}

// `depth` counts the lists around these blocks, for the bullet's look.
function renderBlocks(ctx, blocks, key, depth) {
  return blocks.map((block, index) => {
    const at = `${key}.${index}`;
    switch (block.type) {
      case "heading": return renderHeading(ctx, block, at, index);
      case "list": return renderList(ctx, block, at, depth);
      case "quote": return renderQuote(ctx, block, at, depth);
      case "table": return renderTable(ctx, block, at);
      case "rule": return renderRule(ctx);
      case "image": return renderImageBlock(ctx, block, at);
      case "code": return renderCodeBlock(ctx, block, at);
      default: return renderParagraph(ctx, block, at);
    }
  });
}

function hashOf(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function renderInline(ctx, key, text) {
  const drawn = withFootnoteMarks(text, ctx.footnotes) + ctx.references;
  return TextView.markdown(ctx.id(key, drawn), drawn)
    .selectable(true).on_link_click((url, cx) => ctx.onLink(url, cx));
}

// Text that must stay one paragraph inside a TextView: a leading "1." or "-" would start a list.
const escapeStart = (text) => text.replace(/^([#>+*-]|\d+[.)])(?=\s|$)/, "\\$1");

// Sizes 24, 19, 16 for levels 1 to 3, body size for the rest; bold, no underline. A heading
// below other blocks gets a little more room above it.
function renderHeading(ctx, block, key, index) {
  return div().w_full().min_w(0).text_size(HEADING_SIZE[block.level] ?? BODY).font_semibold()
    .when(index > 0, (el) => el.mt(block.level <= 2 ? 10 : 4))
    .child(renderInline(ctx, key, escapeStart(block.text)));
}

function renderParagraph(ctx, block, key) {
  return div().w_full().min_w(0).child(renderInline(ctx, key, block.text));
}

// Each item is its marker, then its own blocks (text, nested lists, code) in a column.
function renderList(ctx, block, key, depth) {
  const width = block.items.some((item) => item.kind === "ordered")
    ? 8 + 7 * Math.max(...block.items.map((item) => String(item.number ?? "").length))
    : 16;
  return v_flex().w_full().min_w(0).gap(4).children(block.items.map((item, index) => {
    const at = `${key}.${index}`;
    return h_flex().w_full().min_w(0).items_start().gap(6)
      .child(h_flex().flex_none().w(width).h(LINE).items_center().justify_end()
        .child(renderMarker(ctx, item, at, depth)))
      .child(v_flex().flex_1().min_w(0).gap(4).children(renderBlocks(ctx, item.blocks, at, depth + 1)));
  }));
}

// A filled dot on the first level, a hollow one below it, the number, or a checkbox.
function renderMarker(ctx, item, key, depth) {
  const { t } = ctx;
  if (item.kind === "task") return renderCheckbox(ctx, item, key);
  if (item.kind === "ordered") return div().text_color(t.muted).child(`${item.number}.`);
  const dot = div().size(6).mr(4).rounded_full();
  return depth === 0 ? dot.bg(t.foreground) : dot.border(1).border_color(t.foreground);
}

// The checkbox's look only: a click does nothing yet.
function renderCheckbox(ctx, item, _key) {
  const { t } = ctx;
  const box = h_flex().size(14).rounded(3).border(1).items_center().justify_center();
  return item.checked
    ? box.border_color(t.accent).bg(t.accent).text_color(t.accent_foreground).text_size(10).child("✓")
    : box.border_color(t.muted);
}

// A bar on the left and dimmed text; the blocks inside follow the same rules.
function renderQuote(ctx, block, key, depth) {
  const { t } = ctx;
  return v_flex().w_full().min_w(0).gap(8).pl(12).border_l(3).border_color(t.border).text_color(t.muted)
    .children(renderBlocks(ctx, block.blocks, key, depth));
}

// As wide as its content, scrolling sideways when wider than the pane. Columns sit side by
// side, so each column takes the width of its widest cell. Lines run only between rows.
function renderTable(ctx, block, key) {
  const { t } = ctx;
  const rows = [block.header, ...block.rows];
  const justify = { left: "justify_start", center: "justify_center", right: "justify_end" };
  return div().id(`side-viewer-table-${key}`).w_full().min_w(0).overflow_x_scrollbar()
    .child(h_flex().flex_none().items_start().children(block.header.map((_, column) =>
      v_flex().flex_none().children(rows.map((row, index) => {
        const cell = h_flex().w_full().h(LINE + 12).px(10).items_center()[justify[block.align[column]] ?? "justify_start"]()
          .whitespace_nowrap()
          .when(index < rows.length - 1, (el) => el.border_b(1).border_color(t.border))
          .when(index === 0, (el) => el.font_semibold());
        return cell.child(renderCell(ctx, `${key}.${index}.${column}`, row[column]));
      })))));
}

// A cell with nothing to style is plain text, which takes exactly its own width.
function renderCell(ctx, key, text) {
  const shown = withFootnoteMarks(text, ctx.footnotes);
  if (!/[*_`~[\]<>\\&]/.test(shown)) return shown;
  return renderInline(ctx, key, escapeStart(text));
}

function renderRule(ctx) {
  return div().w_full().h(3).my(4).rounded(2).bg(ctx.t.border);
}

// An image alone on its line, drawn from its copy (markdown-image-loader.js) at its own size,
// shrunk to the block's width and 420 high, centered. The width comes from the block's size
// report, so the image waits for the first one. A remote image is left out entirely:
// TextView could fetch and draw it, and remote images are not drawn.
function renderImageBlock(ctx, block, key) {
  const { t, images } = ctx;
  const found = images?.of(block.src) ?? { state: "remote" };
  if (found.state === "remote") return div();
  const box = h_flex().id(`side-viewer-md-image-${key}`).w_full().min_w(0).justify_center()
    .on_size_change((size, cx) => images.setRoom(key, size.width, cx));
  if (found.state === "failed") {
    return box.child(div().min_w(0).text_color(t.muted).child(`그림을 못 읽음: ${block.src}`));
  }
  const room = images.room(key);
  if (found.state !== "ready" || !(room > 0)) return box;
  const { width, height } = imageBoxOf(found.size, room);
  return box.child(image(found.path).w(width).h(height).flex_none());
}

// A code block, drawn by TextView as a fenced block for now.
function renderCodeBlock(ctx, block, key) {
  let longest = 2;
  for (const run of block.text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  const fence = "`".repeat(longest + 1);
  const source = `${fence}${block.lang}\n${block.text}\n${fence}`;
  return div().w_full().min_w(0).child(TextView.markdown(ctx.id(key, source), source).selectable(true));
}

// The footnotes' text, numbered as their marks in the body, at the end of the document.
function renderFootnotes(ctx) {
  const { t } = ctx;
  return v_flex().w_full().min_w(0).mt(8).pt(12).gap(4).border_t(1).border_color(t.border)
    .text_size(12).text_color(t.muted)
    .children(ctx.footnotes.map((note) => h_flex().w_full().min_w(0).items_start().gap(6)
      .child(div().flex_none().h(LINE).flex().items_center().child(`${note.number}.`))
      .child(div().flex_1().min_w(0).child(renderInline(ctx, `fn.${note.number}`, note.text)))));
}
