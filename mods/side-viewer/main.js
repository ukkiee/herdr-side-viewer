// Side viewer: shows one file in a pane beside the conversation. open.sh opens it with
// `pane.split {direction: "right", mod: "side-viewer", props: {file, space?}}`.
// This file holds the viewer's state and most of its talk with Herdr: reading, saving,
// taking requests from open.sh, watching and viewer tabs. The shown file is read on the
// machine of the viewer's space (machine.js) through file-access.js. Two parts that keep their
// own state and call Herdr themselves sit beside it: shell-pane.js (a shell code block's `>_`)
// and markdown-image-loader.js (the document's image copies). Drawing is in header.js,
// code-card.js and the views' modules (markdown-view.js, code-view.js,
// image-view.js, notice-view.js), which get what to show and callbacks from here.
// The decisions live in modules without Herdr imports, each with its own tests: document.js,
// views.js, image-copies.js, svg-preview.js, history.js, request.js, links.js, original.js,
// edit-state.js, viewer-tab.js, checkbox.js, markdown-blocks.js, code-blocks.js,
// markdown-images.js, terminal-insert.js, machine.js and remote-results.js.
import { View } from "gpui-kit";
import { v_flex, EditorState } from "gpui-base";
import { props, readTextFile, writeTextFile, nextCommand, home, appHome, theme, settings, exec, watchFolder, run, spaces, focused, panes, notify, shared, setShared, machines } from "herdr";
// Herdr's built-in module: an image's size is read from its bytes, which readTextFile cannot give.
import * as fs from "fs/promises";
import { contentOf, failedContentOf } from "./document.js";
import { failureOf, unavailable } from "./remote-results.js";
import { viewOf, blockerOf, readProbe, PROBE, showsLoading, refreshOf, waitsForRead, settledProbe, sameProbe, editable, editorOf, imageState, editedContentOf, blankSvg, sourceOnlySvg, rendersEmpty } from "./views.js";
import { noEdits, typed, unsaved, shownText, saveOf, saved, diskRead, statusOf, discarded, overwritten, startSave, refusalOf, saveFailed, takeEdit, putEdit, checkboxToggled, remoteSaveFailed } from "./edit-state.js";
import { handoffFile, handoffId, handoffText, handoffFrom, tabProps, viewerTabOf, tabName, placeAfter, newTabOf, ownTab, unplacedNotice } from "./viewer-tab.js";
import { toggleCheckbox } from "./checkbox.js";
import { kindOf, copyName, sizeOf, staleCopies, olderCopies, FOLDER, LIST } from "./image-copies.js";
import { PREVIEW_FOLDER, previewName, pictureOf } from "./svg-preview.js";
import { start, open, back, canGoBack } from "./history.js";
import { takeRequest } from "./request.js";
import { watchedFolder, linkAction, touches, unshownNotice } from "./links.js";
import { openOriginalCommands } from "./original.js";
import { renderHeader } from "./header.js";
import { renderMarkdown, markdownCache } from "./markdown-view.js";
import { CodeCards } from "./code-card.js";
import { ShellPane } from "./shell-pane.js";
import { renderCode } from "./code-view.js";
import { renderImage } from "./image-view.js";
import { renderNotice } from "./notice-view.js";
import { MarkdownImages } from "./markdown-image-loader.js";
import { LANGS, translator, systemLang, askAgainAfter } from "./i18n.js";
import { machineOf } from "./machine.js";
import { accessOf } from "./file-access.js";
import { closeOverlay } from "herdr";
import { REQUEST_FILE, answerFile } from "./request.js";
import { openTargetOf } from "./path-picker.js";
import { PathPicker } from "./picker-view.js";

// Where the system's language is remembered in Herdr's shared state ("ko" | "en").
const LANG_KEY = "side-viewer.lang";

// The folder watch can miss a change, so the shown file is also read again this often.
const RECHECK_MS = 15000;
// Another machine's file has no folder watch: its checksum is asked for this often, and a
// check that takes longer than the timeout counts as an answer that changed.
const REMOTE_CHECK_MS = 3000;
const REMOTE_CHECK_TIMEOUT_MS = 10000;
// How long a new viewer tab is looked for in spaces(), and how often.
const PLACE_WAIT_MS = 3000;
const PLACE_STEP_MS = 50;

