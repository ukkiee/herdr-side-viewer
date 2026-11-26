// The shell command that asks a machine about a file before anything reads it, and the reading
// of its answer. No Herdr imports, so it runs under `node --test`; main.js and
// markdown-image-loader.js run it through file-access.js. What the answer stops or allows is
// decided in views.js (blockerOf, blankSvg, settledProbe, sameProbe).

// Run as `sh -c PROBE sh <file>`. It tells the size before anything reads the file, so a
// huge file is never pulled into the mod, and gives the first bytes for the image check.
// od's -v keeps repeated lines from collapsing into "*".
export const PROBE = `
[ -e "$1" ] || { echo missing; exit 0; }
{ [ -f "$1" ] && [ -r "$1" ]; } || { echo unreadable; exit 0; }
case "$(uname)" in
  Darwin|*BSD) stat -L -f 'file %z %m' "$1" ;;
  *) stat -L -c 'file %s %Y' "$1" ;;
esac
head -c 4096 "$1" | od -An -v -tx1
`;

// The probe's output as { found, readable, bytes, modified, head }. `modified` is in
// seconds, `head` the first bytes as numbers. Output it cannot make sense of counts as
// a file that cannot be read.
export function readProbe(stdout) {
  const lines = String(stdout ?? "").trim().split("\n");
  if (lines[0] === "missing") return { found: false };
  const stat = /^file (\d+) (\d+)$/.exec(lines[0]);
  if (!stat) return { found: true, readable: false };
  const head = lines.slice(1).join(" ").split(/\s+/).filter(Boolean).map((hex) => parseInt(hex, 16));
  return { found: true, readable: true, bytes: Number(stat[1]), modified: Number(stat[2]), head };
}
