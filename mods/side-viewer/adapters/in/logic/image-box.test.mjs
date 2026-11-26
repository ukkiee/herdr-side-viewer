// node --test: the size an image is drawn at, in the image view and inside a document.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitted, imageBoxOf } from "./image-box.js";

test("an image is never drawn wider than the room it has", () => {
  assert.deepEqual(fitted({ width: 640, height: 480 }, 320), { width: 320, height: 240 });
  assert.deepEqual(fitted({ width: 640, height: 480 }, 640), { width: 640, height: 480 });
});

test("a small image keeps its own size", () => {
  assert.deepEqual(fitted({ width: 100, height: 50 }, 800), { width: 100, height: 50 });
});

test("an image of unknown size fills the room as a square", () => {
  assert.deepEqual(fitted(null, 300), { width: 300, height: 300 });
});

test("the room never collapses to nothing", () => {
  assert.deepEqual(fitted({ width: 640, height: 480 }, 0), { width: 1, height: 1 });
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
