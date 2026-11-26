#!/bin/sh
# Installs or updates the side viewer mod in the Herdr app's home. Run it again after `git pull`.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
# Where an older version built its router app, as it chose it.
router=${SIDE_VIEWER_ROUTER_APP:-$HOME/Applications/Side Viewer Router.app}

# Everything is checked before anything is copied, so a missing tool leaves no half install.
if [ "$(uname)" != Darwin ]; then
  echo "Side Viewer is macOS only." >&2
  exit 1
fi
if ! command -v herdr-app >/dev/null 2>&1; then
  echo "herdr-app not found on PATH: install the Herdr app (https://herdr.dev), then run this again." >&2
  exit 1
fi

# A cmd-click reaches the viewer through a link handler (mods/side-viewer/link.js), which Herdr
# runs from 0.1.17 on.
version=$(herdr-app --version 2>/dev/null | awk '{ print $NF }')
if ! awk -v have="$version" 'BEGIN {
  if (have !~ /^[0-9]+(\.[0-9]+)*/) exit 1
  split(have, h, "."); split("0.1.17", w, ".")
  for (i = 1; i <= 3; i++) { if (h[i] + 0 > w[i] + 0) exit 0; if (h[i] + 0 < w[i] + 0) exit 1 }
  exit 0 }'; then
  echo "Side Viewer needs Herdr 0.1.17 or newer; herdr-app says '${version:-nothing}'. Update Herdr (Settings > Updates), then run this again." >&2
  exit 1
fi

herdr-app check "$here/mods/side-viewer"

# The whole folder goes over: the mod reads extensions.json and its icons from the app home
# while it runs. --delete takes out files an older version left there.
mkdir -p "$home/mods/side-viewer"
rsync -a --delete "$here/mods/side-viewer/" "$home/mods/side-viewer/"

# The keys in this repository's keys.json are merged into the person's: keys-merge.js decides,
# and a key they already use for something else stays theirs. Without Node they are told the
# lines to add, and the rest of the install does not need Node.
keys="$home/keys.json"
echo "Shortcut keys ($keys):"
if ! command -v node >/dev/null 2>&1; then
  echo "node not found: keys.json was not changed. Add these keys to it by hand:"
  cat "$here/keys.json"
elif ! node --input-type=module - "$keys" "$here/keys.json" "$here/scripts/keys-merge.js" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [file, wantedFile, merger] = process.argv.slice(2);
const { mergeKeys, replaceKeys } = await import(pathToFileURL(merger).href);
const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
const { text, lines } = mergeKeys(current, JSON.parse(fs.readFileSync(wantedFile, "utf8")));
for (const line of lines) console.log(`  ${line}`);
if (text !== null) replaceKeys({ fs, path }, file, text, process.pid);
EOF
then
  echo "keys.json was not changed. Add these keys to it by hand:"
  cat "$here/keys.json"
fi

# Herdr turns a mod's link handler on by itself only in a personal layout. The layouts it ships
# (these names) have to be cloned first.
layout=$(herdr-app status 2>/dev/null | sed -n 's/^ *"layout": "\([^"]*\)".*/\1/p')
case "$layout" in
  main | terminals | win98)
    echo "Note: the layout in use, '$layout', is one Herdr ships, so cmd-clicks do not reach the viewer yet."
    echo "  Clone it with: herdr-app do layout.clone --name $layout   (Herdr shows the copy and turns the viewer on there)"
    ;;
  "")
    echo "Note: the Herdr window is not open, so the layout was not checked. cmd-clicks reach the viewer only in a personal layout (README.md, \"Install\")."
    ;;
esac

# An older version opened cmd-clicked files through this app, the default app for some
# extensions. Deleting it first would leave those extensions with no record to give back.
if [ -d "$router" ]; then
  echo "Note: the router app of an older version is still installed. Give its extensions back, then delete it:"
  echo "  \"$router/Contents/MacOS/SideViewerRouter\" --restore"
  echo "  (README.md, \"Upgrading from the router\")"
fi

echo
echo "Installed."
