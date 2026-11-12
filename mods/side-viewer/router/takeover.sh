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
# An extension restore reports as staying with the router is neither a failure nor kept.
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

# ko when the first preferred language of macOS is Korean ("ko-KR", "ko", "ko_KR.UTF-8"),
# en for anything else, an empty list, or a read that fails. Same rule as the viewer's i18n.
system_lang() {
  out=$(defaults read -g AppleLanguages 2>/dev/null) || { echo en; return; }
  # The list is printed as `(\n    "ko-KR",\n    en\n)`; anything else is not a list.
  case "$out" in
    "("*")") ;;
    *) echo en; return ;;
  esac
  first=$(printf '%s\n' "$out" | tr -d '()" \t' | tr ',' '\n' | awk 'NF { print; exit }' | tr 'A-Z' 'a-z')
  case "$first" in
    ko | ko[-_.@]*) echo ko ;;
    *) echo en ;;
  esac
}

# Read once: a run speaks one language even if the setting changes halfway.
lang=$(system_lang)

# Prints message $1 as one line in $lang, with $2... in place of its %s in order.
# Values (extensions, bundle ids, error text) go in as arguments, never into the format.
say() {
  say_key=$1
  shift
  say_s=s
  [ "${1:-}" = 1 ] && say_s=
  case "$lang.$say_key" in
    ko.windows_to_router) say_fmt='macOS 확인 창이 %s번 뜹니다. 창마다 Side Viewer Router로 바꾸는 쪽을 고르세요.' ;;
    en.windows_to_router) say_fmt="macOS will show %s confirmation window$say_s. In each window, choose to change to Side Viewer Router." ;;
    ko.windows_to_original) say_fmt='macOS 확인 창이 %s번 뜹니다. 창마다 원래 앱으로 바꾸는 쪽을 고르세요.' ;;
    en.windows_to_original) say_fmt="macOS will show %s confirmation window$say_s. In each window, choose to change back to the original app." ;;
    ko.nothing) say_fmt='바꿀 것이 없습니다.' ;;
    en.nothing) say_fmt='Nothing to change.' ;;
    ko.left) say_fmt='라우터에 남음:%s (이 확장자를 맡은 앱이 라우터뿐입니다)' ;;
    en.left) say_fmt='Stayed with the router:%s (no app but the router handles these extensions)' ;;
    ko.changed) say_fmt='바뀜:%s' ;;
    en.changed) say_fmt='Changed:%s' ;;
    ko.kept) say_fmt='유지를 선택함:%s' ;;
    en.kept) say_fmt='Chose to keep:%s' ;;
    ko.app_gone) say_fmt='%s: 원래 앱 %s 이 없어 %s 으로 돌립니다.' ;;
    en.app_gone) say_fmt='%s: original app %s not found, switching to %s.' ;;
    ko.no_record) say_fmt='%s: 기록된 원래 앱이 없어 %s 으로 돌립니다.' ;;
    en.no_record) say_fmt='%s: no original app recorded, switching to %s.' ;;
    ko.failed_error) say_fmt='실패: %s (오류: %s)' ;;
    en.failed_error) say_fmt='Failed: %s (error: %s)' ;;
    ko.failed_no_app) say_fmt='실패: %s (앱 없음: %s)' ;;
    en.failed_no_app) say_fmt='Failed: %s (app not found: %s)' ;;
    ko.failed_no_type) say_fmt='실패: %s (파일 종류 없음)' ;;
    en.failed_no_type) say_fmt='Failed: %s (no file type)' ;;
    ko.failed_timeout) say_fmt='실패: %s (시간 초과)' ;;
    en.failed_timeout) say_fmt='Failed: %s (timed out)' ;;
    *) printf '%s\n' "$say_key"; return ;;
  esac
  printf "$say_fmt\n" "$@"
}

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

# Set by restore: the command that names another app when the one asked for is not installed,
# the table it reads, and the extensions that stay with the router without a request.
# make-default has no second choice.
second_choice=""
siblings=""
left=""

