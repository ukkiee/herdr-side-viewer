// node --test: putting a shell code block into a terminal's input line (the `>_` button).
// What the hc commands are, which folder the shell starts in, which pane is reused and when a
// shell is too busy to take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { insertFileOf, insertFolderOf, handoffOf, HANDOFF_THERE, FIND_ZSH, zshOf, prepareLine, insertText, insertPlan, pressOutcome, shellOf, isRemote, machineOfAddress, waitsOf, cutOff, KEY_WAIT_MS, PREPARE_WAIT_MS, shellState, noticeOf, shellFolder, viewerPaneOf, liveShell, openedShell, splitOf } from "./terminal-insert.js";
import { translator } from "./i18n.js";
import { en as alertsEn, ko as alertsKo } from "./messages-alerts.js";

// The notices as a Korean system shows them.
const ko = translator("ko");

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

test("a shell here uses the data folder's handoff file; a shell on another machine one in that machine's ~/.cache", () => {
  assert.deepEqual(handoffOf({ terminal: "t7", app: APP, home: HOME }), { folder: `${APP}/data/side-viewer/shell`, file: FILE });
  assert.deepEqual(handoffOf({ terminal: "nuc-pro/t1kb", app: APP, home: "/home/me" }), {
    folder: "/home/me/.cache/side-viewer/shell",
    file: "/home/me/.cache/side-viewer/shell/nuc-pro_t1kb.txt",
  });
});

// HANDOFF_THERE as the other machine's sh runs it, here in a scratch folder.
function handOff(folder, file, text) {
  return execFileSync("sh", ["-c", HANDOFF_THERE, "sh", folder, file, text], { encoding: "utf8" });
}

test("the command that writes the handoff file there makes the folder the owner's only and writes the text as it is", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-"));
  try {
    const folder = path.join(scratch, ".cache/side-viewer/shell");
    const file = path.join(folder, "nuc-pro_t1kb.txt");
    const text = "echo 'q' \"a b\" | wc -c; printf '%s\\n' 한글 $HOME `pwd` a\\nb\n  -n second line";
    handOff(folder, file, text);
    assert.equal(fs.readFileSync(file, "utf8"), text);
    assert.equal(fs.statSync(folder).mode & 0o777, 0o700);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    // An earlier press's file, and a folder someone opened up, are written over.
    fs.chmodSync(folder, 0o755);
    handOff(folder, file, "-n");
    assert.equal(fs.readFileSync(file, "utf8"), "-n");
    assert.equal(fs.statSync(folder).mode & 0o777, 0o700);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("a handoff file already there that others could read is the owner's only once written over", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-"));
  try {
    const folder = path.join(scratch, ".cache/side-viewer/shell");
    const file = path.join(folder, "nuc-pro_t1kb.txt");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(file, "old");
    fs.chmodSync(file, 0o644);
    handOff(folder, file, "echo new");
    assert.equal(fs.readFileSync(file, "utf8"), "echo new");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
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
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(40), prepared: null, fresh: true, stale: false, tr: ko }), {
    commands: [["send", "t7", prepareLine(FILE)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("a shell already prepared only gets the key", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(40), prepared: shellOf(ready(40)), fresh: false, stale: false, tr: ko }), {
    commands: [KEY],
    notice: null,
    wait: KEY_WAIT_MS,
  });
});

test("a shell that is now another zsh is prepared again, its draft pushed aside first", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(41), prepared: shellOf(ready(40)), fresh: false, stale: false, tr: ko }), {
    commands: [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("after exec zsh, which keeps the pid, a zsh started with other arguments is prepared again", () => {
  const exec = { state: "ready", pid: 40, argv: ["zsh"] };
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: exec, prepared: shellOf(ready(40)), fresh: false, stale: false, tr: ko }).commands,
    [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE)]]);
});

test("a handoff file the last press left behind means the zsh lacks the widget, so it is prepared again", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: ready(40), prepared: shellOf(ready(40)), fresh: false, stale: true, tr: ko }).commands,
    [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE)]]);
});

// A zsh at its prompt on nuc-pro, as `hc get` showed one there (`/usr/bin/zsh -l`).
const readyThere = (pid) => ({ state: "ready", pid, argv: ["/usr/bin/zsh", "-l"] });
const THERE = "nuc-pro/t1kb";
const FILE_THERE = "/home/me/.cache/side-viewer/shell/nuc-pro_t1kb.txt";

