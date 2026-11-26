// The path picker card's size, logical px: the frame around its list, the list's height and the
// card's width in the window. No Herdr imports, so it runs under `node --test`; picker-view.js
// draws the card with these.
//
//   pickerWidthOf(viewportWidth, zoom) -> px
//     the card's width: PICKER_WIDTH, less in a window with no room for it
//   listHeightOf(count, viewportHeight?, zoom?) -> px
//     the list's height for that many rows (ROW each), at most LIST_MAX and within the
//     window's height share, then it scrolls

// One row's height in the picker's list, and how tall the list grows before it scrolls, px.
export const ROW = 32;
export const LIST_MAX = 352;

// The picker card's frame around the list, logical px: its padding, the filter input's height
// and the gap below the input. picker-view.js draws the card with these.
export const CARD_PAD = 14;
export const INPUT_HEIGHT = 36;
export const CARD_GAP = 10;
// How much of the window's height the card may take, as Herdr's own picker popup does.
export const PICKER_HEIGHT_SHARE = 0.8;

// The list's height for `count` rows. The card sizes itself by its content, and a scrolling
// list with no set height gives it none, so the list folds to nothing without this.
// With the window's height (viewport_size(), pixels) and Herdr's zoom, the list also gives up
// height so the card stays within PICKER_HEIGHT_SHARE of the window, keeping at least one row.
export function listHeightOf(count, viewportHeight, zoom) {
  const rows = Math.min(LIST_MAX, count * ROW);
  if (!(viewportHeight > 0)) return rows;
  const scale = zoom > 0 ? zoom : 1;
  const room = viewportHeight / scale * PICKER_HEIGHT_SHARE - (2 * CARD_PAD + INPUT_HEIGHT + CARD_GAP);
  return Math.min(rows, Math.max(ROW, Math.floor(room)));
}

// The picker card's width, logical px: Herdr's own picker width, the room each side of it in a
// narrower window, and the floor below which the card stops shrinking.
export const PICKER_WIDTH = 640;
export const PICKER_SIDE = 16;
export const PICKER_MIN_WIDTH = 240;

// The card's width in a window `viewportWidth` px wide (gpui viewport_size(), in pixels) at
// Herdr's `zoom`. The popup itself covers the whole window, so the card is what must fit.
// An unknown width keeps the full width; an unknown zoom counts as 1.
export function pickerWidthOf(viewportWidth, zoom) {
  const scale = zoom > 0 ? zoom : 1;
  if (!(viewportWidth > 0)) return PICKER_WIDTH;
  const room = viewportWidth / scale - 2 * PICKER_SIDE;
  return Math.max(PICKER_MIN_WIDTH, Math.min(PICKER_WIDTH, room));
}
