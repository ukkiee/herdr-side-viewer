// node --test: putting a shell code block into a terminal's input line (the `>_` button).
// What the hc commands are, which folder the shell starts in, which pane is reused and when a
// shell is too busy to take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { insertFileOf, insertFolderOf, prepareLine, insertText, insertPlan, pressOutcome, shellOf, isRemote, KEY_WAIT_MS, PREPARE_WAIT_MS, shellState, noticeOf, shellFolder, viewerPaneOf, liveShell, openedShell, splitOf } from "./terminal-insert.js";

// Herdr's panes(): a terminal pane, or a mod pane (terminal null).
const pane = (id, tab, more = {}) => ({
  pane: id, tab, terminal: null, cwd: null, status: null, program: { key: "shell", agent: false, shell: true }, ...more,
});
const agentPane = (id, tab, terminal, cwd) =>
  pane(id, tab, { terminal, cwd, status: "idle", program: { key: "claude", agent: true, shell: false } });
const shellPane = (id, tab, terminal, cwd) => pane(id, tab, { terminal, cwd });
const viewerPane = (id, tab) => pane(id, tab, { mod: "side-viewer", program: { key: "mod", agent: false, shell: false } });
const HOME = "/Users/me";

// `hc get <t> --json` of a live terminal whose foreground process is `name`.
const terminal = (name, argv = [`/bin/${name}`]) =>
  ({ address: "t7", state: "live", argv: ["/bin/zsh", "-l"], status: null, foreground: { name, argv, pid: 2 } });

const APP = "/Users/me/.config/herdr-app";
const FILE = `${APP}/data/side-viewer/shell/t7.txt`;

test("each shell has its own handoff file in the app's data folder", () => {
  assert.equal(insertFileOf(APP, "t7"), FILE);
  assert.equal(insertFileOf(APP, "mini/t12"), `${APP}/data/side-viewer/shell/mini_t12.txt`);
  assert.equal(insertFolderOf(APP), `${APP}/data/side-viewer/shell`);
});

// The prepare line for the handoff file `file` as zsh quotes it: the widget, its key in every
// keymap, the file's text put on the buffer stack for the next prompt, then clear.
const widget = (file) =>
  ` _side_viewer_insert() { local f=${file}; [[ -r "$f" ]] || return 0; [[ -n $BUFFER ]] && zle push-line;` +
  ' BUFFER="$(<"$f")"; command rm -f -- "$f"; CURSOR=$#BUFFER };' +
  " zle -N _side_viewer_insert;" +
  " bindkey -M emacs '\\e[24;7~' _side_viewer_insert; bindkey -M viins '\\e[24;7~' _side_viewer_insert;" +
  " bindkey -M vicmd '\\e[24;7~' _side_viewer_insert;" +
  ` [[ -r ${file} ]] && print -rz -- "$(<${file})"; command rm -f -- ${file}; clear`;

test("the prepare line binds ctrl+alt+F12 in every keymap and puts the handoff file's text in itself, then clears", () => {
  assert.equal(prepareLine(FILE), widget(`'${FILE}'`));
});

test("a handoff file path with a quote stays one word for zsh", () => {
  assert.equal(prepareLine("/Users/it's me/t7.txt"), widget("'/Users/it'\\''s me/t7.txt'"));
});

test("a shell still starting is neither ready nor busy", () => {
  const live = terminal("zsh");
  assert.deepEqual(shellState({ ...live, foreground: undefined }), { state: "starting" });
  assert.deepEqual(shellState(terminal("zsh", ["/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec /bin/zsh -l", "zsh", "/w"])),
    { state: "starting" });
});

test("single quotes, Korean, symbols and backslashes go into the handoff file as they are", () => {
  const command = "echo 'q' \"a b\" | wc -c > /dev/null; ls $HOME ~ 한글 & `pwd` a\\nb";
  assert.equal(insertText(command), command);
});

// A zsh waiting at its prompt, as splitOf starts it.
const ready = (pid) => ({ state: "ready", pid, argv: ["/bin/zsh", "-l"] });
const KEY = ["keys", "t7", "ctrl+alt+f12"];

test("a shell just opened is prepared, and the prepare line itself puts the command in; no key, no Enter", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(40), prepared: null, fresh: true, stale: false }), {
    commands: [["send", "t7", prepareLine(FILE)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("a shell already prepared only gets the key", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(40), prepared: shellOf(ready(40)), fresh: false, stale: false }), {
    commands: [KEY],
    notice: null,
    wait: KEY_WAIT_MS,
  });
});

