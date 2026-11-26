// The viewer's way to the files it shows: everything it reads and writes of them goes through
// an access bound to one machine, the machine of its space (machine.js). On this Mac an access
// makes Herdr's calls without `on`; on another machine it passes `on`. The commands it runs and
// the reading of their answers are in machine.js, the reading of this Mac's writeTextFile
// refusals in write-refusal.js. Watching a folder is left out: Herdr's watchFolder watches
// this Mac only.
//
// accessOf(machine) -> access, the same object for the same machine (null: this Mac):
//   access.machine            the machine's name, or null for this Mac
//   access.remote             whether that is another machine
//   access.read(path)         Promise<string | null>: the file's UTF-8 text (up to 1 MiB) as
//                             readTextFile reads it there; null when the file is not there.
//                             Rejects as readTextFile does (too large, machine unreachable).
//   access.run(command, args, { cwd, timeout })
//                             Promise<{ code, stdout, stderr }>: exec there. A nonzero exit
//                             resolves; rejects when it cannot start or the machine is unreachable.
//   access.exists(paths)      Promise<string[]>: those of `paths` that are files there (links
//                             followed), in the order given, from one command. Rejects when the
//                             command rejects or exits nonzero.
//   access.home()             Promise<string>: the machine's home folder. This Mac's is Herdr's
//                             home(); another machine's is asked once and remembered (a failed
//                             ask is not, and rejects).
//   access.mark(path, { timeout })
//                             Promise<string>: a mark of the file there that changes when the
//                             file does, from `cksum <path>` (remote-results.js changeMark).
//                             Rejects when the command cannot start or the machine is
//                             unreachable (remote-results.js failureOf tells which).
//   access.copy(path, copy, bytes)
//                             Promise<{ code, stdout, stderr }>: puts the bytes of the file `path`
//                             there at `copy`, a path on this Mac, by image-copies.js's COPY
//                             rule (a copy already there is only touched); another machine's
//                             by REMOTE_COPY, which gives no copy unless it got `bytes`, the
//                             size the probe found. Nonzero code: no copy. Rejects as exec does.
//   access.key(path)          a name for the file `path` there that no file of the same path on
//                             another machine shares, for naming its copies.
//   access.write(path, text, expected)
//                             Promise, never rejecting, of { saved: true }; { saved: false, disk }
//                             when the file there no longer holds `expected` (disk: its text
//                             now, null when gone), nothing written; or { saved: false, failure },
//                             failure being { reason, detail? } (edit-state.js writeFailed).
//                             This Mac's is writeTextFile, which compares and writes in one step.
//                             Another machine's reads the file just before it writes it, so a
//                             change in between, under a second, is not seen; a file there the
//                             user cannot write fails for permission, nothing written.
import { exec, readTextFile, writeTextFile, home, appHome } from "herdr";
import { EXISTS, existingOf, HOME_FOLDER, homeOf, NOT_WRITABLE, FIND_HC } from "../../core/app/machine.js";
import { COPY, REMOTE_COPY, REMOTE_COPY_TIMEOUT_MS } from "../../core/app/image-copies.js";
import { changeMark, saveFailureOf } from "../../core/ports/remote-results.js";
import { refusalOf, refusalFailureOf } from "../../core/ports/write-refusal.js";

// A remote save hands its text to `hc file write --on`, which takes it on stdin, from a copy in
// this folder of the data folder; exec has no stdin, and an argument that long is refused. The
// copy is removed once the write ends, whatever its end. `hc file write` replaces the file with
// a new one and keeps its mode, writes through a symbolic link to its target, and writes over
// a file whose mode forbids writing, hence NOT_WRITABLE first.
const SAVES = "data/side-viewer/remote-saves";

// Run on this Mac as `sh -c SAVES_FOLDER sh <folder>`: the folder, readable by the user alone,
// without copies a quit in the middle of a save left behind.
const SAVES_FOLDER = 'umask 077; mkdir -p "$1" && chmod 700 "$1" && find "$1" -type f -mmin +10 -delete';

