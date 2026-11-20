// node --test: putting a shell code block into a terminal's input line (the `>_` button).
// What the hc commands are, which folder the shell starts in, which pane is reused and when a
// shell is too busy to take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { insertFileOf, insertFolderOf, handoffOf, keymapOf, HANDOFF_THERE, FIND_ZSH, zshOf, prepareLine, insertText, insertPlan, pressOutcome, shellOf, isRemote, machineOfAddress, waitsOf, cutOff, KEY_WAIT_MS, PREPARE_WAIT_MS, shellState, noticeOf, shellFolder, viewerPaneOf, liveShell, openedShell, splitOf, stateOfGet, handoffLook, handoffTaken } from "./terminal-insert.js";
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
const KEYMAP = `${APP}/data/side-viewer/shell/t7.keymap`;

test("each shell has its own handoff file in the app's data folder", () => {
  assert.equal(insertFileOf(APP, "t7"), FILE);
  assert.equal(insertFileOf(APP, "mini/t12"), `${APP}/data/side-viewer/shell/mini_t12.txt`);
  assert.equal(insertFolderOf(APP), `${APP}/data/side-viewer/shell`);
});

test("a shell here uses the data folder's handoff and keymap files; a shell on another machine ones in that machine's ~/.cache", () => {
  assert.deepEqual(handoffOf({ terminal: "t7", app: APP, home: HOME }), { folder: `${APP}/data/side-viewer/shell`, file: FILE, keymap: KEYMAP });
  assert.deepEqual(handoffOf({ terminal: "mini/t7", app: APP, home: "/home/me" }), {
    folder: "/home/me/.cache/side-viewer/shell",
    file: "/home/me/.cache/side-viewer/shell/mini_t7.txt",
    keymap: "/home/me/.cache/side-viewer/shell/mini_t7.keymap",
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
    const file = path.join(folder, "mini_t7.txt");
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
    const file = path.join(folder, "mini_t7.txt");
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

// The prepare line for the handoff file `file` and the keymap file `keymap` as zsh quotes
// them: the widget, its key in every keymap, the main keymap written over the keymap file, the
// handoff file's text put on the buffer stack for the next prompt, then clear.
const widget = (file, keymap) =>
  ` _side_viewer_insert() { local f=${file}; [[ -r "$f" ]] || return 0; [[ -n $BUFFER ]] && zle push-line;` +
  ' BUFFER="$(<"$f")"; command rm -f -- "$f"; CURSOR=$#BUFFER };' +
  " zle -N _side_viewer_insert;" +
  " bindkey -M emacs '\\e[24;7~' _side_viewer_insert; bindkey -M viins '\\e[24;7~' _side_viewer_insert;" +
  " bindkey -M vicmd '\\e[24;7~' _side_viewer_insert;" +
  ` bindkey -lL main >| ${keymap} 2>/dev/null;` +
  ` [[ -r ${file} ]] && print -rz -- "$(<${file})"; command rm -f -- ${file}; clear`;

test("the prepare line binds ctrl+alt+F12 in every keymap, leaves the main keymap in the keymap file, puts the handoff file's text in itself, then clears", () => {
  assert.equal(prepareLine(FILE, KEYMAP), widget(`'${FILE}'`, `'${KEYMAP}'`));
});

test("the prepare line writes the keymap file over one already there, before it removes the handoff file", () => {
  const line = prepareLine(FILE, KEYMAP);
  const written = line.indexOf(`bindkey -lL main >| '${KEYMAP}'`);
  assert.ok(written > line.indexOf("bindkey -M vicmd"));
  assert.ok(written < line.indexOf(`command rm -f -- '${FILE}'`));
});

test("handoff and keymap file paths with a quote stay one word for zsh", () => {
  assert.equal(prepareLine("/Users/it's me/t7.txt", "/Users/it's me/t7.keymap"),
    widget("'/Users/it'\\''s me/t7.txt'", "'/Users/it'\\''s me/t7.keymap'"));
});

test("a shell still starting is neither ready nor busy", () => {
  const live = terminal("zsh");
  assert.deepEqual(shellState({ ...live, foreground: undefined }), { state: "starting" });
  assert.deepEqual(shellState({ ...live, foreground: null }), { state: "starting" });
});

test("only the short zsh that opens the shell pane is starting, in whatever folder", () => {
  // As seen on a Linux machine while the shell pane opened there.
  const linux = ["/usr/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec \"$2\" -l", "zsh", "/tmp/side-viewer-remote", "/usr/bin/zsh"];
  assert.deepEqual(shellState(running({ argv: linux, name: "zsh" })), { state: "starting" });
  assert.deepEqual(shellState(running({ argv: splitOf("p2", "/work/it's here").argv, name: "zsh" })), { state: "starting" });
  const elsewhere = [...linux];
  elsewhere[4] = "/home/me/other folder";
  assert.deepEqual(shellState(running({ argv: elsewhere, name: "zsh" })), { state: "starting" });
});

test("a -c run shaped almost like the shell pane's short zsh is busy", () => {
  const split = ["/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec \"$2\" -l", "zsh", "/w", "/bin/zsh"];
  const differing = (at, value) => split.map((word, i) => (i === at ? value : word));
  const busy = { state: "busy", program: "zsh" };
  assert.deepEqual(shellState(running({ argv: differing(3, "sh"), name: "zsh" })), busy);
  assert.deepEqual(shellState(running({ argv: differing(5, "/usr/bin/zsh"), name: "zsh" })), busy);
  assert.deepEqual(shellState(running({ argv: differing(2, "cd -- \"$1\"; exec \"$2\" -l"), name: "zsh" })), busy);
  assert.deepEqual(shellState(running({ argv: [...split, "more"], name: "zsh" })), busy);
  assert.deepEqual(shellState(running({ argv: split.slice(0, 5), name: "zsh" })), busy);
});

// `hc get --json` of a live terminal whose foreground is `foreground`, as measured on this Mac
// (cwd and pid aside).
const running = (foreground) => ({ address: "t7", state: "live", argv: ["/bin/zsh", "-l"], status: null, foreground: { ...foreground, pid: 2 } });

test("a program started with -c in the shell pane is busy and named, even when it is zsh", () => {
  const python = running({
    argv: ["/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python", "-c", "import time; time.sleep(3)"],
    name: "Python",
  });
  assert.deepEqual(shellState(python), { state: "busy", program: "Python" });
  assert.deepEqual(shellState(running({ argv: ["sh", "-c", "sleep 3; true"], name: "bash" })), { state: "busy", program: "bash" });
  assert.deepEqual(shellState(running({ argv: ["zsh", "-c", "sleep 3; true"], name: "zsh" })), { state: "busy", program: "zsh" });
});

test("single quotes, Korean, symbols and backslashes go into the handoff file as they are", () => {
  const command = "echo 'q' \"a b\" | wc -c > /dev/null; ls $HOME ~ 한글 & `pwd` a\\nb";
  assert.equal(insertText(command), command);
});

// A zsh waiting at its prompt, as splitOf starts it.
const ready = (pid) => ({ state: "ready", pid, argv: ["/bin/zsh", "-l"] });
// `bindkey -lL main` as zsh prints it: `zsh -f` and a login zsh, then after `bindkey -v`.
test("the keymap file of an emacs zsh says emacs", () => {
  assert.equal(keymapOf("bindkey -A emacs main\n"), "emacs");
});

test("the keymap file of a vi zsh says vi, in insert or command mode", () => {
  assert.equal(keymapOf("bindkey -A viins main\n"), "vi");
  assert.equal(keymapOf("bindkey -A vicmd main\n"), "vi");
});

test("an empty keymap file, none, or another keymap is not known", () => {
  assert.equal(keymapOf(""), null);
  assert.equal(keymapOf(null), null);
  assert.equal(keymapOf("bindkey -A mykeys main\n"), null);
  assert.equal(keymapOf("emacs"), null);
});

const KEY = ["keys", "t7", "ctrl+alt+f12"];

test("a shell just opened is prepared, and the prepare line itself puts the command in; no key, no Enter", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(40), prepared: null, fresh: true, stale: false, tr: ko }), {
    commands: [["send", "t7", prepareLine(FILE, KEYMAP)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("a shell already prepared only gets the key", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(40), prepared: shellOf(ready(40)), fresh: false, stale: false, tr: ko }), {
    commands: [KEY],
    notice: null,
    wait: KEY_WAIT_MS,
  });
});

test("a shell that is now another emacs zsh is prepared again, its draft pushed aside first", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(41), prepared: shellOf(ready(40)), keymap: "emacs", fresh: false, stale: false, tr: ko }), {
    commands: [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE, KEYMAP)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("after exec zsh, which keeps the pid, a zsh started with other arguments is prepared again", () => {
  const exec = { state: "ready", pid: 40, argv: ["zsh"] };
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: exec, prepared: shellOf(ready(40)), keymap: "emacs", fresh: false, stale: false, tr: ko }).commands,
    [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE, KEYMAP)]]);
});

