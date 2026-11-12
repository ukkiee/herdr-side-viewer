// node --test: which machine a viewer reads from, and what it asks that machine, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spaceValue, machineOf, headerActions, EXISTS, existingOf, homeOf, hcCommand } from "./machine.js";

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

test("a viewer whose space is not listed reads from this Mac", () => {
  assert.deepEqual(machineOf({ space: "sp-gone" }, SPACES), THIS_MAC);
  assert.deepEqual(machineOf({ space: NUC }, []), THIS_MAC);
  assert.deepEqual(machineOf({ space: NUC }, null), THIS_MAC);
});

test("a space value is matched whole, not as the end of a longer id", () => {
  assert.deepEqual(machineOf({ space: NUC.slice(4) }, SPACES), THIS_MAC);
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

// A fake hc that prints where it was found and the arguments it got, one per line.
function fakeHc(dir) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "hc");
  writeFileSync(path, `#!/bin/sh\necho "${path}"\nfor a; do echo "$a"; done\n`, { mode: 0o755 });
  return path;
}

function runHc(args, env) {
  const [command, argv] = hcCommand(args);
  return execFileSync(command, argv, { encoding: "utf8", env });
}

test("hc is run from PATH when it is there", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-hc-"));
  try {
    const onPath = fakeHc(join(dir, "bin"));
    fakeHc(join(dir, "home", ".local", "bin"));
    const out = runHc(["exec", "--on", "nuc-pro", "cat", "/a b.md"], { PATH: `${join(dir, "bin")}:/usr/bin:/bin`, HOME: join(dir, "home") });
    assert.equal(out, `${onPath}\nexec\n--on\nnuc-pro\ncat\n/a b.md\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hc is run from ~/.local/bin when PATH lacks it, as an app opened from Finder has", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-hc-"));
  try {
    const installed = fakeHc(join(dir, "home", ".local", "bin"));
    const out = runHc(["machine", "ls"], { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: join(dir, "home") });
    assert.equal(out, `${installed}\nmachine\nls\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a file on this Mac keeps every header action", () => {
  assert.deepEqual(headerActions({ remote: false, newTab: true }), ["newTab", "original", "finder"]);
  assert.deepEqual(headerActions({ remote: false, newTab: false }), ["original", "finder"]);
});
