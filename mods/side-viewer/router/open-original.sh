#!/bin/sh
# Opens a file in the original app of its extension: the app that was the default before the
# router took over. `open -b` names the app directly, so the file cannot come back to the router.
#   open-original.sh <file>
set -u
here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib.sh"

file="${1:?usage: open-original.sh <file>}"
name=$(basename "$file")
case "$name" in
  *.*) ext=$(printf '%s' "${name##*.}" | tr '[:upper:]' '[:lower:]') ;;
  *) ext="" ;;
esac

fallback=$(fallback_app "$ext")
app=$(recorded "$ext")
# A record naming the router would loop forever.
if [ -z "$app" ] || [ "$app" = "${SIDE_VIEWER_ROUTER_ID:-}" ]; then app="$fallback"; fi

open -b "$app" "$file" && exit 0
# The recorded app may have been uninstalled since.
[ "$app" = "$fallback" ] && exit 1
exec open -b "$fallback" "$file"
