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
