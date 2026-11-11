// node --test: which files count as images, how their copies are named, sized and cleaned up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, utimesSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kindOf, copyName, sizeOf, fitted, staleCopies, olderCopies, COPY, LIST } from "./image-copies.js";

const bytes = (text) => [...Buffer.from(text, "latin1")];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// A PNG header for a 640 by 480 image.
const PNG_640_480 = [...PNG, 0, 0, 0, 13, ...bytes("IHDR"), 0, 0, 0x02, 0x80, 0, 0, 0x01, 0xe0];

test("a file whose first bytes are an image's is that kind of image", () => {
  assert.equal(kindOf("/w/a.png", PNG), "png");
  assert.equal(kindOf("/w/a.jpg", [0xff, 0xd8, 0xff, 0xe0]), "jpg");
  assert.equal(kindOf("/w/a.gif", bytes("GIF89a")), "gif");
  assert.equal(kindOf("/w/a.gif", bytes("GIF87a")), "gif");
  assert.equal(kindOf("/w/a.webp", bytes("RIFF\x10\x00\x00\x00WEBPVP8 ")), "webp");
  assert.equal(kindOf("/w/a.svg", bytes('<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg">')), "svg");
});

test("the kind comes from the bytes, not the extension", () => {
  assert.equal(kindOf("/w/really-a-png.jpg", PNG), "png");
});

test("a file with an image extension but other content is not an image", () => {
  assert.equal(kindOf("/w/notes.png", bytes("# Notes\nplain text")), null);
  assert.equal(kindOf("/w/key.svg", bytes("-----BEGIN OPENSSH PRIVATE KEY-----")), null);
  assert.equal(kindOf("/w/page.svg", bytes("<html><body>hi</body></html>")), null);
  assert.equal(kindOf("/w/a.png", []), null);
  assert.equal(kindOf("/w/riff.webp", bytes("RIFF\x10\x00\x00\x00WAVEfmt ")), null);
});

test("compressed content counts as an image only for an svgz file", () => {
  assert.equal(kindOf("/w/logo.svgz", [0x1f, 0x8b, 0x08]), "svgz");
  assert.equal(kindOf("/w/LOGO.SVGZ", [0x1f, 0x8b, 0x08]), "svgz");
  assert.equal(kindOf("/w/archive.png", [0x1f, 0x8b, 0x08]), null);
});

test("a copy's name changes when the image's path, size or time changes", () => {
  const name = copyName("/w/a.png", { bytes: 10, modified: 100 }, "png");
  assert.match(name, /^[0-9a-f]+-10-100\.png$/);
  assert.equal(copyName("/w/a.png", { bytes: 10, modified: 100 }, "png"), name);
  assert.notEqual(copyName("/w/b.png", { bytes: 10, modified: 100 }, "png"), name);
  assert.notEqual(copyName("/w/a.png", { bytes: 11, modified: 100 }, "png"), name);
  assert.notEqual(copyName("/w/a.png", { bytes: 10, modified: 101 }, "png"), name);
});

test("an image's own size is read from its bytes", () => {
  assert.deepEqual(sizeOf(PNG_640_480), { width: 640, height: 480 });
  assert.deepEqual(sizeOf([...bytes("GIF89a"), 0x40, 0x01, 0xf0, 0x00]), { width: 320, height: 240 });
  // JPEG: an APP0 segment, then the frame header carrying height 600 and width 800.
  const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22];
  assert.deepEqual(sizeOf(jpeg), { width: 800, height: 600 });
  // WebP extended header: 24-bit width-1 (399) and height-1 (299).
  const webp = [...bytes("RIFF"), 0, 0, 0, 0, ...bytes("WEBPVP8X"), 10, 0, 0, 0, 0, 0, 0, 0, 0x8f, 0x01, 0x00, 0x2b, 0x01, 0x00];
  assert.deepEqual(sizeOf(webp), { width: 400, height: 300 });
  assert.deepEqual(sizeOf(bytes('<svg width="120" height="80" viewBox="0 0 12 8">')), { width: 120, height: 80 });
  assert.deepEqual(sizeOf(bytes('<svg xmlns="x" viewBox="0 0 24 16">')), { width: 24, height: 16 });
});

test("an image whose size cannot be read has none", () => {
  assert.equal(sizeOf([0x1f, 0x8b, 0x08]), null);
  assert.equal(sizeOf(bytes("<svg>")), null);
  assert.equal(sizeOf([0xff, 0xd8, 0xff]), null);
});

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

