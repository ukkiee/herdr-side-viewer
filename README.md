# Side Viewer

A mod for the [Herdr](https://herdr.dev) desktop app, macOS only. Cmd-click a file path in
an agent's conversation and the file opens in a pane to the right of it, instead of in
another app:

- **Markdown** (`md`, `markdown`, `mdx`) is rendered. A header button switches to the source.
- **Code and text** open in a read-only editor with line numbers and syntax colors.
- **Images** are drawn no wider than the pane.

A viewer already showing in the tab takes the next file, so panes don't pile up, and `←`
goes back to the file before. The viewer reloads when the file changes on disk. Outside
Herdr (Finder, another terminal) the same files keep opening in the app they opened in
before.

## How it works

Herdr hands a cmd-clicked path to macOS, which opens it in the default app for that kind of
file. So this repo ships a small background app, the **router**, that you make the default
app for a list of extensions. For each file it receives, it looks at which app is in front:
Herdr sends the file to the side viewer, anything else sends it to the **original app**,
the one that was the default before. The router takes over only when you run the take-over
command below (the one exception is under [Limits](#limits)), and one command gives
everything back.

## Install

Needs the Herdr app (`herdr-app` on your `PATH`) and Xcode's command line tools
(`xcode-select --install`), which build the router.

```sh
./install.sh
```

from a clone of this repository. It runs `herdr-app check` on the mod, builds
`~/Applications/Side Viewer Router.app`, and copies the mod into
`~/.config/herdr-app/mods/side-viewer` (or `$HERDR_APP_HOME`). If the check or the build
fails, the mod and the router that were installed stay as they were. It does not run the
take-over command below; building alone can still make the router the default for an
extension no other app claims (see "Building alone can change a default" under
[Limits](#limits)). Run it again after `git pull` to update.

## Take over the extensions

The router's commands are flags of its binary. A shell function saves typing:

```sh
router() { "$HOME/Applications/Side Viewer Router.app/Contents/MacOS/SideViewerRouter" "$@"; }

router --make-default        # markdown and image extensions
router --make-default code   # the same, plus the code extensions
```

macOS asks you to confirm every change of a default app, once per file type, and no app can
answer for you. Extensions of one file type (`jpg`, `jpeg`, `jpe`) share one window. The
command first prints how many windows are coming (`macOS 확인 창이 N번 뜹니다.`) and then
sends the requests one at a time, waiting up to 300 seconds for each answer. `code` covers
many more file types, which is why it is opt-in.

In each window pick **Side Viewer Router**. If you pick the button that keeps the current
app, that extension stays as it was, and the command lists it under `유지를 선택함`
("chose to keep") rather than as a failure. Changed extensions are listed under `바뀜`,
real failures under `실패` with the reason.

Before asking, the command records each extension's original app in
`~/.config/herdr-app/data/side-viewer/original-apps.tsv`. Running it again never replaces
that record with the router itself.

Exit codes: `0` everything asked for changed (or nothing needed changing), `1` a request
failed, `2` wrong usage, `3` nothing failed but you kept the current app for some.

## Give them back

```sh
router --restore
```

asks macOS to return every extension the router still holds to its original app. The
windows come up again, once per file type, and this time you have to pick **the original
app**: keeping the current one leaves the router in place for that extension. An extension
whose default you changed yourself in the meantime is left alone. If a recorded original
app has been uninstalled since, the command says so and asks for a sibling extension's app
instead, or for TextEdit (Preview for images).

Run it before you delete the router app: the record it restores from is of no use without
the command.

## See where things stand

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
| code | `log` `json` `jsonc` `yaml` `yml` `toml` `js` `mjs` `jscript` `javascript` `cjs` `jsx` `ts` `tsx` `css` `scss` `py` `go` `rs` `rb` `rbw` `java` `jav` `kt` `swift` `c` `h` `cpp` `cp` `c++` `cc` `cxx` `sh` `zsh` `sql` `xml` `csv` | `--make-default code` |

Some are there only because macOS sets default apps per file type, so they come along with
a sibling: `jpe` with `jpg`, `svgz` with `svg`, `jscript` and `javascript` with `js`, `rbw`
with `rb`, `jav` with `java`, `cp` `c++` `cc` `cxx` with `cpp`.

## Limits

- **macOS only.**
- **Line numbers are ignored.** Clicking `app.ts:12` shows the file from the top.
- **Everything not in the list opens as it does today**: files without an extension,
  extensions outside the list, and `txt`, `diff`, `patch` and `html`, which are left out on
  purpose (`txt` would drag in extensionless text files such as `README`; `diff` and `patch`
  share a file type but can have different original apps; `html` is tied to the browser
  setting).
- **Paths printed by a terminal on another machine are not supported.**
- **Web addresses go to the browser**, not the viewer. A web or mail link inside a markdown
  document is handed to macOS; a link to another markdown file opens in the viewer, and a
  link to any other local file only shows it in Finder.
- **Images inside a markdown document are not shown.**
- **Too big to draw**: text over 1 MB and images over 20 MB get a notice instead. The
  header's buttons still open the file in its original app or show it in Finder.
- **Restore can merge apps within one file type.** macOS keeps one default per file type,
  yet two extensions of a type can open in different apps (seen with `js` and `mjs`; also
  possible for `svg`/`svgz`, `rb`/`rbw`, `cpp`/`cp`). While the router holds them, each
  still goes to its own original app. After `--restore` they all open in the original app
  of the extension that comes first in the list.
- **Building alone can change a default.** An extension that no installed app claims
  (seen with `mdx`, `jsonc`, `rbw`, `cp`) goes to the router as soon as it is built, before
  any `--make-default`. Those have no original app on record, so the router opens them in
  TextEdit (Preview for images). `--restore` sets them to the app a sibling extension of
  the same file type opens in (`rb` for `rbw`, `cpp` for `cp`), and to TextEdit or Preview
  only when there is no such sibling (`mdx`, `jsonc`).
- **`.ts` video files pass through the router too.** macOS classes `.ts` as MPEG-2 video.
  Outside Herdr they still reach the original app.
- **Every file with a taken-over extension passes through the router**, also from Finder.
  It hands the file on to the original app and quits.
- **The router looks in the default places**: `~/.local/bin/herdr-app` and
  `~/.config/herdr-app`. With Herdr elsewhere, or if Herdr doesn't answer within 5 seconds,
  the file opens in its original app.
- **The viewer's notices and tooltips and the commands' output are in Korean.**

## Before you add it

The router is built on your machine from `mods/side-viewer/router/main.swift` and signed
ad hoc. The mod and the router run shell commands (`sh`, `open`, `stat`, `cp`, `rm` and
the like, and `herdr-app`), and read the files you open. They write to `~/.config/herdr-app/data/side-viewer/`:
the record of original apps, the request passed from the router to the viewer, and copies
of the images you view (deleted when the image changes, or when not shown for 30 days). Nothing reaches the network;
a web or mail link you click in a document is handed to macOS.

How it is built and what to watch for: [RECIPE.md](RECIPE.md).

## License

MIT
