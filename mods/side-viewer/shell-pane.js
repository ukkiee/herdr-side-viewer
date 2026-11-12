// The shell pane below a side viewer, and putting a shell code block into its input line
// (the `>_` button). The decisions are in terminal-insert.js; this file asks Herdr and hc.
//
// A viewer keeps one ShellPane: it remembers the pane it opened and puts later blocks there
// while that pane still shows the same terminal.
import { hc, run, panes, focused, props, home, notify } from "herdr";
import { insertCommands, shellState, noticeOf, viewerPaneOf, liveShell, openedShell, splitOf, shellFolder } from "./terminal-insert.js";

// How long a new pane may take to show up in panes(), and a new shell to reach its prompt.
const WAIT_MS = 5000;
const STEP_MS = 100;

export class ShellPane {
  constructor() {
    // { pane, terminal } of the shell pane this viewer opened, or null.
    this.shell = null;
    // A press while one is under way is dropped, so two presses cannot open two panes.
    this.working = false;
  }

  // Puts `command` into the shell's input line without Enter. `file` is the shown document;
  // `viewerTab` whether the viewer is a tab of its own (then the shell starts in the
  // document's folder). A shell running a program does not take it, and a notification says why.
  insert(command, { file, viewerTab }, cx) {
    if (this.working) return;
    this.working = true;
    cx.spawn(async (cx) => {
      try {
        const notice = await this.put(command, file, viewerTab, cx);
        if (notice) notify(notice);
      } catch {
        notify(noticeOf({ state: "failed" }));
      } finally {
        this.working = false;
      }
    });
  }

  // Returns the notice to show, or null when the command went in.
  async put(command, file, viewerTab, cx) {
    const all = panes();
    const kept = liveShell(this.shell, all);
    if (kept) {
      const state = await this.settled(kept.terminal, cx);
      if (state.state === "busy") return noticeOf(state);
      if (state.state === "ready") return this.send(kept, command, false);
    }
    const viewer = viewerPaneOf({ props: props(), focused: focused(), panes: all });
    if (!viewer) return noticeOf({ state: "failed" });
    const folder = shellFolder({ viewerTab, file, viewer, panes: all, shell: this.shell, home: home() });
    run("pane.split", splitOf(viewer, folder));
    const opened = await this.appeared(all, viewer, cx);
    if (!opened) return noticeOf({ state: "failed" });
    this.shell = opened;
    const state = await this.settled(opened.terminal, cx);
    if (state.state === "busy") return noticeOf(state);
    if (state.state !== "ready") return noticeOf({ state: "failed" });
    return this.send(opened, command, true);
  }

  // The pane a split below `viewer` opened, once panes() shows it.
  async appeared(before, viewer, cx) {
    for (let waited = 0; waited <= WAIT_MS; waited += STEP_MS) {
      const opened = openedShell(before, panes(), viewer);
      if (opened) return opened;
      await cx.sleep(STEP_MS);
    }
    return null;
  }

  // The terminal's state once it is no longer starting (terminal-insert.js, shellState).
  async settled(terminal, cx) {
    let state = { state: "starting" };
    for (let waited = 0; waited <= WAIT_MS; waited += STEP_MS) {
      const result = await hc(["get", terminal, "--json"]);
      let info = null;
      try {
        info = result.code === 0 ? JSON.parse(result.stdout) : null;
      } catch {}
      state = shellState(info);
      if (state.state !== "starting") return state;
      await cx.sleep(STEP_MS);
    }
    return state;
  }

  // Puts the line in, then gives the shell pane the keyboard so Enter runs it.
  async send(shell, command, fresh) {
    for (const args of insertCommands(shell.terminal, command, { fresh })) {
      const result = await hc(args);
      if (result.code !== 0) return noticeOf({ state: "failed" });
    }
    run("pane.focus", { pane: shell.pane });
    return null;
  }
}
