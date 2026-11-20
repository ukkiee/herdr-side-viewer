// Putting a shell code block into a terminal's input line, without Enter and without the
// clipboard (the `>_` button on a code card). The decisions only: shell-pane.js asks Herdr.
//
// `hc keys` cannot type symbols or Korean, and `hc send` presses Enter after its paste and
// adds it after whatever the person had typed there. So each command is written to the
// shell's handoff file. A zsh not yet prepared gets a line (prepareLine) that defines a zsh
// widget on a key nobody uses and puts this first command in itself; later presses only
// press that key. No line is left to run, nothing stays on screen, and a draft is pushed
// aside in any keymap. A prepare line also leaves the zsh's keymap in a file beside the
// handoff file, so preparing a new zsh in that terminal later clears a draft without running
// it (insertPlan).
import { wordsOf } from "./i18n.js";
import { saveFailureOf, unavailable } from "./remote-results.js";

// The folder that holds the handoff files, under the app's folder `app` (appHome()).
export const insertFolderOf = (app) => `${app}/data/side-viewer/shell`;

// The handoff file of terminal `terminal`. One per terminal, so two viewers' shells never share
// one; a remote address's "/" would make a subfolder.
export const insertFileOf = (app, terminal) =>
  `${insertFolderOf(app)}/${safeName(terminal)}.txt`;
const safeName = (terminal) => terminal.replace(/[^A-Za-z0-9_-]/g, "_");

// The handoff folder, file and keymap file, { folder, file, keymap }, for the shell at hc
// address `terminal`. A zsh reads and writes them on its own machine: here the app's data
// folder (`app`, appHome()), on another machine `.cache/side-viewer/shell` in its home (`home`,
// that machine's home folder). The keymap file is where a prepare line leaves the zsh's keymap.
export function handoffOf({ terminal, app, home }) {
  const folder = isRemote(terminal) ? `${home}/.cache/side-viewer/shell` : insertFolderOf(app);
  const name = `${folder}/${safeName(terminal)}`;
  return { folder, file: `${name}.txt`, keymap: `${name}.keymap` };
}

// Run on the other machine as `sh -c HANDOFF_THERE sh <folder> <file> <text>`: the handoff file
// written in one command, it and its folder readable by the owner alone, since the file holds
// what the person is about to run. writeTextFile has no `on`, so the text goes as an argument; a
// code block stays under Linux's 128 KiB limit for one. An earlier file is written over, made
// the owner's only before the text goes in (umask covers only a new one).
export const HANDOFF_THERE = 'umask 077; mkdir -p "$1" && chmod 700 "$1" && { [ ! -e "$2" ] || chmod 600 "$2"; } && printf %s "$3" > "$2"';

// The key the widget is bound to: one `hc keys` can press (it names keys up to F12) that zsh
// and terminal programs leave unbound. It reaches zsh as "\e[24;7~".
export const INSERT_KEY = "ctrl+alt+f12";
const WIDGET = "_side_viewer_insert";

// The line that teaches a zsh to take a command from `file`: a widget on INSERT_KEY that puts a
// draft aside with push-line (zsh brings it back at the next prompt), puts the file's text in
// the input line with the cursor at its end, and removes the file so a stray press puts nothing
// in. It is bound in the vi keymaps too, so a draft there is never run.
// It writes the zsh's main keymap (`bindkey -lL main`) over `keymap`, the keymap file, even
// under noclobber, so the viewer knows how to clear a draft the next time it prepares a zsh
// there (keymapOf). It does that before it removes the handoff file, since the viewer reads
// the keymap file once the handoff file is gone.
// The line then puts this press's text in itself with `print -z`, which zle shows at the next
// prompt: a key sent right after the line could reach the shell before zle reads again and be
// echoed as "^[[24;7~". A draft pushed aside before the line sits under it on the buffer stack,
// so it comes back after the command. `clear` wipes the line from the screen; the leading
// space keeps it out of the history where histignorespace is on.
export function prepareLine(file, keymap) {
  const bind = (name) => `bindkey -M ${name} '\\e[24;7~' ${WIDGET};`;
  const path = quoted(file);
  return ` ${WIDGET}() { local f=${path}; [[ -r "$f" ]] || return 0; [[ -n $BUFFER ]] && zle push-line;` +
    ` BUFFER="$(<"$f")"; command rm -f -- "$f"; CURSOR=$#BUFFER }; zle -N ${WIDGET};` +
    ` ${bind("emacs")} ${bind("viins")} ${bind("vicmd")}` +
    ` bindkey -lL main >| ${quoted(keymap)} 2>/dev/null;` +
    ` [[ -r ${path} ]] && print -rz -- "$(<${path})"; command rm -f -- ${path}; clear`;
}

