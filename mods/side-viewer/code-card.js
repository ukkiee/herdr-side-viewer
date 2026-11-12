// Code block cards in the markdown view: the code in a read-only editor for its colors, the
// language's name and a copy button under it.
//
// Editor state cannot be made while drawing, so a viewer keeps one CodeCards and calls
// prepare() with the markdown it shows whenever that text or the theme may have changed
// (after a read, on an edit). Drawing then only picks up the state made for each block.
//
// The editor is drawn taller than the code and cut to the code's height (code-blocks.js,
// editorRows), so it has nothing to scroll and a wheel over the card scrolls the document.
// A clear layer over it takes presses: a focused editor always draws its cursor, and a mod
// cannot turn that off.
import { div, svg, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex, EditorState, Editor } from "gpui-base";
import { parseMarkdown } from "./markdown-blocks.js";
import { codeLanguageOf, wrappedRows, editorRows, cardFill } from "./code-blocks.js";

const FONT = 13;
// The editor's row height at FONT.
const ROW = 21;
const RADIUS = 8;
const PADDING = 16;
// Room the editor may keep beside its text, so the wrap estimate errs toward more rows.
const SLACK = 8;
const COPIED_MS = 1500;

// Every code block in `blocks`, inside lists and quotes too, in the order they are drawn.
function codeBlocksOf(blocks, found = []) {
  for (const block of blocks) {
    if (block.type === "code") found.push(block);
    else if (block.type === "quote") codeBlocksOf(block.blocks, found);
    else if (block.type === "list") for (const item of block.items) codeBlocksOf(item.blocks, found);
  }
  return found;
}

const sameBlock = (card, block) => card.lang === block.lang && card.text === block.text;

export class CodeCards {
  constructor() {
    // One card per code block, in document order.
    this.cards = [];
    this.made = 0;
    // The syntax colors and font the editors were made with: their colors are fixed then.
    this.look = null;
  }

  // Makes editor state for the code blocks of `text` and releases what no block uses any
  // more. A block whose language and code are unchanged keeps its card. `syntax` is the
  // code view's colors, `font` the code font or null. Returns whether any card changed, so
  // the caller can redraw.
  prepare(text, { syntax, font }) {
    const blocks = text ? codeBlocksOf(parseMarkdown(text).blocks) : [];
    const look = JSON.stringify([syntax, font ?? null]);
    let changed = false;
    if (look !== this.look) {
      changed = this.cards.length > 0;
      this.release();
      this.look = look;
    }
    const spare = [...this.cards];
    const cards = blocks.map((block) => {
      const at = spare.findIndex((card) => sameBlock(card, block));
      if (at >= 0) return spare.splice(at, 1)[0];
      changed = true;
      return this.make(block, syntax, font);
    });
    for (const card of spare) card.editor.release();
    if (spare.length) changed = true;
    this.cards = cards;
    return changed;
  }

  release() {
    for (const card of this.cards) card.editor.release();
    this.cards = [];
  }

  make(block, syntax, font) {
    const kind = codeLanguageOf(block.lang);
    const editor = EditorState.new({
      value: block.text, readonly: true, soft_wrap: true, line_numbers: false, folding: false,
      font_size: FONT, syntax,
      ...(kind.language ? { language: kind.language } : {}),
      ...(font ? { font_family: font } : {}),
    });
    // `shell` is for the run-in-terminal button beside the copy button.
    return {
      id: ++this.made, lang: block.lang, text: block.text, ...kind, editor,
      // The card's size from its size report, null until the first one.
      size: null,
      // Nonzero while the copy button shows its check mark.
      copied: 0,
    };
  }

  // A cursor for one drawing of the document: blocks come in document order, the same order
  // prepare() found them in, so each takes the next card that matches it.
  drawing() {
    let next = 0;
    return (block) => {
      const at = this.cards.findIndex((card, index) => index >= next && sameBlock(card, block));
      if (at < 0) return null;
      next = at + 1;
      return this.cards[at];
    };
  }
}

