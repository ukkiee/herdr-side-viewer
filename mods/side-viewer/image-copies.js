// Images are drawn from copies kept in the mod's data folder, because Herdr is reported to
// draw images only from real folders under the app home. This decides which files count as
// images, how a copy is named and sized, and which copies are old enough to delete.
// No Herdr imports, so it runs under `node --test`.

// Under the app home; image() takes a path relative to it.
export const FOLDER = "data/side-viewer/images";
export const STALE_DAYS = 30;

const ascii = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

// What is left of an SVG's text once the parts allowed before its root element are gone.
function afterProlog(text) {
  let rest = text.replace(/^ï»¿/, "");
  for (;;) {
    const next = rest.replace(/^\s+/, "").replace(/^<\?[\s\S]*?\?>/, "").replace(/^<!--[\s\S]*?-->/, "").replace(/^<!DOCTYPE[^>]*>/i, "");
    if (next === rest) return rest;
    rest = next;
  }
}

// The kind of image a file's first bytes say it is, or null. The extension alone is never
// enough: a text file named .png must not be copied. Compressed data cannot be looked into
// here, so it passes only for a file that says it is svgz.
export function kindOf(file, head) {
  if (!head?.length) return null;
  if (head[0] === 0x89 && ascii(head, 1, 4) === "PNG") return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (/^GIF8[79]a$/.test(ascii(head, 0, 6))) return "gif";
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP") return "webp";
  if (head[0] === 0x1f && head[1] === 0x8b) return /\.svgz$/i.test(file) ? "svgz" : null;
  if (/^<svg[\s>]/.test(afterProlog(ascii(head, 0, head.length)))) return "svg";
  return null;
}

const hash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)) >>> 0, 2166136261).toString(16);

// The copy's file name. Size and time are part of it so a changed image gets a new name,
// and with it a fresh draw. The extension is the kind found in the bytes.
export function copyName(file, probe, kind) {
  return `${hash(file)}-${probe.bytes}-${probe.modified}.${kind}`;
}

function jpegSize(b) {
  let i = 2;
  while (i + 8 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    // Markers without a length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame) return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6] };
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

function webpSize(b) {
  const kind = ascii(b, 12, 16);
  const u24 = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  if (kind === "VP8X" && b.length >= 30) return { width: 1 + u24(24), height: 1 + u24(27) };
  if (kind === "VP8 " && b.length >= 30) return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  if (kind === "VP8L" && b.length >= 25) {
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

function svgSize(b) {
  const tag = /<svg\b[^>]*>/.exec(ascii(b, 0, Math.min(b.length, 4096)))?.[0];
  if (!tag) return null;
  const width = /\swidth="([\d.]+)(?:px)?"/.exec(tag)?.[1], height = /\sheight="([\d.]+)(?:px)?"/.exec(tag)?.[1];
  if (width && height) return { width: Math.round(+width), height: Math.round(+height) };
  const box = /\sviewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(tag);
  return box ? { width: Math.round(+box[1]), height: Math.round(+box[2]) } : null;
}

// An image's own { width, height } from its bytes, or null when they do not say.
export function sizeOf(b) {
  const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  let size = null;
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b.length >= 24) size = { width: u32(16), height: u32(20) };
  else if (ascii(b, 0, 4) === "GIF8" && b.length >= 10) size = { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  else if (b[0] === 0xff && b[1] === 0xd8) size = jpegSize(b);
  else if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") size = webpSize(b);
  else size = svgSize(b);
  return size?.width > 0 && size?.height > 0 ? size : null;
}

// The size to draw at: the image's own, shrunk to the room's width when it is wider.
// An image that does not tell its size fills the room as a square.
export function fitted(size, room) {
  const most = Math.max(1, Math.floor(room));
  if (!size) return { width: most, height: most };
  const width = Math.min(size.width, most);
  return { width, height: Math.max(1, Math.round(size.height * width / size.width)) };
}

// Run as `sh -c COPY sh <image> <copy>`. A copy already there is only touched: its time is
// when it was last shown, which is what the 30-day cleanup goes by.
export const COPY = `
umask 077
mkdir -p "$(dirname "$2")" || exit 1
if [ -f "$2" ]; then touch "$2"; else cp "$1" "$2" || { rm -f "$2"; exit 1; }; fi
`;

// Run as `sh -c LIST sh <folder>`. Prints "<seconds last touched> <name>" for each file.
export const LIST = `
cd "$1" 2>/dev/null || exit 0
case "$(uname)" in Darwin|*BSD) format="-f %m@%N" ;; *) format="-c %Y@%n" ;; esac
for f in *; do [ -f "$f" ] && stat $format "$f" | tr '@' ' '; done
exit 0
`;

// The names in LIST's output that were last shown more than 30 days before `now` (seconds).
// Only names shaped like copyName's are returned, so the cleanup can never be pointed at
// anything else.
export function staleCopies(listing, now) {
  const limit = now - STALE_DAYS * 24 * 60 * 60;
  const stale = [];
  for (const line of String(listing ?? "").split("\n")) {
    const found = /^(\d+) ([0-9a-f]+-\d+-\d+\.[a-z]+)$/.exec(line);
    if (found && Number(found[1]) < limit) stale.push(found[2]);
  }
  return stale;
}