// The keymap a prepare line left in the keymap file, from its text `text` (null: no file):
// "emacs", "vi" (insert or command mode), or null when it can't be told. `bindkey -lL main`
// prints the keymap main is linked to as `bindkey -A <name> main`.
export function keymapOf(text) {
  const name = /^bindkey -A (\S+) main$/m.exec(String(text ?? ""))?.[1];
  if (name === "emacs") return "emacs";
  return name === "viins" || name === "vicmd" ? "vi" : null;
}

// What goes into the handoff file for `command`: the block as written, without its last newline.
export const insertText = (command) => command.replace(/\n+$/, "");

// How long the handoff file may stay after the commands before the press counts as not taken.
// A prepared zsh at its prompt runs the widget within milliseconds of `hc keys` returning; the
// rest is room for a slow machine. A prepare line runs after whatever the shell is still doing,
// a new login shell's rc files included, so it gets longer.
export const KEY_WAIT_MS = 500;
export const PREPARE_WAIT_MS = 3000;

// The waits for a shell on machine `machine` (null: this Mac), in ms: after the key, after the
// prepare line, and between two looks at the handoff file. Another machine's key and file
// reads each cross the network (a read there took 27 to 151 ms), so it gets three times the
// key's wait and looks half as often.
export function waitsOf(machine) {
  if (machine == null) return { key: KEY_WAIT_MS, prepare: PREPARE_WAIT_MS, step: 50 };
  return { key: 1500, prepare: 5000, step: 100 };
}

// The zsh `state` (a ready shellState) as remembered once prepared. `exec zsh` keeps the pid,
// so its arguments tell it apart too, unless it was started with the same ones.
export const shellOf = (state) => ({ pid: state.pid, argv: state.argv });
const sameShell = (prepared, state) =>
  prepared != null && prepared.pid === state.pid && JSON.stringify(prepared.argv) === JSON.stringify(state.argv);

// Whether hc address `address` is on another machine ("mini/t7").
export const isRemote = (address) => address.includes("/");

// The machine of hc address `address` (a terminal's or a pane's): its "<machine>/" prefix, or
// null for this Mac. A shell split off a viewer opens on the viewer's machine, so the viewer's
// pane address tells where a new shell will be, whatever space value its props hold.
export const machineOfAddress = (address) => (isRemote(address) ? address.slice(0, address.lastIndexOf("/")) : null);

