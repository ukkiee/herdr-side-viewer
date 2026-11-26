import { test } from "node:test";
import assert from "node:assert/strict";
import { imageFileOf, imagesOf } from "./markdown-images.js";
import { parseMarkdown } from "../domain/markdown-blocks.js";

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

test("a document's images alone on their line are found, inside lists and quotes too", () => {
  const text = "![a](a.png)\n\nsee ![inline](no.png) here\n\n- item\n\n  ![b](<b c.png>)\n\n> ![d](/abs/d.svg)\n";
  assert.deepEqual(imagesOf(parseMarkdown(text).blocks), ["a.png", "b c.png", "/abs/d.svg"]);
});
