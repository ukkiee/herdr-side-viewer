import { test } from "node:test";
import assert from "node:assert/strict";
import { noEdits, typed, unsaved, shownText, saveOf, saved, diskRead, barOf, discarded, overwritten, refusalOf, saveFailed, startSave, checkboxToggled } from "./edit-state.js";

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

// writeTextFile's refusals, as Herdr words them (src/mod_files.rs, and Rust's io errors).
test("a refused save is read as changed on disk, no permission, too large, or something else", () => {
  assert.equal(refusalOf(new Error("The file changed outside Herdr. Reload before saving; your draft is still here.")), "changed");
  assert.equal(refusalOf(new Error("The file changed while saving. Reload before saving.")), "changed");
  assert.equal(refusalOf(new Error("Permission denied (os error 13)")), "permission");
  assert.equal(refusalOf("Operation not permitted (os error 1)"), "permission");
  assert.equal(refusalOf(new Error("Read-only file system (os error 30)")), "permission");
  assert.equal(refusalOf(new Error("Text file exceeds 1 MiB")), "large");
  assert.equal(refusalOf(new Error("No space left on device (os error 28)")), "other");
  assert.equal(refusalOf(undefined), "other");
});

test("a failed save keeps the edits and says why", () => {
  const edits = typed(noEdits(), A, "one\n", "mine\n");
  const permission = saveFailed(edits, A, new Error("Permission denied (os error 13)"));
  assert.equal(shownText(permission, A, "one\n"), "mine\n");
  assert.deepEqual(saveOf(permission, A), { path: A, text: "mine\n", expected: "one\n" });
  assert.deepEqual(barOf(permission, A), { kind: "failed", message: "이 파일에 쓸 권한이 없습니다." });
  assert.equal(barOf(saveFailed(edits, A, new Error("Text file exceeds 1 MiB")), A).message, "저장하기에는 너무 큽니다.");
  assert.equal(barOf(saveFailed(edits, A, new Error("No space left on device (os error 28)")), A).message,
    "저장하지 못했습니다: No space left on device (os error 28)");
});

test("a failure bar goes once the text is typed back to what is on disk, or the save goes through", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = saveFailed(edits, A, new Error("Permission denied (os error 13)"));
  assert.equal(barOf(typed(edits, A, "one\n", "one\n"), A), null);
  edits = typed(edits, A, "one\n", "mine!\n");
  assert.equal(barOf(edits, A).kind, "failed");
  assert.equal(barOf(saved(edits, A, "mine!\n"), A), null);
});

test("a save of up to 1,048,576 UTF-8 bytes goes ahead; a larger one is stopped before writing", () => {
  const at = "a".repeat(1048576);
  let edits = typed(noEdits(), A, "one\n", at);
  let save = startSave(edits, A);
  assert.deepEqual(save.write, { path: A, text: at, expected: "one\n" });
  assert.equal(barOf(save.edits, A), null);

  edits = typed(noEdits(), A, "one\n", at + "b");
  save = startSave(edits, A);
  assert.equal(save.write, null);
  assert.equal(barOf(save.edits, A).message, "저장하기에는 너무 큽니다.");
  assert.equal(unsaved(save.edits, A), true);

  // Bytes, not characters: "가" is three bytes in UTF-8 and "😀" four.
  const hangul = "가".repeat(349525) + "a"; // 1,048,576 bytes, 349,526 characters
  assert.notEqual(startSave(typed(noEdits(), A, "one\n", hangul), A).write, null);
  assert.equal(startSave(typed(noEdits(), A, "one\n", hangul + "a"), A).write, null);
  const emoji = "😀".repeat(262144); // 1,048,576 bytes
  assert.notEqual(startSave(typed(noEdits(), A, "one\n", emoji), A).write, null);
  assert.equal(startSave(typed(noEdits(), A, "one\n", emoji + "a"), A).write, null);
});

test("starting a save with nothing to save writes nothing", () => {
  assert.deepEqual(startSave(noEdits(), A), { edits: noEdits(), write: null });
});