export default class SideViewer extends View {
  init(given, cx) {
    // The copy cmd-o opens as a popup is the path picker (picker-view.js), not a viewer: it
    // takes no requests, since it would answer them itself, and reads no file.
    if (props()?.overlay ?? given?.overlay) {
      this.picker = new PathPicker({ open: (pick, cx) => this.openPicked(pick, cx), tr: this.words() }, cx);
      this.askLang(cx, 0);
      return;
    }
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
    // Whether the markdown or svg view shows the source.
    this.raw = false;
    // The last preview of an edited svg (svg-preview.js), and the text being written as one.
    this.preview = null;
    this.previewing = null;
    this.rechecking = false;
    // The folder being watched, and a count that stops the loop of an earlier folder.
    this.watched = null;
    this.watchTurn = 0;
    // The remote check (checkRemote): whether its timer runs, whether a check is under way,
    // and the last mark it took, as { file, access, mark }.
    this.checking = false;
    this.marking = false;
    this.marked = null;
    // The body's width, from its size report. Null until the first one.
    this.room = null;
    // Unsaved edits by file (edit-state.js). They live as long as this copy does.
    this.edits = noEdits();
    // Whether a save is under way: a second cmd+S waits for it instead of writing twice.
    this.saving = false;
    // Saves asked for during a save, as file -> whether it is the conflict's overwrite, taken
    // when it ends (takeSaves).
    this.saves = new Map();
    // Checkbox clicks that came during a save, as { file, line }, taken when it ends.
    this.clicks = [];
    // The markdown view's code block cards and their editor state (code-card.js).
    this.codeCards = new CodeCards();
    // The markdown view's parse of the text it last drew (markdown-view.js).
    this.markdownCache = markdownCache();
    // The shell pane a shell code block's `>_` puts its command into (shell-pane.js).
    this.shellPane = new ShellPane();
    // The viewer's own keyboard target: cmd+S is heard on the root that tracks it, whether
    // it or the editor inside it holds the keyboard.
    this.focus = cx.focus_handle();
    // Copies of the images inside the shown markdown document (markdown-image-loader.js).
    this.images = new MarkdownImages({ sweep: () => this.sweep(), dropOlder: (path) => this.dropOlder(path), access: () => this.access() });
    // Whether this copy is a viewer tab, a tab whose only pane is it (viewer-tab.js), rather
    // than a viewer beside a conversation. Its props say so, and they never change.
    const tab = viewerTabOf(props()) ?? viewerTabOf(given);
    this.viewerTab = Boolean(tab);
    // The space value its opener gave (machine.js), which never changes. Without one the
    // viewer is on this Mac.
    this.space = props()?.space ?? given?.space ?? null;
    // A viewer tab starts with an empty history, as every new copy does: back only returns
    // to files opened in this tab.
    this.show(given?.file ?? props()?.file, cx);
    if (tab?.handoff) this.receive(tab.handoff, cx);
    this.watch(cx);
    this.listen(cx);
    this.askLang(cx, 0);
  }

  // A new viewer tab taking the unsaved edits its opener handed over (viewer-tab.js). The
  // file's read may already be on screen, so the editor is brought up to the edits, and the
  // file is read again to compare the disk with the text the edits started from.
  receive(id, cx) {
    const path = `${appHome()}/data/side-viewer/${handoffFile(id)}`;
    cx.spawn(async (cx) => {
      const text = await readTextFile(path).catch(() => null);
      exec("rm", ["-f", path]).catch(() => null);
      const handoff = handoffFrom(text, { id, now: Date.now() });
      if (!handoff?.edit) return;
      this.edits = putEdit(this.edits, handoff.file, handoff.edit);
      const content = this.content;
      if (content.file === handoff.file && content.editor) {
        const shown = shownText(this.edits, content.file, content.text);
        if (content.editor.value() !== shown) content.editor.set_value(shown);
      }
      this.ensurePreview(cx);
      this.generation++;
      if (content.file === handoff.file) this.renderingFollows(cx);
      this.probed = null;
      this.load(cx);
      cx.notify();
    });
  }

  // "Open in a new tab": a tab whose only pane is a viewer of this file, right after the tab
  // this viewer is in, and shown. The same file opens a new tab every time. Unsaved edits go
  // with it through a handoff file, and this viewer goes back to the disk text; when the
  // handoff cannot be written they stay here and the tab opens on the disk text.
  openTab(cx) {
    const file = this.file;
    if (!file) return;
    // Taken now, while the click is handled: focused() is this viewer's tab.
    const before = spaces();
    const place = placeAfter(before, focused());
    const { edit } = takeEdit(this.edits, file);
    cx.spawn(async (cx) => {
      const folder = `${appHome()}/data/side-viewer`;
      let handoff = null;
      if (edit) {
        const id = handoffId(Date.now(), Math.random());
        try {
          await exec("mkdir", ["-p", folder]);
          await writeTextFile(`${folder}/${handoffFile(id)}`, handoffText({ id, file, edit, now: Date.now() }), null);
          handoff = id;
        } catch {}
      }
      try {
        run("tab.new", {
          name: tabName(file), ...(place ? { space: place.space } : {}),
          mod: "side-viewer", props: tabProps({ file, handoff, space: this.space }),
        });
      } catch {
        if (handoff) exec("rm", ["-f", `${folder}/${handoffFile(handoff)}`]).catch(() => null);
        return;
      }
      if (handoff) this.handedOff(file, cx);
      if (place && !(await this.placeTab(before, place, cx))) notify(unplacedNotice(file, this.words()));
      cx.notify();
    });
  }

