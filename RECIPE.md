# Side Viewer

Cmd-click a file path in an agent's conversation and the file opens in a pane to the right:
markdown rendered, code and text in a read-only editor with line numbers and syntax colors,
images as pictures. A viewer already showing takes the next file, `←` goes back, and the
content reloads when the file changes. Outside Herdr the same files open in the app they
opened in before. macOS only: a small background app, the **router**, becomes the default
app for a list of extensions and passes each file to the viewer or to its **original app**.

![Side Viewer](preview.png)

## What you see

One pane, to the right of the pane that had focus. `background` fill, `foreground` text.
Top to bottom:

- **Header**, 40px tall, 12px side padding, 8px between items, a 1px `border` line under it.
  Left to right:
  - **Back**, only while there is a file to go back to: a 24×24 square, radius 4, `←` at
    14px in `muted`, `hover` background under the pointer.
  - **File name**, 13px semibold, cut with an ellipsis when the pane is narrow.
  - **Folder**, 11px `dim`, the home folder written as `~`. It takes the room that is left
    and is cut with an ellipsis.
  - **Buttons**, which never shrink: each a 24×24 square, radius 4, a 14px icon in `muted`,
    `hover` background under the pointer, a tooltip. While a markdown document is drawn, a
    source/rendered switch (tooltip `원문 보기`, or `렌더링 보기` while the source shows); for every file
    `원래 앱으로 열기` (open in the original app) and `Finder에서 보기` (show in Finder),
    2px apart.
  - With no file the name reads `Side Viewer` and there are no buttons.
- **Body**, one of:
  - **Markdown view**: a scrolling column centered in the pane, at most 860px wide, 28px
    side and 24px vertical padding, 14px text, selectable. The source is the same column
    with the whole file as one code block.
  - **Code view**: the app's code editor filling the body, read-only, line numbers, no soft
    wrap, in the font from the app's settings. Colors: keyword `ansi5`, string `ansi2`,
    comment `dim`, function `ansi4`, type `ansi3`, number and boolean `ansi1`, constant
    `ansi6`, operator and punctuation `muted`. An extension with no known language draws
    without colors.
  - **Image view**: the image at its own size, centered, with 20px around it, shrunk to the
    pane's width when it is wider; it scrolls vertically when taller than the pane. An image
    whose size can't be read fills the width as a square.
  - **Notice**: one line at 13px in `dim`, 20px padding. `열 파일이 없습니다.` (no file),
    `불러오는 중…` (loading), `이 파일은 비어 있습니다.` (empty),
    `이 파일은 더 이상 없습니다.` (gone), `이 파일을 읽을 수 없습니다.` (unreadable),
    `뷰어에서 열기에는 너무 큽니다.` (too large),
    `이 종류의 파일은 뷰어에서 열 수 없습니다.` (no view for this file).

## How it behaves

The mod shows files, not agents, so it has no agent statuses.

- **Opening.** A cmd-click on a path reaches the router through macOS. The router notes
  which app is in front and runs `open.sh <file> <front app>`. If that app's path contains
  `Herdr.app` (or its name is `herdr-app`), the file goes to the side viewer; otherwise to
  the original app.
- **Reuse.** A side viewer showing in the current tab takes the file: the pane count stays
  and only the content changes. With no viewer showing (none, or only in another tab), a
  new pane splits off to the right of the focused pane about 0.4 s later.
- **Falling back.** The file opens in its original app instead when `herdr-app` is not at
  `~/.local/bin/herdr-app`, the mod is not installed in the app home, the path holds a
  control character, the `pane.split` command fails, or `herdr-app` does not finish within
  5 seconds.
- **View by extension.** `md markdown mdx` → markdown view. `png jpg jpeg jpe gif webp svg
  svgz` → image view, and only when the file's first bytes are an image's (PNG, JPEG, GIF,
  WebP, SVG, or gzip for `.svgz`); otherwise the "no view" notice. The other extensions in
  `extensions.json` → code view. Anything else → the "no view" notice.
