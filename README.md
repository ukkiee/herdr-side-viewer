# Side Viewer

**English** | [한국어](README.ko.md)

A side viewer for the [Herdr](https://herdr.dev) desktop app, macOS only. Cmd-click a file
path in an agent's conversation and the file opens in a pane to the right of it, instead of
in another app. Read markdown drawn block by block, read and edit code with syntax colors,
look at images, save with cmd+S, give a file a tab of its own, and put a document's shell
command into a terminal's input line.

![Side Viewer](preview.png)

- **Markdown** (`md`, `markdown`, `mdx`): rendered block by block, in the manner of Warp's
  markdown view, with code blocks as cards. The header's `렌더링 | 원문` switch shows the
  source, which you can edit.
- **Code and text**: an editor with line numbers and syntax colors, and you can edit them.
  `html` is code here: you see and edit its source, not the page.
- **Images**: drawn no wider than the pane. An `svg` also has the `렌더링 | 원문` switch,
  and its source can be edited.
- **Saving** (cmd+S): edits are saved with cmd+S or the header's `저장` button, never on
  their own. The one exception is a checkbox click (see [Edit and save](#edit-and-save)).
- **One viewer per tab**: a viewer already showing in the tab takes the next file, so panes
  don't pile up, and `←` goes back to the file before. The viewer reloads when the file
  changes on disk.
- **Viewer tab**: the header's `새 탭으로 열기` button gives the file a tab of its own.
- **`>_` on shell blocks**: types a code block's command into a shell pane below the viewer,
  without running it.
- **Outside Herdr** (Finder, another terminal) the same files keep opening in the app they
  opened in before.

### How it works

Herdr hands a cmd-clicked path to macOS, which opens it in the default app for that kind of
file. So this repo ships a small background app, the **router**, that you make the default
app for a list of extensions. For each file it receives, it looks at which app is in front:
Herdr sends the file to the side viewer, anything else sends it to the **original app**,
the one that was the default before. The router takes over only when you run the take-over
command below (the one exception is under [Limits](#limits)), and one command gives
everything back.

### Edit and save

- **Where.** The markdown source, the svg source and the code view take typing. The
  markdown rendering, images (an svg's picture too), the code block cards inside a
  document and the notices do not. An empty (or blank) markdown or svg file shows
  `이 파일은 비어 있습니다.` on its rendering side, and its `렌더링 | 원문` source is ready
  to type; back on the rendering, what was typed is drawn. An empty (or blank) code file
  opens as an empty code view. An empty `svgz` or picture still gets only the notice.
  An `svgz` has no source view. The sources wrap long
  lines to the pane; the code view does not. All three have line numbers.
- **Edited.** Once you change something, the header shows `편집됨` and a `저장`
  button. cmd+S or the button writes the file and both go away; so does undoing your
  change by hand. cmd+S with nothing changed does nothing. That spot in the header is the
  file's status: a failed save or a change on disk shows there too, in red, in place of
  `편집됨`. In a narrow pane the file name and folder are cut first, then the status;
  hover it to read all of it.
- **Kept per file, until the pane closes.** Edits not yet saved stay with that viewer, for
  each file: follow a link, go back, or cmd-click another file, and when you return to the
  file your edits and their status are back. Closing the pane or quitting Herdr drops them,
  and nothing asks first.
- **Preview before saving.** Switch an edited source to `렌더링` and you see the document,
  or the svg's picture, drawn from your edits. The file is not written.
- **Changed outside.** If the file changes on disk while you have edits (an agent wrote
  it, say), the viewer does not read it over them. The status says `외부에서 바뀌었어요`,
  and two buttons take the place of `저장`: `다시 읽기` (drop your edits and show the
  disk) and `덮어쓰기` (save yours over it). A save that finds the file changed since the
  viewer last read it writes nothing and shows the same. You can keep typing meanwhile.
  Without edits the viewer reloads by itself, as before.
- **Save failures.** When a save fails, the status says why, `저장` stays, and your
  edits stay: `쓰기 권한이 없어요` (no permission), `파일이 지워졌어요` (the file was
  deleted; this also shows as soon as an edited file disappears), `너무 커서 저장할 수
  없어요` (over 1 MiB, 1,048,576 bytes), or `저장하지 못했어요` for anything else, where
  hovering it shows the error.
- **Checkboxes.** Clicking a task box (`- [ ]`) in the rendering flips it and turns that
  source line's `[ ]` into `[x]` or back. With no edits in the file it is saved at once,
  the one exception to "never on their own"; if the file changed on disk meanwhile, nothing
  is written and the status says `외부에서 바뀌었어요`. With edits, the click joins them and
  stays `편집됨`.

### Open in a new tab

The header's `새 탭으로 열기` button (the leftmost of the three icons on the right, there
while a file is drawn, not on a notice such as "too large" or "gone") opens a
**viewer tab**: a tab right after the current one, in the same space, holding only a side
viewer of this file, and switches to it. The tab is named after the file and follows it
through links, `←` and new files. It starts with an empty history. The same file opens a new
tab every time. Unsaved edits move with the file: the new tab shows them with their status,
and the viewer you left shows the disk text. While a viewer tab is on screen, a cmd-clicked
file opens in it, not in a new pane.

### The markdown view

- **Full width.** The document uses the pane's whole width, body text at 13pt, with the
  folder (dimmed) and the file name at the top.
- **Blocks.** Headings in three sizes (24, 19 and 16pt; level 4 and below bold body size),
  no underline. Lists with filled dots, hollow dots one level in, numbers and checkboxes;
  lists of a different kind separated by a blank line are drawn apart. Tables as wide as
  their content, bold header row, lines between rows only, column alignment kept. A thick
  rule for `---`. Quotes with a bar on the left and dimmed text, the blocks inside drawn
  the same way. Footnotes as superscript numbers, listed at the end. Links, bold, italic,
  inline code and strikethrough inside a paragraph work as before.
- **Code blocks** become cards: rounded, with a border, a top-to-bottom fade on a dark theme
  and one flat color on a light one. Bottom left the language: its name when known
  (`JavaScript`, `Python`, `HTML` and so on), `Shell` for shell commands, `Mermaid` for
  `mermaid`, otherwise `Code`. Bottom right a copy button that puts the whole block on the
  clipboard and turns into a check mark for a moment. Syntax colors; long lines wrap inside
  the card; the card is as tall as its code, with no scrolling of its own, so the wheel over
  it scrolls the document. Clicking a card puts no cursor in it, and its text can't be
  selected or edited. A code block in a list is indented with the item's text, one in a quote
  sits inside the quote's bar.
- **`>_` on shell blocks.** A block with no language or with `sh`, `shell`, `bash`, `zsh`,
  `fish` or `console` also has a `>_` button. It opens a shell pane below the viewer and
  types the command into its input line. It does not press Enter and does not touch the
  clipboard: check it, then press Enter yourself. The shell is zsh and starts in the folder of
  the conversation terminal beside the viewer (in a viewer tab, the document's folder). The
  next `>_` goes into the same shell pane while it is open. If that shell is running a
  program, nothing is typed and a notification says so (`터미널에 넣지 않았습니다`). A line
  `print -rz -- '…'` is left on the shell's screen. Text you had typed at its prompt is moved
  aside with zsh's push-line (alt+q) and comes back after the command (not with vi keys: see
  [Limits](#limits)).
- **Pictures.** A local picture on a line of its own (`![alt](path)`, relative to the
  document's folder, or absolute) is drawn in the document: as wide as the pane at most,
  never larger than itself, at most 420 high, centered. One that can't be read shows
  `그림을 못 읽음: <path>` in its place.

## Before you add it

- **Programs**: the router is built on your machine from
  [`mods/side-viewer/router/main.swift`](mods/side-viewer/router/main.swift) and signed ad
  hoc. The mod and the router run shell commands (`sh`, `open`, `stat`, `cp`, `rm` and the
  like, and `herdr-app`), and read the files you open.
- **Your files**: the mod writes a file when you save it or click a checkbox in it.
- **Terminal**: the `>_` button opens a zsh pane and types into it through Herdr's `hc`
  (`hc send`, `hc keys alt+q`, `hc get`).
- **Network**: nothing reaches the network; a web or mail link you click in a document is
  handed to macOS.
- **Data folder** (`~/.config/herdr-app/data/side-viewer/`): the mod and the router write:
  - `original-apps.tsv`, the record of original apps;
  - `request.json` and `answer-<id>`, the request passed from the router to the viewer;
  - `images/`, copies of the images you view and of the pictures inside markdown documents;
  - `previews/`, copies of edited svg sources, drawn before they are saved;
  - `handoff-<id>.json`, the unsaved edits handed to a new viewer tab, deleted once the tab
    has read them (one can be left behind if Herdr quits in between).

  A copy in `images/` or `previews/` is deleted when a newer copy of the same file replaces
  it, or when not shown for 30 days.

How it is built and what to watch for: [RECIPE.md](RECIPE.md).

## Install

Needs the Herdr app (`herdr-app` on your `PATH`) and Xcode's command line tools
(`xcode-select --install`), which build the router.

```sh
git clone https://github.com/ukkiee/herdr-side-viewer
cd herdr-side-viewer && ./install.sh
```

`install.sh` runs `herdr-app check` on the mod, builds
`~/Applications/Side Viewer Router.app`, and copies the mod into
`~/.config/herdr-app/mods/side-viewer` (or `$HERDR_APP_HOME`). If the check or the build
fails, the mod and the router that were installed stay as they were. It does not run the
take-over command below; building alone can still make the router the default for an
extension no other app claims (see "Building alone can change a default" under
[Limits](#limits)). **Run it again after `git pull` to update.**

### Take over the extensions

The router's commands are flags of its binary. A shell function saves typing:

```sh
router() { "$HOME/Applications/Side Viewer Router.app/Contents/MacOS/SideViewerRouter" "$@"; }

router --make-default        # markdown and image extensions
router --make-default code   # the same, plus the code extensions
```

macOS asks you to confirm every change of a default app, once per file type, and no app can
answer for you. Extensions of one file type (`jpg`, `jpeg`, `jpe`) share one window. The
command first prints how many windows are coming (`macOS 확인 창이 N번 뜹니다.`) and then
sends the requests one at a time, waiting up to 300 seconds for each answer. It asks only for
what the router does not hold yet, so N can be smaller than the counts below.

In each window pick **Side Viewer Router**. If you pick the button that keeps the current
app, that extension stays as it was, and the command lists it under `유지를 선택함`
("chose to keep") rather than as a failure. Changed extensions are listed under `바뀜`,
real failures under `실패` with the reason.

Before asking, the command records each extension's original app in
`~/.config/herdr-app/data/side-viewer/original-apps.tsv`. Running it again never replaces
that record with the router itself.

Exit codes: `0` everything asked for changed (or nothing needed changing), `1` a request
failed, `2` wrong usage, `3` nothing failed but you kept the current app for some.

### Taking over the code extensions

Code files, `html` among them, open in the viewer (and can be edited there) only once the
router holds the code group. Nothing does that for you, `./install.sh` included: whether
and when to run it is your choice.

1. See where things stand: `router --status`. Code extensions that still name another
   app are the ones that will be asked about.
2. Run `router --make-default code`. On a Mac where the router holds nothing yet that is at
   most **35 windows**: 7 for markdown and images and **28 for code**. The first line it
   prints gives the real number.
3. In every window pick **Side Viewer Router**. The `html` window names your browser as
   the current app; picking the router there is what sends `html` files to the viewer.
   Outside Herdr they still open in that browser.
4. Check the output: `바뀜` for what changed, `유지를 선택함` for any window where the
   current app was kept. Run the command again to be asked about those only.

To undo it, `router --restore` (below) gives everything back, the browser's `html`
included.

### Give them back

```sh
router --restore
```

asks macOS to return every extension the router still holds to its original app. The
windows come up again, once per file type, and this time you have to pick **the original
app**: keeping the current one leaves the router in place for that extension. An extension
whose default you changed yourself in the meantime is left alone. If a recorded original
app has been uninstalled since, the command says so and asks for a sibling extension's app
instead, or for TextEdit (Preview for images).

**Run it before you delete the router app**: the record it restores from is of no use
without the command.

### See where things stand

```sh
router --status
```

prints one line per extension, separated by tabs: the extension, its current default app,
and the recorded original app (`-` when there is none), as bundle ids.

```
md	dev.ukkiee.side-viewer-router	com.apple.TextEdit
png	com.apple.Preview	-
```

Here `md` is with the router and `png` is not.

## Extensions

The list lives in [`mods/side-viewer/extensions.json`](mods/side-viewer/extensions.json);
the router and the viewer both read it.

| Group | Extensions | Taken over by |
|---|---|---|
| markdown | `md` `markdown` `mdx` | `--make-default` |
| image | `png` `jpg` `jpeg` `jpe` `gif` `webp` `svg` `svgz` | `--make-default` |
| code | `log` `json` `jsonc` `yaml` `yml` `toml` `js` `mjs` `jscript` `javascript` `cjs` `jsx` `ts` `tsx` `css` `scss` `py` `go` `rs` `rb` `rbw` `java` `jav` `kt` `swift` `c` `h` `cpp` `cp` `c++` `cc` `cxx` `sh` `zsh` `sql` `xml` `csv` `html` `htm` `shtml` `shtm` | `--make-default code` |

Some are there only because macOS sets default apps per file type, so they come along with
a sibling: `jpe` with `jpg`, `svgz` with `svg`, `jscript` and `javascript` with `js`, `rbw`
with `rb`, `jav` with `java`, `cp` `c++` `cc` `cxx` with `cpp`, `htm` `shtml` `shtm` with
`html`. `xhtml` is a file type of its own and is not in the list.

## Limits

- **macOS only.**
- **Line numbers are ignored.** Clicking `app.ts:12` shows the file from the top.
- **Everything not in the list opens as it does today**: files without an extension,
  extensions outside the list, and `txt`, `diff` and `patch`, which are left out on purpose
  (`txt` would drag in extensionless text files such as `README`; `diff` and `patch` share a
  file type but can have different original apps).
- **`html` may go back to the browser (not verified).** macOS may hand `html` back to the
  browser when you change your default browser. `router --status` then shows the browser
  for `html`, and cmd-clicked `html` files open there; `router --make-default code` asks for
  it again.
- **`html` is shown as code**, never drawn as a page.
- **Not drawn in markdown**: `mermaid` diagrams (shown as a code card), math, GitHub alert
  boxes, HTML tags, definition lists, pictures from the web (`https`), and pictures inside a
  paragraph rather than on a line of their own. Web pictures are never fetched.
- **No autosave and no "save changes?" prompt.** Edits not saved are gone when the pane
  closes or Herdr quits. The one save without cmd+S is a checkbox click on a file without
  edits.
- **`>_` with zsh's vi keys can run what you had typed.** With a vi keymap (zsh picks one when
  `EDITOR` or `VISUAL` contains "vi", or after `bindkey -v`), text left at the shell pane's
  prompt is not moved aside: the command joins it and the line runs, draft and all. Clear
  the prompt before clicking `>_`, or use emacs keys (`bindkey -e`).
- **No keyboard navigation** between blocks, no `cmd+E` for the source switch, no filling in
  of `{{placeholders}}` in commands.
- **A path with text stuck to its end doesn't open.** Herdr reads the letters right after a
  path as part of it (`/tmp/notes/plan.md에서`), so it finds no file. With a space after the
  path it opens.
- **Paths printed by a terminal on another machine are not supported.**
- **Web addresses go to the browser**, not the viewer. A web or mail link inside a markdown
  document is handed to macOS; a link to another markdown file opens in the viewer, and a
  link to any other local file only shows it in Finder.
- **Too big to draw**: text over 1 MB and images over 20 MB get a notice instead. The
  header's buttons still open the file in its original app or show it in Finder. An `svg`
  over 1 MB is drawn but has no source switch.
- **Restore can merge apps within one file type.** macOS keeps one default per file type,
  yet two extensions of a type can open in different apps (seen with `js` and `mjs`; also
  possible for `svg`/`svgz`, `rb`/`rbw`, `cpp`/`cp`). While the router holds them, each
  still goes to its own original app. After `--restore` they all open in the original app
  of the extension that comes first in the list.
- **Building alone can change a default.** An extension that no installed app claims
  (seen with `mdx`, `jsonc`, `rbw`, `cp`) goes to the router as soon as it is built, before
  any `--make-default`. Those have no original app on record, so the router opens them in
  TextEdit (Preview for images). One with a sibling extension of the same file type (`rb`
  for `rbw`, `cpp` for `cp`) stays with the router after `--restore`, which lists it under
  `라우터에 남음`: macOS sets defaults per file type, and no app but the router claims that
  extension itself. The router keeps opening it in TextEdit or Preview, and deleting the
  router app frees it. One without such a sibling (`mdx`, `jsonc`) goes to TextEdit or
  Preview.
- **`.ts` video files pass through the router too.** macOS classes `.ts` as MPEG-2 video.
  Outside Herdr they still reach the original app.
- **Every file with a taken-over extension passes through the router**, also from Finder.
  It hands the file on to the original app and quits.
- **The router looks in the default places**: `~/.local/bin/herdr-app` and
  `~/.config/herdr-app`. With Herdr elsewhere, or if Herdr doesn't answer within 5 seconds,
  the file opens in its original app.
- **The viewer's buttons, notices and tooltips and the commands' output are in Korean.**

## License

MIT