test("a handoff file the last press left behind means the zsh lacks the widget, so it is prepared again", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(40), prepared: shellOf(ready(40)), keymap: "emacs", fresh: false, stale: true, tr: ko }).commands,
    [["keys", "t7", "alt+q"], ["send", "t7", prepareLine(FILE, KEYMAP)]]);
});

test("a shell prepared again whose zsh was vi gets ctrl+c, not alt+q, right before the prepare line", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(41), prepared: shellOf(ready(40)), keymap: "vi", fresh: false, stale: false, tr: ko }), {
    commands: [["keys", "t7", "ctrl+c"], ["send", "t7", prepareLine(FILE, KEYMAP)]],
    notice: null,
    wait: PREPARE_WAIT_MS,
  });
});

test("a shell prepared again whose keymap is not known gets ctrl+c too", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(40), prepared: shellOf(ready(40)), keymap: null, fresh: false, stale: true, tr: ko }).commands,
    [["keys", "t7", "ctrl+c"], ["send", "t7", prepareLine(FILE, KEYMAP)]]);
});

test("a shell just opened gets only the prepare line, whatever the keymap", () => {
  for (const keymap of ["emacs", "vi", null]) {
    assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(40), prepared: null, keymap, fresh: true, stale: false, tr: ko }).commands,
      [["send", "t7", prepareLine(FILE, KEYMAP)]]);
  }
});

