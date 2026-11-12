// The images inside the shown markdown document, copied into the data folder the same way
// the image view copies a whole image (main.js readImage): TextView does not draw a local
// image, and Herdr draws images only from real folders under the app home. Only a file whose
// first bytes are an image's is copied, so nothing else can be pulled into the app home
// through a document. Which file an image points at and its drawn size are decided in
// markdown-images.js.
import { exec, appHome } from "herdr";
// Herdr's built-in module: an image's size is read from its bytes, which readTextFile cannot give.
import * as fs from "fs/promises";
import { readProbe, PROBE, blockerOf } from "./views.js";
import { kindOf, copyName, sizeOf, FOLDER, COPY } from "./image-copies.js";
import { parseMarkdown } from "./markdown-blocks.js";
import { imageFileOf, imagesOf } from "./markdown-images.js";

const FAILED = { failed: true };

const same = (a, b) => a?.failed === b?.failed && a?.path === b?.path
  && a?.size?.width === b?.size?.width && a?.size?.height === b?.size?.height;

export class MarkdownImages {
  // `sweep()` and `dropOlder(path)` are main.js's cleanup of the copies folder, shared with
  // the image view so both follow one 30-day rule.
  constructor({ sweep, dropOlder }) {
    this.sweep = sweep;
    this.dropOlder = dropOlder;
    // Image file -> { path, size } of its copy, or FAILED.
    this.found = new Map();
    this.pending = new Set();
    // Image block key -> the block's width, from its size report.
    this.rooms = new Map();
    this.file = null;
    this.text = null;
  }

  // Copies the images of `text`, the shown text of the document `file`, and notifies when a
  // copy is ready or fails. `again` reads images already known once more, for a new read of
  // the document; typing copies only images not seen yet.
  prepare(file, text, again, cx) {
    if (!again && file === this.file && text === this.text) return;
    this.file = file;
    this.text = text;
    const files = new Set();
    if (text.includes("![")) {
      for (const src of imagesOf(parseMarkdown(text).blocks)) {
        const image = imageFileOf(src, file);
        if (image) files.add(image);
      }
    }
    for (const known of this.found.keys()) if (!files.has(known)) this.found.delete(known);
    for (const image of files) {
      if (this.pending.has(image) || (!again && this.found.has(image))) continue;
      this.pending.add(image);
      cx.spawn(async (cx) => {
        let result;
        try {
          result = await this.copy(image);
        } catch {
          result = FAILED;
        }
        this.pending.delete(image);
        if (same(this.found.get(image), result)) return;
        this.found.set(image, result);
        cx.notify();
      });
    }
  }

  // The copy of one image file as { path, size }, or FAILED.
  async copy(image) {
    const probe = readProbe((await exec("sh", ["-c", PROBE, "sh", image])).stdout);
    if (blockerOf({ view: "image" }, probe)) return FAILED;
    const kind = kindOf(image, probe.head);
    if (!kind) return FAILED;
    const path = `${FOLDER}/${copyName(image, probe, kind)}`;
    const copied = await exec("sh", ["-c", COPY, "sh", image, `${appHome()}/${path}`]);
    if (copied.code !== 0) return FAILED;
    // The same copy as before: its size is known, so the file is not read again.
    const known = this.found.get(image);
    let size = known?.path === path ? known.size : null;
    if (known?.path !== path) {
      try {
        size = sizeOf(await fs.readFile(`${appHome()}/${path}`));
      } catch {}
      this.dropOlder(path).catch(() => null);
    }
    this.sweep().catch(() => null);
    return { path, size };
  }

  // What markdown-view.js's image blocks ask about the document `file`. `of(src)` is one of
  // { state: "remote" } (not a local file), { state: "loading" }, { state: "failed" } or
  // { state: "ready", path, size }.
  forDocument(file) {
    return {
      of: (src) => {
        const image = imageFileOf(src, file);
        if (!image) return { state: "remote" };
        const found = this.found.get(image);
        if (!found) return { state: "loading" };
        return found.failed ? { state: "failed" } : { state: "ready", path: found.path, size: found.size };
      },
      room: (key) => this.rooms.get(key) ?? null,
      setRoom: (key, width, cx) => {
        if (this.rooms.get(key) === width) return;
        this.rooms.set(key, width);
        cx.notify();
      },
    };
  }
}