test("a deleted file's edits stay even when typed back to the text read before", () => {
  let edits = typed(noEdits(), A, "one\n", "mine\n");
  edits = diskRead(edits, A, null).edits;
  edits = typed(edits, A, "one\n", "one\n");
  assert.equal(unsaved(edits, A), true);
  assert.equal(barOf(edits, A).message, "파일이 지워졌습니다.");
});

test("a checkbox clicked in a file without edits is saved at once, expecting the disk text", () => {
  const click = checkboxToggled(noEdits(), A, "- [ ] a\n", "- [x] a\n");
  assert.deepEqual(click.write, { path: A, text: "- [x] a\n", expected: "- [ ] a\n" });
  // The box shows its new state while the save is under way.
  assert.equal(shownText(click.edits, A, "- [ ] a\n"), "- [x] a\n");
  // Once written, nothing is left unsaved.
  assert.equal(unsaved(saved(click.edits, A, "- [x] a\n"), A), false);
});

test("a checkbox save refused because the disk changed keeps the click and raises the bar", () => {
  const click = checkboxToggled(noEdits(), A, "- [ ] a\n", "- [x] a\n");
  // writeTextFile refused; reading again finds someone else's text.
  const read = diskRead(click.edits, A, "- [ ] a\n- [ ] b\n");
  assert.equal(read.step, "keep");
  assert.equal(barOf(read.edits, A).message, "밖에서 바뀌었습니다");
  assert.equal(shownText(read.edits, A, "- [ ] a\n- [ ] b\n"), "- [x] a\n");
  // The bar's two buttons work on the click as on any edit.
  assert.deepEqual(saveOf(overwritten(read.edits, A), A), { path: A, text: "- [x] a\n", expected: "- [ ] a\n- [ ] b\n" });
  assert.equal(unsaved(discarded(read.edits, A), A), false);
});

test("a checkbox clicked in a file with edits joins them and stays unsaved", () => {
  const edits = typed(noEdits(), A, "# T\n- [ ] a\n", "# Title\n- [ ] a\n");
  const click = checkboxToggled(edits, A, "# T\n- [ ] a\n", "# Title\n- [x] a\n");
  assert.equal(click.write, null);
  assert.equal(unsaved(click.edits, A), true);
  assert.deepEqual(saveOf(click.edits, A), { path: A, text: "# Title\n- [x] a\n", expected: "# T\n- [ ] a\n" });
});

test("a checkbox clicked while the bar is up joins the edits and the bar stays", () => {
  let edits = typed(noEdits(), A, "- [ ] a\n", "- [ ] a!\n");
  edits = diskRead(edits, A, "- [ ] a\n- [ ] b\n").edits;
  const click = checkboxToggled(edits, A, "- [ ] a\n- [ ] b\n", "- [x] a!\n");
  assert.equal(click.write, null);
  assert.equal(barOf(click.edits, A).message, "밖에서 바뀌었습니다");
  assert.equal(shownText(click.edits, A, "- [ ] a\n- [ ] b\n"), "- [x] a!\n");
});

test("clicking a checkbox back to the text on disk leaves nothing unsaved", () => {
  // The first click was refused for a reason other than a change on disk.
  const edits = saveFailed(checkboxToggled(noEdits(), A, "- [ ] a\n- [ ] b\n", "- [x] a\n- [ ] b\n").edits, A, new Error("disk full"));
  const click = checkboxToggled(edits, A, "- [ ] a\n- [ ] b\n", "- [ ] a\n- [ ] b\n");
  assert.equal(click.write, null);
  assert.equal(unsaved(click.edits, A), false);
});

test("a checkbox click in a file too large to save raises the bar instead of writing", () => {
  const big = "- [ ] a\n" + "a".repeat(1024 * 1024);
  const click = checkboxToggled(noEdits(), A, big, big.replace("[ ]", "[x]"));
  assert.equal(click.write, null);
  assert.equal(barOf(click.edits, A).message, "저장하기에는 너무 큽니다.");
  assert.equal(unsaved(click.edits, A), true);
});