// A code block's card. `take` is a CodeCards drawing cursor, or null; a block without a
// prepared card (nothing prepared yet) shows its code as plain text in the same card.
export function renderCodeCard(t, take, block, key) {
  const card = take?.(block) ?? null;
  const kind = card ?? codeLanguageOf(block.lang);
  const fill = cardFill(t);
  const id = card ? `side-viewer-code-${card.id}` : `side-viewer-code-${key}`;
  return v_flex().w_full().min_w(0).relative().rounded(RADIUS).bg(fill.solid ?? fill.bottom)
    .child(renderFill(id, card, fill))
    .child(div().absolute().inset_0().rounded(RADIUS).border(1).border_color(t.border))
    .child(v_flex().w_full().min_w(0).pt(PADDING).px(PADDING).pb(12).gap(12)
      .child(card ? renderCode(id, card) : renderPlain(block))
      .child(h_flex().w_full().min_w(0).h(20).items_center().justify_between().gap(8)
        .child(div().min_w(0).truncate().text_size(12).text_color(t.muted).child(kind.label))
        .child(h_flex().flex_none().items_center().gap(4).children(renderActions(t, id, card, block)))));
}

// The gradient on a dark theme, drawn as a rounded shape over the card's plain bottom color.
// Its corners need the card's size, so it appears after the first size report. The layer is
// there on a light theme too: it is what reports the size the wrap estimate needs.
function renderFill(id, card, fill) {
  const layer = div().id(`${id}-fill`).absolute().inset_0()
    .on_size_change((size, cx) => {
      if (!card || (card.size?.width === size.width && card.size?.height === size.height)) return;
      card.size = { width: size.width, height: size.height };
      cx.notify();
    });
  const size = card?.size;
  if (fill.solid || !(size?.width > 2 * RADIUS) || !(size.height > 2 * RADIUS)) return layer;
  const shape = roundedRect(size.width, size.height, RADIUS);
  return layer.child(window.paint_path(shape, Background.linear_gradient(180, fill.top, fill.bottom)).size_full());
}

function roundedRect(width, height, r) {
  return PathBuilder.fill()
    .move_to(r, 0).line_to(width - r, 0).arc_to(r, r, 0, false, true, width, r)
    .line_to(width, height - r).arc_to(r, r, 0, false, true, width - r, height)
    .line_to(r, height).arc_to(r, r, 0, false, true, 0, height - r)
    .line_to(0, r).arc_to(r, r, 0, false, true, r, 0)
    .close().build();
}

// The editor, cut to the code's rows, under the layer that takes presses. Without a press
// the editor never takes the keyboard, so it draws no cursor and selects nothing.
function renderCode(id, card) {
  const width = card.size ? card.size.width - 2 * PADDING - SLACK : null;
  const rows = wrappedRows(card.text, width, FONT);
  const swallow = (_event, cx) => cx.stop_propagation();
  return div().w_full().min_w(0).h(rows * ROW).relative().overflow_hidden()
    .child(Editor.new(card.editor).absolute().top(0).left(0).w_full().h(editorRows(rows) * ROW))
    .child(div().id(`${id}-cover`).absolute().inset_0().cursor_default()
      .on_mouse_down("left", swallow).on_mouse_down("right", swallow).on_mouse_down("middle", swallow));
}

// Before any card is prepared: the code as plain text, line for line.
function renderPlain(block) {
  return v_flex().w_full().min_w(0).text_size(FONT).children(block.text.split("\n")
    .map((line) => div().w_full().min_w(0).min_h(ROW).child(line)));
}

// The buttons at the card's bottom right. A shell block's run-in-terminal button goes before
// the copy button (card.shell says whether the block is one).
function renderActions(t, id, card, block) {
  return [renderCopy(t, id, card, block)];
}

// Puts the whole block on the clipboard, then shows a check mark for a moment.
function renderCopy(t, id, card, block) {
  return h_flex().id(`${id}-copy`).flex_none().size(20).rounded(4).items_center().justify_center()
    .cursor_pointer().text_color(t.muted).hover((style) => style.bg(t.hover).text_color(t.foreground))
    .on_click((_event, cx) => {
      cx.stop_propagation();
      cx.write_to_clipboard(block.text);
      if (!card) return;
      const turn = card.copied = Date.now();
      cx.notify();
      cx.timer.after(COPIED_MS, (cx) => {
        if (card.copied !== turn) return;
        card.copied = 0;
        cx.notify();
      });
    })
    .child(svg(`mods/side-viewer/${card?.copied ? "check" : "copy"}.svg`).size(16));
}
