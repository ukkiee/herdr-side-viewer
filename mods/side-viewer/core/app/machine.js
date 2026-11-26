// The viewer's machine: the computer its space lives on, whose files it shows. No Herdr
// imports, so it runs under `node --test`; file-access.js runs what this module works out.
//
// Whoever opens a viewer (open-beside.js, "Open in a new tab") puts the space
// value in its props: the space id without its `<machine>/` prefix. The machine's name is
// never put there (ADR 0002), so the viewer finds its space in spaces() and takes its
// `machine`. A viewer without the value is on this Mac; one whose space is not listed yet
// waits for it.
// It also holds the commands file-access.js asks a machine (which paths are files, its
// home, how to run `hc`) and reads their answers.

// The props value for the space `id` (spaces()[i].id or focused().space), or null.
export function spaceValue(id) {
  if (typeof id !== "string") return null;
  const value = id.slice(id.lastIndexOf("/") + 1);
  return value || null;
}

// The machine of the viewer whose props are `props`, as { machine, remote, unlisted? }:
// machine is the space's `machine` (null: this Mac). `spaces` is Herdr's spaces(). A remote
// space's id has the machine prefix the value lacks, so its id ends with `/<value>`.
// `unlisted`: the props have a space value that no listed space has, as while Herdr has not
// listed a remote space yet after a restart. The space may be another machine's, so such a
// viewer reads and saves nothing until it is listed (machine stays null, remote false).
export function machineOf(props, spaces) {
  const value = props?.space;
  if (typeof value !== "string" || !value) return { machine: null, remote: false };
  const space = (spaces ?? []).find((s) => s.id === value || s.id.endsWith(`/${value}`));
  if (!space) return { machine: null, remote: false, unlisted: true };
  const machine = space.machine ?? null;
  return { machine, remote: machine !== null };
}

// The address on this screen of `value`, a pane id the viewer whose props are `props` keeps
// without its machine prefix (spaceValue does the same to pane ids): this Mac's as it is, a
// remote one under the prefix this screen gives that machine, which the viewer's space id
// shows. Null when `value` is none or the space is not listed yet.
//   spaces: Herdr's spaces()
export function addressOf(value, props, spaces) {
  if (typeof value !== "string" || !value) return null;
  const space = props?.space;
  if (typeof space !== "string" || !space) return value;
  const listed = (spaces ?? []).find((s) => s.id === space || s.id.endsWith(`/${space}`));
  if (!listed) return null;
  return `${listed.id.slice(0, listed.id.length - space.length)}${value}`;
}

// Run as `sh -c EXISTS sh <path>...` on the machine. It answers with the 1-based places of
// the paths that are files (symbolic links followed), one per line, so no path has to be
// printed back, whatever characters it holds.
export const EXISTS = 'i=0; for p; do i=$((i+1)); [ -f "$p" ] && echo "$i"; done; exit 0';

// EXISTS's answer for `paths` as the paths that are files, in the order asked.
export function existingOf(paths, stdout) {
  const places = new Set(String(stdout ?? "").split("\n").map(Number));
  return paths.filter((_path, i) => places.has(i + 1));
}

// Run as `sh -c HOME_FOLDER sh` on the machine: its home folder.
export const HOME_FOLDER = 'printf "%s\\n" "$HOME"';

// HOME_FOLDER's answer as the home folder, or null when it is no absolute path.
export function homeOf(stdout) {
  const home = String(stdout ?? "").replace(/\n$/, "");
  return home.startsWith("/") && !home.includes("\n") ? home : null;
}

// Run as `sh -c NOT_WRITABLE sh <path>` on the machine before a save: exits 0 when the file is
// there and the user cannot write it. `hc file write` replaces a file with a new one, which
// only the folder's permission governs, so a read-only file would be written over.
export const NOT_WRITABLE = 'test -e "$1" && ! test -w "$1"';

// A shell fragment that puts the path of this Mac's `hc` in $hc: the one on PATH, else
// ~/.local/bin/hc, where herdr-core installs it. An app opened from Finder may run commands
// with a PATH that lacks ~/.local/bin. A command that needs a redirection starts with it.
export const FIND_HC = 'hc=$(command -v hc) || hc="$HOME/.local/bin/hc"';

// The header's actions, left to right (header.js). "Open in the default app" and "Show in
// Finder" act on this Mac, where a remote file is not, so a remote file has neither.
// `newTab`: whether the content can open in a tab (views.js opensInTab).
export function headerActions({ remote, newTab }) {
  return [...(newTab ? ["newTab"] : []), ...(remote ? [] : ["defaultApp", "finder"])];
}
