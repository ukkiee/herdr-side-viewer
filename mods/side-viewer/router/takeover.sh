#!/bin/sh
# Decides what the router's --make-default, --restore and --status do. The router binary only
# reads and sets one default app at a time, so the decisions here can be tested with a fake one.
#   takeover.sh make-default | restore | status
# SIDE_VIEWER_ROUTER: the command that answers `--default-app <ext>` and `--set-default-app <ext> <id>`.
# SIDE_VIEWER_ROUTER_ID: the router's bundle id.
set -u
here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib.sh"

router="${SIDE_VIEWER_ROUTER:?set SIDE_VIEWER_ROUTER to the router binary}"
router_id="${SIDE_VIEWER_ROUTER_ID:-}"

current() { "$router" --default-app "$1" 2>/dev/null; }

make_default() {
  [ -n "$router_id" ] || { echo "SIDE_VIEWER_ROUTER_ID is not set" >&2; exit 2; }
  mkdir -p "$data"
  new="$record.new"
  : > "$new"
  # Record every extension before changing any: extensions that share a file type would
  # otherwise see the router as their default once the first of them is taken over.
  for ext in $(all_extensions); do
    app=$(current "$ext")
    # Already the router: keep what was recorded the first time.
    if [ -z "$app" ] || [ "$app" = "$router_id" ]; then app=$(recorded "$ext"); fi
    [ -n "$app" ] && [ "$app" != "$router_id" ] && printf '%s\t%s\n' "$ext" "$app" >> "$new"
  done
  # Extensions dropped from the list may still be held by the router: keep their record for restore.
  if [ -f "$record" ]; then
    while IFS='	' read -r ext app; do
      [ -n "$ext" ] || continue
      grep -q "^$ext	" "$new" || all_extensions | grep -qx "$ext" || printf '%s\t%s\n' "$ext" "$app" >> "$new"
    done < "$record"
  fi
  mv "$new" "$record"

  failed=""
  for ext in $(all_extensions); do
    "$router" --set-default-app "$ext" "$router_id" >/dev/null 2>&1 || failed="$failed $ext"
  done
  if [ -n "$failed" ]; then
    echo "could not take over:$failed" >&2
    exit 1
  fi
}

# Extensions in the list plus any that are only in the record.
known_extensions() {
  {
    all_extensions
    [ -f "$record" ] && cut -f 1 "$record"
  } | awk 'NF && !seen[$0]++'
}

restore() {
  [ -n "$router_id" ] || { echo "SIDE_VIEWER_ROUTER_ID is not set" >&2; exit 2; }
  failed=""
  for ext in $(known_extensions); do
    # Only what the router still holds: a default the person picked since then stays.
    [ "$(current "$ext")" = "$router_id" ] || continue
    app=$(recorded "$ext")
    if [ -z "$app" ]; then
      app=$(fallback_app "$ext")
      echo "$ext: no original app recorded, using $app"
    fi
    "$router" --set-default-app "$ext" "$app" >/dev/null 2>&1 || failed="$failed $ext"
  done
  if [ -n "$failed" ]; then
    echo "could not restore:$failed" >&2
    exit 1
  fi
}

# One line per extension: extension, current default app, recorded original app ("-" when none).
status() {
  for ext in $(known_extensions); do
    app=$(current "$ext")
    orig=$(recorded "$ext")
    printf '%s\t%s\t%s\n' "$ext" "${app:--}" "${orig:--}"
  done
}

case "${1:-}" in
  make-default) make_default ;;
  restore) restore ;;
  status) status ;;
  *) echo "usage: takeover.sh make-default|restore|status" >&2; exit 2 ;;
esac
