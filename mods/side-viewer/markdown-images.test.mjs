import { test } from "node:test";
import assert from "node:assert/strict";
import { imageFileOf, imageBoxOf, imagesOf } from "./markdown-images.js";
import { parseMarkdown } from "./markdown-blocks.js";

const DOC = "/Users/me/repo/docs/samples/markdown-sample.md";

test("a relative image path is taken from the document's folder, `..` included", () => {
  assert.equal(imageFileOf("../../preview.png", DOC), "/Users/me/repo/preview.png");
  assert.equal(imageFileOf("shots/a.png", DOC), "/Users/me/repo/docs/samples/shots/a.png");
  assert.equal(imageFileOf("./my pic.png", DOC), "/Users/me/repo/docs/samples/my pic.png");
});

test("an absolute image path is used as written", () => {
  assert.equal(imageFileOf("/tmp/b.svg", DOC), "/tmp/b.svg");
});

test("a percent-encoded name is the file with the decoded name", () => {
  assert.equal(imageFileOf("my%20pic.png", DOC), "/Users/me/repo/docs/samples/my pic.png");
  assert.equal(imageFileOf("/tmp/100%.png", DOC), "/tmp/100%.png");
});

test("a remote or inline image is not a local file", () => {
  for (const src of ["https://example.com/a.png", "http://example.com/a.png", "//cdn.example.com/a.png", "data:image/png;base64,iVBORw0KGgo=", "ftp://host/a.png"]) {
    assert.equal(imageFileOf(src, DOC), null, src);
  }
});

test("an image narrower and shorter than the room keeps its own size", () => {
  assert.deepEqual(imageBoxOf({ width: 300, height: 200 }, 700), { width: 300, height: 200 });
});

test("an image wider than the room shrinks to the room's width, keeping its shape", () => {
  assert.deepEqual(imageBoxOf({ width: 1600, height: 400 }, 800), { width: 800, height: 200 });
});

test("an image taller than 420 shrinks to 420 high, keeping its shape", () => {
  assert.deepEqual(imageBoxOf({ width: 600, height: 1200 }, 800), { width: 210, height: 420 });
  // Width first, then height: 2000x1000 in 1000 is 1000x500, then 840x420.
  assert.deepEqual(imageBoxOf({ width: 2000, height: 1000 }, 1000), { width: 840, height: 420 });
});

test("an image that does not tell its size is a square no larger than the room or 420", () => {
  assert.deepEqual(imageBoxOf(null, 300), { width: 300, height: 300 });
  assert.deepEqual(imageBoxOf(null, 900), { width: 420, height: 420 });
});

test("a document's images alone on their line are found, inside lists and quotes too", () => {
  const text = "![a](a.png)\n\nsee ![inline](no.png) here\n\n- item\n\n  ![b](<b c.png>)\n\n> ![d](/abs/d.svg)\n";
  assert.deepEqual(imagesOf(parseMarkdown(text).blocks), ["a.png", "b c.png", "/abs/d.svg"]);
});
