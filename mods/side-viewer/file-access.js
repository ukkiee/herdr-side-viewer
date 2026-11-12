// The viewer's way to the files it shows: everything it reads of them goes through an access
// bound to one machine, the machine of its space (machine.js). On this Mac an access does what
// the viewer did before it existed, Herdr's calls without `on`; on another machine it passes
// `on`. The commands it runs and the reading of their answers are in machine.js.
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
// runHc(args, { timeout })    Promise<{ code, stdout, stderr }>: `hc <args>` on this Mac, the one
//                             on PATH or else ~/.local/bin/hc (machine.js FIND_HC). Rejects as
//                             exec does; an hc found nowhere exits nonzero.
//
// Other tickets' functions join the access; these keep their names, arguments and results.
import { exec, readTextFile, home } from "herdr";
import { EXISTS, existingOf, HOME_FOLDER, homeOf, hcCommand } from "./machine.js";
import { changeMark } from "./remote-results.js";

const accesses = new Map();

export function accessOf(machine) {
  const key = machine ?? null;
  if (!accesses.has(key)) accesses.set(key, key === null ? localAccess() : remoteAccess(key));
  return accesses.get(key);
}

export function runHc(args, options) {
  const [command, argv] = hcCommand(args);
  return exec(command, argv, options);
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
  };
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
  };
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