// What to do to put the handoff file's text into terminal `terminal`, as
// { commands: hc argument lists in order, notice: what to tell instead, or null,
//   wait: how long the handoff file may stay before the press counts as not taken (ms) }.
//   file, keymapFile: the shell's handoff and keymap files (handoffOf);
//   state: shellState() of the terminal now; prepared: shellOf() the zsh last prepared there,
//   or null; keymap: what the last prepare line there left (keymapOf), or null;
//   fresh: the shell was just opened by this viewer, so it has no draft;
//   stale: an earlier press's handoff file was still there, so that zsh did not take it.
// A zsh other than the one prepared, or one that left the file, lacks the widget, so it is
// prepared again, and a draft there must not reach `hc send`, which would run it together with
// the prepare line. In emacs alt+q pushes it aside, and zsh brings it back after the command.
// In vi alt+q is Esc then q, which can run it, so a vi zsh, or one whose keymap is not known,
// gets ctrl+c: the draft is dropped, never run. No wait is needed before the line, as `hc send`
// waits for the output to settle first. A fresh shell gets neither: sent before zsh reads its
// keys, alt+q would only show up on screen as "^[q". A shell on another machine (its address's
// prefix) is treated the same, with that machine's waits (waitsOf); the files are then there.
// tr: the translator the notice is worded with (i18n.js).
export function insertPlan({ terminal, file, keymapFile, state, prepared, keymap, fresh, stale, tr }) {
  if (state.state === "busy") return { commands: [], notice: noticeOf(state, tr), wait: 0 };
  const waits = waitsOf(machineOfAddress(terminal));
  if (!stale && sameShell(prepared, state)) {
    return { commands: [["keys", terminal, INSERT_KEY]], notice: null, wait: waits.key };
  }
  const prepare = ["send", terminal, prepareLine(file, keymapFile)];
  if (fresh) return { commands: [prepare], notice: null, wait: waits.prepare };
  const clear = keymap === "emacs" ? "alt+q" : "ctrl+c";
  return { commands: [["keys", terminal, clear], prepare], notice: null, wait: waits.prepare };
}

// After a press, whether the zsh took it: `left` says the handoff file was still there once
// the plan's wait was over. Then that zsh is forgotten and the next press prepares it.
// After the key (`keyed`) the zsh lacks the widget (exec zsh with the same arguments), and the
// unbound key has put ";7~" in its input line, which the notice mentions. After a prepare line
// no key went out: the shell had not run the line yet (slow rc files), so the notice says only
// that. The late line finds no file and puts nothing in.
//   state: the ready shellState the press went to; tr: the notice's translator (i18n.js).
export function pressOutcome({ left, state, keyed, tr }) {
  if (!left) return { prepared: shellOf(state), notice: null };
  return { prepared: null, notice: noticeOf({ state: keyed ? "unprepared" : "unready" }, tr) };
}

