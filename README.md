# Side Viewer

**English** | [한국어](README.ko.md)

A side viewer for the [Herdr](https://herdr.dev) desktop app (0.1.17 or newer), macOS only.
Cmd-click a file path in an agent's conversation and the file opens in a pane to the right of
it, instead of in another app, also in a space on another machine. Read markdown drawn block
by block, read and edit code with syntax colors, look at images, save with cmd+S, give a file
a tab of its own, and put a document's shell command into a terminal's input line. `cmd-o`
lists the paths a conversation printed and opens the one you pick, for the paths a cmd-click
can't reach.

![Side Viewer](preview.png)

- **Markdown** (`md`, `markdown`, `mdx`): rendered block by block, in the manner of Warp's
  markdown view, with code blocks as cards. The header's `Rendered | Source` switch shows the
  source, which you can edit.
- **Code and text**: an editor with line numbers and syntax colors, and you can edit them.
  `html` is code here: you see and edit its source, not the page.
- **Images**: drawn no wider than the pane. An `svg` also has the `Rendered | Source` switch,
  and its source can be edited.
- **Saving** (cmd+S): edits are saved with cmd+S or the header's `Save` button, never on
  their own. The one exception is a checkbox click in a file without edits (see
  [Edit and save](#edit-and-save)).
- **One viewer per tab**: a viewer already showing in the tab takes the next file, so panes
  don't pile up, and `←` goes back to the file before. The viewer reloads when the file
  changes on disk.
- **Loading**: while a newly opened file is read, or an edited svg's preview is written, a
  small turning arc shows at the top left of the body, where a notice's text starts.
- **Viewer tab**: the header's `Open in New Tab` button gives the file a tab of its own.
- **`>_` on shell blocks**: types a code block's command into a shell pane below the viewer,
  without running it (except when a zsh's keys differ from the ones the viewer remembers, or
  the terminal's interrupt character was changed, see [Limits](#limits)).
- **Path picker** (`cmd-o`): a popup of the file paths in the focused conversation; pick
  one to open it beside the conversation (see [The path picker](#the-path-picker-cmd-o)).
- **Remote spaces**: in a space on a Linux machine or another Mac, the viewer shows, edits
  and saves that machine's files, and `>_` types into a shell there (see
  [Remote spaces](#remote-spaces)).
- **Outside Herdr** (Finder, another terminal) files keep opening in their default apps, as
  macOS decides: Side Viewer changes no default app.

### How a cmd-click opens a file

The mod is a **link handler**: Herdr hands it the cmd-clicks on terminal links that match the
rule in [`mods/side-viewer/mod.json`](mods/side-viewer/mod.json) (a path ending in one of
the [extensions](#extensions)), and
[`mods/side-viewer/link.js`](mods/side-viewer/link.js) decides what to do with each. Herdr
does this only in a personal layout (see [Turn on cmd-click](#turn-on-cmd-click)).

- **Which files.** A path in any terminal whose file has an extension in the
  [list](#extensions) and is a file on that terminal's machine.
- **Path forms.** Absolute paths, `~/…` (the home of the terminal's machine), paths
  relative to the clicked terminal's folder, paths with a line number (`a.md:12`,
  `a.md:12:3`, `a.md:12-20`; the number is dropped), paths in backticks, paths with ASCII
  punctuation after them, and `file://` links a program printed for that machine.
- **Letters stuck to the end make it no path.** `plan.md를` does not open; with a space,
  `plan.md 를`, it does.
- **Bare file names are not links.** Herdr does not make `RECIPE.md` or `c.json:3` a link,
  so a cmd-click on them does nothing; [the path picker](#the-path-picker-cmd-o) finds them.
- **Where it opens.** Beside the clicked conversation, the pane you clicked in, not the
  focused one. A side viewer showing in that tab takes the file, so no pane is added;
  otherwise a new viewer splits off to the right of the conversation. That pane becomes the
  conversation that last sent a file to the tab. A terminal a layout draws without a pane
  has no conversation: a viewer showing in its space takes the file, and with none the click
  goes on as below.
- **Everything else goes on.** A path the viewer can't show, or a file that doesn't exist,
  goes on to Herdr's usual opener on this Mac (the file's default app) and does nothing in a
  remote space.
- **Remote spaces.** On Linux and macOS machines a cmd-click works the same, on that
  machine's files. On a Windows machine it does nothing.

### The path picker (cmd-o)

`cmd-o` opens a popup at the top of the window with the file paths the focused conversation
printed, and opens the one you pick in the side viewer. It works the same in a space on this
Mac and in a [remote space](#remote-spaces). It is there for what a cmd-click can't reach:
bare file names (`RECIPE.md`), paths scrolled off the screen, and use from the keyboard
alone.

- **Which paths.** From the focused terminal's screen and the 1000 lines above it: absolute
  paths, `~` paths, paths relative to the terminal's folder, paths with a line number
  (`a.md:12`, `a.md:12:3`, `a.md:12-20`; the number is dropped) and paths in backticks. Only
  files with an extension in the [list](#extensions) that exist on that terminal's machine,
  newest (lowest on screen) first, each once, at most 30. Each row shows the file name and
  its folder.
- **Picking.** Type to keep only the paths that contain what you typed (case ignored). ↑↓
  move, Enter or a click opens. Esc, the `Esc` button or a click beside the popup closes it
  and changes nothing.
- **Where it opens.** A side viewer showing in the conversation's tab takes the file, so no
  pane is added; otherwise a new viewer splits off to the right of the conversation. The
  popup closes once that is settled, within about half a second.
- **Focus.** With focus on a side viewer beside a conversation, the picker reads the
  conversation that last sent a file to that tab (by cmd-click or this picker) while it is
  still a terminal in the tab, else the tab's conversation (an agent's terminal first).
  Anywhere else without a terminal (a viewer tab, another mod) it says
  `Click a conversation terminal, then press again.`
- **Its other lines**: a small turning arc while it looks, at the left where these lines
  start, `This conversation shows no file path to open.`,
  `No path matches.`, the two remote notices below, and `Couldn't look for paths: <reason>`
  for any other failure (the terminal closed, say).

### Remote spaces

A side viewer reads and writes the files of the machine its space is on. In a space on
another machine connected to Herdr, open a file with a cmd-click or `cmd-o`; links, `←` and
viewer tabs then stay on that machine. Linux and macOS machines are supported.

- **The same as on this Mac**: markdown (rendered and source), code, images with the svg
  switch, pictures in markdown (relative to the document's folder, or absolute, on that
  machine), the size limits and notices, editing, cmd+S, checkboxes, `Changed on disk`,
  the save failures, and `Open in New Tab`, which opens the tab in the same remote space and
  takes unsaved edits along.
- **No `Open in Default App` or `Show in Finder`** in the header: both act on this Mac,
  where the file is not.
- **Changes show within about 3 seconds.** Every 3 seconds the viewer asks the machine for
  the file's checksum and reads the file again only when it changed. With unsaved edits it
  reads nothing over them and says `Changed on disk`, as on this Mac.
- **Saving** writes the file on that machine. Just before writing, the viewer reads it
  again: if it no longer holds the text last read, nothing is written and the status says
  `Changed on disk`. The file keeps its mode (an executable stays executable), and a file
  opened through a symbolic link stays a link, with its target changed. The text passes
  through a copy in the data folder on this Mac, deleted once the write ends. Failures show
  as on this Mac (`No write permission`, `File deleted`, `Too large to save`,
  `Couldn't save`).
- **Links** in a remote document: markdown, code and image files open in the viewer; any
  other file gets a notification, `Can't show this file`, with its path. `~` is that
  machine's home. Web and mail links open on this Mac.
- **Out of reach.** When the machine can't be reached, the viewer shows
  `Can't reach the machine <name>.` instead of `This file no longer exists.`, and the
  picker says the same. Unsaved edits stay in the editor, the status beside the file name
  says `Can't reach <name>` with the save button still there, and a save meanwhile fails
  the same way. Once the machine is back, the status goes and the viewer reads the file
  again at its next check.
- **Just after Herdr starts**, a remote viewer whose space Herdr hasn't listed yet shows
  a turning arc and reads and saves nothing; it reads the file once the space is listed.
- **Windows machines are not supported.** The viewer and the picker show
  `Files on Windows machines can't be shown yet.`, and a cmd-click there does nothing.
- **`>_` types into a shell on that machine.** The shell pane opens there, in the folder of
  the conversation terminal beside the viewer on that machine, the one that last sent a file
  to the tab first (in a viewer tab, the document's folder; without either, that machine's
  home). The zsh is the one `command -v zsh`
  finds in that machine's login shell, else the first of `/bin/zsh`, `/usr/bin/zsh`,
  `/usr/local/bin/zsh` and `/opt/homebrew/bin/zsh` there. With none, no pane opens and a
  notification says `There's no zsh on that machine, so it can't be inserted. Use the copy
  button and paste it.` The command passes through a file in `~/.cache/side-viewer/shell/` on
  that machine (folder mode 700), which the shell deletes as it takes it, and the zsh's
  keymap through a `.keymap` file beside it, which the viewer deletes once read; nothing goes into
  the data folder on this Mac. The viewer waits longer for that shell: 1.5 seconds after the
  key, 5 seconds after the line that teaches it.
- **`>_` on a machine out of reach** opens no pane and types nothing; the notification says
  `Can't reach the machine <name>`.

### Edit and save

- **Where.** The markdown source, the svg source and the code view take typing. The
  markdown rendering, images (an svg's picture too), the code block cards inside a
  document and the notices do not. An empty (or blank) markdown or svg file shows
  `This file is empty.` on its rendering side, and its `Rendered | Source` source is ready
  to type; back on the rendering, what was typed is drawn. An empty (or blank) code file
  opens as an empty code view. An empty `svgz` or picture still gets only the notice.
  An `svgz` has no source view. The sources wrap long
  lines to the pane; the code view does not. All three have line numbers.
- **Edited.** Once you change something, the header shows `Edited` and a `Save`
  button. cmd+S or the button writes the file and both go away; so does undoing your
  change by hand. cmd+S with nothing changed does nothing. That spot in the header is the
  file's status: a failed save or a change on disk shows there too, in red, in place of
  `Edited`. In a narrow pane the file name and folder are cut first, then the status;
  hover it to read all of it.
- **Kept per file, until the pane closes.** Edits not yet saved stay with that viewer, for
  each file: follow a link, go back, or cmd-click another file, and when you return to the
  file your edits and their status are back. Closing the pane or quitting Herdr drops them,
  and nothing asks first.
- **Preview before saving.** Switch an edited source to `Rendered` and you see the document,
  or the svg's picture, drawn from your edits. The file is not written.
- **Changed outside.** If the file changes on disk while you have edits (an agent wrote
  it, say), the viewer does not read it over them. The status says `Changed on disk`,
  and two buttons take the place of `Save`: `Reload` (drop your edits and show the
  disk) and `Overwrite` (save yours over it). A save that finds the file changed since the
  viewer last read it writes nothing and shows the same. You can keep typing meanwhile.
  Without edits the viewer reloads by itself, as before.
- **Save failures.** When a save fails, the status says why, `Save` stays, and your
  edits stay: `No write permission`, `File deleted` (this also shows as soon as an edited
  file disappears), `Too large to save` (over 1 MiB, 1,048,576 bytes), or `Couldn't save`
  for anything else, where hovering it shows the error.
- **Checkboxes.** Clicking a task box (`- [ ]`) in the rendering flips it and turns that
  source line's `[ ]` into `[x]` or back. With no edits in the file it is saved at once,
  the one exception to "never on their own"; if the file changed on disk meanwhile, nothing
  is written and the status says `Changed on disk`. With edits, the click joins them and
  stays `Edited`.

### Open in a new tab

The header's `Open in New Tab` button (the leftmost of the three icons on the right, there
while a file is drawn, not on a notice such as `Too large to open in the viewer.` or
`This file no longer exists.`) opens a
**viewer tab**: a tab right after the current one, in the same space, holding only a side
viewer of this file, and switches to it. The tab is named after the file and follows it
through links, `←` and new files. It starts with an empty history. The same file opens a new
tab every time. Unsaved edits move with the file: the new tab shows them with their status,
and the viewer you left shows the disk text.

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
  the conversation terminal beside the viewer (in a viewer tab, the document's folder). With
  two conversations in the tab, that is the one that last sent a file to the tab (by cmd-click
  or the path picker) while it is still there, else an agent's terminal first. The
  next `>_` goes into the same shell pane while it is open. If that shell is running a
  program, nothing is typed and a notification says so (`Not inserted into the terminal`). When it
  first opens the shell pane it writes the command to a file in the data folder and sends zsh
  one line that teaches it a key, `ctrl+alt+F12`, puts that file's command in and clears the
  screen, so no line is left on the shell's screen. After that `>_` writes the file and
  presses only that key. Text you had typed at the prompt is moved aside with zsh's push-line
  and comes back after the command (with vi keys too). The line also leaves zsh's keymap in a
  file beside the command's, under a mark new for each press, so when a new zsh started in
  that pane is taught again, typed text is moved aside there too with emacs keys, and erased,
  not run, with vi keys or when the keymap is not known, as it is when that file carries
  another press's mark (see [Limits](#limits)). If the shell has not taken the file
  half a second after the key (3 seconds after the line), a notification says the command did
  not go in (`Couldn't insert into the terminal`) and the next `>_` teaches the shell again. In
  a remote space the shell and its file are on that machine (see
  [Remote spaces](#remote-spaces)).
- **Pictures.** A local picture on a line of its own (`![alt](path)`, relative to the
  document's folder, or absolute) is drawn in the document: as wide as the pane at most,
  never larger than itself, at most 420 high, centered. One that can't be read shows
  `Couldn't read image: <path>` in its place.

### Language

The viewer speaks Korean when macOS's first preferred language
(the first entry of `defaults read -g AppleLanguages`) is Korean, and English otherwise.
There is no switch.

- **The viewer** reads the language when it opens, and every viewer, viewer tabs included,
  follows the language the newest one read. After you change the system language, viewers
  already open switch only once you open a new one (cmd-click a file in a tab without a
  viewer, or `Open in New Tab`); they don't read it again on their own.
- **When it can't be read**, a viewer keeps the language it had (English the first time)
  and asks again after 1, 3 and 10 seconds, then every 15 seconds until it gets an answer.
- **Not translated**: code block labels (`Shell`, `JavaScript` and so on), file names and
  paths, the error Herdr gives (shown when hovering `Couldn't save`), and the header's
  `Side Viewer` when no file is open.

## Before you add it

- **Programs**: the mod is plain JavaScript run by Herdr; nothing is built. It runs shell
  commands (`sh`, `open`, `stat`, `cp`, `rm`, `sleep` and the like, and `herdr-app`), and
  reads the files you open. To pick the language, the viewer runs
  `defaults read -g AppleLanguages`. For a cmd-click, Herdr runs the mod's `handleLink`
  (`link.js`), which checks that the file exists with one `sh` on the clicked terminal's
  machine. The path picker reads the focused terminal with `hc read` and checks which paths
  are files with one `sh` on that terminal's machine.
- **Programs on another machine**: in a remote space the viewer runs, on that machine
  through Herdr, `sh` (with `stat`, `head`, `od`, `uname`, `printf`) and `cksum`, and
  reads files there. To save a file there or copy a picture's bytes it runs Herdr's `hc`
  command line on this Mac (`hc file write --on`, `hc exec --on … cat`), the `hc` on your
  `PATH`, else `~/.local/bin/hc`. For `>_` it asks that machine's login shell once for zsh
  (`sh -l -c`), writes the command file with `sh` (`mkdir`, `chmod`, `printf`), removes one the
  shell left with `rm`, and opens a zsh pane there.
- **Herdr's shared state**: the viewer keeps the language last read under
  `side-viewer.lang` (`"en"` or `"ko"`), which every viewer reads, and the conversation pane
  that last sent a file to each tab under `side-viewer.conversations`
  (`{ "<tab id>": "<pane id>" }`), with tabs that are gone taken out. Each new viewer it
  opened is listed under `side-viewer.openings` as `{ "id": "<opening id>", "tab": "<tab
  id>" }` (`tab` is null while that tab is not known, and filled in with its conversation's
  tab once that pane shows, when the viewer starts again or takes a file; never from the
  focus), all of those of tabs still open and the
  latest 50 of the rest, so a viewer that starts again (after a mod file is saved or the app
  restarts) does not put back a conversation another file was sent from since.
- **Your files**: the mod writes a file when you save it or click a checkbox in it, on the
  machine of the viewer's space.
- **Another machine's home**: `>_` in a remote space writes its command to
  `~/.cache/side-viewer/shell/<machine>_<terminal>.txt` there (folder mode 700, file mode
  600), deleted by the shell as it puts it in the input line, or by the viewer when the shell
  has not taken it. The line that teaches the shell writes that press's mark and its keymap to
  `<machine>_<terminal>.keymap` beside it, which the viewer reads and deletes once the shell
  has taken the command.
- **Herdr's keys**: `install.mjs` adds `cmd-o` to Herdr's `keys.json` (see [Install](#install)).
- **Herdr's layout**: Herdr adds `side-viewer` to the `link_handlers` of the personal layout
  in use (see [Turn on cmd-click](#turn-on-cmd-click)).
- **Terminal**: the `>_` button opens a zsh pane and types into it through Herdr's `hc`
  (`hc send`, `hc keys`, `hc get`). A shell it opens gets one line binding an insert widget
  to `ctrl+alt+F12`, and a new zsh started there gets it again.
- **Network**: the mod opens no connection of its own. A file on another machine is read
  and written through Herdr's connection to that machine. A web or mail link you click in a
  document is handed to macOS.
- **Data folder** (`~/.config/herdr-app/data/side-viewer/`): the mod writes:
  - `request.json` and `answer-<id>`, the request a cmd-click or the path picker passes to
    a viewer already showing;
  - `images/`, copies of the images you view and of the pictures inside markdown documents,
    those from another machine too;
  - `remote-saves/`, the text of a save to another machine on its way there, deleted once
    the write ends (one left by a quit in the middle is deleted by a remote save at least
    10 minutes later);
  - `previews/`, copies of edited svg sources, drawn before they are saved;
  - `handoff-<id>.json`, the unsaved edits handed to a new viewer tab, deleted once the tab
    has read them (one can be left behind if Herdr quits in between);
  - `shell/<terminal>.txt`, the command `>_` hands to a shell pane on this Mac, deleted by the shell as it
    puts it in the input line, or by the viewer when the shell has not taken it (one can be
    left behind if an `hc` call fails; the next `>_` replaces it);
  - `shell/<terminal>.keymap`, the press's mark and the keymap of the zsh last taught there, written by that line
    and deleted by the viewer once read (one can be left behind if the shell took the line
    late; the next line replaces it).

  A copy in `images/` or `previews/` is deleted when a newer copy of the same file replaces
  it, or when not shown for 30 days.

How it is built and what to watch for: [RECIPE.md](RECIPE.md).

## Install

Needs macOS, the Herdr app **0.1.17 or newer** (`herdr-app` on your `PATH`), **Node** to
run the installer, and a **personal layout** (see [Turn on cmd-click](#turn-on-cmd-click)).

```sh
git clone https://github.com/ukkiee/herdr-side-viewer
cd herdr-side-viewer && node install.mjs
```

`install.mjs` checks the Herdr version (`herdr-app --version`), runs `herdr-app check` on the
mod, and copies the mod into `~/.config/herdr-app/mods/side-viewer` (or `$HERDR_APP_HOME`):
it writes only the files that changed, leaves out the tests, and takes out files an older
version left there. An older Herdr or a failed check stops it
before anything is copied, and the mod that was installed stays as it was; for an older
Herdr it says `Side Viewer needs Herdr 0.1.17 or newer`. It also stops, changing nothing,
when `mods/side-viewer` in the app home is a symlink (for example to this checkout, for
live development); remove the link to install a copy. It also prints a note when the
layout in use is one Herdr ships, when the Herdr window is not open (the layout is then not
checked), and when the router app of an older version is still installed (see
[Upgrading from the router](#upgrading-from-the-router)). **Run it again after `git pull`
to update.**

### Turn on cmd-click

Herdr hands cmd-clicks to a mod's link handler only in a **personal layout**. The first time
Herdr sees Side Viewer on a personal layout, it adds the mod to that layout's root:
`"link_handlers": ["side-viewer"]`.

- **A layout Herdr ships** (`main`, `terminals`, `win98`) has to be cloned first:
  `herdr-app do layout.clone --name <name>` makes `<name>-copy` and switches to it, and Herdr turns the
  viewer on there.
- **Taken out of `link_handlers`** by hand, the mod stays out: add `"side-viewer"` back to
  that list yourself.

### The cmd-o shortcut

`install.mjs` also merges the path picker's key into Herdr's `keys.json`:
`"cmd-o": "mod.open:side-viewer"` under `global`. It prints what it did under
`Shortcut keys`.

- **Already there**: left as it is, so running it again adds nothing.
- **`cmd-o` bound to something else**, in any section (`global`, `terminal`, `layout:*`,
  `mod:*`): left as it is, and the output says so. Bind `mod.open:side-viewer` to another
  key yourself.
- **No `keys.json` yet, or a `keys.json` that isn't valid JSON**: nothing is
  changed and the output shows the line to add by hand.
- Other keys are never touched, and a `keys.json` that is a link stays a link.

**A changed `keys.json` no longer gets new default keys.** On an upgrade Herdr gives new
default shortcuts only to a keys file nobody edited; once this line is in, any new default
key has to be added by hand.

### Upgrading from the router

An older version opened cmd-clicked files through a background app,
`~/Applications/Side Viewer Router.app`, made the default app for the extensions. If it is
still installed, give those extensions back to their apps **before you delete it**: the
record it gives them back from is of no use without the app.

```sh
"$HOME/Applications/Side Viewer Router.app/Contents/MacOS/SideViewerRouter" --restore
```

1. macOS shows one confirmation window per file type. Before each, the command prints
   `Window i/N: <extensions> (now Side Viewer Router → <app>)` (in Korean on a Mac set to
   Korean).
2. In each window pick the app that line names, **not Side Viewer Router**.
3. Extensions no other app claims (`rbw` and `cp`, for example) stay with the router until
   the app is deleted.
4. Delete `~/Applications/Side Viewer Router.app`, then run `node install.mjs`.

## Extensions

The list lives in [`mods/side-viewer/extensions.json`](mods/side-viewer/extensions.json);
the link rule in `mod.json` is made from it, and the viewer reads it.

| Shown as | Extensions |
|---|---|
| Markdown | `md` `markdown` `mdx` |
| Image | `png` `jpg` `jpeg` `jpe` `gif` `webp` `svg` `svgz` |
| Code | `log` `json` `jsonc` `yaml` `yml` `toml` `js` `mjs` `jscript` `javascript` `cjs` `jsx` `ts` `tsx` `css` `scss` `py` `go` `rs` `rb` `rbw` `java` `jav` `kt` `swift` `c` `h` `cpp` `cp` `c++` `cc` `cxx` `sh` `zsh` `sql` `xml` `csv` `html` `htm` `shtml` `shtm` |

## Limits

- **macOS only**, for the Herdr app this runs in. Remote spaces can be on Linux or macOS
  machines; **Windows machines are not supported** (the viewer says so).
- **Herdr 0.1.17 or newer, in a personal layout.** In a layout Herdr ships, a cmd-click
  never reaches the viewer (see [Turn on cmd-click](#turn-on-cmd-click)).
- **Line numbers are ignored.** Clicking or picking `app.ts:12` shows the file from the top.
- **Everything not in the list opens in its default app**: files without an extension and
  extensions outside the list, `txt`, `diff` and `patch` among them. In a remote space a
  cmd-click on them does nothing.
- **Every `.ts` file opens as code**, a `.ts` video (MPEG-2) too. The header's
  `Open in Default App` hands it to the app macOS would use.
- **`html` is shown as code**, never drawn as a page.
- **Not drawn in markdown**: `mermaid` diagrams (shown as a code card), math, GitHub alert
  boxes, HTML tags, definition lists, pictures from the web (`https`), and pictures inside a
  paragraph rather than on a line of their own. Web pictures are never fetched.
- **No autosave and no "save changes?" prompt.** Edits not saved are gone when the pane
  closes or Herdr quits. The one save without cmd+S is a checkbox click on a file without
  edits.
- **The first `>_` after starting a new zsh in the shell pane clears its screen, and can take
  a second press.** If you ran `zsh` there, or `exec zsh` with other arguments than the zsh
  taught last, the viewer sees a new zsh and sends it the line that teaches it the insert key
  again, then `clear`. When the arguments match (a second `exec zsh` in a row, say), it
  can't tell: that `>_` leaves `;7~` in the input line, a notification says
  `Couldn't insert into the terminal`, and the next `>_` teaches the shell again. Before that
  line, text typed at the prompt is cleared by the keymap the last taught zsh there had: with
  emacs keys it is moved aside with alt+q and comes back after the command; with vi keys, or
  when the keymap is not known, `ctrl+c` erases it, so it is lost but never run. The viewer
  learns a keymap only when it teaches a zsh, so in two cases the keymap it remembers is
  wrong, a zsh with vi keys gets alt+q, and its typed text can run along with that line. One
  is the same zsh changing its keys after it was taught (`bindkey -v`) and being taught
  again, as by the `>_` after that notification. The other is a new zsh with vi keys after
  one taught with emacs keys (say, a new zsh started with other settings). The same can
  happen with vi keys, or when the keymap is not known, if the terminal's interrupt
  character was changed (`stty intr`): `ctrl+c` then does not clear the prompt, and typed
  text can run along with that line. Clear the prompt
  before a `>_` that teaches a zsh again: the first after starting a new zsh, and the one
  after that notification.
- **`>_` needs zsh, on another machine too.** A machine with none gets no shell pane, only a
  notification; use the copy button there.
- **No keyboard navigation** between blocks, no `cmd+E` for the source switch, no filling in
  of `{{placeholders}}` in commands.
- **A path with letters stuck to its end doesn't open.** `/tmp/notes/plan.md에서` is not
  taken for a path, so the click opens nothing. With a space after the path it opens.
- **A bare file name can't be cmd-clicked.** Herdr makes no link of `RECIPE.md` or
  `c.json:3` without a folder in front, so the click does nothing; use `cmd-o`.
- **A cmd-click on a Windows machine does nothing**, as the viewer can't show its files.
- **A remote save has a gap of under a second.** The viewer reads the file there again just
  before writing it, so a change that lands in between is overwritten without
  `Changed on disk`.
- **The path picker misses some paths.** A path with a space or one of `,;=*` in it is
  found only inside backticks. A path longer than the terminal is wide, wrapped onto two
  lines on screen, is still found.
- **A new viewer tab doesn't take the keyboard until you click in it.** Right after
  `Open in New Tab`, cmd+S does nothing; click anywhere in the tab, then cmd+S saves.
- **Web addresses go to the browser**, not the viewer. A web or mail link inside a markdown
  document is handed to macOS; a link to another markdown file opens in the viewer, and a
  link to any other local file only shows it in Finder (in a remote space, see
  [Remote spaces](#remote-spaces)).
- **Too big to draw**: text over 1 MB and images over 20 MB get a notice instead. On this
  Mac the header's buttons still open the file in its default app or show it in Finder. An `svg`
  over 1 MB is drawn but has no source switch.
- **English and Korean only**, picked from macOS's first preferred language with no switch
  (see [Language](#language)). Viewers already open follow a changed system language only
  once a new viewer opens.

## License

MIT