test("a prepared vi zsh only gets the key; its widget pushes the draft aside", () => {
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: ready(40), prepared: shellOf(ready(40)), keymap: "vi", fresh: false, stale: false, tr: ko }), {
    commands: [KEY],
    notice: null,
    wait: KEY_WAIT_MS,
  });
});

// A Linux zsh at its prompt, as `hc get` shows one (`/usr/bin/zsh -l`).
const readyThere = (pid) => ({ state: "ready", pid, argv: ["/usr/bin/zsh", "-l"] });
const THERE = "mini/t7";
const FILE_THERE = "/home/me/.cache/side-viewer/shell/mini_t7.txt";
const KEYMAP_THERE = "/home/me/.cache/side-viewer/shell/mini_t7.keymap";

test("a shell on another machine is prepared like one here, and gets more time to take the handoff file", () => {
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, keymapFile: KEYMAP_THERE, state: readyThere(40), prepared: null, fresh: true, stale: false, tr: ko }), {
    commands: [["send", THERE, prepareLine(FILE_THERE, KEYMAP_THERE)]],
    notice: null,
    wait: 5000,
  });
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, keymapFile: KEYMAP_THERE, state: readyThere(40), prepared: shellOf(readyThere(40)), fresh: false, stale: false, tr: ko }), {
    commands: [["keys", THERE, "ctrl+alt+f12"]],
    notice: null,
    wait: 1500,
  });
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, keymapFile: KEYMAP_THERE, state: readyThere(41), prepared: shellOf(readyThere(40)), keymap: "emacs", fresh: false, stale: false, tr: ko }), {
    commands: [["keys", THERE, "alt+q"], ["send", THERE, prepareLine(FILE_THERE, KEYMAP_THERE)]],
    notice: null,
    wait: 5000,
  });
});

test("a shell on another machine prepared again whose keymap is not known gets ctrl+c, with that machine's wait", () => {
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, keymapFile: KEYMAP_THERE, state: readyThere(41), prepared: shellOf(readyThere(40)), keymap: null, fresh: false, stale: false, tr: ko }), {
    commands: [["keys", THERE, "ctrl+c"], ["send", THERE, prepareLine(FILE_THERE, KEYMAP_THERE)]],
    notice: null,
    wait: 5000,
  });
});

