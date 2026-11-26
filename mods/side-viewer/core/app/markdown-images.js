// Images alone on their line inside a markdown document: which ones a document has and which
// file each one points at. No Herdr imports, so it runs under `node --test`.
import { folderOf } from "../domain/links.js";

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
