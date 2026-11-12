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
