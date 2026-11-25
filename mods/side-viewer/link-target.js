// What a cmd-click on a terminal link opens in the side viewer. No Herdr imports, so it runs
// under `node --test`; link.js asks Herdr what this module works out.
//
// link.js uses them in this order:
//   linkOpening(source, panes) -> { conversation, space } | null
//     the clicked conversation's pane address (null for a layout's terminal block, which has
//     no pane to split) and its space value (machine.js); null: no space, so it passes on
//   wantsHome(link) -> boolean
//     whether resolving the link needs the machine's home: a ~ path Herdr left unresolved
//   uriHost(link) -> string | null
//     the host a raw file URI names when it is not this machine's by its form (empty or
//     localhost); link.js then asks the terminal's machine for its host name
//   linkFile({ link, cwd, home, host, groups }) -> string | null
//     the absolute path of a file the viewer can show, or null: the click passes on
//   linkPattern(groups) -> string
//     the Rust regex of mod.json's link rule, made from extensions.json
import { resolved } from "./path-picker.js";
import { viewOf } from "./views.js";
import { spaceValue } from "./machine.js";

// The clicked conversation as { conversation, space }. `source` is the click's source
// ({ pane, machine, space, ... }); `panes` is Herdr's panes(). The split and the "viewer in
// this tab" check start from a listed pane: the source's id as it is, else, for a remote
// terminal, under its machine's prefix. A click from no listed pane keeps the space only.
export function linkOpening(source, panes) {
  const space = spaceValue(source?.space);
  if (!space) return null;
  const id = typeof source.pane === "string" && source.pane ? source.pane : null;
  const listed = panes ?? [];
  const pane = id && (listed.find((p) => p.pane === id) ?? (source.machine ? listed.find((p) => p.pane === `${source.machine}/${id}`) : null));
  return { conversation: pane ? pane.pane : null, space };
}

// Herdr gives `link.path` only for a local path it resolved. Anything else comes as `raw`,
// the text clicked, and a `~` in it needs the home of the machine the terminal runs on.
export function wantsHome(link) {
  return !link?.path && String(link?.raw ?? "").includes("~/");
}

// A raw file URI (an OSC 8 link): file:/path, file:///path or file://host/path, any case.
const FILE_URI = /^file:(?:\/\/([^/]*))?(\/[^?#]*)/i;

export function uriHost(link) {
  if (link?.path) return null;
  const host = String(link?.raw ?? "").match(FILE_URI)?.[1];
  return host && host.toLowerCase() !== "localhost" ? host : null;
}

// The file a click on `link` ({ kind, raw, path }) opens, or null when the viewer cannot show
// it. A raw file URI gives its path when its host is the terminal's machine: none, localhost
// or `host`, that machine's host name (null when unknown). Plain text is the path up to the
// first space: a path Herdr could not resolve may come with the words after it
// ("plan.md 파일."). Backticks around it, a line number and ASCII punctuation after it fall
// away, and a relative path is taken from `cwd`, the clicked terminal's folder. Letters stuck
// to the end make it no path ("plan.md를"); "plan.md 를" is the clickable way to write it.
//   home: the machine's home or null; groups: extensions.json
export function linkFile({ link, cwd, home, host = null, groups }) {
  if (link?.kind !== "file") return null;
  const file = link.path ?? fromRaw(String(link.raw ?? ""), cwd ?? null, home ?? null, host);
  return file && viewOf(file, groups) ? file : null;
}

// A clicked path: the shortest one with an extension that leaves only a line number
// (a.md:12, a.md:12:3, a.md:12-20), a closing backtick and ASCII punctuation after it.
const CLICKED = /^`?([^`\s]+?\.[A-Za-z0-9+]+)(?::\d+(?:[:-]\d+)?)?`?[.,;:!?)\]'"]*$/;

function fromRaw(raw, cwd, home, host) {
  const uri = raw.match(FILE_URI);
  if (uri) {
    const named = uri[1] ?? "";
    const here = !named || named.toLowerCase() === "localhost" || (host !== null && named.toLowerCase() === host.toLowerCase());
    if (!here) return null;
    try {
      return decodeURIComponent(uri[2]);
    } catch {
      return null;
    }
  }
  const path = raw.trim().split(/\s/, 1)[0].match(CLICKED)?.[1];
  return path ? resolved(path, cwd, home) : null;
}

// The link rule's pattern: a path with one of the extensions in extensions.json, then the end,
// a line number or punctuation. Herdr runs it as a Rust regex search, so it may match inside
// the text it is given; linkFile has the last word on what opens.
export function linkPattern(groups) {
  const extensions = [...new Set(Object.values(groups).flat())];
  const alternatives = extensions.map((e) => e.replace(/[.+*?^$()[\]{}|\\]/g, "\\$&")).join("|");
  return `(?i)\\.(?:${alternatives})(?:[^A-Za-z0-9_+]|$)`;
}
