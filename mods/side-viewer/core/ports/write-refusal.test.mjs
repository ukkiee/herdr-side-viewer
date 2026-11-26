// node --test: this Mac's refusals of writeTextFile, as Herdr words them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { refusalOf } from "./write-refusal.js";

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

// What a mod actually receives: Herdr puts the API function's name in front of the wording.
test("a refused save is read the same when Herdr names the function in front", () => {
  assert.equal(refusalOf(new Error("`herdr.writeTextFile`: The file changed outside Herdr. Reload before saving; your draft is still here.")), "changed");
  assert.equal(refusalOf(new Error("`herdr.writeTextFile`: The file changed while saving. Reload before saving.")), "changed");
  assert.equal(refusalOf(new Error("`herdr.writeTextFile`: Text file exceeds 1 MiB")), "large");
  assert.equal(refusalOf(new Error("`herdr.writeTextFile`: Permission denied (os error 13)")), "permission");
  assert.equal(refusalOf(new Error("`herdr.writeTextFile`: No space left on device (os error 28)")), "other");
});