test("a shell on another machine is prepared like one here, and gets more time to take the handoff file", () => {
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, state: readyThere(40), prepared: null, fresh: true, stale: false, tr: ko }), {
    commands: [["send", THERE, prepareLine(FILE_THERE)]],
    notice: null,
    wait: 5000,
  });
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, state: readyThere(40), prepared: shellOf(readyThere(40)), fresh: false, stale: false, tr: ko }), {
    commands: [["keys", THERE, "ctrl+alt+f12"]],
    notice: null,
    wait: 1500,
  });
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, state: readyThere(41), prepared: shellOf(readyThere(40)), fresh: false, stale: false, tr: ko }), {
    commands: [["keys", THERE, "alt+q"], ["send", THERE, prepareLine(FILE_THERE)]],
    notice: null,
    wait: 5000,
  });
});

test("a busy shell on another machine gets nothing, only the same notice as here", () => {
  const busy = { state: "busy", program: "sleep" };
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, state: busy, prepared: null, fresh: false, stale: false, tr: ko }), {
    commands: [],
    notice: { title: "터미널에 넣지 않았습니다", body: "셸에서 다른 프로그램(sleep)이 실행 중입니다. 끝난 뒤 다시 누르세요.", level: "warning" },
    wait: 0,
  });
});

test("the waits: 0.5 s after the key and 3 s after the prepare line here, looking every 50 ms; 1.5 s, 5 s and 100 ms on another machine", () => {
  assert.deepEqual(waitsOf(null), { key: 500, prepare: 3000, step: 50 });
  assert.deepEqual(waitsOf("nuc-pro"), { key: 1500, prepare: 5000, step: 100 });
  assert.equal(KEY_WAIT_MS, 500);
  assert.equal(PREPARE_WAIT_MS, 3000);
});

test("the machine of an hc address is its prefix; a bare address is this Mac", () => {
  assert.equal(machineOfAddress("nuc-pro/t1kb"), "nuc-pro");
  assert.equal(machineOfAddress("nuc-pro/p3"), "nuc-pro");
  assert.equal(machineOfAddress("t7"), null);
  assert.equal(isRemote("mini/t7"), true);
  assert.equal(isRemote("t7"), false);
});

test("a press whose handoff file was taken keeps the zsh as prepared", () => {
  assert.deepEqual(pressOutcome({ left: false, state: ready(40), keyed: true, tr: ko }), { prepared: shellOf(ready(40)), notice: null });
});

test("a key press whose handoff file is still there forgets the zsh and says the command did not go in", () => {
  assert.deepEqual(pressOutcome({ left: true, state: ready(40), keyed: true, tr: ko }), { prepared: null, notice: noticeOf({ state: "unprepared" }, ko) });
});

test("a prepare line that has not taken the handoff file in time sends no key, so its notice says only that the shell was not ready", () => {
  assert.deepEqual(pressOutcome({ left: true, state: ready(40), keyed: false, tr: ko }), { prepared: null, notice: noticeOf({ state: "unready" }, ko) });
  assert.deepEqual(noticeOf({ state: "unready" }, ko), {
    title: "터미널에 넣지 못했습니다",
    body: "셸이 아직 명령을 받을 준비가 되지 않았습니다. 잠시 뒤 다시 누르세요.",
    level: "error",
  });
});

test("the notice for a shell that did not take the command", () => {
  assert.deepEqual(noticeOf({ state: "unprepared" }, ko), {
    title: "터미널에 넣지 못했습니다",
    body: "셸이 명령을 받지 않았습니다(exec zsh 등으로 다시 시작됨). 입력 칸에 ;7~가 남았다면 지우고 다시 누르세요.",
    level: "error",
  });
});

test("there is no notice refusing another machine's shell any more", () => {
  assert.ok(!Object.keys(alertsEn).includes("alerts.remote"));
  assert.ok(!Object.keys(alertsKo).includes("alerts.remote"));
});

test("no zsh on that machine: the notice says so and points to the copy button", () => {
  assert.deepEqual(noticeOf({ state: "noZsh" }, ko), {
    title: "터미널에 넣지 못했습니다",
    body: "그 기계에 zsh가 없어 넣을 수 없습니다. 복사 버튼으로 붙여 넣으세요.",
    level: "error",
  });
  assert.deepEqual(noticeOf({ state: "noZsh" }, translator("en")), {
    title: "Couldn't insert into the terminal",
    body: "There's no zsh on that machine, so it can't be inserted. Use the copy button and paste it.",
    level: "error",
  });
});

