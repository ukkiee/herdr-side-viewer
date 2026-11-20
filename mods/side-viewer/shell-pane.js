// The shell pane below a side viewer, and putting a shell code block into its input line
// (the `>_` button). The decisions are in terminal-insert.js; this file asks Herdr and hc.
//
// A viewer keeps one ShellPane: it remembers the pane it opened and puts later blocks there
// while that pane still shows the same terminal, and which zsh there it has prepared.
// The shell is on the viewer's machine: a split of a viewer in another machine's space opens
// it there, so the handoff file, the zsh and the home are that machine's (file-access.js).
import { hc, run, panes, focused, props, appHome, notify, machines, writeTextFile, shared } from "herdr";
import { handoffOf, keymapOf, HANDOFF_THERE, FIND_ZSH, zshOf, insertText, insertPlan, pressOutcome, waitsOf, machineOfAddress, cutOff, stateOfGet, handoffLook, handoffTaken, noticeOf, viewerPaneOf, liveShell, openedShell, splitOf, shellFolder } from "./terminal-insert.js";
import { accessOf } from "./file-access.js";
import { CONVERSATIONS_KEY, sentConversation } from "./sent-conversation.js";

// How long a new pane may take to show up in panes(), and a new shell to reach its prompt.
const WAIT_MS = 5000;
const STEP_MS = 100;

// The zsh found on each other machine (zshOf), so it is looked for once. A machine where none
// was found is asked again at the next press.
const zshes = new Map();

export class ShellPane {
  constructor() {
    // { pane, terminal, prepared, keymap } of the shell pane this viewer opened, or null.
    // `prepared`: the zsh there that has the insert widget, as shellOf() gives it
    // ({ pid, argv }), or null. `keymap`: what the last prepare line taken there left in the
    // keymap file (keymapOf), or null, so the next prepare line knows how to clear a draft.
    this.shell = null;
    // A press while one is under way is dropped, so two presses cannot open two panes.
    this.working = false;
  }

  // Puts `command` into the shell's input line without Enter. `file` is the shown document;
  // `viewerTab` whether the viewer is a tab of its own (then the shell starts in the
  // document's folder). A shell running a program does not take it, and a notification says why,
  // worded by `tr` (i18n.js), the viewer's translator at the press.
  insert(command, { file, viewerTab, tr }, cx) {
    if (this.working) return;
    this.working = true;
    cx.spawn(async (cx) => {
      try {
        const notice = await this.put(command, file, viewerTab, tr, cx);
        if (notice) notify(notice);
      } catch {
        notify(noticeOf({ state: "failed" }, tr));
      } finally {
        this.working = false;
      }
    });
  }

  // Returns the notice to show, or null when the command went in. The machine is the kept
  // shell's, else the viewer's (machineOfAddress); a machine Herdr already lists as unavailable
  // gets nothing, and a remote step refused for the connection says so too.
  async put(command, file, viewerTab, tr, cx) {
    const all = panes();
    const kept = liveShell(this.shell, all);
    const viewer = kept ? null : viewerPaneOf({ props: props(), focused: focused(), panes: all });
    if (!kept && !viewer) return noticeOf({ state: "failed" }, tr);
    const machine = machineOfAddress(kept ? kept.terminal : viewer);
    if (cutOff({ machine, machines: machines() })) return noticeOf({ state: "unreachable", machine }, tr);
    const trouble = (failure) => noticeOf(cutOff({ machine, failure }) ? { state: "unreachable", machine } : { state: "failed" }, tr);
    try {
      return await this.putOn(machine, kept, viewer, all, command, file, viewerTab, tr, trouble, cx);
    } catch (error) {
      return trouble(error);
    }
  }

  async putOn(machine, kept, viewer, all, command, file, viewerTab, tr, trouble, cx) {
    const access = accessOf(machine);
    if (kept) {
      const state = await this.settled(kept.terminal, machine, cx);
      if (state.state === "busy" || state.state === "unreachable") return noticeOf(state, tr);
      if (state.state === "ready") return this.send(kept, command, state, false, access, tr, trouble, cx);
    }
    viewer ??= viewerPaneOf({ props: props(), focused: focused(), panes: all });
    if (!viewer || machineOfAddress(viewer) !== machine) return noticeOf({ state: "failed" }, tr);
    const { zsh, failure } = await this.zshOn(access);
    if (failure) return trouble(failure);
    if (zsh === null) return noticeOf({ state: "noZsh" }, tr);
    // Beside two conversations the shell starts with the one that sent the file.
    const tab = all.find((p) => p.pane === viewer)?.tab;
    const conversation = sentConversation(shared(CONVERSATIONS_KEY), tab, all)?.pane ?? null;
    const folder = shellFolder({ viewerTab, file, viewer, panes: all, shell: this.shell, conversation, home: await access.home() });
    run("pane.split", splitOf(viewer, folder, zsh));
    const opened = await this.appeared(all, viewer, cx);
    if (!opened) return noticeOf({ state: "failed" }, tr);
    this.shell = { ...opened, prepared: null, keymap: null };
    const state = await this.settled(opened.terminal, machine, cx);
    if (state.state === "busy" || state.state === "unreachable") return noticeOf(state, tr);
    if (state.state !== "ready") return noticeOf({ state: "failed" }, tr);
    return this.send(this.shell, command, state, true, access, tr, trouble, cx);
  }

