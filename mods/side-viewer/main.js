// Side viewer: shows one file in a pane beside the conversation. open.sh opens it with
// `pane.split {direction: "right", mod: "side-viewer", props: {file}}`.
// The decisions (what a file's text becomes, the header's label) live in document.js.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { props, readTextFile, home, theme } from "herdr";
import { contentOf, labelOf, noticeFor } from "./document.js";
// Header buttons, the file watch and markdown links (links.js, original.js).
import { svg } from "gpui-kit";
import { exec, appHome, watchFolder } from "herdr";
import { folderOf, isMarkdown, linkAction, rawMarkdown, touches } from "./links.js";
import { openOriginalCommands } from "./original.js";

// The folder watch can miss a change, so the shown file is also read again this often.
const RECHECK_MS = 15000;

export default class SideViewer extends View {
  init(given, cx) {
    this.file = null;
    this.content = { state: "none" };
    // Counts loads: an older read that finishes late must not replace a newer one, and the
    // markdown element needs a new id to draw new text.
    this.generation = 0;
    this.show(given?.file ?? props()?.file, cx);
    this.watch(cx);
  }

  // Changing the shown file. Every way of opening a file ends here.
  show(file, cx) {
    this.file = typeof file === "string" && file ? file : null;
    this.load(cx);
  }

  // Reading the shown file into this.content.
  load(cx) {
    const file = this.file;
    const generation = ++this.generation;
    if (!file) {
      this.content = contentOf(null, null);
      cx.notify();
      return;
    }
    this.content = { state: "loading" };
    cx.notify();
    cx.spawn(async (cx) => {
      let content;
      try {
        content = contentOf(file, await readTextFile(file));
      } catch {
        content = { state: "unreadable" };
      }
      if (generation !== this.generation) return;
      this.content = content;
      cx.notify();
    });
  }

  // The header: file name and folder.
  renderHeader(t) {
    const label = this.file ? labelOf(this.file, home()) : { name: "Side Viewer", folder: "" };
    return h_flex().h(40).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().min_w(0).truncate().text_size(13).font_semibold().child(label.name))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(label.folder))
      // The buttons never shrink: a narrow viewer cuts the name and the folder instead.
      .when(isMarkdown(this.file), (el) => el.child(this.raw
        ? this.renderButton(t, "side-viewer-rendered", "rendered", "렌더링 보기", (_event, cx) => this.toggleRaw(cx))
        : this.renderButton(t, "side-viewer-source", "source", "원문 보기", (_event, cx) => this.toggleRaw(cx))))
      .when(Boolean(this.file), (el) => el.child(this.renderActions(t)));
  }

  // "Open in the original app" and "Show in Finder", for the header and for a notice screen.
  renderActions(t) {
    return h_flex().flex_none().gap(2)
      .child(this.renderButton(t, "side-viewer-original", "original", "원래 앱으로 열기", (_event, cx) => this.openOriginal(cx)))
      .child(this.renderButton(t, "side-viewer-finder", "finder", "Finder에서 보기", (_event, cx) => this.revealInFinder(cx)));
  }

  renderButton(t, id, icon, label, onClick) {
    return h_flex().id(id).flex_none().size(24).items_center().justify_center().rounded(4)
      .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(label).on_click(onClick)
      .child(svg(`mods/side-viewer/${icon}.svg`).size(14));
  }

  toggleRaw(cx) {
    this.raw = !this.raw;
    cx.notify();
  }

  // Names the app with `open -b`, so the file cannot come back through the router.
  openOriginal(cx) {
    const file = this.file;
    if (!file) return;
    cx.spawn(async () => {
      const read = (path) => readTextFile(path).catch(() => null);
      const record = await read(`${appHome()}/data/side-viewer/original-apps.tsv`);
      const extensions = await read(`${appHome()}/mods/side-viewer/extensions.json`);
      for (const [command, args] of openOriginalCommands(file, record, extensions)) {
        const result = await exec(command, args).catch(() => null);
        if (result?.code === 0) return;
      }
    });
  }

  revealInFinder(_cx) {
    if (this.file) exec("open", ["-R", this.file]).catch(() => null);
  }

  // A click on a link in the markdown view. links.js decides; a local file that is not
  // markdown is only shown in Finder, never opened.
  followLink(url, cx) {
    const step = linkAction(url, this.file, home());
    if (step.action === "show") {
      this.show(step.file, cx);
      this.watch(cx);
    } else if (step.action === "system") {
      exec("open", [step.url]).catch(() => null);
    } else if (step.action === "reveal") {
      exec("open", ["-R", step.file]).catch(() => null);
    }
  }

  // Keeps the folder watch on the shown file's folder, and starts the slow recheck once.
  // Call it again whenever this.file may have changed: it does nothing if the folder is the same.
  watch(cx) {
    if (!this.rechecking) {
      this.rechecking = true;
      cx.timer.every(RECHECK_MS, (cx) => {
        this.watch(cx);
        if (this.file) this.load(cx);
      });
    }
    const folder = folderOf(this.file);
    if (folder === this.watched) return;
    this.watched = folder;
    // A loop for an earlier folder sees a newer turn and stops.
    const turn = (this.watchTurn = (this.watchTurn ?? 0) + 1);
    if (!folder) return;
    cx.spawn(async (cx) => {
      while (turn === this.watchTurn) {
        let paths;
        try {
          paths = await watchFolder(folder);
        } catch {
          // The folder cannot be watched (it may be gone). Forget it so the recheck tries again.
          if (turn === this.watchTurn) this.watched = undefined;
          return;
        }
        if (turn !== this.watchTurn) return;
        if (touches(paths, this.file)) this.load(cx);
      }
    });
  }

  // The body, by what this.content holds.
  renderBody(t) {
    const content = this.content;
    if (content.state === "markdown") return this.renderMarkdown(content.text, t);
    return div().flex_1().min_h(0).p(20).text_size(13).text_color(t.dim).child(noticeFor(content.state) ?? "");
  }

  renderMarkdown(text, _t) {
    return div().id("side-viewer-scroll").flex_1().min_h(0).overflow_y_scrollbar()
      .child(h_flex().w_full().justify_center()
        .child(v_flex().flex_1().min_w(0).max_w(860).overflow_hidden().px(28).py(24).text_size(14)
          // The source is drawn by the same element, fenced as one code block.
          .child(TextView.markdown(`side-viewer-markdown-${this.generation}${this.raw ? "-source" : ""}`, this.raw ? rawMarkdown(text) : text)
            .selectable(true).on_link_click((url, cx) => this.followLink(url, cx)))));
  }

  render(_cx) {
    const t = theme();
    return v_flex().id("side-viewer").size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .child(this.renderHeader(t))
      .child(this.renderBody(t));
  }
}
