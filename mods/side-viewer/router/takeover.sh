#!/bin/sh
# Decides what the router's --make-default, --restore and --status do. The router binary only
# reads and sets one default app at a time, so the decisions here can be tested with a fake one.
#   takeover.sh make-default [code] | restore | status
# make-default takes over the markdown and image extensions; `code` adds the code extensions.
#
# macOS asks the person to confirm every change, once per file type, and the router cannot
# answer for them. So each run first says how many times macOS will ask, sends one request per
# file type, and reports the extensions the person chose to keep apart from real failures.
#
# Exit code: 0 everything asked for was changed (or nothing needed changing), 1 a request
# failed, 2 wrong usage, 3 nothing failed but the person kept the current app for some.
#
# SIDE_VIEWER_ROUTER: the command that answers `--default-app <ext>`, `--type-of <ext>` and
#   `--set-default-app <ext> <id>` (exit 0 changed, 1 macOS refused, 3 app not found,
#   4 no file type, 5 timed out).
# SIDE_VIEWER_ROUTER_ID: the router's bundle id.
set -u
here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib.sh"

router="${SIDE_VIEWER_ROUTER:?set SIDE_VIEWER_ROUTER to the router binary}"
router_id="${SIDE_VIEWER_ROUTER_ID:-}"

usage() {
  echo "usage: takeover.sh make-default [code] | restore | status" >&2
  exit 2
}

need_router_id() {
  [ -n "$router_id" ] || { echo "SIDE_VIEWER_ROUTER_ID is not set" >&2; exit 2; }
}

current() { "$router" --default-app "$1" 2>/dev/null; }

# Extensions of one file type share one default app and one confirmation window.
type_of() {
  type=$("$router" --type-of "$1" 2>/dev/null)
  printf '%s' "${type:-extension:$1}"
}

# Extensions in the list plus any that are only in the record.
known_extensions() {
  {
    all_extensions
    [ -f "$record" ] && cut -f 1 "$record"
  } | awk 'NF && !seen[$0]++'
}

# Sends the requests in $plan (lines of "<file type><TAB><extension><TAB><app>"), one per file
# type, after saying how many confirmation windows that means. $1 tells the person what to pick.
run_plan() {
  count=$(cut -f 1 "$plan" | awk 'NF && !seen[$0]++' | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    echo "바꿀 것이 없습니다."
    rm -f "$plan"
    return 0
  fi
  echo "macOS 확인 창이 ${count}번 뜹니다. $1"

  changed=""
  kept=""
  failed=0
  errors="$plan.err"
  types="$plan.types"
  cut -f 1 "$plan" | awk 'NF && !seen[$0]++' > "$types"
  while IFS= read -r type; do
    ext=$(awk -F '\t' -v type="$type" '$1 == type { print $2; exit }' "$plan")
    app=$(awk -F '\t' -v type="$type" '$1 == type { print $3; exit }' "$plan")
    group=$(awk -F '\t' -v type="$type" '$1 == type { printf "%s%s", sep, $2; sep = " " }' "$plan")
    before=$(current "$ext")
    "$router" --set-default-app "$ext" "$app" < /dev/null > /dev/null 2> "$errors"
    code=$?
    case "$code" in
      0) changed="$changed $group" ;;
      1)
        # macOS answers a "keep" in the window with an error and leaves the default app alone.
        # That is the person's choice, not a failure.
        if [ "$(current "$ext")" = "$before" ]; then
          kept="$kept $group"
        else
          failed=1
          echo "실패: $group (오류: $(tr '\n' ' ' < "$errors"))" >&2
        fi
        ;;
      3) failed=1; echo "실패: $group (앱 없음: $app)" >&2 ;;
      4) failed=1; echo "실패: $group (파일 종류 없음)" >&2 ;;
      5) failed=1; echo "실패: $group (시간 초과)" >&2 ;;
      *) failed=1; echo "실패: $group (오류: $(tr '\n' ' ' < "$errors"))" >&2 ;;
    esac
  done < "$types"
  rm -f "$plan" "$errors" "$types"

  [ -n "$changed" ] && echo "바뀜:$changed"
  [ -n "$kept" ] && echo "유지를 선택함:$kept"
  [ "$failed" -eq 1 ] && return 1
  [ -n "$kept" ] && return 3
  return 0
}

# The extensions make-default takes over: markdown and image, plus code when asked.
selected_extensions() {
  extensions_of markdown
  extensions_of image
  [ "$1" = code ] && extensions_of code
  return 0
}

make_default() {
  need_router_id
  mkdir -p "$data"
  new="$record.new"
  plan="$record.plan"
  : > "$new"
  : > "$plan"
  # Record every extension before changing any: extensions that share a file type would
  # otherwise see the router as their default once the first of them is taken over.
  for ext in $(selected_extensions "$1"); do
    app=$(current "$ext")
    [ "$app" = "$router_id" ] || printf '%s\t%s\t%s\n' "$(type_of "$ext")" "$ext" "$router_id" >> "$plan"
    # Already the router: keep what was recorded the first time.
    if [ -z "$app" ] || [ "$app" = "$router_id" ]; then app=$(recorded "$ext"); fi
    [ -n "$app" ] && [ "$app" != "$router_id" ] && printf '%s\t%s\n' "$ext" "$app" >> "$new"
  done
  # Everything else in the record stays: extensions not selected this time, or dropped from
  # the list, may still be held by the router and need their line for restore.
  if [ -f "$record" ]; then
    while IFS='	' read -r ext app; do
      [ -n "$ext" ] || continue
      cut -f 1 "$new" | grep -qxF "$ext" || selected_extensions "$1" | grep -qxF "$ext" || printf '%s\t%s\n' "$ext" "$app" >> "$new"
    done < "$record"
  fi
  mv "$new" "$record"

  run_plan "창마다 Side Viewer Router로 바꾸는 쪽을 고르세요."
}

restore() {
  need_router_id
  mkdir -p "$data"
  plan="$record.plan"
  : > "$plan"
  for ext in $(known_extensions); do
    # Only what the router still holds: a default the person picked since then stays.
    [ "$(current "$ext")" = "$router_id" ] || continue
    app=$(recorded "$ext")
    if [ -z "$app" ]; then
      app=$(fallback_app "$ext")
      echo "$ext: 기록된 원래 앱이 없어 $app 으로 돌립니다."
    fi
    printf '%s\t%s\t%s\n' "$(type_of "$ext")" "$ext" "$app" >> "$plan"
  done

  run_plan "창마다 원래 앱으로 바꾸는 쪽을 고르세요."
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
  make-default)
    case "${2:-}" in
      "" | code) make_default "${2:-}" ;;
      *) usage ;;
    esac
    ;;
  restore) [ $# -eq 1 ] || usage; restore ;;
  status) [ $# -eq 1 ] || usage; status ;;
  *) usage ;;
esac
