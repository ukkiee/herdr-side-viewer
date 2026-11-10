// Side viewer: shows one file in a pane beside the conversation. open.sh opens it with
// `pane.split {direction: "right", mod: "side-viewer", props: {file}}`.
// The decisions (what a file's text becomes, the header's label) live in document.js.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { props, readTextFile, home, theme } from "herdr";
import { contentOf, labelOf, noticeFor } from "./document.js";

export default class SideViewer extends View {
  init(given, cx) {
    this.file = null;
    this.content = { state: "none" };
    // Counts loads: an older read that finishes late must not replace a newer one, and the
    // markdown element needs a new id to draw new text.
    this.generation = 0;
    this.show(given?.file ?? props()?.file, cx);
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
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(label.folder));
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
          .child(TextView.markdown(`side-viewer-markdown-${this.generation}`, text).selectable(true))));
  }

  render(_cx) {
    const t = theme();
    return v_flex().id("side-viewer").size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .child(this.renderHeader(t))
      .child(this.renderBody(t));
  }
}
