// Side viewer: shows one file in a pane beside the conversation. open.sh opens it with
// `pane.split {direction: "right", mod: "side-viewer", props: {file}}`.
// The decisions (what a file's text becomes, the header's label) live in document.js.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { props, readTextFile, home, theme } from "herdr";
import { contentOf, labelOf, noticeFor } from "./document.js";
// Code view, image view and the checks before reading a file.
import * as fs from "fs/promises";
import { image } from "gpui-kit";
import { Editor, EditorState } from "gpui-base";
import { exec, appHome, settings } from "herdr";
import { viewOf, blockerOf, readProbe, PROBE } from "./views.js";
import { kindOf, copyName, sizeOf, fitted, staleCopies, FOLDER, COPY, LIST } from "./image-copies.js";

// Space around an image, on each side.
const IMAGE_PADDING = 20;

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
      this.setContent(contentOf(null, null, null));
      cx.notify();
      return;
    }
    this.setContent({ state: "loading" });
    cx.notify();
    cx.spawn(async (cx) => {
      let content;
      try {
        content = await this.read(file);
      } catch {
        content = { state: "unreadable" };
      }
      if (generation !== this.generation) return;
      // Editor state cannot be created while drawing, so it is made here, once the text is in.
      if (content.state === "code") content.editor = this.makeEditor(content);
      this.setContent(content);
      cx.notify();
    });
  }

  // Replacing this.content. The code view's editor state is released when it goes.
  setContent(content) {
    this.content?.editor?.release();
    this.content = content;
  }

  // What to show for a file: the view's content, or the state of a notice. The size is
  // asked first, so a file too large to draw is never read.
  async read(file) {
    const found = viewOf(file, await this.handedOver());
    if (!found) return { state: "unsupported" };
    const probe = readProbe((await exec("sh", ["-c", PROBE, "sh", file])).stdout);
    const blocker = blockerOf(found, probe);
    if (blocker) return { state: blocker };
    if (found.view === "image") return this.readImage(file, probe);
    return contentOf(file, await readTextFile(file), found);
  }

  // The handed-over extensions by view. The installed mod's own list is the one read,
  // because a mod cannot import JSON or ask where its files are.
  async handedOver() {
    if (!this.groups) {
      try {
        this.groups = JSON.parse(await readTextFile(`${appHome()}/mods/side-viewer/extensions.json`));
      } catch {
        this.groups = null;
      }
    }
    return this.groups;
  }

  // An image is drawn from a copy in the data folder. Only a file whose bytes are an
  // image's is copied, so nothing else can be pulled into the app home through here.
  async readImage(file, probe) {
    const kind = kindOf(file, probe.head);
    if (!kind) return { state: "unsupported" };
    const path = `${FOLDER}/${copyName(file, probe, kind)}`;
    const copied = await exec("sh", ["-c", COPY, "sh", file, `${appHome()}/${path}`]);
    if (copied.code !== 0) return { state: "unreadable" };
    let size = null;
    try {
      size = sizeOf(await fs.readFile(`${appHome()}/${path}`));
    } catch {}
    this.sweep().catch(() => null);
    return { state: "image", path, size };
  }

  // Deleting copies not shown for 30 days. Once per viewer is enough.
  async sweep() {
    if (this.swept) return;
    this.swept = true;
    const folder = `${appHome()}/${FOLDER}`;
    const listing = await exec("sh", ["-c", LIST, "sh", folder]);
    const stale = staleCopies(listing.stdout, Math.floor(Date.now() / 1000));
    if (stale.length) await exec("rm", ["-f", ...stale.map((name) => `${folder}/${name}`)]);
  }

  // Read-only editor state for the code view. A language of null, or one the editor does
  // not know, draws as plain text.
  makeEditor({ text, language }) {
    const t = theme(), font = settings()?.font_family;
    return EditorState.new({
      value: text, readonly: true, soft_wrap: false,
      ...(language ? { language } : {}),
      ...(typeof font === "string" && font ? { font_family: font } : {}),
      syntax: {
        keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3,
        number: t.ansi1, constant: t.ansi6, boolean: t.ansi1, operator: t.muted, punctuation: t.muted,
      },
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
    if (content.state === "code") return this.renderCode(content, t);
    if (content.state === "image") return this.renderImage(content, t);
    return this.renderNotice(t, content.state);
  }

  // The reason shown in place of content that cannot be drawn.
  renderNotice(t, state) {
    return div().flex_1().min_h(0).p(20).text_size(13).text_color(t.dim).child(noticeFor(state) ?? "");
  }

  renderCode(content, _t) {
    return div().flex_1().min_h(0).overflow_hidden().child(Editor.new(content.editor).size_full());
  }

  // The image at its own size, shrunk to the viewer's width. The width comes from the
  // size report, so nothing is drawn until the first one arrives.
  renderImage(content, _t) {
    const known = this.room > 0;
    const { width, height } = fitted(content.size, (this.room ?? 0) - 2 * IMAGE_PADDING);
    return div().id("side-viewer-image").flex_1().min_h(0).overflow_hidden()
      .on_size_change((size, cx) => {
        if (size.width === this.room) return;
        this.room = size.width;
        cx.notify();
      })
      .child(div().id("side-viewer-image-scroll").size_full().overflow_y_scrollbar()
        .when(known, (e) => e.child(h_flex().w_full().justify_center().p(IMAGE_PADDING)
          .child(image(content.path).w(width).h(height).flex_none()))));
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