- **Limits.** Text over 1 MB (1,048,576 bytes) and images over 20 MB (20,971,520 bytes)
  show the "too large" notice and are never read. Exactly at the limit still draws.
- **Back.** Each viewer keeps its own history. Opening a file adds the one being left;
  opening the file already shown adds nothing. `←` returns to the previous file and drops
  the one left behind (there is no forward).
- **Reload.** The viewer watches the shown file's folder and also checks the file again
  every 15 seconds. A file directly in the home folder or in `/` is not watched, only
  checked every 15 seconds. A text file whose size and modified time are as at the last
  read is not read again (unless it changed within the last 2 seconds, since the time is in
  whole seconds). While a read of the shown file is under way, a new change waits for it
  and the file is read once more afterwards; opening another file leaves the read behind.
  Unchanged content leaves the screen and the scroll position alone; changed code keeps
  its editor and only gets the new text. A deleted file turns into the "gone" notice, and
  its content comes back when the file does. "Loading" shows only for a newly opened file.
- **Theme.** The code view's colors are fixed when its editor is made, so each check also
  compares them with the theme: after a theme change the open code is redrawn with the new
  colors within 15 seconds.
- **Source switch.** Shown only while a markdown document is drawn, not on a notice. Every
  file opens rendered: opening another file, `←` and a link all switch back from the source.
- **Open in the original app.** For a listed extension, runs `open -b <bundle id> <file>`
  with the app recorded for the extension; TextEdit (Preview for images) when there is no
  record, when the record names the router, or as a second try when the recorded app
  fails. Naming the app keeps the file from coming back through the router. For an
  extension outside the list, which the router cannot be the default app of, it runs
  `open <file>`.
- **Show in Finder.** Runs `open -R <file>`.
- **Links in the markdown view.** Another markdown file opens in the same viewer and joins
  the history. `http`, `https` and `mailto` go to macOS's handler. Any other local file is
  only shown in Finder, never opened. Relative links start from the shown document's
  folder; `~/`, absolute paths and `file://` work; an anchor alone, or another scheme, does
  nothing.
- **Take over** (`SideViewerRouter --make-default`, or `--make-default code`). Without
  `code` it covers the markdown and image extensions; with it, the code extensions too. It
  records each extension's original app, prints `macOS 확인 창이 N번 뜹니다.` (N = the
  number of file types to change), then sends one request per file type and waits up to
  300 seconds for each confirmation window. Output: `바뀜: …` (changed), `유지를 선택함: …`
  (the person kept the current app), `실패: … (reason)` on stderr, or `바꿀 것이
  없습니다.` (nothing to change). A second run never records the router as an original app.