test("a shell that is now another zsh is prepared again, its draft pushed aside first", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(41), prepared: shellOf(ready(40)), fresh: false, stale: false }), {
    commands: [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("after exec zsh, which keeps the pid, a zsh started with other arguments is prepared again", () => {
  const exec = { state: "ready", pid: 40, argv: ["zsh"] };
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: exec, prepared: shellOf(ready(40)), fresh: false, stale: false }).commands,
    [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE)]]);
});

test("a handoff file the last press left behind means the zsh lacks the widget, so it is prepared again", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(40), prepared: shellOf(ready(40)), fresh: false, stale: true }).commands,
    [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE)]]);
});

test("a shell on another machine gets nothing: the handoff file is on this one", () => {
  assert.deepEqual(insertPlan({ terminal: "mini/t7", file: FILE, state: ready(40), prepared: null, fresh: true, stale: false }), {
    commands: [],
    notice: noticeOf({ state: "remote" }),
    wait: 0,
  });
  assert.equal(isRemote("mini/t7"), true);
  assert.equal(isRemote("t7"), false);
});

test("a press whose handoff file was taken keeps the zsh as prepared", () => {
  assert.deepEqual(pressOutcome({ left: false, state: ready(40) }), { prepared: shellOf(ready(40)), notice: null });
});

test("a press whose handoff file is still there forgets the zsh and says the command did not go in", () => {
  assert.deepEqual(pressOutcome({ left: true, state: ready(40) }), { prepared: null, notice: noticeOf({ state: "unprepared" }) });
});

test("the notices for a shell that did not take the command and for another machine's shell", () => {
  assert.deepEqual(noticeOf({ state: "unprepared" }), {
    title: "터미널에 넣지 못했습니다",
    body: "셸이 명령을 받지 않았습니다(exec zsh 등으로 다시 시작됨). 입력 칸에 ;7~가 남았다면 지우고 다시 누르세요.",
    level: "error",
  });
  assert.deepEqual(noticeOf({ state: "remote" }), {
    title: "터미널에 넣지 못했습니다",
    body: "다른 기계의 셸에는 넣을 수 없습니다. 복사 버튼으로 붙여 넣으세요.",
    level: "error",
  });
});

test("a busy shell gets nothing, only a notice", () => {
  const busy = { state: "busy", program: "sleep" };
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: busy, prepared: shellOf(ready(40)), fresh: false, stale: false }), {
    commands: [],
    notice: noticeOf(busy),
    wait: 0,
  });
});

test("a shell waiting at its prompt is ready; zsh is told by its foreground process, whose pid names it", () => {
  assert.deepEqual(shellState(terminal("zsh", ["/bin/zsh", "-l"])), { state: "ready", pid: 2, argv: ["/bin/zsh", "-l"] });
  assert.deepEqual(shellState(terminal("-zsh", ["-zsh"])), { state: "ready", pid: 2, argv: ["-zsh"] });
});

test("a shell running another program is busy, and the program is named", () => {
  assert.deepEqual(shellState(terminal("sleep", ["sleep", "20"])), { state: "busy", program: "sleep" });
  assert.deepEqual(shellState(terminal("vim")), { state: "busy", program: "vim" });
});

test("a shell that is not zsh is not used: the insert widget is zsh's", () => {
  assert.deepEqual(shellState(terminal("bash")), { state: "busy", program: "bash" });
  assert.deepEqual(shellState(terminal("fish")), { state: "busy", program: "fish" });
});

test("a terminal that has ended, or could not be asked about, is gone", () => {
  assert.deepEqual(shellState(null), { state: "gone" });
  assert.deepEqual(shellState({ ...terminal("zsh"), state: "exited", foreground: null }), { state: "gone" });
});

test("a busy shell's notice says what runs there and what to do", () => {
  assert.deepEqual(noticeOf({ state: "busy", program: "sleep" }), {
    title: "터미널에 넣지 않았습니다",
    body: "셸에서 다른 프로그램(sleep)이 실행 중입니다. 끝난 뒤 다시 누르세요.",
    level: "warning",
  });
});

test("beside a conversation the shell starts in the conversation terminal's folder", () => {
  const panes = [
    agentPane("p1", "tab1", "t1", "/work/elsewhere"),
    agentPane("p2", "tab2", "t2", "/work/api"),
    viewerPane("p3", "tab2"),
  ];
  assert.equal(shellFolder({ viewerTab: false, file: "/notes/a.md", viewer: "p3", panes, shell: null, home: HOME }), "/work/api");
});