const DAY = 24 * 60 * 60;

test("copies untouched for more than 30 days are the stale ones", () => {
  const now = 1_800_000_000;
  const listing = [
    `${now - 31 * DAY} aaaa-10-100.png`,
    `${now - 30 * DAY} bbbb-10-100.jpg`,
    `${now - DAY} cccc-10-100.svg`,
    `${now - 30 * DAY - 1} dddd-10-100.webp`,
  ].join("\n");
  assert.deepEqual(staleCopies(listing, now), ["aaaa-10-100.png", "dddd-10-100.webp"]);
});

test("only files named like copies are ever stale", () => {
  const old = 1_800_000_000 - 90 * DAY;
  const listing = [`${old} notes.txt`, `${old} ../../etc/passwd`, `${old} a b.png`, "garbage", ""].join("\n");
  assert.deepEqual(staleCopies(listing, 1_800_000_000), []);
});

// COPY and LIST are the scripts the mod runs; here they run against a temporary folder.
const sh = (script, ...args) => spawnSync("sh", ["-c", script, "sh", ...args], { encoding: "utf8" });

test("copying puts the image in the folder, private to the user", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-copies-"));
  const source = join(dir, "my shot.png"), copy = join(dir, "data folder", "images", "aaaa-8-1.png");
  writeFileSync(source, Buffer.from(PNG));
  assert.equal(sh(COPY, source, copy).status, 0);
  assert.deepEqual([...readFileSync(copy)], PNG);
  assert.equal(statSync(copy).mode & 0o077, 0);
});

test("opening an image again keeps its copy fresh instead of copying again", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-copies-"));
  const source = join(dir, "shot.png"), copy = join(dir, "images", "aaaa-8-1.png");
  writeFileSync(source, Buffer.from(PNG));
  sh(COPY, source, copy);
  const old = Date.now() / 1000 - 40 * DAY;
  utimesSync(copy, old, old);
  writeFileSync(source, "changed");
  assert.equal(sh(COPY, source, copy).status, 0);
  assert.deepEqual([...readFileSync(copy)], PNG);
  assert.ok(statSync(copy).mtimeMs / 1000 > Date.now() / 1000 - DAY);
});

test("copying a file that cannot be copied fails without leaving a copy", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-copies-"));
  const copy = join(dir, "images", "aaaa-8-1.png");
  assert.notEqual(sh(COPY, join(dir, "none.png"), copy).status, 0);
  assert.equal(existsSync(copy), false);
});

test("a new copy replaces the earlier copies of the same image, and no others", () => {
  const name = copyName("/w/shot.png", { bytes: 900, modified: 30 }, "png");
  const older = copyName("/w/shot.png", { bytes: 800, modified: 20 }, "png");
  const oldest = copyName("/w/shot.png", { bytes: 700, modified: 10 }, "svg");
  const other = copyName("/w/other.png", { bytes: 800, modified: 20 }, "png");
  const listing = [`50 ${name}`, `40 ${older}`, `30 ${oldest}`, `40 ${other}`, "40 notes.txt", `40 ${name}.bak`, ""].join("\n");
  assert.deepEqual(olderCopies(listing, name), [older, oldest]);
  assert.deepEqual(olderCopies("", name), []);
  assert.deepEqual(olderCopies(null, name), []);
  // A name that is not a copy's gives nothing to delete.
  assert.deepEqual(olderCopies(listing, "../x.png"), []);
  assert.deepEqual(olderCopies(listing, ""), []);
});

test("the listing of a real folder names the older copies of an image", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-copies-"));
  for (const name of ["aaaa-8-1.png", "aaaa-9-2.png", "aaaab-8-1.png", "bbbb-8-1.png"]) writeFileSync(join(dir, name), "x");
  assert.deepEqual(olderCopies(sh(LIST, dir).stdout, "aaaa-9-2.png"), ["aaaa-8-1.png"]);
});

test("the listing of a real folder names the copies that went stale", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-copies-"));
  const now = Math.floor(Date.now() / 1000);
  for (const [name, age] of [["aaaa-8-1.png", 45], ["bbbb-8-1.png", 2]]) {
    writeFileSync(join(dir, name), "x");
    utimesSync(join(dir, name), now - age * DAY, now - age * DAY);
  }
  assert.deepEqual(staleCopies(sh(LIST, dir).stdout, now), ["aaaa-8-1.png"]);
  assert.deepEqual(staleCopies(sh(LIST, join(dir, "none")).stdout, now), []);
});