# Sends the requests in $plan (lines of "<file type><TAB><extension><TAB><app>"), one per file
# type, after saying how many confirmation windows that means. $1: the message that says so and
# tells the person what to pick.
run_plan() {
  count=$(cut -f 1 "$plan" | awk 'NF && !seen[$0]++' | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    say nothing
    [ -n "$left" ] && say left "$left"
    rm -f "$plan"
    [ -n "$siblings" ] && rm -f "$siblings"
    return 0
  fi
  say "$1" "$count"

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
    # The app is gone: without another request the extension would stay with the router for
    # good. macOS shows no window for an app it cannot find, so the count above still holds.
    if [ "$code" -eq 3 ] && [ -n "$second_choice" ]; then
      other=$("$second_choice" "$ext" "$app")
      if [ -n "$other" ] && [ "$other" != "$app" ]; then
        say app_gone "$ext" "$app" "$other"
        app=$other
        "$router" --set-default-app "$ext" "$app" < /dev/null > /dev/null 2> "$errors"
        code=$?
      fi
    fi
    case "$code" in
      0)
        # The request sets the file type, but an extension that no app but the router claims
        # keeps going to the router whatever its file type opens in. Only a fresh read tells.
        for one in $group; do
          if [ "$app" != "$router_id" ] && [ "$(current "$one")" = "$router_id" ]; then
            left="$left $one"
          else
            changed="$changed $one"
          fi
        done
        ;;
      1)
        # macOS answers a "keep" in the window with an error and leaves the default app alone.
        # That is the person's choice, not a failure.
        if [ "$(current "$ext")" = "$before" ]; then
          kept="$kept $group"
        else
          failed=1
          say failed_error "$group" "$(tr '\n' ' ' < "$errors")" >&2
        fi
        ;;
      3) failed=1; say failed_no_app "$group" "$app" >&2 ;;
      4) failed=1; say failed_no_type "$group" >&2 ;;
      5) failed=1; say failed_timeout "$group" >&2 ;;
      *) failed=1; say failed_error "$group" "$(tr '\n' ' ' < "$errors")" >&2 ;;
    esac
  done < "$types"
  rm -f "$plan" "$errors" "$types"
  [ -n "$siblings" ] && rm -f "$siblings"

  [ -n "$changed" ] && say changed "$changed"
  [ -n "$kept" ] && say kept "$kept"
  [ -n "$left" ] && say left "$left"
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

  run_plan windows_to_router
}

# The app a sibling of extension $1 (same file type) that the router does not hold opens in,
# which is the app that file type opens in now, or nothing. $2 is an app to pass over.
# Reads $siblings: lines of "<file type><TAB><extension><TAB><current default app>".
sibling_opens_in() {
  type=$(awk -F '\t' -v ext="$1" '$2 == ext { print $1; exit }' "$siblings")
  awk -F '\t' -v type="$type" -v ext="$1" -v router="$router_id" -v skip="${2:-}" \
    '$1 == type && $2 != ext && $3 != "" && $3 != router && $3 != skip { print $3; exit }' "$siblings"
}

# The recorded original app of a sibling of extension $1, or nothing. $2 is an app to pass over.
sibling_record() {
  type=$(awk -F '\t' -v ext="$1" '$2 == ext { print $1; exit }' "$siblings")
  for other in $(awk -F '\t' -v type="$type" -v ext="$1" '$1 == type && $2 != ext { print $2 }' "$siblings"); do
    found=$(recorded "$other")
    if [ -n "$found" ] && [ "$found" != "$router_id" ] && [ "$found" != "${2:-}" ]; then
      printf '%s' "$found"
      return
    fi
  done
}

# The app that extension $1's siblings open in, else a sibling's record, else nothing.
sibling_app() {
  found=$(sibling_opens_in "$1" "${2:-}")
  [ -n "$found" ] || found=$(sibling_record "$1" "${2:-}")
  printf '%s' "$found"
}

# Where extension $1 goes when app $2 is not installed any more.
restore_second_choice() {
  other=$(sibling_app "$1" "$2")
  [ -n "$other" ] || other=$(fallback_app "$1")
  printf '%s' "$other"
}

restore() {
  need_router_id
  mkdir -p "$data"
  plan="$record.plan"
  siblings="$record.siblings"
  second_choice=restore_second_choice
  : > "$plan"
  : > "$siblings"
  for ext in $(known_extensions); do
    printf '%s\t%s\t%s\n' "$(type_of "$ext")" "$ext" "$(current "$ext")" >> "$siblings"
  done
  # Lines of "<file type><TAB><extension><TAB><app><TAB>now|ask": "now" when the app is the
  # one the file type already opens in.
  wishes="$record.wishes"
  : > "$wishes"
  while IFS='	' read -r type ext app; do
    # Only what the router still holds: a default the person picked since then stays.
    [ "$app" = "$router_id" ] || continue
    how=ask
    app=$(recorded "$ext")
    if [ -z "$app" ]; then
      # A request changes the whole file type. TextEdit here would also take the siblings
      # that were never taken over away from their app, so their app is asked for instead.
      how=now
      app=$(sibling_opens_in "$ext")
      [ -n "$app" ] || { how=ask; app=$(sibling_record "$ext"); }
      if [ -z "$app" ]; then
        app=$(fallback_app "$ext")
        say no_record "$ext" "$app"
      fi
    fi
    printf '%s\t%s\t%s\t%s\n' "$type" "$ext" "$app" "$how" >> "$wishes"
  done < "$siblings"
  # A file type whose every wish is "now" would change nothing: macOS accepts the request
  # without a window. Those extensions are claimed by no app but the router, so they stay
  # with it whatever the file type opens in, and no request is sent for them.
  awk -F '\t' 'NR == FNR { if ($4 == "ask") asked[$1] = 1; next } asked[$1]' "$wishes" "$wishes" > "$plan"
  left=$(awk -F '\t' 'NR == FNR { if ($4 == "ask") asked[$1] = 1; next } !asked[$1] { printf " %s", $2 }' "$wishes" "$wishes")
  rm -f "$wishes"

  run_plan windows_to_original
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