test("a machine that can't be reached: the notice names it, in the viewer's words", () => {
  assert.deepEqual(noticeOf({ state: "unreachable", machine: "nuc-pro" }, ko), {
    title: "터미널에 넣지 못했습니다",
    body: "nuc-pro 기계에 연결할 수 없어요",
    level: "error",
  });
  assert.deepEqual(noticeOf({ state: "unreachable", machine: "nuc-pro" }, translator("en")), {
    title: "Couldn't insert into the terminal",
    body: "Can't reach the machine nuc-pro",
    level: "error",
  });
});

// Herdr's machines(), with nuc-pro cut off.
const OFFLINE = [{ name: null, layout: "ready" }, { name: "imac-i7", layout: "ready" }, { name: "nuc-pro", layout: "unavailable" }];

test("a machine Herdr lists as unavailable is cut off before anything is sent", () => {
  assert.equal(cutOff({ machine: "nuc-pro", machines: OFFLINE }), true);
  assert.equal(cutOff({ machine: "imac-i7", machines: OFFLINE }), false);
  assert.equal(cutOff({ machine: null, machines: OFFLINE }), false);
});

test("a remote command refused for the connection means the machine is cut off; any other refusal does not", () => {
  // Herdr's words for exec (herdr.d.ts), and hc machine ls's `why` for a machine it lost.
  assert.equal(cutOff({ machine: "nuc-pro", failure: new Error("`herdr.exec`: the machine is unreachable") }), true);
  assert.equal(cutOff({ machine: "nuc-pro", failure: new Error("cannot reach mac-m1-max: ssh: connect to host 100.90.90.10 port 22: Operation timed out") }), true);
  // A nonzero hc answer, its JSON error on stderr.
  const answer = (message) => ({ code: 1, stdout: "", stderr: JSON.stringify({ error: { kind: "x", message } }) });
  assert.equal(cutOff({ machine: "nuc-pro", failure: answer("request timed out after 10000 ms") }), true);
  assert.equal(cutOff({ machine: "nuc-pro", failure: answer("unknown machine \"no-such-machine\"") }), false);
  assert.equal(cutOff({ machine: "nuc-pro", failure: { code: 1, stdout: "", stderr: "sh: 1: cannot create /x: Permission denied" } }), false);
  // This Mac's own failures are never a lost connection.
  assert.equal(cutOff({ machine: null, failure: new Error("the machine is unreachable") }), false);
});

test("a busy shell gets nothing, only a notice", () => {
  const busy = { state: "busy", program: "sleep" };
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, state: busy, prepared: shellOf(ready(40)), fresh: false, stale: false, tr: ko }), {
    commands: [],
    notice: noticeOf(busy, ko),
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
  assert.deepEqual(noticeOf({ state: "busy", program: "sleep" }, ko), {
    title: "터미널에 넣지 않았습니다",
    body: "셸에서 다른 프로그램(sleep)이 실행 중입니다. 끝난 뒤 다시 누르세요.",
    level: "warning",
  });
});

test("a shell pane that could not be opened or found says so", () => {
  assert.deepEqual(noticeOf({ state: "failed" }, ko), { title: "터미널에 넣지 못했습니다", body: "셸 pane을 열거나 찾지 못했습니다.", level: "error" });
});

