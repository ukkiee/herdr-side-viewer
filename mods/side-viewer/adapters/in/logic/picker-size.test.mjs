// node --test: the path picker card's size. How tall its list grows for a number of rows and
// in a short window, and how wide the card is in windows of different widths and zooms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listHeightOf, pickerWidthOf, PICKER_MIN_WIDTH } from "./picker-size.js";

// Rows are 32px, as in Herdr's own picker; the list stops growing at 11 rows (352px) and
// scrolls inside. A list with no set height folds to nothing in the popup.
test("the list is as tall as its rows, up to eleven rows", () => {
  assert.equal(listHeightOf(1), 32);
  assert.equal(listHeightOf(3), 96);
  assert.equal(listHeightOf(11), 352);
  assert.equal(listHeightOf(12), 352);
  assert.equal(listHeightOf(40), 352);
  assert.equal(listHeightOf(0), 0);
});

// Measured in a real window: a 1800pt window gets the full 640pt card, a 560pt window a 528pt
// card that leaves 16pt each side. viewport_size() is in pixels, so zoom 2 doubles them.
test("the card is 640 wide, narrower in a window that has no room for it", () => {
  assert.equal(pickerWidthOf(1800, 1), 640);
  assert.equal(pickerWidthOf(560, 1), 528);
  assert.equal(pickerWidthOf(672, 1), 640);
  assert.equal(pickerWidthOf(3600, 2), 640);
  assert.equal(pickerWidthOf(1120, 2), 528);
});

test("the card keeps 640 when the window size is unknown, and a floor in a tiny window", () => {
  assert.equal(pickerWidthOf(0, 1), 640);
  assert.equal(pickerWidthOf(NaN, 1), 640);
  assert.equal(pickerWidthOf(undefined, 1), 640);
  assert.equal(pickerWidthOf(560, undefined), 528);
  assert.equal(pickerWidthOf(560, 0), 528);
  assert.equal(pickerWidthOf(100, 1), PICKER_MIN_WIDTH);
  assert.ok(PICKER_MIN_WIDTH < 528);
});

// The card stays within 0.8 of the window's height, as Herdr's picker popup does. Its frame
// around the list is 74pt (14 padding, the 36pt filter, a 10pt gap, 14 padding), so a 400pt
// window leaves the list 0.8 × 400 − 74 = 246pt, and it scrolls inside that.
test("the list gives up height in a short window, keeping one row", () => {
  assert.equal(listHeightOf(40, 900, 1), 352);
  assert.equal(listHeightOf(3, 400, 1), 96);
  assert.equal(listHeightOf(40, 400, 1), 246);
  assert.equal(listHeightOf(40, 800, 2), 246);
  assert.equal(listHeightOf(40, 100, 1), 32);
  assert.equal(listHeightOf(0, 100, 1), 0);
  assert.equal(listHeightOf(40, undefined, 1), 352);
  assert.equal(listHeightOf(40, NaN, 1), 352);
  assert.equal(listHeightOf(40, 400, undefined), 246);
});
