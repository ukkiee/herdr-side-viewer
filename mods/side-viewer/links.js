// What a click on a link inside a markdown document does, and the small decisions of the
// file watch. No Herdr imports, so it runs under `node --test`.
import { viewOf } from "./views.js";

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// `groups` is extensions.json, the one place that says which extensions are markdown.
// Until it has been read nothing is markdown: the file is then only ever shown in Finder.
export function isMarkdown(file, groups) {
  return typeof file === "string" && viewOf(file, groups)?.view === "markdown";
}

// The folder a file sits in, or null without a file.
export function folderOf(file) {
  if (typeof file !== "string" || !file) return null;
  return file.slice(0, file.lastIndexOf("/")) || "/";
}

// The folder to watch for the shown file, or null to leave it to the slow recheck. The
// watch is recursive on macOS, so the home folder or the root would report every change
// on the machine.
export function watchedFolder(file, home) {
  const folder = folderOf(file);
  if (!folder || folder === "/") return null;
  if (typeof home === "string" && home && folder === (home.replace(/\/+$/, "") || "/")) return null;
  return folder;
}

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

// `url` is the link as written, `file` the document it is in, `home` the home folder,
// `groups` extensions.json.
// Returns one of:
//   { action: "show", file }    another markdown document: open it in this viewer
//   { action: "system", url }   a web or mail address: the system's handler opens it
//   { action: "reveal", file }  any other local file: only shown in Finder. A link could
//                               point at something that runs, so it is never opened.
//   { action: "none" }          an anchor inside the document, or a scheme we do not follow
export function linkAction(url, file, home, groups) {
  const none = { action: "none" };
  let path = typeof url === "string" ? url.trim() : "";
  if (/^(https?|mailto):/i.test(path)) return { action: "system", url: path };
  if (/^file:\/\//i.test(path)) path = path.slice(7).replace(/^localhost(?=\/)/i, "");
  else if (SCHEME.test(path) || path.startsWith("//")) return none;

  // The anchor goes first, so an encoded "#" or "?" in a name survives.
  path = path.split("#")[0].split("?")[0];
  if (!path) return none;
  try {
    path = decodeURIComponent(path);
  } catch {
    // A stray "%" is a legal file name: keep the path as written.
  }

  if (path === "~" || path.startsWith("~/")) path = (home ?? "") + path.slice(1);
  else if (!path.startsWith("/")) {
    const folder = folderOf(file);
    if (!folder) return none;
    path = `${folder}/${path}`;
  }
  path = normalize(path);
  return isMarkdown(path, groups) ? { action: "show", file: path } : { action: "reveal", file: path };
}

// The source wrapped in a code fence, so the markdown view draws it as written and it stays
// selectable. The fence is one backtick longer than the longest run inside.
export function rawMarkdown(text) {
  let longest = 2;
  for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  const fence = "`".repeat(longest + 1);
  return `${fence}\n${text}${text.endsWith("\n") ? "" : "\n"}${fence}`;
}

// Whether a batch of changed paths from the folder watch concerns the shown file. The watch
// is recursive on macOS, so most batches are about other files.
export function touches(paths, file) {
  const folder = folderOf(file);
  if (!folder) return false;
  if (!Array.isArray(paths)) return true;
  // endsWith: the watch reports real paths (/private/tmp for /tmp). The folder itself in a
  // batch means "refresh everything".
  return paths.some((path) => typeof path === "string" && (path.endsWith(file) || path.endsWith(folder)));
}
