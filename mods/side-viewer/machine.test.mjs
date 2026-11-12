// node --test: which machine a viewer reads from, and what it asks that machine, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spaceValue, machineOf, headerActions, EXISTS, existingOf, homeOf, NOT_WRITABLE } from "./machine.js";

// Space ids as `herdr-app status` and spaces() give them (observed 2026-11-13): this Mac's
// bare, another machine's with its `<machine>/` prefix.
const HERE = "sp8b57a2baf6b934a06fdeccc6b38ed439";
const NUC = "sp05ca7f2f0e0d351c8ed546645cf8c425";

test("the space value is the space id without its machine prefix", () => {
  assert.equal(spaceValue(`nuc-pro/${NUC}`), NUC);
  assert.equal(spaceValue(HERE), HERE);
});

test("no space id gives no space value", () => {
  for (const id of [null, undefined, "", "nuc-pro/"]) assert.equal(spaceValue(id), null, String(id));
});

const space = (id, machine) => ({ id, machine, name: "work", tabs: [] });
const SPACES = [space(HERE, null), space(`nuc-pro/${NUC}`, "nuc-pro"), space("imac-i7/sp77", "imac-i7")];
const THIS_MAC = { machine: null, remote: false };

test("a viewer in a remote space reads from that space's machine", () => {
  assert.deepEqual(machineOf({ file: "/home/ukyi/a.md", space: NUC }, SPACES), { machine: "nuc-pro", remote: true });
  assert.deepEqual(machineOf({ space: "sp77" }, SPACES), { machine: "imac-i7", remote: true });
});

test("a viewer in a space on this Mac reads from this Mac", () => {
  assert.deepEqual(machineOf({ file: "/Users/ukyi/a.md", space: HERE }, SPACES), THIS_MAC);
});

test("the space value opened with the space id spaces() gives, prefix and all, still finds it", () => {
  assert.deepEqual(machineOf({ space: `nuc-pro/${NUC}` }, SPACES), { machine: "nuc-pro", remote: true });
});

test("a viewer whose props have no space value reads from this Mac", () => {
  for (const props of [null, undefined, {}, { file: "/Users/ukyi/a.md" }, { space: 7 }, { space: "" }]) {
    assert.deepEqual(machineOf(props, SPACES), THIS_MAC, JSON.stringify(props));
  }
});

// A space Herdr does not list yet, as after a restart, may be another machine's: the viewer
// waits for it instead of reading this Mac's file of the same path.
const UNLISTED = { machine: null, remote: false, unlisted: true };

test("a viewer whose space value is not listed is on no machine yet", () => {
  assert.deepEqual(machineOf({ space: "sp-gone" }, SPACES), UNLISTED);
  assert.deepEqual(machineOf({ space: NUC }, []), UNLISTED);
  assert.deepEqual(machineOf({ space: NUC }, null), UNLISTED);
});

test("a space value is matched whole, not as the end of a longer id", () => {
  assert.deepEqual(machineOf({ space: NUC.slice(4) }, SPACES), UNLISTED);
});

test("a remote file's header has no original app and no Finder, only the new tab", () => {
  assert.deepEqual(headerActions({ remote: true, newTab: true }), ["newTab"]);
  assert.deepEqual(headerActions({ remote: true, newTab: false }), []);
});

// Output of `hc exec --on nuc-pro sh -c EXISTS sh <a file> <its folder> /nope <the file again>`
// (observed 2026-11-13).
test("the existence check's answer names the paths that are files, in the order asked", () => {
  const file = "/home/ukyi/homelab/README.md";
  assert.deepEqual(existingOf([file, "/home/ukyi/homelab", "/nope", file], "1\n4\n"), [file, file]);
  assert.deepEqual(existingOf(["/nope"], ""), []);
  assert.deepEqual(existingOf([], ""), []);
});

test("an answer that names no asked path counts for nothing", () => {
  assert.deepEqual(existingOf(["/a.md"], "0\n2\nx\n"), []);
});

test("the existence check run by sh finds files, not folders or missing paths, whatever their names", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-machine-"));
  try {
    const odd = join(dir, "내 문서 \"x\"\nline.md");
    writeFileSync(odd, "# x\n");
    writeFileSync(join(dir, "a.md"), "");
    const paths = [join(dir, "a.md"), dir, join(dir, "gone.md"), odd];
    const stdout = execFileSync("sh", ["-c", EXISTS, "sh", ...paths], { encoding: "utf8" });
    assert.deepEqual(existingOf(paths, stdout), [join(dir, "a.md"), odd]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Output of `hc exec --on nuc-pro sh -c HOME sh` and `--on mac-m1-max` (observed 2026-11-13).
test("a machine's home is the folder its shell answers with", () => {
  assert.equal(homeOf("/home/ukyi\n"), "/home/ukyi");
  assert.equal(homeOf("/Users/ukyi\n"), "/Users/ukyi");
});

test("an answer that is no absolute folder gives no home", () => {
  for (const stdout of ["", "\n", "ukyi\n", null]) assert.equal(homeOf(stdout), null, JSON.stringify(stdout));
});

// NOT_WRITABLE exits 0 for a file there that cannot be written, so the save stops before
// replacing it; anything else (writable, not there) lets the save go on.
const notWritable = (path) => spawnSync("sh", ["-c", NOT_WRITABLE, "sh", path]).status === 0;

test("a file the user cannot write is told apart before a save, a writable or new one is not", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-machine-"));
  try {
    const locked = join(dir, "locked .md"), open = join(dir, "open.md");
    writeFileSync(locked, "# a\n", { mode: 0o444 });
    writeFileSync(open, "# a\n");
    assert.equal(notWritable(locked), true);
    assert.equal(notWritable(open), false);
    assert.equal(notWritable(join(dir, "new.md")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a file on this Mac keeps every header action", () => {
  assert.deepEqual(headerActions({ remote: false, newTab: true }), ["newTab", "original", "finder"]);
  assert.deepEqual(headerActions({ remote: false, newTab: false }), ["original", "finder"]);
});
