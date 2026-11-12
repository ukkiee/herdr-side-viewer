// An svg edited in its source is drawn, before it is saved, from a preview: the edited text
// written to a copy in the data folder, since Herdr draws images only from files there
// (image-copies.js). This names the previews and picks the picture an svg draws.
// No Herdr imports, so it runs under `node --test`.
import { copyName } from "./image-copies.js";

// Under the app home, apart from the disk copies: a disk copy's cleanup of earlier copies
// (olderCopies) would otherwise take the preview on screen.
export const PREVIEW_FOLDER = "data/side-viewer/previews";

const textHash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)) >>> 0, 2166136261);

// The preview's file name for `file` edited to `text`. It has the shape of a disk copy's
// name (copyName), so olderCopies and staleCopies clean previews the same way, and any change
// of the text gives a new name, and with it a fresh draw.
export function previewName(file, text) {
  return copyName(file, { bytes: text.length, modified: textHash(text) }, "svg");
}

// What the rendering of svg `content` draws, as { path, size }. `text` is the text the viewer
// shows (shownText), `preview` the last preview written: { file, text, path, size } or null.
// A preview of exactly that text wins: it is also right just after a save, before the read
// that brings the saved file's own copy. Otherwise the disk copy, unless the text is edited:
// then null, until the preview of that text is written.
export function pictureOf(content, text, preview) {
  if (preview && preview.file === content.file && preview.text === text) {
    return { path: preview.path, size: preview.size };
  }
  if (text !== content.text) return null;
  return { path: content.path, size: content.size };
}
