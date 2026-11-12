// Putting a shell code block into a terminal's input line, without Enter and without the
// clipboard (the `>_` button on a code card). The decisions only: shell-pane.js asks Herdr.
//
// `hc keys` cannot type symbols or Korean, and `hc send` presses Enter after its paste and
// adds it after whatever the person had typed there. So a shell is prepared once with a line
// that defines a zsh widget on a key nobody uses (prepareLine), and each command is written
// to that shell's handoff file and put in by pressing that key: no line runs, nothing stays
// on screen, and a draft is pushed aside in any keymap.

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
// in. It is bound in the vi keymaps too, so a draft there is never run. `clear` then wipes the
// line from the screen; the leading space keeps it out of the history where histignorespace is on.
export function prepareLine(file) {
  const bind = (keymap) => `bindkey -M ${keymap} '\\e[24;7~' ${WIDGET};`;
  return ` ${WIDGET}() { local f=${quoted(file)}; [[ -r $f ]] || return 0; [[ -n $BUFFER ]] && zle push-line;` +
    ` BUFFER=$(<$f); command rm -f -- $f; CURSOR=$#BUFFER }; zle -N ${WIDGET};` +
    ` ${bind("emacs")} ${bind("viins")} ${bind("vicmd")} clear`;
}

// What goes into the handoff file for `command`: the block as written, without its last newline.
export const insertText = (command) => command.replace(/\n+$/, "");

// What to do to put the handoff file's text into terminal `terminal`, as
// { commands: hc argument lists in order, notice: what to tell instead, or null }.
//   state: shellState() of the terminal now; prepared: the pid of the zsh last prepared there,
//   or null; fresh: the shell was just opened by this viewer, so it has no draft.
// A zsh with another pid than the one prepared (exec zsh, a zsh started inside) lacks the
// widget, so it is prepared again. Its draft is pushed aside with alt+q first, or `hc send`
// would run it together with the prepare line; in a vi keymap alt+q is not push-line, so that
// one case can still run a draft. A fresh shell gets no alt+q: sent before zsh reads its keys
// it would only show up on screen as "^[q".
export function insertPlan({ terminal, file, state, prepared, fresh }) {
  if (state.state === "busy") return { commands: [], notice: noticeOf(state) };
  const key = ["keys", terminal, INSERT_KEY];
  if (prepared === state.pid) return { commands: [key], notice: null };
  const prepare = ["send", terminal, prepareLine(file)];
  return { commands: fresh ? [prepare, key] : [["keys", terminal, "alt+q"], prepare, key], notice: null };
}

// Inside single quotes zsh takes everything as it is except the quote itself.
const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`;

// Whether the terminal `info` (`hc get <t> --json`, null when that failed) can take a line now.
// zsh reports no hc status, so the foreground process tells: the shell itself while it waits
// at its prompt, anything else while a program runs. Another shell counts as busy too, since
// only zsh has zle widgets. A ready shell's pid tells one zsh from another in the same terminal.
// A shell from splitOf is "starting" until its short zsh has become the login shell, and so
// is a terminal hc has no foreground for yet.
//   { state: "ready", pid } | { state: "busy", program } | { state: "starting" } | { state: "gone" }
export function shellState(info) {
  if (info?.state !== "live") return { state: "gone" };
  const foreground = info.foreground;
  if (!foreground || foreground.argv?.[1] === "-c") return { state: "starting" };
  const program = String(foreground.name ?? "").split("/").pop();
  return /^-?zsh$/.test(program) ? { state: "ready", pid: foreground.pid } : { state: "busy", program };
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
// shell where Herdr started it. Always zsh: the line goes in with zsh's print -z.
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

// The notification (herdr notify) for a line that was not put in.
//   reason: { state: "busy", program } | { state: "failed" }
export function noticeOf(reason) {
  if (reason.state === "busy") {
    return {
      title: "터미널에 넣지 않았습니다",
      body: `셸에서 다른 프로그램(${reason.program})이 실행 중입니다. 끝난 뒤 다시 누르세요.`,
      level: "warning",
    };
  }
  return { title: "터미널에 넣지 못했습니다", body: "셸 pane을 열거나 찾지 못했습니다.", level: "error" };
}
