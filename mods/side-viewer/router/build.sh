#!/bin/sh
# macOS only. Builds ~/Applications/Side Viewer Router.app (needs Xcode's command line tools).
# Building registers the app with macOS. Extensions that some other app already opens keep
# that app until `SideViewerRouter --make-default`; an extension that no app claims by name (seen
# with mdx, jsonc, rbw and cp) goes to the router straight away, as its only candidate.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib.sh"

app="${SIDE_VIEWER_ROUTER_APP:-$HOME/Applications/Side Viewer Router.app}"
plist="$app/Contents/Info.plist"
buddy=/usr/libexec/PlistBuddy

rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
swiftc -O -o "$app/Contents/MacOS/SideViewerRouter" "$here/main.swift"
cp "$here/takeover.sh" "$here/open-original.sh" "$here/lib.sh" "$list" "$app/Contents/Resources/"

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>dev.ukkiee.side-viewer-router</string>
  <key>CFBundleName</key><string>Side Viewer Router</string>
  <key>CFBundleExecutable</key><string>SideViewerRouter</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSBackgroundOnly</key><true/>
  <key>LSUIElement</key><true/>
  <key>CFBundleDocumentTypes</key><array><dict>
    <key>CFBundleTypeName</key><string>Side Viewer file</string>
    <key>CFBundleTypeRole</key><string>Viewer</string>
    <key>LSHandlerRank</key><string>Alternate</string>
    <key>CFBundleTypeExtensions</key><array/>
  </dict></array>
</dict></plist>
PLIST
# The claimed extensions come from the one list the mod reads too.
for ext in $(all_extensions); do
  "$buddy" -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions: string $ext" "$plist"
done

codesign -s - --force "$app"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"
echo "built $app"
