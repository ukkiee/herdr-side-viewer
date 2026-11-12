// Putting a shell code block into a terminal's input line, without Enter and without the
// clipboard (the `>_` button on a code card). The decisions only: shell-pane.js asks Herdr.
//
// `hc keys` cannot type symbols or Korean, and `hc send` presses Enter after its paste. So
// what is sent is a zsh line, ` print -rz -- '<command>'`, that runs and leaves the command
// in the next prompt's input line. The leading space keeps that line out of the shell's
// history where `histignorespace` is on. -r keeps backslashes as they are.
//
// `hc send` adds its paste after whatever the person had typed there, so alt+q (zsh's
// push-line in the emacs keymap) first puts that draft aside. zsh brings it back after
// the inserted command has run or been dropped.

// The hc argument lists that put `command` into terminal `terminal`'s input line, in order.
export function insertCommands(terminal, command) {
  const text = command.replace(/\n+$/, "");
  return [
    ["keys", terminal, "alt+q"],
    ["send", terminal, ` print -rz -- ${quoted(text)}`],
  ];
}

// Inside single quotes zsh takes everything as it is except the quote itself.
const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`;

// Whether the terminal `info` (`hc get <t> --json`, null when that failed) can take a line now.
// zsh reports no hc status, so the foreground process tells: the shell itself while it waits
// at its prompt, anything else while a program runs. Another shell counts as busy too, since
// only zsh has print -z.
//   { state: "ready" } | { state: "busy", program } | { state: "gone" }
export function shellState(info) {
  if (info?.state !== "live" || !info.foreground) return { state: "gone" };
  const program = String(info.foreground.name ?? "").split("/").pop();
  return /^-?zsh$/.test(program) ? { state: "ready" } : { state: "busy", program };
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