// Inside single quotes zsh takes everything as it is except the quote itself.
const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`;

// Whether the terminal `info` (`hc get <t> --json`, null when that failed) can take a line now.
// zsh reports no hc status, so the foreground process tells: the shell itself while it waits
// at its prompt, anything else while a program runs. Another shell counts as busy too, since
// only zsh has zle widgets. A ready shell's pid and arguments tell one zsh from another in the
// same terminal (shellOf).
// A shell from splitOf is "starting" until its short zsh has become the login shell, and so
// is a terminal hc has no foreground for yet. Only splitOf's exact argv counts as that short
// zsh (any folder): any other `-c` run, a zsh one too, is a program the person started, and a
// line sent to it would be read by that program.
//   { state: "ready", pid, argv } | { state: "busy", program } | { state: "starting" } | { state: "gone" }
export function shellState(info) {
  if (info?.state !== "live") return { state: "gone" };
  const foreground = info.foreground;
  if (!foreground || isStartingZsh(foreground.argv)) return { state: "starting" };
  const program = String(foreground.name ?? "").split("/").pop();
  const runsLine = (foreground.argv ?? []).slice(1).includes("-c");
  return /^-?zsh$/.test(program) && !runsLine ? { state: "ready", pid: foreground.pid, argv: foreground.argv } : { state: "busy", program };
}

// splitOf's argv: [zsh, "-c", START_SCRIPT, "zsh", folder, zsh].
const isStartingZsh = (argv) =>
  Array.isArray(argv) && argv.length === 6 && argv[1] === "-c" && argv[2] === START_SCRIPT && argv[3] === "zsh" && argv[5] === argv[0];

// The state of the terminal on machine `machine` (null: this Mac) from `hc get <t> --json`'s
// answer `answer` ({ code, stdout, stderr }): shellState of what it printed, or, when it failed,
// { state: "unreachable", machine } if that was the connection (cutOff), else "gone".
export function stateOfGet({ machine, answer }) {
  if (answer?.code !== 0) return cutOff({ machine, failure: answer }) ? { state: "unreachable", machine } : { state: "gone" };
  let info = null;
  try {
    info = JSON.parse(answer.stdout);
  } catch {}
  return shellState(info);
}

// What one look at the handoff file on machine `machine` says: "taken" when it is gone,
// "left" when it is still there, "unreachable" when the read was refused for the connection.
// Any other refused read counts as taken, as the file can't be told to be there.
//   text: what the read gave (null: no file); failure: the read's rejection, if it was refused
export function handoffLook({ machine, text = null, failure = null }) {
  if (failure != null) return cutOff({ machine, failure }) ? "unreachable" : "taken";
  return text == null ? "taken" : "left";
}

// Looks at the handoff file until it is taken or `wait` ms have passed on the clock `now`
// (Date.now), a look every `step` ms or less: "taken", "left", or "unreachable" (handoffLook).
// The time a look takes counts, so a slow link does not stretch the wait; the last sleep is cut
// so the last look falls at the end of the wait.
//   look(): Promise of one handoffLook; sleep(ms): Promise that resolves after `ms`
export async function handoffTaken({ look, sleep, now, wait, step }) {
  const started = now();
  for (;;) {
    const seen = await look();
    const rest = wait - (now() - started);
    if (seen !== "left" || rest <= 0) return seen;
    await sleep(Math.min(step, rest));
  }
}

const MOD = "side-viewer";
const ZSH = "/bin/zsh";

// This viewer's own pane id, or null. A mod pane is not told its id the way a pane header is
// (props().pane), so: its props if they carry one, else the focused pane when that is a side
// viewer (a click on `>_` leaves the keyboard with it), else the focused tab's only side viewer.
//   props: herdr props(); focused: herdr focused(); panes: herdr panes()
export function viewerPaneOf({ props, focused, panes }) {
  const viewers = panes.filter((p) => p.mod === MOD);
  const given = props?.pane;
  if (typeof given === "string" && viewers.some((p) => p.pane === given)) return given;
  if (focused?.pane && viewers.some((p) => p.pane === focused.pane)) return focused.pane;
  const inTab = viewers.filter((p) => p.tab === focused?.tab);
  return inTab.length === 1 ? inTab[0].pane : null;
}

// The shell pane this viewer opened, { pane, terminal }, if it still shows that terminal.
export function liveShell(shell, panes) {
  if (!shell) return null;
  return panes.some((p) => p.pane === shell.pane && p.terminal === shell.terminal) ? shell : null;
}

// After a split below `viewer`: the terminal pane in its tab that `before` did not have, as
// { pane, terminal }, or null while panes() has not caught up.
export function openedShell(before, panes, viewer) {
  const tab = panes.find((p) => p.pane === viewer)?.tab;
  const known = new Set(before.map((p) => p.pane));
  const found = panes.find((p) => p.tab === tab && p.terminal && !known.has(p.pane));
  return found ? { pane: found.pane, terminal: found.terminal } : null;
}

// The pane.split arguments for a shell below the viewer. pane.split takes no folder, so a
// short zsh moves there first and becomes the login shell; a folder that is gone leaves the
// shell where Herdr started it. Always zsh: the line goes in through a zle widget. `zsh` is
// its path on the viewer's machine: /bin/zsh here, zshOf's answer on another machine. Both the
// folder and the zsh go as arguments, so a space or quote in either stays one word.
export function splitOf(viewer, folder, zsh = ZSH) {
  return {
    direction: "down",
    pane: viewer,
    argv: [zsh, "-c", START_SCRIPT, "zsh", folder, zsh],
  };
}

// The short zsh's line in splitOf. shellState tells that zsh by this exact text, so the two
// must share it.
const START_SCRIPT = 'cd -- "$1" 2>/dev/null; exec "$2" -l';

// Where a zsh may be when the login shell's PATH has none, in the order they are taken.
const ZSH_PATHS = ["/bin/zsh", "/usr/bin/zsh", "/usr/local/bin/zsh", "/opt/homebrew/bin/zsh"];

// Run on another machine as `sh -l -c FIND_ZSH sh`, so PATH is the one its login shell sets
// up: a "login <path>" line with `command -v zsh` when that is a program file (empty when not:
// none, or an alias), then a "path <path>" line for each of ZSH_PATHS that is one. The tags
// keep apart whatever a login profile prints first.
export const FIND_ZSH = 'z=$(command -v zsh 2>/dev/null); { [ -f "$z" ] && [ -x "$z" ]; } || z=; ' +
  "printf 'login %s\\n' \"$z\"; " +
  `for p in ${ZSH_PATHS.join(" ")}; do [ -f "$p" ] && [ -x "$p" ] && printf 'path %s\\n' "$p"; done; exit 0`;

// FIND_ZSH's answer as the zsh to start there: the login shell's, else the first of ZSH_PATHS
// there, else null (no zsh, so no shell pane: the widget is zsh's).
export function zshOf(stdout) {
  const lines = String(stdout ?? "").split("\n");
  const login = lines.filter((line) => line.startsWith("login ")).pop()?.slice("login ".length);
  if (login?.startsWith("/")) return login;
  const found = new Set(lines.filter((line) => line.startsWith("path ")).map((line) => line.slice("path ".length)));
  return ZSH_PATHS.find((p) => found.has(p)) ?? null;
}

// The folder a new shell pane starts in. In a viewer tab, the shown document's folder. Beside
// a conversation, that conversation terminal's live folder: the viewer was split off it, so it
// is a terminal pane in the viewer's own tab, an agent's before a plain shell's, and never the
// shell this viewer opened. Home when there is none.
//   viewer: the viewer's pane id or null; panes: herdr panes(); shell: { pane, terminal } or null;
//   home: the home folder of the viewer's machine, another machine's when the shell opens there
export function shellFolder({ viewerTab, file, viewer, panes, shell, home }) {
  if (viewerTab) {
    if (!file) return home;
    const folder = file.slice(0, file.lastIndexOf("/"));
    return folder || "/";
  }
  const tab = panes.find((p) => p.pane === viewer)?.tab;
  if (!tab) return home;
  const terminals = panes.filter((p) => p.tab === tab && p.terminal && p.cwd && p.pane !== shell?.pane);
  const conversation = terminals.find((p) => p.program?.agent || p.status) ?? terminals[0];
  return conversation?.cwd ?? home;
}

// Whether machine `machine` (null: this Mac, never cut off) can't be reached now: Herdr's
// machines() lists it unavailable, or `failure` says so. `failure` is a rejection of exec or
// readTextFile, or a nonzero answer { code, stdout, stderr } of a command run there or of an
// `hc` command for its terminal; remote-results.js reads both. Any other failure is not the
// connection's.
export function cutOff({ machine, machines = [], failure = null }) {
  if (machine == null) return false;
  if (unavailable(machines, machine)) return true;
  return failure != null && saveFailureOf(failure).reason === "unreachable";
}

// The notification (herdr notify) for a line that was not put in, in tr's language (i18n.js).
//   reason: { state: "busy", program } | { state: "unprepared" } | { state: "unready" }
//     | { state: "noZsh" } | { state: "unreachable", machine } | { state: "failed" }
export function noticeOf(reason, tr) {
  const words = wordsOf(tr);
  if (reason.state === "busy") {
    return { title: words("alerts.notInserted"), body: words("alerts.busy", { program: reason.program }), level: "warning" };
  }
  const title = words("alerts.insertFailed");
  if (reason.state === "unprepared") return { title, body: words("alerts.unprepared"), level: "error" };
  if (reason.state === "unready") return { title, body: words("alerts.unready"), level: "error" };
  if (reason.state === "noZsh") return { title, body: words("alerts.noZsh"), level: "error" };
  if (reason.state === "unreachable") return { title, body: words("alerts.unreachable", { machine: reason.machine }), level: "error" };
  return { title, body: words("alerts.failed"), level: "error" };
}