// Run on this Mac as `sh -c REMOTE_WRITE sh <machine> <path> <copy>`.
const REMOTE_WRITE = `${FIND_HC}
exec "$hc" file write --on "$1" "$2" < "$3"
`;

const accesses = new Map();

export function accessOf(machine) {
  const key = machine ?? null;
  if (!accesses.has(key)) accesses.set(key, key === null ? localAccess() : remoteAccess(key));
  return accesses.get(key);
}

function localAccess() {
  const run = (command, args, options) => exec(command, args, options);
  return {
    machine: null,
    remote: false,
    read: (path) => readTextFile(path),
    run,
    exists: (paths) => existsWith(run, paths),
    home: async () => home(),
    mark: (path, options) => markWith(run, path, options),
    copy: (path, copy) => exec("sh", ["-c", COPY, "sh", path, copy]),
    key: (path) => path,
    write: writeHere,
  };
}

// writeTextFile refuses when the file no longer holds `expected`, and says the same when the
// file is gone, so the file is read again to tell the two apart.
async function writeHere(path, text, expected) {
  try {
    await writeTextFile(path, text, expected);
    return { saved: true };
  } catch (error) {
    if (refusalOf(error) !== "changed") return { saved: false, failure: refusalFailureOf(error) };
  }
  try {
    return { saved: false, disk: await readTextFile(path) };
  } catch (error) {
    return { saved: false, failure: refusalFailureOf(error) };
  }
}

function remoteAccess(machine) {
  const run = (command, args, options) => exec(command, args, { ...options, on: machine });
  let known = null;
  return {
    machine,
    remote: true,
    read: (path) => readTextFile(path, { on: machine }),
    run,
    exists: (paths) => existsWith(run, paths),
    home: async () => {
      if (known) return known;
      const answer = await run("sh", ["-c", HOME_FOLDER, "sh"]);
      const folder = answer.code === 0 ? homeOf(answer.stdout) : null;
      if (!folder) throw new Error(`no home folder on ${machine}: ${answer.stderr || answer.stdout}`);
      known = folder;
      return folder;
    },
    mark: (path, options) => markWith(run, path, options),
    copy: (path, copy, bytes) => exec("sh", ["-c", REMOTE_COPY, "sh", machine, path, copy, String(bytes)], { timeout: REMOTE_COPY_TIMEOUT_MS }),
    key: (path) => `${machine}:${path}`,
    write: (path, text, expected) => writeThere(machine, path, text, expected),
  };
}

async function writeThere(machine, path, text, expected) {
  let disk;
  try {
    disk = await readTextFile(path, { on: machine });
  } catch (error) {
    return { saved: false, failure: saveFailureOf(error) };
  }
  if (disk !== expected) return { saved: false, disk };
  try {
    const locked = await exec("sh", ["-c", NOT_WRITABLE, "sh", path], { on: machine });
    if (locked.code === 0) return { saved: false, failure: { reason: "permission" } };
  } catch (error) {
    return { saved: false, failure: saveFailureOf(error) };
  }
  const folder = `${appHome()}/${SAVES}`;
  const copy = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  try {
    const made = await exec("sh", ["-c", SAVES_FOLDER, "sh", folder]);
    if (made.code !== 0) return { saved: false, failure: saveFailureOf(made) };
    await writeTextFile(copy, text, null);
    const answer = await exec("sh", ["-c", REMOTE_WRITE, "sh", machine, path, copy]);
    return answer.code === 0 ? { saved: true } : { saved: false, failure: saveFailureOf(answer) };
  } catch (error) {
    return { saved: false, failure: saveFailureOf(error) };
  } finally {
    await exec("rm", ["-f", copy]).catch(() => {});
  }
}

async function markWith(run, path, options) {
  return changeMark(await run("cksum", [path], options));
}

async function existsWith(run, paths) {
  if (!paths.length) return [];
  const answer = await run("sh", ["-c", EXISTS, "sh", ...paths]);
  if (answer.code !== 0) throw new Error(`existence check failed: ${answer.stderr}`);
  return existingOf(paths, answer.stdout);
}
