// Installs or updates Side Viewer in the Herdr app's home. Run it again after `git pull`.
//
//   node install.mjs    into $HERDR_APP_HOME, else ~/.config/herdr-app
//
// Needs Node only: bun and the repository's node_modules are for development.

export const MOD = "side-viewer";

// The Herdr version that runs a mod's link handler, which a cmd-click reaches the viewer through
// (mods/side-viewer/link.js).
const NEEDED = "0.1.17";

// The layouts Herdr ships. Herdr turns a mod's link handler on by itself only in a personal
// layout, so one of these has to be cloned first.
const SHIPPED = ["main", "terminals", "win98"];

// atLeast(version, needed) → whether `version` ("0.1.18", "0.2.0-beta") is `needed` or newer.
//   Compares the first three numbers; a part that is not a number counts from its leading
//   digits, a missing part as 0. Anything not starting with a number is too old.
export function atLeast(version, needed) {
  if (!/^[0-9]+(\.[0-9]+)*/.test(version)) return false;
  const have = version.split("."), want = needed.split(".");
  for (let i = 0; i < 3; i++) {
    const h = parseInt(have[i], 10) || 0, w = parseInt(want[i], 10) || 0;
    if (h !== w) return h > w;
  }
  return true;
}

// The lines to add by hand, one per key, each with the section it goes in.
function manual(wanted) {
  const lines = [];
  for (const [section, binds] of Object.entries(wanted)) {
    for (const [key, action] of Object.entries(binds)) {
      lines.push(`  in "${section}": ${JSON.stringify(key)}: ${JSON.stringify(action)}`);
    }
  }
  return lines;
}

// mergeKeys(current, wanted) → { text, lines }
//   current: the text of the person's keys.json, or null when there is none. wanted: the
//   repository's keys.json, parsed. text: what to write (null: leave the file as it is).
//   lines: what to tell the person.
export function mergeKeys(current, wanted) {
  if (current === null) {
    return { text: null, lines: ["No keys.json yet: once Herdr has written one, add by hand:", ...manual(wanted)] };
  }
  let keys;
  try {
    keys = JSON.parse(current);
  } catch (error) {
    return { text: null, lines: [`keys.json is not valid JSON (${error.message}): left as it is. Add by hand:`, ...manual(wanted)] };
  }
  if (!isObject(keys) || !Object.values(keys).every(isObject)) {
    return { text: null, lines: ["keys.json is not an object of sections: left as it is. Add by hand:", ...manual(wanted)] };
  }
  const lines = [];
  let changed = false;
  for (const [section, binds] of Object.entries(wanted)) {
    for (const [key, action] of Object.entries(binds)) {
      if (same(keys[section]?.[key], action)) {
        lines.push(`${key} → ${JSON.stringify(action)} (${section}): already there.`);
        continue;
      }
      // Any section may hold the key: global, terminal, layout:<name>, mod:<name>. A key
      // the person bound to something else stays theirs; Herdr asks before replacing one.
      const taken = Object.keys(keys).find((s) => keys[s]?.[key] !== undefined && !same(keys[s][key], action));
      if (taken) {
        lines.push(`${key} is already ${JSON.stringify(keys[taken][key])} (${taken}): left as it is. Bind ${JSON.stringify(action)} to another key in ${section} by hand.`);
        continue;
      }
      (keys[section] ??= {})[key] = action;
      changed = true;
      lines.push(`${key} → ${JSON.stringify(action)} (${section})`);
    }
  }
  return { text: changed ? JSON.stringify(keys, null, 2) + "\n" : null, lines };
}

