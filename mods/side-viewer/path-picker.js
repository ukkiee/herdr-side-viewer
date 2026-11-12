// The path picker's decisions. No Herdr imports, so it runs under `node --test`.
//
// The picker uses them in this order:
//   conversationOf({ focused, panes }) -> { pane, terminal, cwd } | null
//     the conversation to read; null: ask for a click on a conversation terminal
//   pathCandidates({ text, cwd, home, groups }) -> string[]
//     absolute paths from that terminal's text (`hc read <terminal> --lines 1000`), latest first,
//     at most CHECK_LIMIT; cwd null leaves relative paths out; groups: extensions.json
//   existingPaths(candidates, output) -> string[]
//     the candidates the machine has, at most PICK_LIMIT; output: the paths among them that are
//     files there, one per line, as file-access.js exists gives them (from one command run
//     on that machine, machine.js EXISTS) joined with newlines
//   readFailureOf(read), pickerFailureOf(error) -> { state, reason }
//     a failed `hc read` of the terminal as an error, and what the picker shows for an error
//   filterPaths(paths, typed) -> string[]
//     the paths containing what was typed, ignoring case
//   openTargetOf({ conversation, panes }) -> { viewer: pane } | { split: { pane, direction } }
//     where the pick opens: the side viewer shown in the conversation's tab, else a split
import { viewOf } from "./views.js";
import { failureOf } from "./remote-results.js";

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

// How many paths the picker shows at most.
export const PICK_LIMIT = 30;

// The candidates (pathCandidates) that the existence check found on the machine, in their
// order, at most PICK_LIMIT. `output` is the paths file-access.js exists gave, one per line.
export function existingPaths(candidates, output) {
  const exists = new Set(String(output ?? "").split(/\r?\n/));
  return candidates.filter((path) => exists.has(path)).slice(0, PICK_LIMIT);
}

// A failed `hc read` of the conversation's terminal ({ code, stdout, stderr }) as what to throw:
// hc's JSON error from stderr ({"error":{"kind","message","hint"}}, exit 3 for a terminal
// that is gone), which remote-results.js failureOf reads, else an Error of its words.
export function readFailureOf(read) {
  const said = String(read.stderr || read.stdout || "").trim();
  try {
    const json = JSON.parse(said);
    if (json?.error) return json;
  } catch {}
  return new Error(said || `hc read exited ${read.code}`);
}

// What the picker shows when finding paths failed with `error`, as { state, reason }: a
// machine out of reach or a Windows machine has its own state, anything else is "failed" with
// the first line of its words as `reason`.
export function pickerFailureOf(error) {
  const failure = failureOf(error);
  const state = failure === "unreachable" || failure === "windows" ? failure : "failed";
  const reason = String(error?.error?.message ?? error?.message ?? error).split("\n")[0];
  return { state, reason };
}

// The paths that contain `typed`, ignoring case. Nothing typed keeps them all.
export function filterPaths(paths, typed) {
  const wanted = String(typed ?? "").toLowerCase();
  return paths.filter((path) => path.toLowerCase().includes(wanted));
}

const MOD = "side-viewer";

// The conversation whose text the picker reads, as { pane, terminal, cwd }, or null when the
// focus is on none (a viewer tab, another mod, no pane): the picker then asks for a click on a
// conversation terminal. A focused terminal is it. A focused side viewer stands for its tab's
// conversation, an agent's terminal before a plain shell's.
//   focused: herdr focused(); panes: herdr panes()
export function conversationOf({ focused, panes }) {
  if (!focused?.pane) return null;
  const here = panes.find((p) => p.pane === focused.pane);
  if (focused.terminal) return { pane: focused.pane, terminal: focused.terminal, cwd: here?.cwd ?? focused.cwd ?? null };
  if (here?.mod !== MOD) return null;
  const terminals = panes.filter((p) => p.tab === here.tab && p.terminal);
  const found = terminals.find((p) => p.program?.agent || p.status) ?? terminals[0];
  return found ? { pane: found.pane, terminal: found.terminal, cwd: found.cwd ?? null } : null;
}

// Where a picked file opens: { viewer: pane } when a side viewer shows in the conversation's
// tab, else { split: { pane, direction: "right" } } beside the conversation. A viewer behind
// another pane's zoom does not show, and `side-viewer.show` reaches shown copies only.
//   conversation: the conversation's pane id; panes: herdr panes()
export function openTargetOf({ conversation, panes }) {
  const tab = panes.find((p) => p.pane === conversation)?.tab;
  const inTab = panes.filter((p) => p.tab === tab);
  const zoomed = inTab.find((p) => p.zoomed);
  const viewer = inTab.find((p) => p.mod === MOD && (!zoomed || zoomed === p));
  return viewer ? { viewer: viewer.pane } : { split: { pane: conversation, direction: "right" } };
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
