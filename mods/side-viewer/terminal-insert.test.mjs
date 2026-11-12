// node --test: putting a shell code block into a terminal's input line (the `>_` button).
// What the hc commands are, which folder the shell starts in, which pane is reused and when a
// shell is too busy to take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { insertCommands, shellState, noticeOf } from "./terminal-insert.js";

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

test("a block of several lines stays several lines, without its last newline", () => {
  assert.equal(sent(insertCommands("t7", "for f in *; do\n  echo \"$f\"\ndone\n")),
    " print -rz -- 'for f in *; do\n  echo \"$f\"\ndone'");
});
