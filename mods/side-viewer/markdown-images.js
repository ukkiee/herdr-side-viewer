// Images alone on their line inside a markdown document: which file each one points at, and
// the size it is drawn at. No Herdr imports, so it runs under `node --test`.
import { folderOf } from "./links.js";
import { fitted } from "./image-copies.js";

export const MAX_HEIGHT = 420;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Resolves "." and "..", never climbing above the root.
function normalize(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return "/" + parts.join("/");
}

// The local file an image's `src` points at, or null for anything that is not a local file
// (a web address, `data:`, another scheme). Relative paths start from the folder of `file`,
// the document the image is in.
export function imageFileOf(src, file) {
  let path = typeof src === "string" ? src.trim() : "";
  if (SCHEME.test(path) || path.startsWith("//")) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    // A stray "%" is a legal file name: keep the path as written.
  }
  if (!path) return null;
  if (!path.startsWith("/")) {
    const folder = folderOf(file);
    if (!folder) return null;
    path = `${folder}/${path}`;
  }
  return normalize(path);
}

// The `src` of every image block among markdown-blocks.js's `blocks`, in document order,
// looking inside lists and quotes.
export function imagesOf(blocks) {
  const found = [];
  const walk = (list) => {
    for (const block of list ?? []) {
      if (block.type === "image") found.push(block.src);
      else if (block.type === "quote") walk(block.blocks);
      else if (block.type === "list") for (const item of block.items) walk(item.blocks);
    }
  };
  walk(blocks);
  return found;
}

// The size to draw an image at inside a document: its own size, shrunk to the room's width
// and then to MAX_HEIGHT, keeping its shape. It is never made larger than its own size.
// An image that does not tell its size is a square that fits both limits.
export function imageBoxOf(size, room) {
  const box = fitted(size, Math.min(room, size ? Infinity : MAX_HEIGHT));
  if (box.height <= MAX_HEIGHT) return box;
  return { width: Math.max(1, Math.round(box.width * MAX_HEIGHT / box.height)), height: MAX_HEIGHT };
}
