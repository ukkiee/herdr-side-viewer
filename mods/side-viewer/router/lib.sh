# Shared by takeover.sh and open-original.sh: where the record and the extension list live.
# Sourced with $here set to the calling script's folder.

data="${SIDE_VIEWER_DATA:-${HERDR_APP_HOME:-$HOME/.config/herdr-app}/data/side-viewer}"

# One line per extension: "<extension><TAB><bundle id of the original app>".
record="$data/original-apps.tsv"

# The list sits beside the scripts inside the built app, and one folder up in the repository.
if [ -n "${SIDE_VIEWER_EXTENSIONS:-}" ]; then
  list="$SIDE_VIEWER_EXTENSIONS"
elif [ -f "$here/extensions.json" ]; then
  list="$here/extensions.json"
else
  list="$here/../extensions.json"
fi

# The extensions of one view kind (markdown, image, code), one per line.
extensions_of() {
  # awk also ends the last line, which plutil leaves open.
  plutil -extract "$1" json -o - "$list" 2>/dev/null | tr -d '[]" \n' | tr ',' '\n' | awk 'NF'
}

all_extensions() {
  for kind in markdown image code; do extensions_of "$kind"; done
}

# The recorded original app of an extension, or nothing.
recorded() {
  [ -f "$record" ] || return 0
  awk -F '\t' -v ext="$1" '$1 == ext { print $2; exit }' "$record"
}

# The app used when no original app is known.
fallback_app() {
  if extensions_of image | grep -qxF "$1"; then
    echo com.apple.Preview
  else
    echo com.apple.TextEdit
  fi
}
