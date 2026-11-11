// Which app "open in the original app" names. The same decision as router/open-original.sh,
// kept here so the mod does not depend on where the router app is installed. No Herdr
// imports, so it runs under `node --test`.

// The router's bundle id, as router/build.sh writes it.
export const ROUTER_ID = "dev.ukkiee.side-viewer-router";

const TEXT_APP = "com.apple.TextEdit";
const IMAGE_APP = "com.apple.Preview";

function extensionOf(file) {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

// `record` is the text of original-apps.tsv: "<extension><TAB><bundle id>" per line.
function recorded(extension, record) {
  if (typeof record !== "string") return "";
  for (const line of record.split("\n")) {
    const [ext, app] = line.split("\t");
    if (ext === extension) return (app ?? "").trim();
  }
  return "";
}

function isImage(extension, extensions) {
  try {
    const image = JSON.parse(extensions).image;
    return Array.isArray(image) && image.includes(extension);
  } catch {
    return false;
  }
}

// The bundle ids to try, in order. `record` and `extensions` are the texts of
// original-apps.tsv and extensions.json, or null when they could not be read.
export function originalApps(file, record, extensions) {
  const extension = extensionOf(file);
  const fallback = isImage(extension, extensions) ? IMAGE_APP : TEXT_APP;
  const app = recorded(extension, record);
  // A record naming the router would send the file straight back here.
  if (!app || app === ROUTER_ID || app === fallback) return [fallback];
  // The recorded app may have been uninstalled since, hence the second try.
  return [app, fallback];
}

// The commands to run until one succeeds. `-b` names the app, so macOS never asks the
// default app (the router) where the file should go.
export function openOriginalCommands(file, record, extensions) {
  return originalApps(file, record, extensions).map((app) => ["open", ["-b", app, file]]);
}
