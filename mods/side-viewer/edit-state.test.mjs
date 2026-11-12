import { test } from "node:test";
import assert from "node:assert/strict";
import { noEdits, typed, unsaved, shownText, saveOf, saved, diskRead, barOf, discarded, overwritten } from "./edit-state.js";

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

test("a file with no edits that changed on disk is read again, as before", () => {
  const read = diskRead(noEdits(), A, "new\n");
  assert.equal(read.step, "show");
  assert.equal(unsaved(read.edits, A), false);
  assert.equal(barOf(read.edits, A), null);
  // A file without edits that is gone shows the v1 notice: nothing to keep.
  assert.equal(diskRead(noEdits(), A, null).step, "show");
});

test("a file with edits that changed on disk keeps the edits on screen and raises the bar", () => {
  const edits = typed(noEdits(), A, "one\n", "mine\n");
  const read = diskRead(edits, A, "theirs\n");
  assert.equal(read.step, "keep");
  assert.equal(unsaved(read.edits, A), true);
  assert.equal(shownText(read.edits, A, "theirs\n"), "mine\n");
  assert.deepEqual(barOf(read.edits, A), { kind: "conflict", message: "밖에서 바뀌었습니다" });
  // A save still expects the text the edit started from, so writeTextFile refuses it.
  assert.deepEqual(saveOf(read.edits, A), { path: A, text: "mine\n", expected: "one\n" });
});

test("a file with edits that is read again unchanged raises no bar", () => {
  const edits = typed(noEdits(), A, "one\n", "mine\n");
  const read = diskRead(edits, A, "one\n");
  assert.equal(read.step, "keep");
  assert.equal(barOf(read.edits, A), null);
  assert.equal(unsaved(read.edits, A), true);
});

test("a file with edits that is deleted keeps the edits and says it is gone", () => {
  const edits = typed(noEdits(), A, "one\n", "mine\n");
  const read = diskRead(edits, A, null);
  assert.equal(read.step, "keep");
  assert.equal(shownText(read.edits, A, "one\n"), "mine\n");
  assert.deepEqual(barOf(read.edits, A), { kind: "failed", message: "파일이 지워졌습니다." });
});

test("a file whose disk text comes back to what the edit started from drops the bar", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, "theirs\n").edits;
  edits = diskRead(edits, A, "one\n").edits;
  assert.equal(barOf(edits, A), null);
  assert.equal(unsaved(edits, A), true);
});

test("a disk that now holds the edited text leaves nothing unsaved", () => {
  // As when the viewer's own save is read back before the save has finished.
  const edits = typed(noEdits(), A, "one\n", "mine\n");
  const read = diskRead(edits, A, "mine\n");
  assert.equal(read.step, "show");
  assert.equal(unsaved(read.edits, A), false);
  assert.equal(barOf(read.edits, A), null);
});

test("a disk that cannot be read leaves the edits and the bar as they are", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, "theirs\n").edits;
  const read = diskRead(edits, A, undefined);
  assert.equal(read.step, "keep");
  assert.equal(barOf(read.edits, A).kind, "conflict");
});

test("typing goes on under the bar, and the bar stays until one of its buttons is pressed", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, "theirs\n").edits;
  edits = typed(edits, A, "one\n", "mine, more\n");
  assert.equal(barOf(edits, A).kind, "conflict");
  assert.equal(shownText(edits, A, "one\n"), "mine, more\n");
  // Typing back to the text the edit started from is still not what is on disk now.
  edits = typed(edits, A, "one\n", "one\n");
  assert.equal(barOf(edits, A).kind, "conflict");
  assert.equal(unsaved(edits, A), true);
});

test("discarding drops the edits and the bar, so the file shows what is on disk", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, "theirs\n").edits;
  const after = discarded(edits, A);
  assert.equal(unsaved(after, A), false);
  assert.equal(barOf(after, A), null);
  assert.equal(shownText(after, A, "theirs\n"), "theirs\n");
  assert.equal(saveOf(after, A), null);
});

test("overwriting saves my text, expecting what is on disk now", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, "theirs\n").edits;
  edits = overwritten(edits, A);
  assert.equal(barOf(edits, A), null);
  assert.deepEqual(saveOf(edits, A), { path: A, text: "mine\n", expected: "theirs\n" });
  // A later change on disk is a conflict again, against the text overwritten.
  edits = diskRead(edits, A, "theirs again\n").edits;
  assert.equal(barOf(edits, A).kind, "conflict");
  edits = overwritten(edits, A);
  assert.deepEqual(saveOf(edits, A), { path: A, text: "mine\n", expected: "theirs again\n" });
});

test("overwriting with nothing to overwrite leaves the edits alone", () => {
  const edits = typed(noEdits(), A, "one\n", "mine\n");
  assert.deepEqual(saveOf(overwritten(edits, A), A), { path: A, text: "mine\n", expected: "one\n" });
  assert.deepEqual(overwritten(noEdits(), A), noEdits());
});

test("a deleted file's edits stay even when typed back to the text read before", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, null).edits;
  edits = typed(edits, A, "one\n", "one\n");
  assert.equal(unsaved(edits, A), true);
  assert.equal(barOf(edits, A).message, "파일이 지워졌습니다.");
});