test("a busy shell on another machine gets nothing, only the same notice as here", () => {
  const busy = { state: "busy", program: "sleep" };
  assert.deepEqual(insertPlan({ terminal: THERE, file: FILE_THERE, keymapFile: KEYMAP_THERE, state: busy, prepared: null, fresh: false, stale: false, tr: ko }), {
    commands: [],
    notice: { title: "터미널에 넣지 않았습니다", body: "셸에서 다른 프로그램(sleep)이 실행 중입니다. 끝난 뒤 다시 누르세요.", level: "warning" },
    wait: 0,
  });
});

test("the waits: 0.5 s after the key and 3 s after the prepare line here, looking every 50 ms; 1.5 s, 5 s and 100 ms on another machine", () => {
  assert.deepEqual(waitsOf(null), { key: 500, prepare: 3000, step: 50 });
  assert.deepEqual(waitsOf("mini"), { key: 1500, prepare: 5000, step: 100 });
  assert.equal(KEY_WAIT_MS, 500);
  assert.equal(PREPARE_WAIT_MS, 3000);
});

test("the machine of an hc address is its prefix; a bare address is this Mac", () => {
  assert.equal(machineOfAddress("mini/t7"), "mini");
  assert.equal(machineOfAddress("mini/p3"), "mini");
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
  assert.deepEqual(noticeOf({ state: "unreachable", machine: "mini" }, ko), {
    title: "터미널에 넣지 못했습니다",
    body: "mini 기계에 연결할 수 없어요",
    level: "error",
  });
  assert.deepEqual(noticeOf({ state: "unreachable", machine: "mini" }, translator("en")), {
    title: "Couldn't insert into the terminal",
    body: "Can't reach the machine mini",
    level: "error",
  });
});

// Herdr's machines(), with mini cut off.
const OFFLINE = [{ name: null, layout: "ready" }, { name: "studio", layout: "ready" }, { name: "mini", layout: "unavailable" }];

test("a machine Herdr lists as unavailable is cut off before anything is sent", () => {
  assert.equal(cutOff({ machine: "mini", machines: OFFLINE }), true);
  assert.equal(cutOff({ machine: "studio", machines: OFFLINE }), false);
  assert.equal(cutOff({ machine: null, machines: OFFLINE }), false);
});

test("a remote command refused for the connection means the machine is cut off; any other refusal does not", () => {
  // Herdr's words for exec (herdr.d.ts), and hc machine ls's `why` for a machine it lost.
  assert.equal(cutOff({ machine: "mini", failure: new Error("`herdr.exec`: the machine is unreachable") }), true);
  assert.equal(cutOff({ machine: "mini", failure: new Error("cannot reach studio: ssh: connect to host 192.0.2.10 port 22: Operation timed out") }), true);
  // A nonzero hc answer, its JSON error on stderr.
  const answer = (message) => ({ code: 1, stdout: "", stderr: JSON.stringify({ error: { kind: "x", message } }) });
  assert.equal(cutOff({ machine: "mini", failure: answer("request timed out after 10000 ms") }), true);
  assert.equal(cutOff({ machine: "mini", failure: answer("unknown machine \"no-such-machine\"") }), false);
  assert.equal(cutOff({ machine: "mini", failure: { code: 1, stdout: "", stderr: "sh: 1: cannot create /x: Permission denied" } }), false);
  // This Mac's own failures are never a lost connection.
  assert.equal(cutOff({ machine: null, failure: new Error("the machine is unreachable") }), false);
});

// `hc get <t> --json` answers: a live zsh at its prompt, and failures with hc's JSON error.
const got = (info) => ({ code: 0, stdout: JSON.stringify(info), stderr: "" });
const gotError = (kind, message) => ({ code: 1, stdout: "", stderr: JSON.stringify({ error: { kind, message } }) });
const LOST = gotError("timeout", "request timed out after 10000 ms");

test("a terminal on another machine whose `hc get` failed for the connection is unreachable, not gone", () => {
  assert.deepEqual(stateOfGet({ machine: "mini", answer: LOST }), { state: "unreachable", machine: "mini" });
  assert.deepEqual(noticeOf(stateOfGet({ machine: "mini", answer: LOST }), ko).body, "mini 기계에 연결할 수 없어요");
});

