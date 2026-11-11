#!/bin/sh
# Installs or updates the side viewer mod in the Herdr app's home and builds the router app.
# Run it again after `git pull`.
# It never runs the take-over command. That is a separate command, printed at the end, because
# macOS asks the person to confirm every change and they should choose when that happens.
# Building can still make the router the default app for an extension no other app claims
# (README.md, "Limits": "Building alone can change a default").
set -eu
here=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
app=${SIDE_VIEWER_ROUTER_APP:-$HOME/Applications/Side Viewer Router.app}

# Everything is checked before anything is copied, so a missing tool leaves no half install.
if [ "$(uname)" != Darwin ]; then
  echo "Side Viewer is macOS only: the router is a macOS app." >&2
  exit 1
fi
if ! command -v herdr-app >/dev/null 2>&1; then
  echo "herdr-app not found on PATH: install the Herdr app (https://herdr.dev), then run this again." >&2
  exit 1
fi
# /usr/bin/swiftc exists even without the tools, so ask xcode-select whether they are there.
if ! command -v swiftc >/dev/null 2>&1 || ! xcode-select -p >/dev/null 2>&1; then
  echo "swiftc not found: install Xcode's command line tools with 'xcode-select --install', then run this again." >&2
  exit 1
fi

# The mod is checked where it is and the router is built before anything is copied: a run
# that fails must not leave a new mod beside an old router, or the other way round.
herdr-app check "$here/mods/side-viewer"

# The scripts and the extension list are copied into the app, hence the rebuild on every run.
sh "$here/mods/side-viewer/router/build.sh"

# The whole folder goes over: the mod reads extensions.json and its icons from the app home
# while it runs.
mkdir -p "$home/mods/side-viewer"
cp -R "$here/mods/side-viewer/." "$home/mods/side-viewer/"

# macOS starts the router without this shell's environment, so it only finds the defaults.
if [ ! -x "$HOME/.local/bin/herdr-app" ]; then
  echo "Note: the router runs $HOME/.local/bin/herdr-app, which is not there. Until it is, every file opens in its original app."
fi
if [ "$home" != "$HOME/.config/herdr-app" ]; then
  echo "Note: the router looks for the mod in $HOME/.config/herdr-app, not in $home."
fi

echo
echo "Installed. The take-over command has not been run. To make the router the default app for markdown and image files:"
echo "  \"$app/Contents/MacOS/SideViewerRouter\" --make-default"
echo "An extension that no other app claims may already open through the router: see \"Building alone can change a default\" in README.md."
echo "macOS asks you to confirm once per file type; the command says how many times first. README.md has the rest."
