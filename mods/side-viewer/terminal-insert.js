// Putting a shell code block into a terminal's input line, without Enter and without the
// clipboard (the `>_` button on a code card). The decisions only: shell-pane.js asks Herdr.
//
// `hc keys` cannot type symbols or Korean, and `hc send` presses Enter after its paste and
// adds it after whatever the person had typed there. So each command is written to the
// shell's handoff file. A zsh not yet prepared gets a line (prepareLine) that defines a zsh
// widget on a key nobody uses and puts this first command in itself; later presses only
// press that key. No line is left to run, nothing stays on screen, and a draft is pushed
// aside in any keymap.
import { wordsOf } from "./i18n.js";

// The folder that holds the handoff files, under the app's folder `app` (appHome()).
export const insertFolderOf = (app) => `${app}/data/side-viewer/shell`;

// The handoff file of terminal `terminal`. One per terminal, so two viewers' shells never share
// one; a remote address's "/" would make a subfolder.
export const insertFileOf = (app, terminal) =>
  `${insertFolderOf(app)}/${terminal.replace(/[^A-Za-z0-9_-]/g, "_")}.txt`;

// The key the widget is bound to: one `hc keys` can press (it names keys up to F12) that zsh
// and terminal programs leave unbound. It reaches zsh as "\e[24;7~".
export const INSERT_KEY = "ctrl+alt+f12";
const WIDGET = "_side_viewer_insert";

// The line that teaches a zsh to take a command from `file`: a widget on INSERT_KEY that puts a
// draft aside with push-line (zsh brings it back at the next prompt), puts the file's text in
// the input line with the cursor at its end, and removes the file so a stray press puts nothing
// in. It is bound in the vi keymaps too, so a draft there is never run.
// The line then puts this press's text in itself with `print -z`, which zle shows at the next
// prompt: a key sent right after the line could reach the shell before zle reads again and be
// echoed as "^[[24;7~". A draft pushed aside before the line sits under it on the buffer stack,
// so it comes back after the command. `clear` wipes the line from the screen; the leading
// space keeps it out of the history where histignorespace is on.
export function prepareLine(file) {
  const bind = (keymap) => `bindkey -M ${keymap} '\\e[24;7~' ${WIDGET};`;
  const path = quoted(file);
  return ` ${WIDGET}() { local f=${path}; [[ -r "$f" ]] || return 0; [[ -n $BUFFER ]] && zle push-line;` +
    ` BUFFER="$(<"$f")"; command rm -f -- "$f"; CURSOR=$#BUFFER }; zle -N ${WIDGET};` +
    ` ${bind("emacs")} ${bind("viins")} ${bind("vicmd")}` +
    ` [[ -r ${path} ]] && print -rz -- "$(<${path})"; command rm -f -- ${path}; clear`;
}

// What goes into the handoff file for `command`: the block as written, without its last newline.
export const insertText = (command) => command.replace(/\n+$/, "");

// How long the handoff file may stay after the commands before the press counts as not taken.
// A prepared zsh at its prompt runs the widget within milliseconds of `hc keys` returning; the
// rest is room for a slow machine. A prepare line runs after whatever the shell is still doing,
// a new login shell's rc files included, so it gets longer.
export const KEY_WAIT_MS = 500;
export const PREPARE_WAIT_MS = 3000;

// The zsh `state` (a ready shellState) as remembered once prepared. `exec zsh` keeps the pid,
// so its arguments tell it apart too, unless it was started with the same ones.
export const shellOf = (state) => ({ pid: state.pid, argv: state.argv });
const sameShell = (prepared, state) =>
  prepared != null && prepared.pid === state.pid && JSON.stringify(prepared.argv) === JSON.stringify(state.argv);

// Whether hc address `address` is on another machine ("mini/t7").
export const isRemote = (address) => address.includes("/");

// What to do to put the handoff file's text into terminal `terminal`, as
// { commands: hc argument lists in order, notice: what to tell instead, or null,
//   wait: how long the handoff file may stay before the press counts as not taken (ms) }.
//   state: shellState() of the terminal now; prepared: shellOf() the zsh last prepared there,
//   or null; fresh: the shell was just opened by this viewer, so it has no draft;
//   stale: an earlier press's handoff file was still there, so that zsh did not take it.
// A zsh other than the one prepared, or one that left the file, lacks the widget, so it is
// prepared again. Its draft is pushed aside with alt+q first, or `hc send` would run it
// together with the prepare line; in a vi keymap alt+q is not push-line, so that one case can
// still run a draft. A fresh shell gets no alt+q: sent before zsh reads its keys it would only
// show up on screen as "^[q". Another machine's shell would never find the handoff file.
// tr: the translator the notice is worded with (i18n.js).
export function insertPlan({ terminal, file, state, prepared, fresh, stale, tr }) {
  if (isRemote(terminal)) return { commands: [], notice: noticeOf({ state: "remote" }, tr), wait: 0 };
  if (state.state === "busy") return { commands: [], notice: noticeOf(state, tr), wait: 0 };
  if (!stale && sameShell(prepared, state)) {
    return { commands: [["keys", terminal, INSERT_KEY]], notice: null, wait: KEY_WAIT_MS };
  }
  const prepare = ["send", terminal, prepareLine(file)];
  return { commands: fresh ? [prepare] : [["keys", terminal, "alt+q"], prepare], notice: null, wait: PREPARE_WAIT_MS };
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
// is a terminal hc has no foreground for yet.
//   { state: "ready", pid, argv } | { state: "busy", program } | { state: "starting" } | { state: "gone" }
export function shellState(info) {
  if (info?.state !== "live") return { state: "gone" };
  const foreground = info.foreground;
  if (!foreground || foreground.argv?.[1] === "-c") return { state: "starting" };
  const program = String(foreground.name ?? "").split("/").pop();
  return /^-?zsh$/.test(program) ? { state: "ready", pid: foreground.pid, argv: foreground.argv } : { state: "busy", program };
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
// shell where Herdr started it. Always zsh: the line goes in through a zle widget.
export function splitOf(viewer, folder) {
  return {
    direction: "down",
    pane: viewer,
    argv: [ZSH, "-c", `cd -- "$1" 2>/dev/null; exec ${ZSH} -l`, "zsh", folder],
  };
}

// The folder a new shell pane starts in. In a viewer tab, the shown document's folder. Beside
// a conversation, that conversation terminal's live folder: the viewer was split off it, so it
// is a terminal pane in the viewer's own tab, an agent's before a plain shell's, and never the
// shell this viewer opened. Home when there is none.
//   viewer: the viewer's pane id or null; panes: herdr panes(); shell: { pane, terminal } or null
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

// The notification (herdr notify) for a line that was not put in, in tr's language (i18n.js).
//   reason: { state: "busy", program } | { state: "unprepared" } | { state: "unready" }
//     | { state: "remote" } | { state: "failed" }
export function noticeOf(reason, tr) {
  const words = wordsOf(tr);
  if (reason.state === "busy") {
    return { title: words("alerts.notInserted"), body: words("alerts.busy", { program: reason.program }), level: "warning" };
  }
  const title = words("alerts.insertFailed");
  if (reason.state === "unprepared") return { title, body: words("alerts.unprepared"), level: "error" };
  if (reason.state === "unready") return { title, body: words("alerts.unready"), level: "error" };
  if (reason.state === "remote") return { title, body: words("alerts.remote"), level: "error" };
  return { title, body: words("alerts.failed"), level: "error" };
}
