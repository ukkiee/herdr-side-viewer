// node --test: the copies an edited svg is drawn from before it is saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PREVIEW_FOLDER, previewName, pictureOf } from "./svg-preview.js";
import { olderCopies, staleCopies, FOLDER } from "./image-copies.js";

const DAY = 24 * 60 * 60;

test("the same edited text of the same svg gets the same preview name, any change a new one", () => {
  const name = previewName("/work/logo.svg", "<svg>a</svg>");
  assert.equal(previewName("/work/logo.svg", "<svg>a</svg>"), name);
  assert.notEqual(previewName("/work/logo.svg", "<svg>b</svg>"), name);
  assert.notEqual(previewName("/work/logo.svg", "<svg>ab</svg>"), name);
  assert.notEqual(previewName("/work/other.svg", "<svg>a</svg>"), name);
  assert.match(name, /\.svg$/);
});

test("previews live apart from the disk copies, so cleaning one kind never takes the other", () => {
  assert.notEqual(PREVIEW_FOLDER, FOLDER);
  assert.match(PREVIEW_FOLDER, /^data\/side-viewer\//);
});

test("a new preview finds the earlier previews of the same svg to delete, and no other svg's", () => {
  const first = previewName("/work/logo.svg", "<svg>a</svg>");
  const second = previewName("/work/logo.svg", "<svg>b</svg>");
  const other = previewName("/work/other.svg", "<svg>a</svg>");
  const listing = [`100 ${first}`, `100 ${other}`, `100 ${second}`].join("\n");
  assert.deepEqual(olderCopies(listing, second), [first]);
});

test("previews not touched for 30 days are cleaned like the disk copies", () => {
  const old = previewName("/work/logo.svg", "<svg>a</svg>");
  const fresh = previewName("/work/other.svg", "<svg>a</svg>");
  const now = 100 * DAY;
  const listing = `${now - 31 * DAY} ${old}\n${now - DAY} ${fresh}`;
  assert.deepEqual(staleCopies(listing, now), [old]);
});

const disk = { state: "svg", file: "/work/logo.svg", text: "<svg>a</svg>", path: "data/side-viewer/images/1-12-1.svg", size: { width: 4, height: 2 } };

test("an svg without edits draws its disk copy", () => {
  assert.deepEqual(pictureOf(disk, disk.text, null), { path: disk.path, size: disk.size });
});

test("an edited svg draws the preview of its edited text", () => {
  const preview = { file: disk.file, text: "<svg>b</svg>", path: "data/side-viewer/previews/1-12-9.svg", size: { width: 8, height: 4 } };
  assert.deepEqual(pictureOf(disk, "<svg>b</svg>", preview), { path: preview.path, size: preview.size });
});

test("an edited svg draws nothing until the preview of that very text is written", () => {
  const earlier = { file: disk.file, text: "<svg>b</svg>", path: "data/side-viewer/previews/1-12-9.svg", size: null };
  assert.equal(pictureOf(disk, "<svg>c</svg>", earlier), null);
  assert.equal(pictureOf(disk, "<svg>c</svg>", null), null);
  const otherFile = { ...earlier, file: "/work/other.svg", text: "<svg>c</svg>" };
  assert.equal(pictureOf(disk, "<svg>c</svg>", otherFile), null);
});

test("a just-saved svg keeps its preview until the disk copy of the saved text is read", () => {
  // The save makes the edited text the disk text before the file is read again, so the disk
  // copy on hand is still the picture from before the edit.
  const preview = { file: disk.file, text: "<svg>b</svg>", path: "data/side-viewer/previews/1-12-9.svg", size: null };
  const saved = { ...disk, text: "<svg>b</svg>" };
  assert.deepEqual(pictureOf(saved, saved.text, preview), { path: preview.path, size: null });
  // Edits thrown away: back to the disk copy.
  assert.deepEqual(pictureOf(disk, disk.text, preview), { path: disk.path, size: disk.size });
});