test("any other `hc get` failure, or one here, is a terminal that is gone; an answer is read as the shell's state", () => {
  assert.deepEqual(stateOfGet({ machine: "mini", answer: gotError("not_found", "no terminal t7") }), { state: "gone" });
  assert.deepEqual(stateOfGet({ machine: null, answer: LOST }), { state: "gone" });
  assert.deepEqual(stateOfGet({ machine: null, answer: { code: 0, stdout: "not json", stderr: "" } }), { state: "gone" });
  assert.deepEqual(stateOfGet({ machine: "mini", answer: got(terminal("zsh", ["/bin/zsh", "-l"])) }), { state: "ready", pid: 2, argv: ["/bin/zsh", "-l"] });
  assert.deepEqual(stateOfGet({ machine: null, answer: got(terminal("sleep", ["sleep", "9"])) }), { state: "busy", program: "sleep" });
});

test("a look at the handoff file: gone is taken, still there is left, a read refused for the connection is unreachable", () => {
  assert.equal(handoffLook({ machine: "mini", text: null }), "taken");
  assert.equal(handoffLook({ machine: "mini", text: "echo hi" }), "left");
  assert.equal(handoffLook({ machine: "mini", failure: new Error("`herdr.readTextFile`: the machine is unreachable") }), "unreachable");
  // Any other refusal, and every refusal here, counts as taken.
  assert.equal(handoffLook({ machine: "mini", failure: new Error("file too large") }), "taken");
  assert.equal(handoffLook({ machine: null, failure: new Error("the machine is unreachable") }), "taken");
});

// handoffTaken on a clock that moves only when a look takes `readMs` or a sleep runs. `looks`
// gives each look's answer in turn, the last one repeated. Returns what it said and when.
async function timed({ wait, step, readMs, looks = ["left"] }) {
  let clock = 0;
  let n = 0;
  const said = await handoffTaken({
    look: async () => {
      clock += readMs;
      return looks[Math.min(n++, looks.length - 1)];
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    wait,
    step,
  });
  return { said, at: clock };
}

test("a file left on another machine is given up once the wait is over by the clock, however long each read takes", async () => {
  const { key, prepare, step } = waitsOf("mini");
  // 100 ms a read there, as a slow link gives.
  const keyed = await timed({ wait: key, step, readMs: 100 });
  assert.equal(keyed.said, "left");
  assert.ok(keyed.at >= 1500 && keyed.at <= 1600, `gave up at ${keyed.at} ms`);
  const prepared = await timed({ wait: prepare, step, readMs: 100 });
  assert.equal(prepared.said, "left");
  assert.ok(prepared.at >= 5000 && prepared.at <= 5100, `gave up at ${prepared.at} ms`);
});

test("a file left here is given up after 0.5 s after the key and 3 s after the prepare line", async () => {
  const { key, prepare, step } = waitsOf(null);
  assert.deepEqual(await timed({ wait: key, step, readMs: 0 }), { said: "left", at: 500 });
  assert.deepEqual(await timed({ wait: prepare, step, readMs: 0 }), { said: "left", at: 3000 });
});

test("the wait ends at the first look that finds the file taken, or a look refused for the connection", async () => {
  const { key, step } = waitsOf("mini");
  assert.deepEqual(await timed({ wait: key, step, readMs: 100, looks: ["left", "left", "taken"] }), { said: "taken", at: 500 });
  assert.deepEqual(await timed({ wait: key, step, readMs: 100, looks: ["left", "unreachable"] }), { said: "unreachable", at: 300 });
});

test("a busy shell gets nothing, only a notice", () => {
  const busy = { state: "busy", program: "sleep" };
  assert.deepEqual(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: busy, prepared: shellOf(ready(40)), fresh: false, stale: false, tr: ko }), {
    commands: [],
    notice: noticeOf(busy, ko),
    wait: 0,
  });
});

test("a shell waiting at its prompt is ready; zsh is told by its foreground process, whose pid names it", () => {
  assert.deepEqual(shellState(terminal("zsh", ["/bin/zsh", "-l"])), { state: "ready", pid: 2, argv: ["/bin/zsh", "-l"] });
  assert.deepEqual(shellState(terminal("-zsh", ["-zsh"])), { state: "ready", pid: 2, argv: ["-zsh"] });
  assert.deepEqual(shellState(running({ argv: ["/bin/zsh", "-f"], name: "zsh" })), { state: "ready", pid: 2, argv: ["/bin/zsh", "-f"] });
});

