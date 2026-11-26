// node --test: the command that asks about a file before it is read, run with a real sh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProbe, PROBE } from "./file-probe.js";

// The probe is the script the mod runs to learn about a file before reading it.
const run = (file) => readProbe(spawnSync("sh", ["-c", PROBE, "sh", file], { encoding: "utf8" }).stdout);

test("the probe reports a file's size and first bytes without reading it into the mod", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-probe-"));
  const file = join(dir, "a b.txt");
  writeFileSync(file, "GIF89a" + "x".repeat(5000));
  const seen = run(file);
  assert.equal(seen.found, true);
  assert.equal(seen.readable, true);
  assert.equal(seen.bytes, 5006);
  assert.equal(seen.head.length, 4096);
  assert.deepEqual(seen.head.slice(0, 6), [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  assert.ok(seen.modified > 0);
});

test("the probe tells a missing file from one that cannot be read", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-probe-"));
  assert.deepEqual(run(join(dir, "none.txt")), { found: false });
  assert.deepEqual(run(dir), { found: true, readable: false });
  const locked = join(dir, "locked.txt");
  writeFileSync(locked, "secret");
  chmodSync(locked, 0o000);
  assert.deepEqual(run(locked), { found: true, readable: false });
  assert.deepEqual(readProbe(""), { found: true, readable: false });
});
