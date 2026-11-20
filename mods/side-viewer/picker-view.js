// The path picker: the popup cmd-o (`mod.open:side-viewer`, mod.json "overlay") opens over the
// window. main.js makes a copy that knows it is the popup (props().overlay) into one of these.
// It reads the focused conversation's terminal, lists the files named there that its machine
// has (path-picker.js decides which), and hands the pick to main.js's openPicked, which closes
// the popup. Esc and a click beside the card close it without opening anything.
// Keys follow Herdr's own picker mod: the filter input holds the keyboard, Enter is its
// submit, and ↑↓ and Esc are heard on the root.
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, ScrollHandle } from "gpui-base";
import { hc, focused, panes, spaces, machines, readTextFile, appHome, closeOverlay, props, settings, shared } from "herdr";
import { conversationOf, pathCandidates, existingPaths, filterPaths, readFailureOf, pickerFailureOf, listHeightOf, pickerWidthOf, ROW, CARD_PAD, CARD_GAP, INPUT_HEIGHT } from "./path-picker.js";
import { machineOf, spaceValue } from "./machine.js";
import { CONVERSATIONS_KEY } from "./sent-conversation.js";
import { accessOf } from "./file-access.js";
import { unavailable } from "./remote-results.js";
import { wordsOf } from "./i18n.js";

// Room above the card, logical px: where Herdr's own picker popup sits below the window's top.
const CARD_TOP = 40;