test("the notices in English, the program's name kept as it is", () => {
  const en = translator("en");
  assert.deepEqual(noticeOf({ state: "busy", program: "sleep" }, en), {
    title: "Not inserted into the terminal",
    body: "Another program (sleep) is running in the shell. Press again when it ends.",
    level: "warning",
  });
  const failed = "Couldn't insert into the terminal";
  assert.deepEqual(noticeOf({ state: "unprepared" }, en), {
    title: failed,
    body: "The shell didn't take the command (it was restarted, e.g. by exec zsh). If ;7~ is left in the input line, delete it and press again.",
    level: "error",
  });
  assert.deepEqual(noticeOf({ state: "unready" }, en), { title: failed, body: "The shell isn't ready for commands yet. Press again in a moment.", level: "error" });
  assert.deepEqual(noticeOf({ state: "failed" }, en), { title: failed, body: "Couldn't open or find the shell pane.", level: "error" });
  // The plan and the press word their notices in the language they are given, and throw without one.
  const busy = { state: "busy", program: "sleep" };
  assert.equal(insertPlan({ terminal: "t7", file: FILE, state: busy, prepared: null, fresh: false, stale: false, tr: en }).notice.title,
    "Not inserted into the terminal");
  assert.equal(pressOutcome({ left: true, state: ready(40), keyed: false, tr: en }).notice.title, failed);
  assert.throws(() => insertPlan({ terminal: "t7", file: FILE, state: busy, prepared: null, fresh: false, stale: false }), /translator/);
  assert.throws(() => pressOutcome({ left: true, state: ready(40), keyed: false }), /translator/);
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

test("a shell on another machine is the zsh found there, split below the viewer and started in the folder", () => {
  assert.deepEqual(splitOf("nuc-pro/p3", "/home/me/work", "/usr/bin/zsh"), {
    direction: "down",
    pane: "nuc-pro/p3",
    argv: ["/usr/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec /usr/bin/zsh -l", "zsh", "/home/me/work"],
  });
});

// FIND_ZSH's answers as `hc exec --on <machine> sh -l -c FIND_ZSH sh` gave them (2026-11-19).
const NUC_PRO = "login /usr/bin/zsh\npath /bin/zsh\npath /usr/bin/zsh\n";
const IMAC = "login /bin/zsh\npath /bin/zsh\n";

test("the zsh there is the login shell's `command -v zsh` first", () => {
  assert.equal(zshOf(NUC_PRO), "/usr/bin/zsh");
  assert.equal(zshOf(IMAC), "/bin/zsh");
  // Lines a login profile prints before the answer are not taken for it.
  assert.equal(zshOf("Welcome to nuc-pro\npath of least resistance\nlogin /usr/local/bin/zsh\n"), "/usr/local/bin/zsh");
});

test("without a login answer, the zsh there is the first of /bin, /usr/bin, /usr/local/bin and /opt/homebrew/bin", () => {
  assert.equal(zshOf("login \npath /bin/zsh\npath /usr/bin/zsh\n"), "/bin/zsh");
  assert.equal(zshOf("login \npath /opt/homebrew/bin/zsh\npath /usr/local/bin/zsh\n"), "/usr/local/bin/zsh");
  assert.equal(zshOf("login \npath /opt/homebrew/bin/zsh\n"), "/opt/homebrew/bin/zsh");
});

test("no zsh there: no login answer and none of the four paths", () => {
  assert.equal(zshOf("login \n"), null);
  assert.equal(zshOf(""), null);
  assert.equal(zshOf("login zsh\n"), null);
});

test("the zsh lookup answers with the login shell's zsh only when it is a program file", () => {
  // Run here with PATH only `bin`, from the folder `cwd`, after `profile` (what a login profile
  // may have set up).
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "find-zsh-"));
  try {
    const run = (bin, profile = "") =>
      execFileSync("/bin/sh", ["-c", `${profile}${FIND_ZSH}`, "sh"], { encoding: "utf8", cwd: scratch, env: { PATH: bin } });
    // A profile's zsh function: `command -v` answers with the bare name, which here is a folder.
    fs.mkdirSync(path.join(scratch, "zsh"));
    fs.mkdirSync(path.join(scratch, "a"));
    assert.match(run(path.join(scratch, "a"), "zsh() { :; }; "), /^login \n/);
    fs.mkdirSync(path.join(scratch, "b"));
    fs.writeFileSync(path.join(scratch, "b/zsh"), "#!/bin/sh\n", { mode: 0o755 });
    assert.match(run(path.join(scratch, "b")), new RegExp(`^login ${scratch}/b/zsh\n`));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("beside a conversation on another machine with no conversation terminal, the shell starts in that machine's home", () => {
  const panes = [agentPane("nuc-pro/p1", "nuc-pro/tab1", "nuc-pro/t1", "/home/me/api"), viewerPane("nuc-pro/p2", "nuc-pro/tab2")];
  assert.equal(shellFolder({ viewerTab: false, file: "/home/me/a.md", viewer: "nuc-pro/p2", panes, shell: null, home: "/home/me" }), "/home/me");
  assert.equal(shellFolder({ viewerTab: true, file: null, viewer: "nuc-pro/p2", panes, shell: null, home: "/home/me" }), "/home/me");
  // With one, its folder there; in a viewer tab, the document's folder there.
  const beside = [agentPane("nuc-pro/p1", "nuc-pro/tab1", "nuc-pro/t1", "/home/me/api"), viewerPane("nuc-pro/p2", "nuc-pro/tab1")];
  assert.equal(shellFolder({ viewerTab: false, file: "/home/me/a.md", viewer: "nuc-pro/p2", panes: beside, shell: null, home: "/home/me" }), "/home/me/api");
  assert.equal(shellFolder({ viewerTab: true, file: "/home/me/notes/a.md", viewer: "nuc-pro/p2", panes: beside, shell: null, home: "/home/me" }), "/home/me/notes");
});

test("a block of several lines stays several lines, without its last newline", () => {
  assert.equal(insertText("for f in *; do\n  echo \"$f\"\ndone\n"), "for f in *; do\n  echo \"$f\"\ndone");
});
