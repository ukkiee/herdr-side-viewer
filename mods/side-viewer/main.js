// Side viewer: shows one file in a pane beside the conversation. open.sh opens it with
// `pane.split {direction: "right", mod: "side-viewer", props: {file}}`.
// This file talks to Herdr and draws. The decisions live in modules without Herdr imports,
// each with its own tests: document.js, views.js, image-copies.js, history.js, request.js,
// links.js and original.js.
import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, TextView, Editor, EditorState } from "gpui-base";
import { props, readTextFile, writeTextFile, nextCommand, home, appHome, theme, settings, exec, watchFolder } from "herdr";
// Herdr's built-in module: an image's size is read from its bytes, which readTextFile cannot give.
import * as fs from "fs/promises";
import { contentOf, labelOf, noticeFor } from "./document.js";
import { viewOf, blockerOf, readProbe, PROBE, showsLoading, refreshOf, waitsForRead, settledProbe, sameProbe } from "./views.js";
import { kindOf, copyName, sizeOf, fitted, staleCopies, FOLDER, COPY, LIST } from "./image-copies.js";
import { start, open, back, canGoBack } from "./history.js";
import { takeRequest } from "./request.js";
import { watchedFolder, linkAction, rawMarkdown, touches } from "./links.js";
import { openOriginalCommands } from "./original.js";

// Space around an image, on each side.
const IMAGE_PADDING = 20;

// The folder watch can miss a change, so the shown file is also read again this often.
const RECHECK_MS = 15000;

export default class SideViewer extends View {
  init(given, cx) {
    this.file = null;
    this.visits = start();
    // The id of the last request this copy took from open.sh.
    this.answered = null;
    this.content = { state: "none" };
    // Counts content replacements: the markdown element needs a new id to draw new text.
    this.generation = 0;
    // Counts reads, so one that finishes late cannot replace a newer one.
    this.reads = 0;
    // The file the last load was for: only a newly opened file shows "loading".
    this.loadedFile = null;
    // The file being read, and whether it has to be read once more when that read ends.
    this.reading = null;
    this.again = false;
    // The size and time of the shown text file at its last read (views.js, settledProbe).
    this.probed = null;
    // extensions.json, once it has been read.
    this.groups = null;
    // Whether this copy has already deleted the old image copies.
    this.swept = false;
    // Whether the markdown view shows the source.
    this.raw = false;
    this.rechecking = false;
    // The folder being watched, and a count that stops the loop of an earlier folder.
    this.watched = null;
    this.watchTurn = 0;
    // The body's width, from its size report. Null until the first one.
    this.room = null;
    this.show(given?.file ?? props()?.file, cx);
    this.watch(cx);
    this.listen(cx);
  }

