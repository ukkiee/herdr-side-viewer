// The viewer's machine: the computer its space lives on, whose files it shows. No Herdr
// imports, so it runs under `node --test`; file-access.js runs what this module works out.
//
// Whoever opens a viewer (open.sh, the path picker, "Open in a new tab") puts the space
// value in its props: the space id without its `<machine>/` prefix. The machine's name is
// never put there (ADR 0002), so the viewer finds its space in spaces() and takes its
// `machine`. A viewer without the value, or whose space is not listed, is on this Mac.

// The props value for the space `id` (spaces()[i].id or focused().space), or null.
export function spaceValue(id) {
  if (typeof id !== "string") return null;
  const value = id.slice(id.lastIndexOf("/") + 1);
  return value || null;
}

// The machine of the viewer whose props are `props`, as { machine, remote }: machine is the
// space's `machine` (null: this Mac). `spaces` is Herdr's spaces(). A remote space's id has
// the machine prefix the value lacks, so its id ends with `/<value>`.
export function machineOf(props, spaces) {
  const value = props?.space;
  if (typeof value !== "string" || !value) return { machine: null, remote: false };
  const space = (spaces ?? []).find((s) => s.id === value || s.id.endsWith(`/${value}`));
  const machine = space?.machine ?? null;
  return { machine, remote: machine !== null };
}

// The header's actions, left to right (header.js). "Open in the original app" and "Show in
// Finder" act on this Mac, where a remote file is not, so a remote file has neither.
// `newTab`: whether the content can open in a tab (views.js opensInTab).
export function headerActions({ remote, newTab }) {
  return [...(newTab ? ["newTab"] : []), ...(remote ? [] : ["original", "finder"])];
}
