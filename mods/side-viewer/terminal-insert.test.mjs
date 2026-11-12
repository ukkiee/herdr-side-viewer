// node --test: putting a shell code block into a terminal's input line (the `>_` button).
// What the hc commands are, which folder the shell starts in, which pane is reused and when a
// shell is too busy to take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { insertCommands, shellState, noticeOf, shellFolder } from "./terminal-insert.js";

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

// The text `hc send` would paste, as zsh reads it back: what lands in the input line.
const sent = (commands) => commands.find((args) => args[0] === "send")[2];

test("the command goes in through push-line, then print -rz, and nothing presses Enter", () => {
  assert.deepEqual(insertCommands("t7", "ls -la"), [
    ["keys", "t7", "alt+q"],
    ["send", "t7", " print -rz -- 'ls -la'"],
  ]);
});

test("single quotes, Korean, symbols and backslashes are quoted for zsh", () => {
  assert.equal(sent(insertCommands("t7", "echo 'q' \"a b\" | wc -c > /dev/null; ls $HOME ~ 한글 & `pwd` a\\nb")),
    " print -rz -- 'echo '\\''q'\\'' \"a b\" | wc -c > /dev/null; ls $HOME ~ 한글 & `pwd` a\\nb'");
});

test("a shell waiting at its prompt is ready; zsh is told by its foreground process", () => {
  assert.deepEqual(shellState(terminal("zsh", ["/bin/zsh", "-l"])), { state: "ready" });
  assert.deepEqual(shellState(terminal("-zsh", ["-zsh"])), { state: "ready" });
});

test("a shell running another program is busy, and the program is named", () => {
  assert.deepEqual(shellState(terminal("sleep", ["sleep", "20"])), { state: "busy", program: "sleep" });
  assert.deepEqual(shellState(terminal("vim")), { state: "busy", program: "vim" });
});

test("a shell that is not zsh is not used: print -z is zsh's", () => {
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

test("a block of several lines stays several lines, without its last newline", () => {
  assert.equal(sent(insertCommands("t7", "for f in *; do\n  echo \"$f\"\ndone\n")),
    " print -rz -- 'for f in *; do\n  echo \"$f\"\ndone'");
});