  // tab.new returns nothing and puts the tab where Herdr puts new tabs, so the new tab is
  // found by comparing the space's tabs, then moved after this viewer's tab and shown.
  // spaces() may lag the command, so it is asked again for a while. Returns whether the tab
  // was found.
  async placeTab(before, place, cx) {
    for (let waited = 0; waited <= PLACE_WAIT_MS; waited += PLACE_STEP_MS) {
      const id = newTabOf(before, spaces(), place.space);
      if (id) {
        try {
          run("tab.move", { id, index: place.index });
          run("tab.select", { id });
        } catch {}
        return true;
      }
      await cx.sleep(PLACE_STEP_MS);
    }
    return false;
  }

  // The edits of `file` went to a viewer tab: this viewer shows the disk text again.
  handedOff(file, cx) {
    this.edits = takeEdit(this.edits, file).edits;
    const content = this.content;
    if (content.file === file && content.editor && content.editor.value() !== content.text) {
      content.editor.set_value(content.text);
    }
    if (content.state === "markdown") this.generation++;
    if (content.file === file) this.renderingFollows(cx);
    this.probed = null;
    this.load(cx);
  }

  // The markdown rendering's code cards and pictures follow the text now shown. Whatever puts
  // text into the editor with set_value calls this itself: set_value is not seen to report a
  // "change" (edited).
  renderingFollows(cx) {
    const content = this.content;
    if (content.state !== "markdown") return;
    this.prepareCards(content.file, content, cx);
    this.images.prepare(content.file, shownText(this.edits, content.file, content.text), false, cx);
  }

  // A viewer tab's name follows the shown file: after a link, back, and an open request.
  // Not at the start, where tab.new already named it and the shown tab may still be the
  // opener's.
  nameTab() {
    if (!this.viewerTab || !this.file) return;
    const id = ownTab(focused(), panes());
    if (!id) return;
    try {
      run("tab.rename", { id, name: tabName(this.file) });
    } catch {}
  }