export class PathPicker {
  // open({ file, conversation, space }, cx): main.js's openPicked. tr: the viewer's
  // translator when the popup opens, for the filter's placeholder.
  constructor({ open, tr }, cx) {
    this.open = open;
    // finding | listed | none | elsewhere | unreachable | windows | failed | opening
    this.state = "finding";
    this.paths = [];
    this.at = 0;
    this.reason = "";
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.input = InputState.new({ placeholder: wordsOf(tr)("picker.filter") });
    this.input.on("change", (_e, cx) => {
      this.at = 0;
      this.scroll.scroll_to_item(0);
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.pick(this.shown()[this.at], cx));
    this.input.focus();
    // The popup may take the keyboard a moment after it opens, as Herdr's picker finds.
    cx.timer.after(600, () => this.input.focus());
    this.find(cx);
  }

  // The conversation is the one focused when the popup opens: a click on a row moves no
  // focus away from it first. A focused viewer stands for the conversation that last sent its
  // tab a file (sent-conversation.js).
  find(cx) {
    const here = focused();
    const conversation = conversationOf({ focused: here, panes: panes(), conversations: shared(CONVERSATIONS_KEY) });
    if (!conversation) {
      this.state = "elsewhere";
      return;
    }
    this.conversation = conversation;
    this.space = spaceValue(here.space);
    const { machine } = machineOf({ space: this.space }, spaces());
    this.machine = machine;
    if (machine && unavailable(machines(), machine)) {
      this.state = "unreachable";
      return;
    }
    cx.spawn(async (cx) => {
      try {
        this.paths = await this.existing();
        this.state = this.paths.length ? "listed" : "none";
      } catch (error) {
        ({ state: this.state, reason: this.reason } = pickerFailureOf(error));
      }
      cx.notify();
    });
  }

  // The machine's home comes first: a Windows machine already fails there, where `sh` cannot
  // start, before its terminal is read for paths it could not check.
  async existing() {
    const access = accessOf(this.machine);
    const home = await access.home();
    const read = await hc(["read", this.conversation.terminal, "--lines", "1000"]);
    if (read.code !== 0) throw readFailureOf(read);
    const groups = JSON.parse(await readTextFile(`${appHome()}/mods/side-viewer/extensions.json`));
    const candidates = pathCandidates({ text: read.stdout, cwd: this.conversation.cwd, home, groups });
    const found = await access.exists(candidates);
    return existingPaths(candidates, found.join("\n"));
  }

  shown() {
    return this.state === "listed" ? filterPaths(this.paths, this.input.value()) : [];
  }

  pick(path, cx) {
    if (!path || this.state !== "listed") return;
    this.state = "opening";
    this.open({ file: path, conversation: this.conversation.pane, space: this.space }, cx);
    cx.notify();
  }

  close() {
    closeOverlay(props().overlay);
  }

  move(by, cx) {
    const count = this.shown().length;
    if (!count) return;
    this.at = (this.at + by + count) % count;
    this.scroll.scroll_to_item(this.at);
    cx.notify();
  }

  // The status line in place of the list, or null when the list shows.
  statusLine(shown, tr) {
    const words = wordsOf(tr);
    if (this.state === "finding") return words("picker.finding");
    if (this.state === "none") return words("picker.none");
    if (this.state === "elsewhere") return words("picker.elsewhere");
    if (this.state === "unreachable") return words("body.unreachable", { machine: this.machine });
    if (this.state === "windows") return words("body.windows");
    if (this.state === "failed") return words("picker.failed", { reason: this.reason });
    if (this.state === "listed" && !shown.length) return words("picker.noMatch");
    return null;
  }

  renderRow(t, path, i) {
    const cut = path.lastIndexOf("/");
    const name = path.slice(cut + 1);
    const folder = path.slice(0, cut) || "/";
    return h_flex().id(`svp-row-${i}`).flex_none().h(ROW).mx(4).px(10).gap(10).items_center().rounded(7)
      .cursor_pointer()
      .when(i === this.at, (el) => el.bg(t.hover))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.pick(path, cx))
      .child(div().flex_none().max_w(280).truncate().text_color(t.foreground).child(name))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(folder));
  }

  // The popup covers the whole window with no frame of Herdr's (mod.json "overlay"), so a
  // card no wider than the window fits in it. The clear backdrop around the card closes the
  // picker on a click, as a click beside a framed popup would; a click on the card stays.
  // The window's size is read on each render: a picker left open while the window is resized
  // keeps its card until it is opened again.
  renderPicker(t, tr) {
    const shown = this.shown();
    this.at = Math.max(0, Math.min(this.at, shown.length - 1));
    const status = this.statusLine(shown, tr);
    const viewport = globalThis.window?.viewport_size?.();
    const zoom = Number(settings()?.zoom) || 1;
    return v_flex().id("side-viewer-picker").track_focus(this.handle).size_full().items_center().pt(CARD_TOP)
      .on_click(() => this.close())
      .on_key_down((e, cx) => {
        if (e.key === "escape") return this.close();
        if (e.key === "down") this.move(1, cx);
        else if (e.key === "up") this.move(-1, cx);
        else return;
        cx.stop_propagation();
      })
      .child(this.renderCard(t, shown, status, viewport, zoom));
  }

  // The card draws the frame Herdr draws around its own picker popup.
  renderCard(t, shown, status, viewport, zoom) {
    return v_flex().id("svp-card").flex_none().w(pickerWidthOf(viewport?.width, zoom)).min_h(0).p(CARD_PAD).gap(CARD_GAP)
      .bg(t.popover).rounded(12).border_1().border_color(t.border).shadow_lg()
      .text_size(13).text_color(t.foreground)
      .on_click((_e, cx) => cx.stop_propagation())
      .child(
        h_flex().h(INPUT_HEIGHT).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))
          .child(div().id("svp-esc").flex_none().px(6).py(2).rounded(5).text_size(11).text_color(t.dim).cursor_pointer()
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click(() => this.close())
            .child("Esc")),
      )
      .child(status === null
        ? v_flex().id("svp-list").flex_none().h(listHeightOf(shown.length, viewport?.height, zoom)).overflow_y_scrollbar().track_scroll(this.scroll)
          .children(shown.map((path, i) => this.renderRow(t, path, i)))
        : div().flex_none().px(10).pb(6).text_color(t.muted).child(status));
  }
}