// replaceKeys({ fs, path }, file, text, pid): writes `text` over the keys.json at `file`.
//   It is written beside the real file with that file's permissions and renamed over it: a
//   write that fails halfway leaves the person's keys as they were, a keys.json that is a link
//   stays a link, and one only its owner may read stays so. `pid` names the file beside.
export function replaceKeys({ fs, path }, file, text, pid) {
  const target = fs.realpathSync(file);
  const temp = writeBeside(fs, path.dirname(target), path.basename(target), pid, text, { mode: 0o600 });
  try {
    fs.chmodSync(temp, fs.statSync(target).mode & 0o7777);
    fs.renameSync(temp, target);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

// writeBeside(fs, dir, name, pid, data, options) → the path of a new hidden file in `dir`
//   holding `data`, named after `name` and `pid`. It is created with "wx", so a file or link
//   already at that name (another run's, or one planted there) is never written through: the
//   next name is tried. When the write fails the file is removed, as wx means it is this run's.
function writeBeside(fs, dir, name, pid, data, options = {}) {
  for (let n = 0; ; n++) {
    const temp = `${dir}/.${name}.${pid}${n ? `-${n}` : ""}.tmp`;
    try {
      fs.writeFileSync(temp, data, { ...options, flag: "wx" });
      return temp;
    } catch (error) {
      if (error.code === "EEXIST" && n < 9) continue;
      if (error.code !== "EEXIST") { try { fs.unlinkSync(temp); } catch {} }
      throw error;
    }
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// An action is a string or a {command, args} object.
function same(a, b) {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

// Tests sit beside the modules they test but are not part of the installed mod.
const isTest = (name) => name.endsWith(".test.mjs");

// tree(fs, root) → { files, dirs }: the paths under `root`, relative to it, sorted, the
// folders before what they hold. Only files and folders: the mod holds no links.
function tree(fs, root) {
  const files = [], dirs = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(rel ? `${root}/${rel}` : root, { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { dirs.push(next); walk(next); }
      else files.push(next);
    }
  };
  walk("");
  return { files: files.sort(), dirs: dirs.sort() };
}

// kind(fs, p) → "file", "dir", "link" or null when nothing is there. A link is never followed.
function kind(fs, p) {
  let stat;
  // ENOTDIR: a file stands where a folder on the way to `p` would be.
  try { stat = fs.lstatSync(p); } catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error; }
  return stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : "file";
}

// copyMod(fs, from, to, pid) → { written, same, removed }
//   Makes `to` hold what `from` holds, its tests left out, as rsync -a --delete would.
//   Only a file whose bytes differ is written: Herdr reloads the mod each time a file in its
//   folder is saved. Each is first written beside its target under a hidden name, which Herdr
//   does not reload on, and the renames come after the last of them, so a write that fails
//   (a full disk) leaves no half file and every file already there whole. What `from` does not
//   hold (an older version's files, tests an older install copied) is removed after that.
//   gpui-kit.d.ts and jsconfig.json, which `herdr-app check` writes into `from`, go over like
//   any file: Herdr does not reload on them either.
//   `to` must be a real folder, links resolved (install checks it). A link inside it is never
//   followed: it is replaced by the file or folder that goes there, or removed. An entry of the
//   other kind where a file or folder goes (an upgrade turned one into the other) is removed
//   before the writes, so a write that fails then leaves it gone; running again finishes.
//   On a case-insensitive volume a name whose case changed is the same entry: it is renamed.
export function copyMod(fs, from, to, pid) {
  if (kind(fs, to) !== "dir") throw new Error(`${to} is not a folder`);
  const source = tree(fs, from);
  const files = source.files.filter((rel) => !isTest(rel));
  // Only the folders that hold a file to install are made; a folder of tests only is not.
  const dirs = [...new Set(files.flatMap((rel) => rel.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))))].sort();
  const pending = [], written = [];
  let same = 0;
  try {
    for (const rel of files) {
      if (kind(fs, `${to}/${rel}`) === "dir") fs.rmSync(`${to}/${rel}`, { recursive: true });
    }
    for (const rel of dirs) {
      const there = kind(fs, `${to}/${rel}`);
      if (there === "dir") continue;
      if (there !== null) fs.unlinkSync(`${to}/${rel}`);
      fs.mkdirSync(`${to}/${rel}`);
    }
    for (const rel of files) {
      const data = fs.readFileSync(`${from}/${rel}`), target = `${to}/${rel}`;
      if (kind(fs, target) === "file" && fs.readFileSync(target).equals(data)) { same++; continue; }
      const cut = target.lastIndexOf("/");
      pending.push({ temp: writeBeside(fs, target.slice(0, cut), target.slice(cut + 1), pid, data), target, rel });
    }
    for (const { temp, target, rel } of pending) { fs.renameSync(temp, target); written.push(rel); }
  } catch (error) {
    for (const { temp } of pending) { try { fs.unlinkSync(temp); } catch {} }
    throw error;
  }
  const keepFiles = new Set(files), keepDirs = new Set(source.dirs), removed = [];
  // The entry a kept name opens, when it is `entry` under another spelling (case, or Unicode
  // composition on macOS): the same file system object, as its device and inode say.
  const spelledAs = (rel, entry) => {
    const dir = rel ? `${to}/${rel}` : to, it = fs.lstatSync(`${dir}/${entry}`);
    const key = (n) => n.normalize("NFC").toLowerCase();
    for (const name of [...keepFiles, ...keepDirs]) {
      const cut = name.lastIndexOf("/"), base = name.slice(cut + 1);
      if (name.slice(0, Math.max(cut, 0)) !== rel || base === entry || key(base) !== key(entry)) continue;
      let kept;
      try { kept = fs.lstatSync(`${dir}/${base}`); } catch { continue; }
      if (kept.dev === it.dev && kept.ino === it.ino) return base;
    }
    return null;
  };
  const prune = (rel) => {
    const dir = rel ? `${to}/${rel}` : to;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      let name = entry.name;
      const next = () => (rel ? `${rel}/${name}` : name);
      if (!keepFiles.has(next()) && !keepDirs.has(next())) {
        const spelled = spelledAs(rel, name);
        if (spelled) { fs.renameSync(`${dir}/${name}`, `${dir}/${spelled}`); name = spelled; }
      }
      if (entry.isDirectory() && keepDirs.has(next())) prune(next());
      else if (!keepFiles.has(next())) {
        fs.rmSync(`${to}/${next()}`, { recursive: true });
        removed.push(next());
      }
    }
  };
  prune("");
  return { written, same, removed };
}

// copyReport({ written, same, removed }) → the line the copy prints.
export function copyReport({ written, same, removed }) {
  const gone = removed.length ? `, ${removed.length} removed` : "";
  return `${written.length} ${written.length === 1 ? "file" : "files"} updated, ${same} already the same${gone}.`;
}

// realPath(fs, p) → `p` with every link in it resolved, the parts not made yet kept as they are.
//   The native realpath gives each name as the volume spells it, so two paths to one folder
//   compare equal on a case-insensitive volume too.
function realPath(fs, p) {
  const real = fs.realpathSync.native ?? fs.realpathSync;
  const rest = [];
  for (let at = p; ; ) {
    try {
      return [real(at), ...rest].join("/");
    } catch (error) {
      const cut = at.lastIndexOf("/");
      if (error.code !== "ENOENT" || cut <= 0) throw error;
      rest.unshift(at.slice(cut + 1));
      at = at.slice(0, cut);
    }
  }
}

// installPlace(fs, mod, source) → { target } or { refused }: where the mod in `source` goes
//   for `mod` (<home>/mods/side-viewer), checked before anything is written. The copy removes
//   what the mod does not hold, so it must land in a folder of its own: `mod` itself may not
//   be a link (a developer often links it to the repository's mod), and the folder it ends up
//   at, links above it resolved, may not be the repository's mod, hold it or sit inside it.
//   Links above `mod` (an app home or mods folder kept elsewhere) are followed.
export function installPlace(fs, mod, source) {
  const cut = mod.lastIndexOf("/");
  const target = `${realPath(fs, mod.slice(0, cut))}/${mod.slice(cut + 1)}`;
  const from = realPath(fs, source);
  if (kind(fs, target) === "link") {
    let to = null;
    try { to = realPath(fs, target); } catch {}
    if (to === from) {
      return { refused: `${mod} is a link to this repository's mod (${source}), so Herdr already runs the mod from there: nothing was copied. To install a copy instead, remove the link (rm "${mod}") and run this again.` };
    }
    return { refused: `${mod} is a link to ${to ?? fs.readlinkSync(target)}: nothing was copied, as installing removes what the mod does not hold. Remove the link (rm "${mod}") and run this again.` };
  }
  const within = (a, b) => a === b || a.startsWith(`${b}/`);
  if (within(target, from) || within(from, target)) {
    return { refused: `${mod} and this repository's mod (${source}) are the same folder or one holds the other: nothing was copied. Install into an app home outside the repository's mod.` };
  }
  return { target };
}

// herdrApp(spawnSync) → herdr(args, output) → { code, stdout, missing }: runs `herdr-app <args>`.
//   output "shown" passes its output through; "captured" returns its stdout and drops its
//   stderr. missing: herdr-app could not be started (not on PATH), code 127 as a shell has it.
export const herdrApp = (spawnSync) => (args, output) => {
  const stdio = output === "shown" ? "inherit" : ["ignore", "pipe", "ignore"];
  const r = spawnSync("herdr-app", args, { stdio, encoding: "utf8" });
  if (r.error) return { code: 127, stdout: "", missing: true };
  return { code: r.status ?? 1, stdout: r.stdout ?? "", missing: false };
};

// install({ fs, path, herdr, platform, here, home, router, pid, log, warn }) → exit code
//   here: this repository's folder. home: the Herdr app's home. router: where an older
//   version built its router app. herdr: `herdrApp` or a stand-in. platform: process.platform.
//   pid names the files written beside their targets. log and warn print a line to stdout
//   and stderr.
//   Everything is checked before anything is copied: if a check fails, nothing has been
//   written, and the mod that was installed stays as it was.
export function install({ fs, path, herdr, platform, here, home, router, pid, log = console.log, warn = console.error }) {
  if (platform !== "darwin") {
    warn("Side Viewer is macOS only.");
    return 1;
  }
  const asked = herdr(["--version"], "captured");
  if (asked.missing) {
    warn("herdr-app not found on PATH: install the Herdr app (https://herdr.dev), then run this again.");
    return 1;
  }
  const version = asked.stdout.trim().split(/\s+/).at(-1) ?? "";
  if (!atLeast(version, NEEDED)) {
    warn(`Side Viewer needs Herdr ${NEEDED} or newer; herdr-app says '${version || "nothing"}'. Update Herdr (Settings > Updates), then run this again.`);
    return 1;
  }
  const checked = herdr(["check", `${here}/mods/${MOD}`], "shown").code;
  if (checked !== 0) return checked;

  // The whole folder goes over: the mod reads extensions.json and its icons from the app
  // home while it runs.
  const mod = `${home}/mods/${MOD}`, source = `${here}/mods/${MOD}`;
  const place = installPlace(fs, mod, source);
  if (place.refused) {
    warn(place.refused);
    return 1;
  }
  try {
    fs.mkdirSync(place.target, { recursive: true });
    log(copyReport(copyMod(fs, source, place.target, pid)));
  } catch (error) {
    warn(`Cannot copy to ${mod}: ${error.message}. Files already there are whole.`);
    return 1;
  }

  // The keys in this repository's keys.json are merged into the person's; a key they already
  // use for something else stays theirs.
  const keys = `${home}/keys.json`, wantedFile = `${here}/keys.json`;
  log(`Shortcut keys (${keys}):`);
  try {
    const current = fs.existsSync(keys) ? fs.readFileSync(keys, "utf8") : null;
    const { text, lines } = mergeKeys(current, JSON.parse(fs.readFileSync(wantedFile, "utf8")));
    for (const line of lines) log(`  ${line}`);
    if (text !== null) replaceKeys({ fs, path }, keys, text, pid);
  } catch (error) {
    warn(error.message);
    log("keys.json was not changed. Add these keys to it by hand:");
    log(fs.readFileSync(wantedFile, "utf8").replace(/\n$/, ""));
  }

  // The window's status names the layout in use; with no window open it says nothing.
  const layout = herdr(["status"], "captured").stdout.match(/^ *"layout": "([^"]*)"/m)?.[1] ?? "";
  if (SHIPPED.includes(layout)) {
    log(`Note: the layout in use, '${layout}', is one Herdr ships, so cmd-clicks do not reach the viewer yet.`);
    log(`  Clone it with: herdr-app do layout.clone --name ${layout}   (Herdr shows the copy and turns the viewer on there)`);
  } else if (layout === "") {
    log('Note: the Herdr window is not open, so the layout was not checked. cmd-clicks reach the viewer only in a personal layout (README.md, "Install").');
  }

  // An older version opened cmd-clicked files through this app, the default app for some
  // extensions. Deleting it first would leave those extensions with no record to give back.
  let routerThere = false;
  try { routerThere = fs.statSync(router).isDirectory(); } catch {}
  if (routerThere) {
    log("Note: the router app of an older version is still installed. Give its extensions back, then delete it:");
    log(`  "${router}/Contents/MacOS/SideViewerRouter" --restore`);
    log('  (README.md, "Upgrading from the router")');
  }

  log("");
  log("Installed.");
  return 0;
}

// Run as a script, not imported by a test. Node loads the script at its real path, so a path
// to it through a link (a checkout linked into ~/code) is resolved before the two are compared.
const invoked = typeof process !== "undefined" && process.argv[1] && await (async () => {
  const { realpathSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (invoked) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const { homedir } = await import("node:os");
  const { fileURLToPath } = await import("node:url");
  const here = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");
  process.exitCode = install({
    fs, path, herdr: herdrApp(spawnSync), platform: process.platform, here, pid: process.pid,
    home: process.env.HERDR_APP_HOME || `${homedir()}/.config/herdr-app`,
    // Where an older version built its router app, as it chose it.
    router: process.env.SIDE_VIEWER_ROUTER_APP || `${homedir()}/Applications/Side Viewer Router.app`,
  });
}