  // The zsh to start on the access's machine, as { zsh }: undefined here (splitOf's own
  // /bin/zsh), the one found there otherwise, null when there is none; or { failure } when the
  // lookup did not run (a nonzero answer).
  async zshOn(access) {
    if (!access.remote) return { zsh: undefined };
    if (zshes.has(access.machine)) return { zsh: zshes.get(access.machine) };
    const answer = await access.run("sh", ["-l", "-c", FIND_ZSH, "sh"]);
    if (answer.code !== 0) return { failure: answer };
    const zsh = zshOf(answer.stdout);
    if (zsh) zshes.set(access.machine, zsh);
    return { zsh };
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

  // The state of the terminal on `machine` once it is no longer starting (terminal-insert.js,
  // stateOfGet): unreachable when `hc get` failed for the connection.
  async settled(terminal, machine, cx) {
    let state = { state: "starting" };
    for (let waited = 0; waited <= WAIT_MS; waited += STEP_MS) {
      state = stateOfGet({ machine, answer: await hc(["get", terminal, "--json"]) });
      if (state.state !== "starting") return state;
      await cx.sleep(STEP_MS);
    }
    return state;
  }

  // Writes the command to the shell's handoff file, prepares the shell (which puts the command
  // in) or presses the key, waits for the file to be taken, then gives the shell pane the
  // keyboard so Enter runs it. A file still there means that zsh did not take it: it is
  // removed, so it cannot turn up at a later prompt, and the next press prepares the shell.
  // A failed step after the write removes it too, as far as the machine can still be reached.
  // The file is on the shell's machine, read, written and removed through `access`.
  //   state: the shell's ready state (shellState), remembered once the shell took a command.
  //   trouble(failure): the notice for a failed step, the connection's or not.
  // A prepare line that was taken has left the zsh's keymap in the keymap file, which is read
  // and removed then; a key press, or a prepare line not taken, leaves the kept keymap as it is.
  async send(shell, command, state, fresh, access, tr, trouble, cx) {
    const { folder, file, keymapFile } = handoffOf({ terminal: shell.terminal, app: appHome(), home: access.remote ? await access.home() : null });
    const stale = (await access.read(file).catch(() => null)) != null;
    const plan = insertPlan({ terminal: shell.terminal, file, keymapFile, state, prepared: shell.prepared, keymap: shell.keymap, fresh, stale, tr });
    if (plan.notice) return plan.notice;
    const written = await this.write(access, folder, file, insertText(command));
    if (written !== true) return trouble(written);
    const waits = waitsOf(access.machine);
    let look = "left";
    try {
      for (const args of plan.commands) {
        const result = await hc(args);
        if (result.code !== 0) return trouble(result);
      }
      look = await this.untaken(access, file, plan.wait, waits.step, cx);
    } finally {
      if (look !== "taken") await access.run("rm", ["-f", "--", file]).catch(() => null);
    }
    if (look === "unreachable") return noticeOf({ state: "unreachable", machine: access.machine }, tr);
    const keyed = plan.kind === "key";
    const outcome = pressOutcome({ left: look === "left", state, keyed, tr });
    shell.prepared = outcome.prepared;
    if (outcome.notice) return outcome.notice;
    if (!keyed) shell.keymap = await this.keymapLeft(access, keymapFile);
    run("pane.focus", { pane: shell.pane });
    return null;
  }

  // The keymap a taken prepare line left in `file` (keymapOf), the file then removed. A read
  // that fails, the connection's too, gives null: the command already went in, and the next
  // prepare line clears a draft the safe way.
  async keymapLeft(access, file) {
    const text = await access.read(file).catch(() => null);
    await access.run("rm", ["-f", "--", file]).catch(() => null);
    return keymapOf(text);
  }

  // Whether the handoff file was taken within `wait` ms of the clock, looking every `step` ms:
  // "taken", "left", or "unreachable" when a look was refused for the connection (handoffTaken).
  untaken(access, file, wait, step, cx) {
    const { machine } = access;
    return handoffTaken({
      look: () => access.read(file).then((text) => handoffLook({ machine, text }), (failure) => handoffLook({ machine, failure })),
      sleep: (ms) => cx.sleep(ms),
      now: () => Date.now(),
      wait,
      step,
    });
  }

  // Writes `text` to the handoff file, whether or not an earlier one is still there: true, or
  // what failed (a nonzero answer, a rejection, or null). The folder is the owner's only, like
  // the picture copies: the file holds what the person is about to run.
  // Here writeTextFile writes it; a second try covers the widget removing the earlier file
  // between the read and the write. Another machine's is one command there (HANDOFF_THERE).
  async write(access, folder, file, text) {
    if (access.remote) {
      const answer = await access.run("sh", ["-c", HANDOFF_THERE, "sh", folder, file, text]);
      return answer.code === 0 ? true : answer;
    }
    const made = await access.run("sh", ["-c", 'umask 077; mkdir -p "$1"', "sh", folder]).catch(() => null);
    if (made?.code !== 0) return null;
    for (let tries = 0; tries < 2; tries++) {
      try {
        await writeTextFile(file, text, await access.read(file));
        return true;
      } catch {}
    }
    return null;
  }
}