  // Taking files from open.sh while this copy is showing: `side-viewer.show` wakes it, and
  // the request waits in the data folder (request.js). Only a request for this viewer's space
  // is taken, since a file on another machine than the space's is not one it can show.
  listen(cx) {
    const files = {
      read: (path) => readTextFile(path),
      create: (path, text) => writeTextFile(path, text, null),
    };
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        // pane.go gave this copy the keyboard (mod.json "focusable"), or a popup over it closed.
        if (command === "focus") {
          this.focus.focus();
          continue;
        }
        if (command !== "show") continue;
        const folder = `${appHome()}/data/side-viewer`;
        const request = await takeRequest(files, { folder, answered: this.answered, now: Date.now(), space: this.space, spaces: spaces() });
        if (!request) continue;
        this.answered = request.id;
        this.show(request.file, cx);
        this.nameTab();
        this.watch(cx);
      }
    });
  }

  // The path picker's pick, opened the way open.sh opens a cmd-clicked file: a side viewer
  // showing in the conversation's tab takes it as a request (request.js) within about 0.4 s,
  // else a new viewer splits off right of the conversation pane. Both carry the space value,
  // so only a viewer of the conversation's space takes the file. The popup closes only once
  // that is settled: a closed copy's tasks are cancelled, and the wait would end with them.
  //   conversation: the conversation's pane id; space: its space value (machine.js)
  openPicked({ file, conversation, space }, cx) {
    const split = () => {
      closeOverlay(props().overlay);
      run("pane.split", { pane: conversation, direction: "right", mod: "side-viewer", props: { file, space } });
    };
    if (openTargetOf({ conversation, panes: panes() }).split) return split();
    cx.spawn(async (cx) => {
      const folder = `${appHome()}/data/side-viewer`;
      const at = Math.floor(Date.now() / 1000);
      const id = `${at}-picker-${Math.random().toString(36).slice(2, 10)}`;
      const answer = `${folder}/${answerFile(id)}`;
      try {
        const request = `${folder}/${REQUEST_FILE}`;
        const before = await readTextFile(request).catch(() => null);
        await writeTextFile(request, `${JSON.stringify({ id, file, at, space })}\n`, before);
        run("side-viewer.show");
        for (let tries = 8; tries > 0; tries--) {
          await cx.sleep(50);
          if ((await readTextFile(answer).catch(() => null)) !== null) {
            closeOverlay(props().overlay);
            return;
          }
        }
        // Taking the answer's name ends the request, so a viewer that wakes now cannot take
        // the file as well as the new pane. A viewer that took it first leaves the name taken.
        await writeTextFile(answer, `${id}\n`, null);
      } catch {
        if ((await readTextFile(answer).catch(() => null)) !== null) {
          closeOverlay(props().overlay);
          return;
        }
      }
      split();
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
    this.nameTab();
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
      } catch (error) {
        // Another machine may refuse because it is out of reach or is a Windows machine,
        // which says so instead of "can't read" (remote-results.js).
        const access = this.access();
        const content = access.remote ? failedContentOf(failureOf(error), access.machine) : { state: "unreadable" };
        result = { content, probe: null };
      }
      // Another file was opened meanwhile, and its own read is under way.
      if (turn !== this.reads) return;
      this.reading = null;
      this.probed = result.probe;
      // A file with unsaved edits is not read again over them: a changed or deleted file
      // shows in the header's status instead (edit-state.js). Only a screen without its editor takes the read,
      // and a notice there gives way to the editor of the edits (views.js, editedContentOf).
      const read = diskRead(this.edits, file, result.text);
      this.edits = read.edits;
      const shown = this.content.file === file && this.content.editor;
      const content = read.step === "keep"
        ? editedContentOf(file, result.content, viewOf(file, this.groups), this.edits[file]?.disk)
        : result.content;
      if (result.content === null || read.step === "show" || !shown) this.apply(file, content, cx);
      else cx.notify();
      if (this.again) this.load(cx);
    });
  }

  // Puts a finished read of `file` on screen. Null means the file is as it was at the last read.
  // `text` stays the disk text; a file with unsaved edits shows those instead (edit-state.js),
  // so a read never drops them.
  apply(file, content, cx) {
    // Before the early returns below: unchanged markdown (null) still needs new cards
    // after a change of theme.
    this.prepareCards(file, content ?? this.content, cx);
    const shown = this.content;
    // Unchanged code is compared all the same, so its colors follow a change of theme.
    const next = content ?? (shown.state === "code" ? { state: "code", text: shown.text, language: shown.language } : null);
    if (!next) return;
    const syntax = this.syntax();
    if (next.state === "code" || next.state === "svg") next.theme = Object.values(syntax).join(" ");
    const step = refreshOf(shown, next);
    if (step === "keep") return;
    if (step === "retext") {
      shown.text = next.text;
      if (next.state === "svg") Object.assign(shown, { path: next.path, size: next.size });
      const text = shownText(this.edits, shown.file, next.text);
      if (shown.editor.value() !== text) shown.editor.set_value(text);
      cx.notify();
      return;
    }
    next.file = file;
    // Editor state cannot be created while drawing, so it is made here, once the text is in.
    const options = editorOf(next.state);
    if (options) next.editor = this.makeEditor(next, syntax, options);
    this.setContent(next, cx);
  }

  // Makes the code cards' editor state for the markdown `content` of `file` shows, with its
  // unsaved edits; any other content leaves no cards. Editor state cannot be made while
  // drawing, so this runs after a read and on an edit.
  prepareCards(file, content, cx) {
    const text = content.state === "markdown" ? shownText(this.edits, file, content.text) : "";
    const font = settings()?.font_family;
    const look = { syntax: this.syntax(), font: typeof font === "string" && font ? font : null };
    if (this.codeCards.prepare(text, look)) cx.notify();
  }

  // Replacing this.content. The code view's editor state is released when it goes, and the
  // generation moves on so the markdown element draws the new text.
  setContent(content, cx) {
    this.content?.editor?.release();
    this.content = content;
    this.generation++;
    cx.notify();
    if (content.state === "markdown") this.images.prepare(content.file, shownText(this.edits, content.file, content.text), true, cx);
    this.ensurePreview(cx);
  }

  // What to show for a file, as { content, probe, text }: the view's content or the state of a
  // notice, what to remember of the file's size and time for the next read, and the text found
  // on disk (null: the file is gone; undefined: not read). The size is asked first, so a file
  // too large to draw is never read. `known` is what the last read remembered: text that still
  // has that size and time is not read again (content: null).
  async read(file, known) {
    const found = viewOf(file, await this.listed());
    if (!found) return { content: { state: "unsupported" }, probe: null };
    const access = this.access();
    if (access.remote && unavailable(machines(), access.machine)) {
      return { content: failedContentOf("unreachable", access.machine), probe: null };
    }
    const probe = readProbe((await access.run("sh", ["-c", PROBE, "sh", file])).stdout);
    // An image goes on: its bytes are not read again anyway, and showing it has to touch
    // its copy, or the 30-day cleanup would take it. An svg's text goes with it, for edits.
    if (found.view === "image") {
      const blocker = blockerOf(found, probe, file);
      if (blocker) return { content: { state: blocker }, probe: null, text: blocker === "missing" ? null : undefined };
      // An svg with nothing in it yet has no picture to copy, only its source to write in.
      if (blankSvg(file, probe)) {
        const text = await access.read(file);
        return { content: text === null ? { state: "missing" } : sourceOnlySvg(text), probe: null, text };
      }
      const content = await this.readImage(access, file, probe);
      return { content, probe: null, text: content.text };
    }
    if (sameProbe(known, file, probe)) return { content: null, probe: known };
    const remembered = settledProbe(file, probe, Math.floor(Date.now() / 1000));
    const blocker = blockerOf(found, probe, file);
    if (blocker) {
      return { content: { state: blocker }, probe: remembered, text: blocker === "missing" ? null : undefined };
    }
    const text = await access.read(file);
    return { content: contentOf(file, text, found), probe: remembered, text };
  }

  // The file access of this viewer's machine (file-access.js). Asked again at each read: a
  // viewer that starts before Herdr lists its space is on this Mac until it does.
  access() {
    return accessOf(machineOf({ space: this.space }, spaces()).machine);
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

  // An image is drawn from a copy in the data folder on this Mac, made through `access` from
  // the file on its machine. Only a file whose bytes are an image's is copied, so nothing else
  // can be pulled into the app home through here.
  async readImage(access, file, probe) {
    const kind = kindOf(file, probe.head);
    if (!kind) return { state: "unsupported" };
    const path = `${FOLDER}/${copyName(access.key(file), probe, kind)}`;
    const copied = await access.copy(file, `${appHome()}/${path}`);
    if (copied.code !== 0) return { state: "unreadable" };
    // The same copy as the one on screen: its size, and an svg's text, are known, so the
    // file is not read again. The name holds the size and time, so the bytes are the same.
    const drawn = this.content.state === "image" || this.content.state === "svg";
    const shown = drawn && this.content.path === path ? this.content : null;
    let size = shown?.size ?? null;
    if (!shown) {
      try {
        size = sizeOf(await fs.readFile(`${appHome()}/${path}`));
      } catch {}
    }
    this.sweep().catch(() => null);
    if (!shown) this.dropOlder(path).catch(() => null);
    const state = imageState(file, kind, probe.bytes);
    if (state !== "svg") return { state, path, size };
    const text = shown?.text ?? await access.read(file);
    // Gone between the probe and the read: the next read says so.
    if (text === null) return { state: "missing" };
    return { state, path, size, text };
  }

  // Deleting the earlier copies of the image whose copy is at `path`, a path under `under`
  // (the disk copies' folder, or the svg previews').
  async dropOlder(path, under = FOLDER) {
    const folder = `${appHome()}/${under}`;
    const listing = await exec("sh", ["-c", LIST, "sh", folder]);
    const older = olderCopies(listing.stdout, path.slice(under.length + 1));
    if (older.length) await exec("rm", ["-f", ...older.map((name) => `${folder}/${name}`)]);
  }

  // Deleting copies and svg previews not shown for 30 days. Once per viewer is enough.
  async sweep() {
    if (this.swept) return;
    this.swept = true;
    for (const under of [FOLDER, PREVIEW_FOLDER]) {
      const folder = `${appHome()}/${under}`;
      const listing = await exec("sh", ["-c", LIST, "sh", folder]);
      const stale = staleCopies(listing.stdout, Math.floor(Date.now() / 1000));
      if (stale.length) await exec("rm", ["-f", ...stale.map((name) => `${folder}/${name}`)]);
    }
  }

  // An svg shown rendered with unsaved edits is drawn from a preview of the edited text in the
  // data folder, never from the file, which keeps its disk text until a save. The rendering
  // shows "loading" until the preview of the text on screen is written.
  ensurePreview(cx) {
    const content = this.content;
    if (content.state !== "svg" || this.raw) return;
    const text = shownText(this.edits, content.file, content.text);
    // Blank text has nothing to draw: its rendering is the empty notice.
    if (rendersEmpty(text)) return;
    if (pictureOf(content, text, this.preview) || this.previewing === text) return;
    this.previewing = text;
    const file = content.file;
    const path = `${PREVIEW_FOLDER}/${previewName(file, text)}`;
    cx.spawn(async (cx) => {
      const full = `${appHome()}/${path}`;
      let preview;
      try {
        // Private like the disk copies (image-copies.js, COPY).
        await exec("sh", ["-c", 'umask 077; mkdir -p "$1"', "sh", `${appHome()}/${PREVIEW_FOLDER}`]);
        // writeTextFile creates only with null and replaces only the text it is given. The
        // same name holds the same text, so a preview already there is only touched for the
        // 30-day cleanup.
        const there = await readTextFile(full).catch(() => null);
        if (there === text) await exec("touch", [full]);
        else await writeTextFile(full, text, there);
        let size = null;
        try {
          size = sizeOf(await fs.readFile(full));
        } catch {}
        preview = { file, text, path, size };
      } catch {
        // Drawn as a file that cannot be read, until the text changes again.
        preview = { file, text, path: null, size: null };
      }
      if (this.previewing === text) this.previewing = null;
      this.preview = preview;
      // A preview written after the text changed again is not on screen: the earlier ones are
      // deleted only by the preview that is.
      const current = this.content.file === file && shownText(this.edits, file, this.content.text) === text;
      if (current && preview.path) this.dropOlder(path, PREVIEW_FOLDER).catch(() => null);
      this.ensurePreview(cx);
      cx.notify();
    });
  }

  // The code view's colors under the theme of the moment.
  syntax() {
    const t = theme();
    return {
      keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3,
      number: t.ansi1, constant: t.ansi6, boolean: t.ansi1, operator: t.muted, punctuation: t.muted,
    };
  }

  // Editor state for the code view and the markdown source, holding the file's unsaved edits
  // if it has any. `options` comes from views.js (editorOf). A language of null, or one the
  // editor does not know, draws as plain text.
  makeEditor(content, syntax, options) {
    const font = settings()?.font_family;
    const editor = EditorState.new({
      value: shownText(this.edits, content.file, content.text), readonly: false, ...options,
      ...(content.language ? { language: content.language } : {}),
      ...(typeof font === "string" && font ? { font_family: font } : {}),
      syntax,
    });
    editor.on("change", (_event, cx) => this.edited(editor, cx));
    return editor;
  }

  // The editor's text changed by typing. Text put in with set_value is followed by its
  // caller (renderingFollows). An editor that is no longer on screen is ignored: its content
  // has been replaced.
  edited(editor, cx) {
    const content = this.content;
    if (content.editor !== editor) return;
    const was = unsaved(this.edits, content.file);
    this.edits = typed(this.edits, content.file, content.text, editor.value());
    // The rendering draws the edited text, and the markdown element needs a new id for it.
    if (content.state === "markdown") this.generation++;
    if (content.state === "markdown") this.prepareCards(content.file, content, cx);
    if (content.state === "markdown") this.images.prepare(content.file, editor.value(), false, cx);
    if (unsaved(this.edits, content.file) !== was) cx.notify();
  }

  // Writes the shown file's unsaved edits. Returns false when there is nothing to save.
  // writeTextFile refuses when the file no longer matches the text read before the edit, and
  // says the same when the file is gone, so the file is read again to tell the two apart.
  // A refused or failed save keeps the edits, and the header's status says why (edit-state.js).
  // Asked during another save, it waits for that one to end (takeSaves).
  save(cx, file = this.file) {
    if (!saveOf(this.edits, file)) return false;
    if (this.saving) {
      if (!this.saves.has(file)) this.saves.set(file, false);
      return true;
    }
    const start = startSave(this.edits, file);
    this.edits = start.edits;
    const request = start.write;
    if (!request) {
      cx.notify();
      return true;
    }
    this.saving = true;
    cx.spawn(async (cx) => {
      try {
        // writeTextFile writes on this Mac only, so a file on another machine is saved through
        // its file access instead of landing on this Mac's file of the same path.
        const access = this.access();
        const wrote = access.remote ? await this.saveThere(access, request) : (await writeTextFile(request.path, request.text, request.expected), true);
        if (wrote) {
          this.edits = saved(this.edits, request.path, request.text);
          if (this.content.file === request.path) this.content.text = request.text;
        }
      } catch (error) {
        if (refusalOf(error) !== "changed") {
          this.edits = saveFailed(this.edits, request.path, error);
        } else {
          try {
            this.edits = diskRead(this.edits, request.path, await readTextFile(request.path)).edits;
          } catch (readError) {
            this.edits = saveFailed(this.edits, request.path, readError);
          }
        }
      } finally {
        this.saving = false;
        cx.notify();
        this.takeClicks(cx);
        this.takeSaves(cx);
      }
    });
    return true;
  }

  // A save to another machine (file-access.js write). Returns whether it wrote. A file there
  // that no longer holds the text the edit started from is not written, and its text goes to
  // diskRead as a refused save's read does here (changed or deleted); a failed write keeps the
  // edits with its reason, a machine out of reach among them.
  async saveThere(access, request) {
    const outcome = unavailable(machines(), access.machine)
      ? { saved: false, failure: { reason: "unreachable" } }
      : await access.write(request.path, request.text, request.expected);
    if (outcome.saved) return true;
    this.edits = outcome.failure
      ? remoteSaveFailed(this.edits, request.path, outcome.failure, access.machine)
      : diskRead(this.edits, request.path, outcome.disk).edits;
    return false;
  }

  // The saves asked for during a save, in order. One that starts a save makes the rest wait
  // for it again.
  takeSaves(cx) {
    const saves = this.saves;
    this.saves = new Map();
    for (const [file, overwrite] of saves) {
      if (overwrite) this.overwrite(cx, file);
      else this.save(cx, file);
    }
  }

  // A click on a checkbox in the rendering, at source line `line` (checkbox.js). A file
  // without edits is saved at once; with edits, the click joins them (edit-state.js).
  toggleCheckbox(line, cx) {
    const content = this.content;
    const file = content.file;
    if (content.state !== "markdown" || !file) return;
    // Taken against the text a save under way writes, the click would be left unsaved, or
    // undone by the save; it waits for the save to end (takeClicks).
    if (this.saving) {
      this.clicks.push({ file, line });
      return;
    }
    const text = toggleCheckbox(shownText(this.edits, file, content.text), line);
    if (text === null) return;
    const click = checkboxToggled(this.edits, file, content.text, text);
    this.edits = click.edits;
    // The source's editor holds the same text, for when it is shown.
    if (content.editor && content.editor.value() !== text) content.editor.set_value(text);
    this.generation++;
    this.prepareCards(file, content, cx);
    this.images.prepare(file, text, false, cx);
    if (click.write) this.save(cx);
    cx.notify();
  }

  // The checkbox clicks that waited for a save, in order. Clicks on a file no longer shown
  // are dropped.
  takeClicks(cx) {
    const clicks = this.clicks;
    this.clicks = [];
    for (const { file, line } of clicks) if (file === this.content.file) this.toggleCheckbox(line, cx);
  }

  // The conflict's "read again", which discards the edits. The editor goes back to the last read at
  // once, and the read that follows puts the disk's text on screen.
  discard(cx) {
    const file = this.file;
    this.edits = discarded(this.edits, file);
    const content = this.content;
    if (content.file === file && content.editor && content.editor.value() !== content.text) {
      content.editor.set_value(content.text);
    }
    if (content.state === "markdown") this.generation++;
    if (content.file === file) this.renderingFollows(cx);
    this.probed = null;
    this.load(cx);
    cx.notify();
  }

  // The conflict's "overwrite": a save that expects the disk text the conflict found. During
  // another save it waits, since the save under way may change what the status says.
  overwrite(cx, file = this.file) {
    if (this.saving) {
      this.saves.set(file, true);
      return;
    }
    this.edits = overwritten(this.edits, file);
    // My text was already what the disk holds: nothing to write, only the screen to catch up.
    if (!saveOf(this.edits, file)) {
      if (file === this.file) {
        this.probed = null;
        this.load(cx);
      }
    } else {
      this.save(cx, file);
    }
    cx.notify();
  }

  // Keys reach here while the viewer or the editor inside it holds the keyboard.
  keyDown(event, cx) {
    if (event.keystroke === "cmd-s" && this.save(cx)) cx.stop_propagation();
  }

  toggleRaw(cx) {
    this.raw = !this.raw;
    // The source's editor leaves the screen and takes the keyboard with it; the viewer keeps
    // it, so cmd+S still saves from the rendering.
    if (!this.raw) this.focus.focus();
    // An svg edited in the source is drawn from its edited text.
    this.ensurePreview(cx);
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

  // A shell code block's `>_`: into the shell pane below this viewer, which starts in the
  // conversation's folder, or in the document's folder when the viewer is a tab of its own.
  insertIntoTerminal(command, cx) {
    this.shellPane.insert(command, { file: this.file, viewerTab: this.viewerTab === true, tr: this.words() }, cx);
  }

  revealInFinder(_cx) {
    if (this.file) exec("open", ["-R", this.file]).catch(() => null);
  }

  // A click on a link in the markdown view. links.js decides; a file on this Mac that is not
  // markdown is only shown in Finder, never opened. On another machine `~` is that machine's
  // home, and a file the viewer cannot show is announced.
  followLink(url, cx) {
    const access = this.access();
    if (!access.remote) return this.takeLink(linkAction(url, this.file, home(), this.groups), cx);
    const file = this.file;
    cx.spawn(async (cx) => {
      const folder = await access.home().catch(() => null);
      this.takeLink(linkAction(url, file, folder, this.groups, true), cx);
    });
  }

  // Carries out linkAction's `step`.
  takeLink(step, cx) {
    if (step.action === "show") {
      this.show(step.file, cx);
      this.nameTab();
      this.watch(cx);
    } else if (step.action === "system") {
      exec("open", [step.url]).catch(() => null);
    } else if (step.action === "reveal") {
      exec("open", ["-R", step.file]).catch(() => null);
    } else if (step.action === "unshown") {
      notify(unshownNotice(step.file, this.words()));
    }
  }

  // Keeps the folder watch on the shown file's folder, and starts the slow recheck and the
  // remote check once. Call it again whenever this.file may have changed: it does nothing if
  // the folder is the same. A file in the home folder or the root is not watched, only
  // rechecked (links.js). Another machine's file has no folder here to watch: the remote
  // check follows it instead, and the recheck stops a watch that started before Herdr listed
  // the viewer's space.
  watch(cx) {
    if (!this.rechecking) {
      this.rechecking = true;
      cx.timer.every(RECHECK_MS, (cx) => {
        this.watch(cx);
        if (this.file) this.load(cx);
      });
    }
    if (!this.checking) {
      this.checking = true;
      cx.timer.every(REMOTE_CHECK_MS, (cx) => this.checkRemote(cx));
    }
    const folder = this.access().remote ? null : watchedFolder(this.file, home());
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

  // The remote check: another machine's shown file is read again only when its mark changes
  // (file-access.js mark, remote-results.js). Being out of reach is a mark too, so losing the
  // machine reads the file into the "can't reach" notice, and getting it back reads it again;
  // a file with unsaved edits is never read over them (load). The first mark of a file is only
  // taken, since showing it has just read it. A check still under way skips its turn.
  checkRemote(cx) {
    const file = this.file;
    const access = this.access();
    if (!file || !access.remote || this.marking) return;
    this.marking = true;
    cx.spawn(async (cx) => {
      let mark;
      if (unavailable(machines(), access.machine)) mark = "unreachable";
      else {
        try {
          mark = await access.mark(file, { timeout: REMOTE_CHECK_TIMEOUT_MS });
        } catch (error) {
          mark = failureOf(error);
        }
      }
      this.marking = false;
      if (file !== this.file) return;
      const last = this.marked;
      this.marked = { file, access, mark };
      if (last?.file !== file || last.access !== access || last.mark === mark) return;
      this.probed = null;
      this.load(cx);
    });
  }

  // The image view's width, from its size report.
  setRoom(width, cx) {
    if (width === this.room) return;
    this.room = width;
    cx.notify();
  }

  // What the header shows, and where its clicks go (header.js).
  header(tr) {
    return {
      file: this.file,
      canGoBack: canGoBack(this.visits),
      state: this.content.state,
      raw: this.raw,
      remote: this.access().remote,
      status: statusOf(this.edits, this.file, tr),
      tr,
      onBack: (cx) => this.goBack(cx),
      onToggleRaw: (cx) => this.toggleRaw(cx),
      onSave: (cx) => this.save(cx),
      onDiscard: (cx) => this.discard(cx),
      onOverwrite: (cx) => this.overwrite(cx),
      onNewTab: (cx) => this.openTab(cx),
      onOriginal: (cx) => this.openOriginal(cx),
      onFinder: (cx) => this.revealInFinder(cx),
    };
  }

  // The body, by what this.content holds. tr: the viewer's translator (i18n.js).
  renderBody(t, tr) {
    const content = this.content;
    // The code view and the markdown and svg sources are the same editable editor; sources
    // wrap their lines (views.js, editorOf).
    if (editable(content.state, this.raw)) return renderCode(t, content);
    if (content.state === "markdown") {
      return renderMarkdown(t, {
        text: shownText(this.edits, content.file, content.text), generation: this.generation,
        onLink: (url, cx) => this.followLink(url, cx),
        file: this.file,
        codeCards: this.codeCards,
        images: this.images.forDocument(content.file),
        onTerminal: (command, cx) => this.insertIntoTerminal(command, cx),
        onCheckbox: (line, cx) => this.toggleCheckbox(line, cx),
        cache: this.markdownCache,
        tr,
      });
    }
    if (content.state === "image" || content.state === "svg") {
      // An svg draws its disk copy, or the preview of its unsaved edits (svg-preview.js).
      // With no text yet, the notice says it is empty; the source is a click away.
      const text = content.state === "svg" ? shownText(this.edits, content.file, content.text) : null;
      if (content.state === "svg" && rendersEmpty(text)) return renderNotice(t, "empty", tr);
      const picture = content.state === "svg" ? pictureOf(content, text, this.preview) : content;
      if (!picture) return renderNotice(t, "loading", tr);
      if (!picture.path) return renderNotice(t, "unreadable", tr);
      return renderImage(t, { content: picture, room: this.room, onRoom: (width, cx) => this.setRoom(width, cx) });
    }
    // The whole content, so the "can't reach" notice can name its machine (document.js).
    return renderNotice(t, content, tr);
  }

  // The system's language, read once when the copy starts and remembered in Herdr's shared
  // state for every copy, viewer tabs and later viewers too. Writing it there redraws every
  // copy, so a viewer showing another language switches at once. A read that fails leaves the
  // language as it was (English when nothing was ever read) and asks again (askAgainAfter).
  askLang(cx, attempt) {
    cx.spawn(async (cx) => {
      const read = await exec("defaults", ["read", "-g", "AppleLanguages"], { timeout: 5000 }).catch(() => null);
      const lang = systemLang(read);
      if (!lang) {
        cx.timer.after(askAgainAfter(attempt), (cx) => this.askLang(cx, attempt + 1));
        return;
      }
      if (shared(LANG_KEY) !== lang) setShared(LANG_KEY, lang);
    });
  }

  // The viewer's translator (i18n.js): the remembered language, English until one is known.
  // Asked for at the moment the words are needed, so a notification written after a wait
  // speaks the language of that moment.
  words() {
    const remembered = shared(LANG_KEY);
    const lang = LANGS.includes(remembered) ? remembered : "en";
    if (this.tr?.lang !== lang) this.tr = translator(lang);
    return this.tr;
  }

  render(_cx) {
    const t = theme();
    const tr = this.words();
    if (this.picker) return this.picker.renderPicker(t, tr);
    return v_flex().id("side-viewer").size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .track_focus(this.focus).on_key_down((event, cx) => this.keyDown(event, cx))
      .child(renderHeader(t, this.header(tr)))
      .child(this.renderBody(t, tr));
  }
}
