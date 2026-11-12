// The path picker's decisions. No Herdr imports, so it runs under `node --test`.
import { viewOf } from "./views.js";

// How many candidates go to the existence check at most. False ones ("Next.js", a path that
// was only mentioned) drop out there, so this is larger than what the picker shows.
export const CHECK_LIMIT = 200;

// Where a word that may be a path ends outside a code span. A path with one of these in its
// name is found only inside backticks.
const RUN = /`([^`\n]+)`|[^\s`'"()[\]{}<>|,;*=]+/g;

// A path with a known-looking extension, an optional line number (a.md:12, a.md:12:3, a.md:12-20)
// and then nothing but punctuation or letters of another script ("plan.md를", "a.md.").
// The lazy start picks the shortest such path, so "a.md.bak" is not a.md.
const PATH = /^(.*?\.[A-Za-z0-9+]+)(?::\d+(?:[:-]\d+)?)?[^A-Za-z0-9_/]*$/;

// The absolute paths of files the side viewer can show that the terminal text `text` names,
// the latest (lowest, then rightmost) first, each file once, at most CHECK_LIMIT.
//   cwd: the terminal's folder, or null: then relative paths are left out
//   home: the machine's home, for ~ paths; groups: extensions.json
export function pathCandidates({ text, cwd, home, groups }) {
  const found = [];
  for (const line of String(text ?? "").split("\n").reverse()) {
    found.push(...pathsIn(line).reverse());
  }
  const unique = [];
  for (const path of found) {
    const full = resolved(path, cwd, home);
    if (!full || unique.includes(full) || !viewOf(full, groups)) continue;
    unique.push(full);
    if (unique.length === CHECK_LIMIT) break;
  }
  return unique;
}

// The paths written in one line, in order. A code span with spaces is also tried whole, for
// "`My Docs/a.md`"; its words are tried too, for "`node --test a.test.mjs`".
function pathsIn(line) {
  const paths = [];
  for (const [run, span] of line.matchAll(RUN)) {
    if (span === undefined) {
      paths.push(pathOf(run));
      continue;
    }
    for (const [word] of span.matchAll(RUN)) paths.push(pathOf(word));
    if (/\s/.test(span.trim())) paths.push(pathOf(span.trim()));
  }
  return paths.filter(Boolean);
}

function pathOf(word) {
  if (word.includes("://")) return null;
  return word.match(PATH)?.[1] ?? null;
}

function resolved(path, cwd, home) {
  if (path.startsWith("/")) return normalized(path);
  if (path.startsWith("~")) return path.startsWith("~/") && home ? normalized(`${home}/${path.slice(2)}`) : null;
  return cwd ? normalized(`${cwd}/${path}`) : null;
}

// The path with "." and ".." parts and doubled slashes taken out.
function normalized(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}
