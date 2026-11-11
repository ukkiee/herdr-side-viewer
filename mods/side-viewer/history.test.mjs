// node --test: the viewer's visit history, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { start, open, back, canGoBack } from "./history.js";

test("a viewer starts with no file and nothing to go back to", () => {
  const visits = start();
  assert.equal(visits.file, null);
  assert.equal(canGoBack(visits), false);
});

test("the first file opened is shown and leaves nothing to go back to", () => {
  const visits = open(start(), "/work/a.md");
  assert.equal(visits.file, "/work/a.md");
  assert.equal(canGoBack(visits), false);
});

test("opening another file makes the one before it the place back goes to", () => {
  const visits = open(open(start(), "/work/a.md"), "/work/b.md");
  assert.equal(visits.file, "/work/b.md");
  assert.equal(canGoBack(visits), true);
  const returned = back(visits);
  assert.equal(returned.file, "/work/a.md");
  assert.equal(canGoBack(returned), false);
});

test("back walks through the files in reverse order of opening", () => {
  let visits = start();
  for (const file of ["/a.md", "/b.md", "/c.md"]) visits = open(visits, file);
  visits = back(visits);
  assert.equal(visits.file, "/b.md");
  visits = back(visits);
  assert.equal(visits.file, "/a.md");
});

test("opening the file already shown adds nothing to the history", () => {
  const once = open(open(start(), "/a.md"), "/b.md");
  const twice = open(once, "/b.md");
  assert.equal(twice.file, "/b.md");
  assert.equal(back(twice).file, "/a.md");
  assert.equal(canGoBack(back(twice)), false);
});

test("a file opened again later, after another one, is a new visit", () => {
  let visits = start();
  for (const file of ["/a.md", "/b.md", "/a.md"]) visits = open(visits, file);
  assert.equal(back(visits).file, "/b.md");
  assert.equal(back(back(visits)).file, "/a.md");
});

test("back with an empty history changes nothing", () => {
  const visits = open(start(), "/a.md");
  assert.deepEqual(back(visits), visits);
  assert.deepEqual(back(start()), start());
});

test("a file opened after going back is stacked on the file gone back to", () => {
  let visits = start();
  for (const file of ["/a.md", "/b.md"]) visits = open(visits, file);
  visits = open(back(visits), "/c.md");
  assert.equal(visits.file, "/c.md");
  assert.equal(back(visits).file, "/a.md");
});

test("opening something that is not a path shows no file and keeps the history", () => {
  const visits = open(open(start(), "/a.md"), "/b.md");
  for (const nothing of [undefined, null, "", 7, {}]) {
    const after = open(visits, nothing);
    assert.equal(after.file, null);
    assert.equal(back(after).file, "/a.md");
  }
});

test("opening and going back leave the history they were given untouched", () => {
  const visits = open(open(start(), "/a.md"), "/b.md");
  const copy = structuredClone(visits);
  open(visits, "/c.md");
  back(visits);
  assert.deepEqual(visits, copy);
});
