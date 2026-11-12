// node --test: what the viewer makes of a remote machine's answers and refusals, without Herdr.
// The answers are the words nuc-pro (Linux) gave on 2026-11-13 through `hc exec --on nuc-pro`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { changeMark, failureOf, unavailable, saveFailureOf } from "./remote-results.js";

const DIR = "/tmp/side-viewer-t05-20043";

test("a file's checksum answer marks it by its sum and size, whatever path reached it", () => {
  const file = changeMark({ code: 0, stdout: `3015617425 6 ${DIR}/a.md\n`, stderr: "" });
  const link = changeMark({ code: 0, stdout: `3015617425 6 ${DIR}/link.md\n`, stderr: "" });
  assert.equal(file, link);
  // The same answer from this Mac's cksum.
  assert.equal(changeMark({ code: 0, stdout: "3015617425 6 /private/tmp/x.md\n", stderr: "" }), file);
});

test("a changed sum or size is another mark", () => {
  const before = changeMark({ code: 0, stdout: `3015617425 6 ${DIR}/a.md\n`, stderr: "" });
  assert.notEqual(changeMark({ code: 0, stdout: `1170164398 6 ${DIR}/a.md\n`, stderr: "" }), before);
  assert.notEqual(changeMark({ code: 0, stdout: `3015617425 7 ${DIR}/a.md\n`, stderr: "" }), before);
});

test("a file that is not there, or a link to nothing, is marked gone", () => {
  assert.equal(changeMark({ code: 1, stdout: "", stderr: `cksum: ${DIR}/nope.md: No such file or directory\n` }), "missing");
  assert.equal(changeMark({ code: 1, stdout: "", stderr: `cksum: ${DIR}/dangling.md: No such file or directory\n` }), "missing");
});

// Not measured: no machine could be cut off. The words are Herdr's: herdr.d.ts on exec ("the
// machine is unreachable") and the shipped git-tools mod's tests ("machine vps is unreachable").
test("a refusal because the machine cannot be reached is told apart", () => {
  assert.equal(failureOf(new Error("machine vps is unreachable")), "unreachable");
  assert.equal(failureOf("the machine is unreachable"), "unreachable");
});

// Not measured: there is no Windows machine. The words are those the shipped Files mod
// (git-tools/files-data.js) takes for a Windows host.
test("a machine where sh cannot start is a Windows machine", () => {
  assert.equal(failureOf(new Error("cannot start sh: program not found")), "windows");
});

test("hc's not_found error is a gone file", () => {
  const read = { error: { hint: "check the path, or hc exec ls", kind: "not_found", message: `no file ${DIR}/nope.md` } };
  assert.equal(failureOf(read), "missing");
  assert.equal(failureOf(read.error), "missing");
});

test("any other refusal is neither the machine nor a gone file", () => {
  // Observed on nuc-pro: a program the machine does not have.
  assert.equal(failureOf(new Error("cannot start nosuchprog-sv: No such file or directory (os error 2)")), "other");
  assert.equal(failureOf({ error: { hint: "", kind: "io", message: `${DIR}/noread.md: Permission denied (os error 13)` } }), "other");
  assert.equal(failureOf({ error: { hint: "", kind: "machine_unknown", message: 'unknown machine "nosuch-machine"' } }), "other");
  assert.equal(failureOf(undefined), "other");
});

test("a machine Herdr lists as unavailable cannot be reached; loading or ready ones can", () => {
  const listed = [
    { name: null, layout: "ready" },
    { name: "nuc-pro", layout: "unavailable" },
    { name: "imac-i7", layout: "loading" },
    { name: "mac-m1-max", layout: "ready" },
  ];
  assert.equal(unavailable(listed, "nuc-pro"), true);
  assert.equal(unavailable(listed, "imac-i7"), false);
  assert.equal(unavailable(listed, "mac-m1-max"), false);
  assert.equal(unavailable(listed, "gone"), false);
  assert.equal(unavailable(undefined, "nuc-pro"), false);
});

test("a file that cannot be read is marked apart from a gone one and from any sum", () => {
  const denied = changeMark({ code: 1, stdout: "", stderr: `cksum: ${DIR}/noread.md: Permission denied\n` });
  const folder = changeMark({ code: 1, stdout: "", stderr: `cksum: ${DIR}/dir.md: Is a directory\n` });
  assert.equal(denied, "unreadable");
  assert.equal(folder, "unreadable");
});

// `hc file write --on nuc-pro <path> < <file>` from this Mac's sh, 2026-11-13: it puts its error
// as JSON on stderr. A read-only file in a writable folder is replaced (no error); a folder
// that cannot be written is what refuses.
const SAVE_DIR = "/tmp/side-viewer-t07";

test("a remote save the folder's permissions refuse fails for want of write permission", () => {
  const answer = {
    code: 1,
    stdout: "",
    stderr: `{"error":{"hint":"","kind":"io","message":"${SAVE_DIR}/ro-dir/f.txt: Permission denied (os error 13)"}}\n`,
  };
  assert.deepEqual(saveFailureOf(answer), { reason: "permission" });
});

test("any other refusal of a remote save fails with hc's own words as its detail", () => {
  const folder = {
    code: 1,
    stdout: "",
    stderr: `{"error":{"hint":"","kind":"io","message":"${SAVE_DIR}/dir: Is a directory (os error 21)"}}\n`,
  };
  const unknown = {
    code: 4,
    stdout: "",
    stderr: '{"error":{"hint":"machines: nuc-pro, mac-m1-max, imac-i7","kind":"machine_unknown","message":"unknown machine \\"nosuch-machine\\""}}\n',
  };
  assert.deepEqual(saveFailureOf(folder), { reason: "other", detail: `${SAVE_DIR}/dir: Is a directory (os error 21)` });
  assert.deepEqual(saveFailureOf(unknown), { reason: "other", detail: 'unknown machine "nosuch-machine"' });
});

test("a remote save whose hc cannot run fails with the shell's words as its detail", () => {
  // Ticket 01: an hc found neither on PATH nor in ~/.local/bin.
  const answer = { code: 126, stdout: "", stderr: "sh: /Users/ukyi/.local/bin/hc: cannot execute: No such file or directory\n" };
  assert.deepEqual(saveFailureOf(answer), { reason: "other", detail: "sh: /Users/ukyi/.local/bin/hc: cannot execute: No such file or directory" });
});

test("a remote save that cannot reach the machine fails as unreachable", () => {
  // Not observed: Herdr's words for exec (herdr.d.ts) and the git-tools mod's tests.
  assert.deepEqual(saveFailureOf(new Error("the machine is unreachable")), { reason: "unreachable" });
  assert.deepEqual(saveFailureOf({ code: 1, stdout: "", stderr: '{"error":{"hint":"","kind":"io","message":"machine nuc-pro is unreachable"}}\n' }), { reason: "unreachable" });
});

test("the re-read before a remote save, refused for permission, fails the save the same way", () => {
  // `hc file read` on nuc-pro for a file it may not read (ticket 05).
  assert.deepEqual(saveFailureOf(new Error(`${SAVE_DIR}/noread.md: Permission denied (os error 13)`)), { reason: "permission" });
  assert.deepEqual(saveFailureOf(new Error("something else")), { reason: "other", detail: "something else" });
  // Herdr puts its function's name in front of every API error (edit-state.js messageOf).
  assert.deepEqual(saveFailureOf(new Error("`herdr.readTextFile`: something else")), { reason: "other", detail: "something else" });
});
