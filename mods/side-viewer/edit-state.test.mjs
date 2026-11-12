import { test } from "node:test";
import assert from "node:assert/strict";
import { noEdits, typed, unsaved, shownText, saveOf, saved } from "./edit-state.js";

const A = "/work/a.md";

test("a file with no edits is not unsaved and shows what is on disk", () => {
  const edits = noEdits();
  assert.equal(unsaved(edits, A), false);
  assert.equal(shownText(edits, A, "# A\n"), "# A\n");
});

test("typing something other than the disk text makes the file unsaved and shows the edit", () => {
  const edits = typed(noEdits(), A, "# A\n", "# A!\n");
  assert.equal(unsaved(edits, A), true);
  assert.equal(shownText(edits, A, "# A\n"), "# A!\n");
});

test("each file keeps its own edits, so coming back to a file brings its edits back", () => {
  const B = "/work/b.go";
  let edits = typed(noEdits(), A, "# A\n", "# A!\n");
  // Another file is shown and edited meanwhile.
  edits = typed(edits, B, "package b\n", "package bb\n");
  assert.equal(shownText(edits, B, "package b\n"), "package bb\n");
  assert.equal(unsaved(edits, A), true);
  assert.equal(shownText(edits, A, "# A\n"), "# A!\n");
  // A file never edited shows its disk text.
  assert.equal(unsaved(edits, "/work/c.md"), false);
  assert.equal(shownText(edits, "/work/c.md", "c"), "c");
});

test("saving a file with no edits does nothing", () => {
  assert.equal(saveOf(noEdits(), A), null);
  const reverted = typed(typed(noEdits(), A, "a", "ab"), A, "a", "a");
  assert.equal(saveOf(reverted, A), null);
  assert.equal(saveOf(noEdits(), null), null);
});

test("saving writes the edited text, expecting the disk text read before the edit", () => {
  let edits = typed(noEdits(), A, "one\n", "one!\n");
  edits = typed(edits, A, "one\n", "one!!\n");
  assert.deepEqual(saveOf(edits, A), { path: A, text: "one!!\n", expected: "one\n" });
});

test("a finished save leaves nothing unsaved, and the saved text is what is on disk", () => {
  const edits = typed(noEdits(), A, "one\n", "two\n");
  const after = saved(edits, A, "two\n");
  assert.equal(unsaved(after, A), false);
  assert.equal(saveOf(after, A), null);
  // Typing it back to the old text is now an edit against the saved text.
  const again = typed(after, A, "two\n", "one\n");
  assert.deepEqual(saveOf(again, A), { path: A, text: "one\n", expected: "two\n" });
});

test("typing that lands while a save is under way stays unsaved, against the saved text", () => {
  let edits = typed(noEdits(), A, "one\n", "two\n");
  edits = typed(edits, A, "one\n", "three\n");
  const after = saved(edits, A, "two\n");
  assert.equal(unsaved(after, A), true);
  assert.deepEqual(saveOf(after, A), { path: A, text: "three\n", expected: "two\n" });
});

test("a save of one file leaves the edits of the others alone", () => {
  const B = "/work/b.go";
  let edits = typed(noEdits(), A, "a", "a!");
  edits = typed(edits, B, "b", "b!");
  const after = saved(edits, A, "a!");
  assert.equal(unsaved(after, B), true);
  assert.equal(shownText(after, B, "b"), "b!");
});

test("an unsaved file read again keeps its edits, and its save still expects the text read before the edit", () => {
  let edits = typed(noEdits(), A, "one\n", "one!\n");
  // The file changed on disk; the editor reports its text against the new read.
  assert.equal(shownText(edits, A, "changed\n"), "one!\n");
  edits = typed(edits, A, "changed\n", "one!!\n");
  assert.deepEqual(saveOf(edits, A), { path: A, text: "one!!\n", expected: "one\n" });
});

test("typing the text back to what is on disk leaves nothing unsaved", () => {
  let edits = typed(noEdits(), A, "# A\n", "# A!\n");
  edits = typed(edits, A, "# A\n", "# A\n");
  assert.equal(unsaved(edits, A), false);
  assert.equal(shownText(edits, A, "# A\n"), "# A\n");
});