test("the conversation is the agent's terminal, not a plain shell or the viewer's own shell", () => {
  const panes = [
    shellPane("p1", "tab1", "t1", "/work/logs"),
    agentPane("p2", "tab1", "t2", "/work/api"),
    viewerPane("p3", "tab1"),
    shellPane("p4", "tab1", "t4", "/work/api/sub"),
  ];
  const shell = { pane: "p4", terminal: "t4" };
  assert.equal(shellFolder({ viewerTab: false, file: "/notes/a.md", viewer: "p3", panes, shell, home: HOME }), "/work/api");
  // Without an agent, the first terminal that is not the viewer's shell.
  const plain = [panes[0], panes[2], panes[3]];
  assert.equal(shellFolder({ viewerTab: false, file: "/notes/a.md", viewer: "p3", panes: plain, shell, home: HOME }), "/work/logs");
});

test("in a viewer tab the shell starts in the document's folder", () => {
  const panes = [agentPane("p1", "tab1", "t1", "/work/api"), viewerPane("p2", "tab2")];
  assert.equal(shellFolder({ viewerTab: true, file: "/notes/plans/a.md", viewer: "p2", panes, shell: null, home: HOME }), "/notes/plans");
  assert.equal(shellFolder({ viewerTab: true, file: "/a.md", viewer: "p2", panes, shell: null, home: HOME }), "/");
});

test("with no conversation terminal or no document the shell starts at home", () => {
  const panes = [agentPane("p1", "tab1", "t1", "/work/api"), viewerPane("p2", "tab2")];
  assert.equal(shellFolder({ viewerTab: false, file: "/notes/a.md", viewer: "p2", panes, shell: null, home: HOME }), HOME);
  assert.equal(shellFolder({ viewerTab: true, file: null, viewer: "p2", panes, shell: null, home: HOME }), HOME);
  assert.equal(shellFolder({ viewerTab: false, file: "/notes/a.md", viewer: null, panes, shell: null, home: HOME }), HOME);
});

test("the viewer's pane: its props first, then the focused viewer, then the tab's only viewer", () => {
  const panes = [agentPane("p1", "tab1", "t1", "/w"), viewerPane("p2", "tab1"), viewerPane("p3", "tab2"), viewerPane("p4", "tab2")];
  const focusOn = (pane, tab) => ({ space: "s1", tab, pane, terminal: null });
  assert.equal(viewerPaneOf({ props: { pane: "p3" }, focused: focusOn("p2", "tab1"), panes }), "p3");
  assert.equal(viewerPaneOf({ props: { file: "/a.md" }, focused: focusOn("p4", "tab2"), panes }), "p4");
  assert.equal(viewerPaneOf({ props: {}, focused: focusOn("p1", "tab1"), panes }), "p2");
  // Two viewers in the focused tab and neither holds the keyboard: no way to tell.
  assert.equal(viewerPaneOf({ props: {}, focused: focusOn(null, "tab2"), panes }), null);
  assert.equal(viewerPaneOf({ props: null, focused: null, panes }), null);
});

test("the shell pane a viewer opened is used again while it shows the same terminal", () => {
  const shell = { pane: "p4", terminal: "t4" };
  assert.deepEqual(liveShell(shell, [viewerPane("p3", "tab1"), shellPane("p4", "tab1", "t4", "/w")]), shell);
  assert.equal(liveShell(shell, [viewerPane("p3", "tab1")]), null);
  assert.equal(liveShell(shell, [shellPane("p4", "tab1", "t9", "/w")]), null);
  assert.equal(liveShell(null, [shellPane("p4", "tab1", "t4", "/w")]), null);
});

test("the shell pane a split opened is the new terminal pane in the viewer's tab", () => {
  const before = [agentPane("p1", "tab1", "t1", "/w"), viewerPane("p2", "tab1"), shellPane("p5", "tab2", "t5", "/x")];
  assert.equal(openedShell(before, before, "p2"), null);
  const after = [...before, shellPane("p6", "tab2", "t6", "/x"), shellPane("p7", "tab1", "t7", "/w")];
  assert.deepEqual(openedShell(before, after, "p2"), { pane: "p7", terminal: "t7" });
});

test("a new shell is zsh, split below the viewer and started in the folder", () => {
  assert.deepEqual(splitOf("p2", "/work/it's here"), {
    direction: "down",
    pane: "p2",
    argv: ["/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec /bin/zsh -l", "zsh", "/work/it's here"],
  });
});

test("a block of several lines stays several lines, without its last newline", () => {
  assert.equal(insertText("for f in *; do\n  echo \"$f\"\ndone\n"), "for f in *; do\n  echo \"$f\"\ndone");
});
