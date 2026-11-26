// The size an image is drawn at, from its own size and the width the screen gives it:
// the image view fits a whole image to the viewer's width, and the markdown view also keeps
// an image in a document under MAX_HEIGHT. No Herdr imports, so it runs under `node --test`.

export const MAX_HEIGHT = 420;

// The size to draw at: the image's own, shrunk to the room's width when it is wider.
// An image that does not tell its size fills the room as a square.
export function fitted(size, room) {
  const most = Math.max(1, Math.floor(room));
  if (!size) return { width: most, height: most };
  const width = Math.min(size.width, most);
  return { width, height: Math.max(1, Math.round(size.height * width / size.width)) };
}

// The size to draw an image at inside a document: its own size, shrunk to the room's width
// and then to MAX_HEIGHT, keeping its shape. It is never made larger than its own size.
// An image that does not tell its size is a square that fits both limits.
export function imageBoxOf(size, room) {
  const box = fitted(size, Math.min(room, size ? Infinity : MAX_HEIGHT));
  if (box.height <= MAX_HEIGHT) return box;
  return { width: Math.max(1, Math.round(box.width * MAX_HEIGHT / box.height)), height: MAX_HEIGHT };
}