- **Restore** (`--restore`). Every extension the router still holds goes back to its
  recorded app, with the same count line, windows and output. An extension with no record
  goes to the app a sibling of the same file type opens in (a sibling the router does not
  hold first, then a sibling's record), because the request changes the whole file type;
  only without such a sibling does it go to TextEdit (Preview for images), and it says so.
  A file type whose extensions would all go to the app it already opens in gets no request
  and is not counted. After each request every extension of its file type is read again:
  `바뀜` lists only those that left the router. The rest, and those of a file type that got
  no request, are claimed by no app but the router (`rbw`, `cp` once built) and are printed
  as `라우터에 남음: … (이 확장자를 맡은 앱이 라우터뿐입니다)`, neither a failure nor kept.
  When the app asked for is no longer installed, the same choice is asked for once more
  (sibling's app, else TextEdit or Preview) and printed.
- **Status** (`--status`). One line per extension: extension, current default app, recorded
  original app or `-`, tab-separated bundle ids.
- **Exit codes** of the three: 0 done or nothing to do, 1 a request failed, 2 wrong usage,
  3 nothing failed but the person kept the current app for some. Any other argument that
  starts with `--` prints the usage and ends with 2.
- **Outside Herdr.** A taken-over file opened from Finder goes through the router to its
  original app (TextEdit, or Preview for images, without a record). The router never comes
  to the front and quits 2 seconds after the last file.

## Built from

- `mods/side-viewer/mod.json`: `{ "place": "none", "title": "Side Viewer" }`. Opened with
  `pane.split {direction: "right", mod: "side-viewer", props: {file}}`; `props.file` is the
  absolute path to show.
- `mods/side-viewer/main.js`: the one `View`. The decisions sit in modules without `herdr`
  imports, so `node --test` runs them: `views.js` (extension → view and language, size
  limits, the probe script), `document.js` (notices, header label), `history.js`,
  `request.js` (the handoff from `open.sh`), `links.js` (link clicks, watch decisions),
  `original.js` (which app "open in the original app" names), `image-copies.js` (image
  check by first bytes, copy names, sizes, cleanup). Each has a `*.test.mjs`.
- `mods/side-viewer/extensions.json`: the listed extensions in three groups, `markdown`,
  `image`, `code`. The router build and the mod both read it, and it alone says which
  extensions are markdown. A listed extension is taken over only once the router is its
  default app: `markdown` and `image` with `--make-default`, `code` with `--make-default code`.
- `mods/side-viewer/open.sh`: the branch the router calls. It writes
  `request.json` (`{"id","file","at"}`) into the data folder, runs
  `herdr-app do side-viewer.show`, waits 8 × 0.05 s for the viewer's `answer-<id>` file,
  and otherwise runs `herdr-app do pane.split --direction right --mod side-viewer --props
  '{"file":"…"}'`. Answer files older than a minute are deleted on the next run.
- `mods/side-viewer/router/`: `main.swift` (the app: receives files, reads and sets one
  default app at a time), `takeover.sh` (make-default, restore, status), `open-original.sh`,
  `lib.sh`, `build.sh`, `router.test.mjs`. `build.sh` compiles with `swiftc -O` into
  `~/Applications/Side Viewer Router.app` (bundle id `dev.ukkiee.side-viewer-router`,
  `LSBackgroundOnly`, document types from `extensions.json` at rank `Alternate`), copies
  the scripts and the list into its `Resources`, signs it ad hoc and registers it with
  `lsregister`. It builds in a hidden folder beside the app and swaps the result in only
  when every step worked. The binary also answers `--type-info <extension>` (file type, its
  other extensions, its parent types), the check behind the sibling extensions in the list.
- Icons: `source.svg`, `rendered.svg`, `original.svg`, `finder.svg`, 16×16, one stroked
  path each in `currentColor`, drawn at 14px with `svg("mods/side-viewer/<name>.svg")`.
- `herdr` functions: `props`, `readTextFile`, `writeTextFile`, `nextCommand`, `home`,
  `appHome`, `theme`, `settings`, `exec`, `watchFolder`; `cx.spawn`, `cx.timer.every`,
  `cx.notify`. `gpui-kit`: `View`, `div`, `image`, `svg`. `gpui-base`: `v_flex`, `h_flex`,
  `TextView.markdown`, `Editor`, `EditorState`. Node: `fs/promises` `readFile`.
- Command for scripts: `side-viewer.show`.
- Programs the mod runs: `sh` (with `stat`, `head`, `od`, `cp`, `touch`, `mkdir`), `open`,
  `rm`. The scripts also use `herdr-app`, `plutil`, `awk`, `sed`, `find`, `mktemp`.
- Files outside the mod folder, all under the app home's `data/side-viewer/`:
  `original-apps.tsv` (`<extension><TAB><bundle id>` per line), `request.json`,
  `answer-<id>`, and `images/<path hash>-<bytes>-<modified>.<kind>` (image copies, mode 600,
  deleted when the image changes and gets a new copy, or when not shown for 30 days). The
  viewer reads whichever file it is asked to show.
- `install.sh`: runs `herdr-app check` on the mod folder, runs `build.sh`, then copies the
  mod folder into the app home. It never runs the take-over command; building can still
  change a default (see "Building the app is enough" under Watch out).

## Watch out

Platform:

- A mod gets no click on terminal text. The only way in is the default app that macOS
  opens for a cmd-clicked path, hence the router.
- `<mod>.<command>` reaches showing copies only, and says nothing about whether one took
  it. So the viewer answers by creating `answer-<id>` with `writeTextFile(path, text, null)`
  (new files only), and `open.sh` takes that name itself before splitting, so a viewer that
  wakes late cannot take the file as well.
- A mod can't import JSON and has no `import.meta.url`: the viewer reads
  `mods/side-viewer/extensions.json` under `appHome()` while it runs. A mod not installed
  there shows the "no view" notice for every file. The icon paths assume the same folder
  name.
- `fs/promises` has no `stat`, so size, modified time and the first 4096 bytes come from one
  `exec("sh", …)` before anything is read.
- No `setTimeout`: the 15-second recheck is `cx.timer.every`.
- `EditorState` can't be created while drawing; it is made when the text arrives and
  released when the content is replaced. Its colors are fixed when it is made.
- `TextView.markdown` needs a new element id to draw new text.
- Images are drawn from copies under the app home, on the report that Herdr draws images
  only from there. Only files whose first bytes are an image's are copied.
- `watchFolder` reports subfolders too on macOS, and real paths (`/private/tmp` for `/tmp`):
  batches are matched by path ending. Watching the home folder or `/` would report every
  change under them, so a file there is left to the 15-second check.
- `herdr-app check` draws once, with no file, so it only ever sees `열 파일이 없습니다.`
- Language names the editor knows are not documented. `toml`, `swift`, `kotlin`, `scss` and
  `xml` are guesses; an unknown name draws without colors, never an error. TypeScript and
  JSX use JavaScript's colors.

macOS:

- Default apps are kept per file type, not per extension, and every change brings up a
  confirmation window, once per file type, on take-over and on restore alike. No app can
  dismiss it. "Keep" comes back as an error with the default unchanged; `takeover.sh` tells
  it from a failure by comparing the default before and after.
- A 30-second wait per window was too short for a person to read and answer; it is 300.
- Two extensions of one file type can still open in different apps, so the default app is
  asked about a real file with that extension, and the record is per extension. Restore
  sets a file type once, to the original app of the extension that comes first in the list.
- All original apps are recorded before the first request: once one extension of a type is
  taken over, its siblings would report the router.
- Building the app is enough to make it the default for an extension no other app claims
  (seen with `mdx`, `jsonc`, `rbw`, `cp`).
- Left out on purpose: `txt` (its file type includes extensionless text files such as
  `README`), `diff` and `patch` (one file type, different original apps), `html` (tied to
  the browser setting). `ts` is MPEG-2 video to macOS; it is taken over because that file
  type has no other extension.
- The router must never come to the front, or "the app in front" would be itself:
  `LSBackgroundOnly` and activation policy `prohibited`.
- Quitting right after a file lost a second file macOS sent meanwhile; the router waits
  2 seconds without files.
- macOS starts the router without your shell's environment: it uses
  `~/.local/bin/herdr-app` and `~/.config/herdr-app` whatever `HERDR_APP_HOME` was at
  install time. `SIDE_VIEWER_DATA` is for tests; the mod always uses the app home.

Limits and assumptions:

- Line numbers in a path (`app.ts:12`) are ignored; the file shows from the top.
- No web addresses, no paths from another machine's terminal, no binary files (`pdf`,
  `zip`), no editing, no images inside markdown, no keyboard navigation in the viewer.
- When `herdr-app` gives up after 5 seconds and Herdr makes the pane late, the file can
  open in both the viewer and the original app.
- A request is ignored when its time is more than 5 seconds off, its id is not
  `[A-Za-z0-9_-]+`, or its path is not absolute.
- Two viewers in one tab: whichever creates the answer file first takes the file.
- Notices, tooltips and command output are in Korean.

## Done when

Set up: run `./install.sh`, then in a terminal
`router() { "$HOME/Applications/Side Viewer Router.app/Contents/MacOS/SideViewerRouter" "$@"; }`.
Have an agent's conversation in Herdr print the paths of a markdown file, a code file and
an image, as an absolute path, a relative path, a path with a line number (`app.ts:12`)
and a path in code formatting.

1. `./install.sh` prints `check passed`, `built …/Side Viewer Router.app`, and the
   `--make-default` command. Where the router was already built, `router --status` reads
   the same before and after: installing changes no default app. (AC-10)
2. `router --status` prints one line per extension: extension, current default app, recorded
   original app or `-`. (AC-5)
3. `router --make-default` first prints `macOS 확인 창이 N번 뜹니다.`, and exactly N windows
   follow. Pick the router in every window but one, and keep the current app in that one:
   the output lists the kept extensions under `유지를 선택함`, the rest under `바뀜`, the
   exit code is 3, and `router --status` agrees. No code extension changed. (AC-5)
4. `router --make-default` again asks only for what was kept; pick the router. Afterwards
   no line of `original-apps.tsv` names `dev.ukkiee.side-viewer-router`. (AC-5)
5. `router --make-default code` announces its windows and takes over the code extensions.
   (AC-5)
6. With no side viewer in the tab, cmd-click the markdown path: a pane appears to the right
   of the focused pane with the document rendered, the file name and folder in the header.
   The same works for the relative path, the line-number path (shown from the top) and the
   code-formatted path. (AC-1, AC-8)
7. Cmd-click the code path with the viewer showing: the pane count stays, the content
   becomes the code with line numbers and syntax colors, and it can't be edited. `←` appears;
   clicking it shows the markdown again, and `←` is gone. (AC-2, AC-3)
8. Cmd-click the image path: the picture shows, no wider than the pane, and shrinks as the
   pane is narrowed. A `.log` or `.csv` file shows as code without colors. (AC-3)
9. In another tab without a viewer, cmd-click a path: a new pane appears in that tab.
   (AC-1, AC-2)
10. With a file showing, change it on disk: the content updates without a click. Delete it:
    `이 파일은 더 이상 없습니다.` Put it back: the content returns. (AC-6)
11. In a markdown document, click a link to another markdown file (relative link): it opens
    in the same viewer and `←` returns. An `https` link opens in the browser. A link to a
    local non-markdown file only shows it in Finder. (AC-7)
12. The source/rendered switch shows for markdown only and flips the view. `원래 앱으로
    열기` opens the file in its original app and the side viewer does not change.
    `Finder에서 보기` opens a Finder window with the file selected. Narrow the pane: name
    and folder are cut short, the buttons stay. (AC-8)
13. Open, one at a time: a text file over 1 MB with a listed extension, an image over
    20 MB, an empty file, a file with mode 000, and a text file renamed to `.png`. Each
    shows its notice (`뷰어에서 열기에는 너무 큽니다.` for the two large ones,
    `이 파일은 비어 있습니다.`, `이 파일을 읽을 수 없습니다.`,
    `이 종류의 파일은 뷰어에서 열 수 없습니다.`) with both buttons working, and
    `herdr-app status` reports no mod error. (AC-9)
14. `herdr-app do pane.split --direction right --mod side-viewer --props '{"file":"/etc/hosts"}'`
    shows `이 종류의 파일은 뷰어에서 열 수 없습니다.` with both buttons. (AC-9)
15. In Finder, open a taken-over file with Herdr not in front: it opens in the original app
    `router --status` lists, and no side viewer opens or changes. A `.mdx` file with no
    recorded original app opens in TextEdit. (AC-4)
16. In a terminal, with a real markdown file:
    `SIDE_VIEWER_HERDR_APP=/nonexistent sh "$HOME/Applications/Side Viewer Router.app/Contents/Resources/open.sh" /path/to/file.md /Applications/Herdr.app`
    opens the file in its original app, and no side viewer opens. (AC-11)
17. `node --test mods/side-viewer/` passes with no failures; it covers the cases where
    `herdr-app` is missing, errors, or does not answer. (AC-11, AC-2, AC-3, AC-7, AC-9)
18. `router --restore` announces its windows, and exactly that many follow; pick the original
    app in each. `바뀜` lists only extensions that left the router; any that stay are under
    `라우터에 남음`. `router --status` then shows the router only for those, none of which
    has a recorded original app, and the same files open from Finder as before the
    take-over. (AC-5)
