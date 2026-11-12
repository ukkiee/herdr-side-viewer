// What the viewer makes of a remote machine's answers and refusals. No Herdr imports, so it
// runs under `node --test`; main.js and file-access.js run the commands.
//
// The shapes other parts rely on (later tickets add kinds, never change these):
//   changeMark({ code, stdout, stderr }) -> string
//     `cksum <path>`'s answer as a mark that changes when the file does:
//     "<sum> <size>" for a file, "missing" (not there, or a link to nothing),
//     "unreadable" (no permission, a folder, any other refusal).
//   failureOf(error) -> "unreachable" | "windows" | "missing" | "other"
//     A rejection of exec or readTextFile (an Error or its message), or an `hc` JSON error
//     ({ error: { kind, message } } or its `error`):
//     "unreachable": the machine cannot be reached;
//     "windows":     the machine has no `sh`, which is how a Windows machine answers;
//     "missing":     hc's `not_found`;
//     "other":       anything else.
//   unavailable(machines, name) -> boolean
//     Whether Herdr's machines() lists the machine `name` with its layout "unavailable",
//     which is a machine that cannot be reached as well.

// `cksum` prints "<sum> <size> <path>". The path is left out: a file opened through a link
// gives the same sum under another path.
export function changeMark(answer) {
  if (answer?.code === 0) {
    const fields = /^(\d+) (\d+)/.exec(String(answer.stdout ?? ""));
    if (fields) return `${fields[1]} ${fields[2]}`;
  }
  if (/No such file or directory/.test(String(answer?.stderr ?? ""))) return "missing";
  return "unreadable";
}

// Herdr's words for a machine it cannot reach (herdr.d.ts, exec), and the ones Herdr's Files
// mod takes for a Windows host, where `sh` cannot start.
const UNREACHABLE = /\bunreachable\b/;
const NO_SH = "cannot start sh: program not found";

export function failureOf(error) {
  const json = error?.error && typeof error.error === "object" ? error.error : error;
  if (json?.kind === "not_found") return "missing";
  const message = String(json?.message ?? error ?? "");
  if (UNREACHABLE.test(message)) return "unreachable";
  if (message.includes(NO_SH)) return "windows";
  return "other";
}

export function unavailable(machines, name) {
  return (machines ?? []).some((machine) => machine.name === name && machine.layout === "unavailable");
}