test("a zsh with -c anywhere among its arguments runs a line, not a prompt, so it is busy", () => {
  assert.deepEqual(shellState(running({ argv: ["zsh", "-l", "-c", "sleep 3; true"], name: "zsh" })), { state: "busy", program: "zsh" });
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
  assert.equal(insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: busy, prepared: null, fresh: false, stale: false, tr: en }).notice.title,
    "Not inserted into the terminal");
  assert.equal(pressOutcome({ left: true, state: ready(40), keyed: false, tr: en }).notice.title, failed);
  assert.throws(() => insertPlan({ terminal: "t7", file: FILE, keymapFile: KEYMAP, state: busy, prepared: null, fresh: false, stale: false }), /translator/);
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
    argv: ["/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec \"$2\" -l", "zsh", "/work/it's here", "/bin/zsh"],
  });
});

test("a shell on another machine is the zsh found there, split below the viewer and started in the folder", () => {
  assert.deepEqual(splitOf("mini/p3", "/home/me/work", "/usr/bin/zsh"), {
    direction: "down",
    pane: "mini/p3",
    argv: ["/usr/bin/zsh", "-c", "cd -- \"$1\" 2>/dev/null; exec \"$2\" -l", "zsh", "/home/me/work", "/usr/bin/zsh"],
  });
});

test("a zsh path with a space stays one word when the short zsh becomes the login shell", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "split-"));
  try {
    const tools = path.join(scratch, "My Tools");
    const work = path.join(scratch, "it's here");
    fs.mkdirSync(tools);
    fs.mkdirSync(work);
    // Stands in for zsh: prints its own path, its arguments and the folder it started in.
    const zsh = path.join(tools, "zsh");
    fs.writeFileSync(zsh, '#!/bin/sh\nprintf "%s|%s|%s" "$0" "$*" "$(pwd -P)"\n', { mode: 0o755 });
    const { argv } = splitOf("mini/p3", work, zsh);
    // This Mac's zsh runs the short zsh's line in its place.
    const said = execFileSync("/bin/zsh", argv.slice(1), { encoding: "utf8" });
    assert.equal(said, `${zsh}|-l|${fs.realpathSync(work)}`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

// FIND_ZSH's answers as `hc exec --on <machine> sh -l -c FIND_ZSH sh` gives them, on Linux and on a Mac.
const LINUX = "login /usr/bin/zsh\npath /bin/zsh\npath /usr/bin/zsh\n";
const MAC = "login /bin/zsh\npath /bin/zsh\n";

test("the zsh there is the login shell's `command -v zsh` first", () => {
  assert.equal(zshOf(LINUX), "/usr/bin/zsh");
  assert.equal(zshOf(MAC), "/bin/zsh");
  // Lines a login profile prints before the answer are not taken for it.
  assert.equal(zshOf("Welcome to mini\npath of least resistance\nlogin /usr/local/bin/zsh\n"), "/usr/local/bin/zsh");
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
  const panes = [agentPane("mini/p1", "mini/tab1", "mini/t1", "/home/me/api"), viewerPane("mini/p2", "mini/tab2")];
  assert.equal(shellFolder({ viewerTab: false, file: "/home/me/a.md", viewer: "mini/p2", panes, shell: null, home: "/home/me" }), "/home/me");
  assert.equal(shellFolder({ viewerTab: true, file: null, viewer: "mini/p2", panes, shell: null, home: "/home/me" }), "/home/me");
  // With one, its folder there; in a viewer tab, the document's folder there.
  const beside = [agentPane("mini/p1", "mini/tab1", "mini/t1", "/home/me/api"), viewerPane("mini/p2", "mini/tab1")];
  assert.equal(shellFolder({ viewerTab: false, file: "/home/me/a.md", viewer: "mini/p2", panes: beside, shell: null, home: "/home/me" }), "/home/me/api");
  assert.equal(shellFolder({ viewerTab: true, file: "/home/me/notes/a.md", viewer: "mini/p2", panes: beside, shell: null, home: "/home/me" }), "/home/me/notes");
});

test("a block of several lines stays several lines, without its last newline", () => {
  assert.equal(insertText("for f in *; do\n  echo \"$f\"\ndone\n"), "for f in *; do\n  echo \"$f\"\ndone");
});
