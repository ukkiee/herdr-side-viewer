#!/bin/sh
# macOS only. The router calls this for every file it is handed.
#   open.sh <file> <front app>
# <front app> is the path (or name) of the app that was in front when the file was opened.
# Herdr in front (a cmd-click on a path in a terminal): the file opens in a side viewer pane.
# Anything else, or any failure on the way: the file goes to its original app.
# Environment, all optional: SIDE_VIEWER_HERDR_APP (the herdr-app program), SIDE_VIEWER_DATA
# (the data folder), HERDR_APP_HOME (Herdr's folder, where the mod is installed),
# SIDE_VIEWER_TIMEOUT (whole seconds to wait for herdr-app, 5 by default).
set -u
file="${1:?usage: open.sh <file> <front app>}"
front="${2:-}"
herdr="${SIDE_VIEWER_HERDR_APP:-$HOME/.local/bin/herdr-app}"

# The other scripts sit beside this one inside the built app, and in router/ in the repository.
here=$(cd "$(dirname "$0")" && pwd)
[ -f "$here/open-original.sh" ] || here="$here/router"
. "$here/lib.sh"

# `open -b` inside names the app, so the file cannot come back to the router.
original() { exec /bin/sh "$here/open-original.sh" "$file"; }

# The running Herdr may report no bundle id, so it is known by its path or its name.
case "$front" in
  *Herdr.app*|herdr-app) ;;
  *) original ;;
esac

[ -x "$herdr" ] || original
# Without the mod in Herdr's folder a split would only leave a broken pane behind.
[ -f "${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/side-viewer/main.js" ] || original

# The path travels as JSON. A control character (a newline in a name) is not worth escaping.
case "$file" in *[[:cntrl:]]*) original ;; esac
json_file=$(printf '%s' "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')

# Runs herdr-app with a time limit, so a Herdr that does not answer cannot swallow the click.
# Succeeds only if the command exited 0 and its answer holds no "error".
herdr_do() {
  answer=$(mktemp "${TMPDIR:-/tmp}/side-viewer.XXXXXX") || return 1
  "$herdr" do "$@" > "$answer" 2>&1 &
  pid=$!
  ticks=$(( ${SIDE_VIEWER_TIMEOUT:-5} * 20 ))
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$ticks" -le 0 ]; then
      kill "$pid" 2>/dev/null
      rm -f "$answer"
      return 1
    fi
    sleep 0.05
    ticks=$((ticks - 1))
  done
  wait "$pid"
  code=$?
  if grep -q '"error"' "$answer"; then code=1; fi
  rm -f "$answer"
  return "$code"
}

# Ticket 03 asks a viewer that is already showing to take the file here, and leaves when one
# answers. Requests and answers live in "$data". Until then every file gets a new pane.

herdr_do pane.split --direction right --mod side-viewer --props "{\"file\":\"$json_file\"}" || original
exit 0