  // Taking files from open.sh while this copy is showing: `side-viewer.show` wakes it, and
  // the request waits in the data folder (request.js).
  listen(cx) {
    const files = {
      read: (path) => readTextFile(path),
      create: (path, text) => writeTextFile(path, text, null),
    };
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command !== "show") continue;
        const folder = `${appHome()}/data/side-viewer`;
        const request = await takeRequest(files, { folder, answered: this.answered, now: Date.now() });
        if (!request) continue;
        this.answered = request.id;
        this.show(request.file, cx);
        this.watch(cx);
      }
    });
  }

  // Changing the shown file. Every way of opening a file ends here, and it is the only place
  // that adds to the visit history.
  show(file, cx) {
    this.visits = open(this.visits, file);
    // Another file starts in the rendered view.
    if (this.visits.file !== this.file) this.raw = false;
    this.file = this.visits.file;
    this.load(cx);
  }

  // Returning to the file before this one. Not through show(), which would add the file
  // being left to the history again.
  goBack(cx) {
    if (!canGoBack(this.visits)) return;
    this.visits = back(this.visits);
    this.raw = false;
    this.file = this.visits.file;
    this.load(cx);
    this.watch(cx);
  }

  // Reading the shown file into this.content.
  load(cx) {
    const file = this.file;
    const opened = showsLoading(this.loadedFile, file);
    this.loadedFile = file;
    if (!file) {
      // A read under way is left behind.
      this.reads++;
      this.reading = null;
      if (this.content.state !== "none") this.setContent(contentOf(null, null, null), cx);
      return;
    }
    // The watch reads the shown file again every few seconds: only a newly opened file
    // shows "loading", and a read that finds nothing new leaves the screen alone.
    if (opened) this.setContent({ state: "loading" }, cx);
    // The same file is being read: let that read finish, then read once more.
    if (waitsForRead(this.reading, file)) {
      this.again = true;
      return;
    }
    const turn = ++this.reads;
    this.reading = file;
    this.again = false;
    cx.spawn(async (cx) => {
      let result;
      try {
        result = await this.read(file, opened ? null : this.probed);
      } catch {
        result = { content: { state: "unreadable" }, probe: null };
      }
      // Another file was opened meanwhile, and its own read is under way.
      if (turn !== this.reads) return;
      this.reading = null;
      this.probed = result.probe;
      this.apply(result.content, cx);
      if (this.again) this.load(cx);
    });
  }

  // Puts a finished read on screen. Null means the file is as it was at the last read.
  apply(content, cx) {
    const shown = this.content;
    // Unchanged code is compared all the same, so its colors follow a change of theme.
    const next = content ?? (shown.state === "code" ? { state: "code", text: shown.text, language: shown.language } : null);
    if (!next) return;
    const syntax = this.syntax();
    if (next.state === "code") next.theme = Object.values(syntax).join(" ");
    const step = refreshOf(shown, next);
    if (step === "keep") return;
    if (step === "retext") {
      shown.text = next.text;
      shown.editor.set_value(next.text);
      cx.notify();
      return;
    }
    // Editor state cannot be created while drawing, so it is made here, once the text is in.
    if (next.state === "code") next.editor = this.makeEditor(next, syntax);
    this.setContent(next, cx);
  }

  // Replacing this.content. The code view's editor state is released when it goes, and the
  // generation moves on so the markdown element draws the new text.
  setContent(content, cx) {
    this.content?.editor?.release();
    this.content = content;
    this.generation++;
    cx.notify();
  }

  // What to show for a file, as { content, probe }: the view's content or the state of a
  // notice, and what to remember of the file's size and time for the next read. The size is
  // asked first, so a file too large to draw is never read. `known` is what the last read
  // remembered: text that still has that size and time is not read again (content: null).
  async read(file, known) {
    const found = viewOf(file, await this.listed());
    if (!found) return { content: { state: "unsupported" }, probe: null };
    const probe = readProbe((await exec("sh", ["-c", PROBE, "sh", file])).stdout);
    // An image goes on: its bytes are not read again anyway, and showing it has to touch
    // its copy, or the 30-day cleanup would take it.
    if (found.view === "image") {
      const blocker = blockerOf(found, probe);
      return { content: blocker ? { state: blocker } : await this.readImage(file, probe), probe: null };
    }
    if (sameProbe(known, file, probe)) return { content: null, probe: known };
    const remembered = settledProbe(file, probe, Math.floor(Date.now() / 1000));
    const blocker = blockerOf(found, probe);
    if (blocker) return { content: { state: blocker }, probe: remembered };
    return { content: contentOf(file, await readTextFile(file), found), probe: remembered };
  }

  // The listed extensions by group (extensions.json). The installed mod's own list is the
  // one read, because a mod cannot import JSON or ask where its files are.
  async listed() {
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
    // The same copy as the one on screen: its size is known, so the file is not read again.
    const shown = this.content.state === "image" && this.content.path === path ? this.content : null;
    let size = shown?.size ?? null;
    if (!shown) {
      try {
        size = sizeOf(await fs.readFile(`${appHome()}/${path}`));
      } catch {}
    }
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

  // The code view's colors under the theme of the moment.
  syntax() {
    const t = theme();
    return {
      keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3,
      number: t.ansi1, constant: t.ansi6, boolean: t.ansi1, operator: t.muted, punctuation: t.muted,
    };
  }

  // Read-only editor state for the code view. A language of null, or one the editor does
  // not know, draws as plain text.
  makeEditor({ text, language }, syntax) {
    const font = settings()?.font_family;
    return EditorState.new({
      value: text, readonly: true, soft_wrap: false,
      ...(language ? { language } : {}),
      ...(typeof font === "string" && font ? { font_family: font } : {}),
      syntax,
    });
  }

  // Back, drawn only while there is a file to go back to.
  renderBack(t) {
    return div().id("side-viewer-back").flex_none().w(24).h(24).rounded(4)
      .flex().items_center().justify_center().text_size(14).text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click((_event, cx) => this.goBack(cx))
      .child("←");
  }

  // The header: back, file name and folder.
  renderHeader(t) {
    const label = this.file ? labelOf(this.file, home()) : { name: "Side Viewer", folder: "" };
    return h_flex().h(40).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
      .when(canGoBack(this.visits), (el) => el.child(this.renderBack(t)))
      .child(div().min_w(0).truncate().text_size(13).font_semibold().child(label.name))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(label.folder))
      // The buttons never shrink: a narrow viewer cuts the name and the folder instead.
      // The switch belongs to a drawn markdown document, not to a notice about one.
      .when(this.content.state === "markdown", (el) => el.child(this.raw
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
    const step = linkAction(url, this.file, home(), this.groups);
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
  // A file in the home folder or the root is not watched, only rechecked (links.js).
  watch(cx) {
    if (!this.rechecking) {
      this.rechecking = true;
      cx.timer.every(RECHECK_MS, (cx) => {
        this.watch(cx);
        if (this.file) this.load(cx);
      });
    }
    const folder = watchedFolder(this.file, home());
    if (folder === this.watched) return;
    this.watched = folder;
    // A loop for an earlier folder sees a newer turn and stops.
    const turn = ++this.watchTurn;
    if (!folder) return;
    cx.spawn(async (cx) => {
      while (turn === this.watchTurn) {
        let paths;
        try {
          paths = await watchFolder(folder);
        } catch {
          // The folder cannot be watched (it may be gone). Forget it so the recheck tries again.
          if (turn === this.watchTurn) this.watched = null;
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
