// node --test: putting a shell code block into a terminal's input line (the `>_` button).
// What the hc commands are, which folder the shell starts in, which pane is reused and when a
// shell is too busy to take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { insertCommands } from "./terminal-insert.js";

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

test("a block of several lines stays several lines, without its last newline", () => {
  assert.equal(sent(insertCommands("t7", "for f in *; do\n  echo \"$f\"\ndone\n")),
    " print -rz -- 'for f in *; do\n  echo \"$f\"\ndone'");
});
