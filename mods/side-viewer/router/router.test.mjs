// node --test: takeover.sh and open-original.sh against a fake router command, a fake `open`,
// and a throwaway data folder, and build.sh against a compiler that fails. Nothing here
// touches the real default apps or the real router app.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const ROUTER_ID = "test.side-viewer-router";

// Stands in for the router binary: default apps live in one file per file type.
// `type-<ext>` makes an extension share another one's file type, as jpg and jpeg do on macOS.
// `keep-<ext>` plays the person choosing "keep" in the macOS confirmation window: the request
// ends with exit 1 and nothing changes. `fail-<ext>` holds the exit code of any other failure.
// `only-<ext>` gives one extension a default app of its own inside a shared file type, and
// `gone` lists the bundle ids of apps that are no longer installed.
const FAKE_ROUTER = `#!/bin/sh
key() { cat "$FAKE_STATE/type-$1" 2>/dev/null || printf '%s' "$1"; }
case "$1" in
  --default-app) cat "$FAKE_STATE/only-$2" 2>/dev/null || cat "$FAKE_STATE/app-$(key "$2")" 2>/dev/null; exit 0 ;;
  --type-of) printf 'type.%s\\n' "$(key "$2")"; exit 0 ;;
  --set-default-app)
    [ -e "$FAKE_STATE/quiet" ] || printf '%s %s\\n' "$2" "$3" >> "$FAKE_STATE/requests.log"
    [ -e "$FAKE_STATE/keep-$2" ] && { echo "The file couldn't be opened." >&2; exit 1; }
    [ -e "$FAKE_STATE/fail-$2" ] && exit "$(cat "$FAKE_STATE/fail-$2")"
    grep -qx "$3" "$FAKE_STATE/gone" 2>/dev/null && exit 3
    printf '%s\\n' "$3" > "$FAKE_STATE/app-$(key "$2")" ;;
esac
`;

// Stands in for /usr/bin/open: logs its arguments, and fails for bundle ids listed in `missing`.
const FAKE_OPEN = `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_STATE/open.log"
[ "$1" = "-b" ] && grep -qx "$2" "$FAKE_STATE/missing" 2>/dev/null && exit 1
exit 0
`;

// Stands in for /usr/bin/defaults: logs its arguments and answers `read -g AppleLanguages`
// with the file `languages`, or fails the way macOS does when that file is missing.
const FAKE_DEFAULTS = `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_STATE/defaults.log"
[ "$*" = "read -g AppleLanguages" ] || exit 1
[ -e "$FAKE_STATE/languages" ] || { echo "The domain/default pair of (kCFPreferencesAnyApplication, AppleLanguages) does not exist" >&2; exit 1; }
cat "$FAKE_STATE/languages"
`;

// `defaults read -g AppleLanguages` output, the way macOS prints it.
const appleLanguages = (...tags) => `(\n${tags.map((tag) => `    "${tag}"`).join(",\n")}\n)\n`;
const KOREAN = appleLanguages("ko-KR", "en-KR");
const ENGLISH = appleLanguages("en-KR", "ko-KR");
const HANGUL = /[가-힣]/;

// languages: what the fake `defaults` answers, null for a failing read. Korean by default, so
// the Korean lines are checked exactly as the router has always printed them.
function world({ extensions, defaults = {}, sameType = {}, record, languages = KOREAN } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-router-"));
  const state = join(dir, "state");
  const data = join(dir, "data");
  const bin = join(dir, "bin");
  for (const d of [state, data, bin]) mkdirSync(d);
  writeFileSync(join(dir, "router"), FAKE_ROUTER);
  writeFileSync(join(bin, "open"), FAKE_OPEN);
  writeFileSync(join(bin, "defaults"), FAKE_DEFAULTS);
  chmodSync(join(dir, "router"), 0o755);
  chmodSync(join(bin, "open"), 0o755);
  chmodSync(join(bin, "defaults"), 0o755);
  if (languages !== null) writeFileSync(join(state, "languages"), languages);
  writeFileSync(
    join(dir, "extensions.json"),
    JSON.stringify(extensions ?? { markdown: ["md"], image: ["png", "jpg", "jpeg"], code: ["txt", "py"] }),
  );
  for (const [ext, other] of Object.entries(sameType)) writeFileSync(join(state, `type-${ext}`), other);
  const recordFile = join(data, "original-apps.tsv");
  if (record) writeFileSync(recordFile, record);
  const env = {
    PATH: `${bin}:/usr/bin:/bin`,
    FAKE_STATE: state,
    SIDE_VIEWER_DATA: data,
    SIDE_VIEWER_EXTENSIONS: join(dir, "extensions.json"),
    SIDE_VIEWER_ROUTER: join(dir, "router"),
    SIDE_VIEWER_ROUTER_ID: ROUTER_ID,
  };
  const w = {
    state,
    setDefault: (ext, id) => execFileSync(join(dir, "router"), ["--set-default-app", ext, id], { env }),
    defaultOf: (ext) => execFileSync(join(dir, "router"), ["--default-app", ext], { env, encoding: "utf8" }).trim(),
    record: () => (existsSync(recordFile) ? readFileSync(recordFile, "utf8") : ""),
    dataFiles: () => readdirSync(data).sort(),
    takeover: (...args) => spawnSync("/bin/sh", [join(here, "takeover.sh"), ...args], { env, encoding: "utf8" }),
    // The confirmation windows asked for: one line per request sent to macOS.
    requests: () => (existsSync(join(state, "requests.log")) ? readFileSync(join(state, "requests.log"), "utf8").trim().split("\n") : []),
    keep: (ext) => writeFileSync(join(state, `keep-${ext}`), ""),
    fail: (ext, code) => writeFileSync(join(state, `fail-${ext}`), String(code)),
    only: (ext, id) => writeFileSync(join(state, `only-${ext}`), `${id}\n`),
    gone: (...ids) => writeFileSync(join(state, "gone"), ids.map((id) => `${id}\n`).join("")),
    openOriginal: (file) => spawnSync("/bin/sh", [join(here, "open-original.sh"), file], { env, encoding: "utf8" }),
    opened: () => (existsSync(join(state, "open.log")) ? readFileSync(join(state, "open.log"), "utf8") : ""),
    // Every `defaults` call, one line of arguments each.
    defaultsCalls: () => (existsSync(join(state, "defaults.log")) ? readFileSync(join(state, "defaults.log"), "utf8").trim().split("\n") : []),
  };
  // Setting the scene is not a request the person would be asked about.
  writeFileSync(join(state, "quiet"), "");
  for (const [ext, id] of Object.entries(defaults)) w.setDefault(ext, id);
  rmSync(join(state, "quiet"));
  return w;
}

test("make-default records each extension's original app, then makes the router the default", () => {
  const w = world({ defaults: { md: "com.example.Notes", png: "com.apple.Preview", jpg: "com.apple.Preview", txt: "com.apple.TextEdit", py: "com.example.Editor" }, sameType: { jpeg: "jpg" } });
  const r = w.takeover("make-default", "code");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    w.record(),
    "md\tcom.example.Notes\npng\tcom.apple.Preview\njpg\tcom.apple.Preview\njpeg\tcom.apple.Preview\ntxt\tcom.apple.TextEdit\npy\tcom.example.Editor\n",
  );
  for (const ext of ["md", "png", "jpg", "jpeg", "txt", "py"]) assert.equal(w.defaultOf(ext), ROUTER_ID, ext);
});

test("make-default twice keeps the original apps instead of recording the router itself", () => {
  const w = world({ defaults: { md: "com.example.Notes", png: "com.apple.Preview" } });
  w.takeover("make-default");
  const first = w.record();
  const r = w.takeover("make-default");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(w.record(), first);
  assert.ok(!w.record().includes(ROUTER_ID));
});

test("make-default picks up an original app the person chose after an earlier takeover", () => {
  const w = world({ defaults: { md: "com.example.Notes" } });
  w.takeover("make-default");
  w.setDefault("md", "com.example.Other");
  w.takeover("make-default");
  assert.match(w.record(), /^md\tcom\.example\.Other$/m);
});

test("make-default leaves an extension with no original app out of the record", () => {
  const w = world({ extensions: { markdown: ["md", "mdx"], image: [], code: [] }, defaults: { md: "com.example.Notes" } });
  w.takeover("make-default");
  assert.equal(w.record(), "md\tcom.example.Notes\n");
  assert.equal(w.defaultOf("mdx"), ROUTER_ID);
});

test("make-default keeps the record of an extension that has left the list, so restore can still return it", () => {
  const w = world({ extensions: { markdown: ["md"], image: [], code: [] }, defaults: { md: "com.example.Notes" }, record: "ts\tcom.example.Player\n" });
  w.takeover("make-default");
  assert.equal(w.record(), "md\tcom.example.Notes\nts\tcom.example.Player\n");
});

test("make-default reports the extensions it could not take over and exits 1", () => {
  const w = world({ extensions: { markdown: ["md"], image: [], code: ["ts"] }, defaults: { md: "com.example.Notes", ts: "com.example.Player" } });
  w.fail("ts", 5);
  const r = w.takeover("make-default", "code");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /실패: ts \(시간 초과\)/);
  assert.doesNotMatch(r.stdout, /유지를 선택함/);
  assert.equal(w.defaultOf("md"), ROUTER_ID);
  assert.equal(w.defaultOf("ts"), "com.example.Player");
});

test("make-default without a bundle takes over markdown and image only", () => {
  const w = world({ defaults: { md: "com.example.Notes", png: "com.apple.Preview", txt: "com.apple.TextEdit", py: "com.example.Editor" } });
  const r = w.takeover("make-default");
  assert.equal(r.status, 0, r.stderr);
  for (const ext of ["md", "png", "jpg", "jpeg"]) assert.equal(w.defaultOf(ext), ROUTER_ID, ext);
  assert.equal(w.defaultOf("txt"), "com.apple.TextEdit");
  assert.equal(w.defaultOf("py"), "com.example.Editor");
  assert.equal(w.record(), "md\tcom.example.Notes\npng\tcom.apple.Preview\n");
});

test("make-default code adds the code bundle and keeps the earlier record", () => {
  const w = world({ defaults: { md: "com.example.Notes", py: "com.example.Editor" } });
  w.takeover("make-default");
  const r = w.takeover("make-default", "code");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(w.defaultOf("py"), ROUTER_ID);
  assert.equal(w.record(), "md\tcom.example.Notes\npy\tcom.example.Editor\n");
});

test("make-default without a bundle keeps the record of code extensions taken over earlier", () => {
  const w = world({ defaults: { md: "com.example.Notes", py: "com.example.Editor" } });
  w.takeover("make-default", "code");
  w.takeover("make-default");
  assert.match(w.record(), /^py\tcom\.example\.Editor$/m);
});

test("make-default rejects a bundle it does not know", () => {
  const w = world();
  const r = w.takeover("make-default", "everything");
  assert.equal(r.status, 2);
  assert.deepEqual(w.requests(), []);
});

test("make-default says how many confirmation windows to expect: one per file type that will change", () => {
  // jpg and jpeg are one file type, and md is already the router's: png, jpg+jpeg, txt, py.
  const w = world({ defaults: { md: ROUTER_ID, png: "com.apple.Preview", jpg: "com.apple.Preview" }, sameType: { jpeg: "jpg" } });
  const r = w.takeover("make-default", "code");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^macOS 확인 창이 4번 뜹니다\./);
  assert.deepEqual(w.requests(), [`png ${ROUTER_ID}`, `jpg ${ROUTER_ID}`, `txt ${ROUTER_ID}`, `py ${ROUTER_ID}`]);
});

test("make-default code takes html over with its siblings in one confirmation window, and restore gives them back in one", () => {
  // The shipped list. macOS files html, htm, shtml and shtm under one type (public.html).
  const extensions = JSON.parse(readFileSync(join(here, "..", "extensions.json"), "utf8"));
  const family = ["html", "htm", "shtml", "shtm"];
  const w = world({ extensions, defaults: { html: "com.example.Browser" }, sameType: { htm: "html", shtml: "html", shtm: "html" } });
  const asked = () => w.requests().filter((line) => family.includes(line.split(" ")[0]));

  const taken = w.takeover("make-default", "code");
  assert.equal(taken.status, 0, taken.stderr);
  assert.deepEqual(asked(), [`html ${ROUTER_ID}`]);
  for (const ext of family) {
    assert.equal(w.defaultOf(ext), ROUTER_ID, ext);
    assert.match(w.record(), new RegExp(`^${ext}\tcom\\.example\\.Browser$`, "m"));
  }

  const given = w.takeover("restore");
  assert.equal(given.status, 0, given.stderr);
  assert.deepEqual(asked(), [`html ${ROUTER_ID}`, "html com.example.Browser"]);
  for (const ext of family) assert.equal(w.defaultOf(ext), "com.example.Browser", ext);
});

test("make-default asks for nothing when the router already holds everything", () => {
  const w = world({ extensions: { markdown: ["md"], image: ["png"], code: [] } });
  w.takeover("make-default");
  const r = w.takeover("make-default");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "바꿀 것이 없습니다.\n");
  assert.equal(w.requests().length, 2);
  assert.deepEqual(w.dataFiles(), ["original-apps.tsv"]);
});

test("restore with nothing to give back leaves no working file in the data folder", () => {
  const w = world({ defaults: { md: "com.example.Notes" } });
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "바꿀 것이 없습니다.\n");
  assert.deepEqual(w.dataFiles(), []);
});

test("make-default reports the extensions the person chose to keep, apart from failures, and exits 3", () => {
  const w = world({ extensions: { markdown: ["md", "markdown"], image: ["png"], code: [] }, defaults: { md: "com.example.Notes", png: "com.apple.Preview" }, sameType: { markdown: "md" } });
  w.keep("md");
  const r = w.takeover("make-default");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /^유지를 선택함: md markdown$/m);
  assert.match(r.stdout, /^바뀜: png$/m);
  assert.equal(r.stderr, "");
  assert.equal(w.defaultOf("md"), "com.example.Notes");
  assert.equal(w.defaultOf("png"), ROUTER_ID);
});

test("a failure outranks a kept extension in the exit code, and each is reported as what it is", () => {
  const w = world({ extensions: { markdown: ["md"], image: ["png", "gif"], code: [] }, defaults: { md: "com.example.Notes", png: "com.apple.Preview", gif: "com.apple.Preview" } });
  w.keep("md");
  w.fail("png", 3);
  const r = w.takeover("make-default");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^유지를 선택함: md$/m);
  assert.match(r.stderr, /^실패: png \(앱 없음: /m);
  assert.doesNotMatch(r.stderr, /md/);
  assert.equal(w.defaultOf("gif"), ROUTER_ID);
});

test("restore says how many confirmation windows to expect and reports what the person kept", () => {
  const w = world({ defaults: { md: "com.example.Notes", png: "com.apple.Preview", jpg: "com.apple.Preview" }, sameType: { jpeg: "jpg" } });
  w.takeover("make-default");
  w.keep("png");
  const before = w.requests().length;
  const r = w.takeover("restore");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /^macOS 확인 창이 3번 뜹니다\./);
  assert.match(r.stdout, /^유지를 선택함: png$/m);
  assert.deepEqual(w.requests().slice(before), ["md com.example.Notes", "png com.apple.Preview", "jpg com.apple.Preview"]);
  assert.equal(w.defaultOf("png"), ROUTER_ID);
  assert.equal(w.defaultOf("jpeg"), "com.apple.Preview");
});

test("restore gives every recorded extension back to its original app", () => {
  const defaults = { md: "com.example.Notes", png: "com.apple.Preview", jpg: "com.apple.Preview", txt: "com.apple.TextEdit", py: "com.example.Editor" };
  const w = world({ defaults, sameType: { jpeg: "jpg" } });
  w.takeover("make-default");
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  for (const [ext, id] of Object.entries(defaults)) assert.equal(w.defaultOf(ext), id, ext);
});

test("restore returns a recorded extension even after it left the list", () => {
  const w = world({ extensions: { markdown: ["md"], image: [], code: [] }, defaults: { md: "com.example.Notes", ts: ROUTER_ID }, record: "ts\tcom.example.Player\n" });
  w.takeover("restore");
  assert.equal(w.defaultOf("ts"), "com.example.Player");
});

test("restore leaves alone an extension the person already moved off the router", () => {
  const w = world({ defaults: { md: "com.example.Notes" } });
  w.takeover("make-default");
  w.setDefault("md", "com.example.Other");
  w.takeover("restore");
  assert.equal(w.defaultOf("md"), "com.example.Other");
});

test("restore falls back to TextEdit, or Preview for images, when nothing was recorded", () => {
  const w = world({ extensions: { markdown: ["mdx"], image: ["webp"], code: [] } });
  w.takeover("make-default");
  w.takeover("restore");
  assert.equal(w.defaultOf("mdx"), "com.apple.TextEdit");
  assert.equal(w.defaultOf("webp"), "com.apple.Preview");
});

test("restore asks nothing for an unrecorded extension whose file type already opens in its sibling's app, and says it stays with the router", () => {
  // Building alone gave rbw to the router. rb was never taken over and still opens in the IDE,
  // so asking for the IDE would change nothing: no app but the router claims rbw itself.
  const w = world({ extensions: { markdown: [], image: [], code: ["rb", "rbw"] }, defaults: { rb: "com.example.IDE" }, sameType: { rbw: "rb" } });
  w.only("rbw", ROUTER_ID);
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "바꿀 것이 없습니다.\n라우터에 남음: rbw (이 확장자를 맡은 앱이 라우터뿐입니다)\n");
  assert.deepEqual(w.requests(), []);
  assert.deepEqual(w.dataFiles(), []);
});

test("restore leaves out of the window count a file type it asks nothing for, and still says what stays with the router", () => {
  const w = world({ extensions: { markdown: ["md"], image: [], code: ["rb", "rbw"] }, defaults: { md: ROUTER_ID, rb: "com.example.IDE" }, sameType: { rbw: "rb" }, record: "md\tcom.example.Notes\n" });
  w.only("rbw", ROUTER_ID);
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^macOS 확인 창이 1번 뜹니다\./);
  assert.deepEqual(w.requests(), ["md com.example.Notes"]);
  assert.match(r.stdout, /^바뀜: md$/m);
  assert.match(r.stdout, /^라우터에 남음: rbw \(이 확장자를 맡은 앱이 라우터뿐입니다\)$/m);
});

test("restore lists under 바뀜 only the extensions that left the router, and says which stayed", () => {
  // The request for rb's original app succeeds for the file type, yet no app but the router
  // claims rbw itself, so rbw keeps going to the router.
  const w = world({ extensions: { markdown: [], image: [], code: ["rb", "rbw"] }, defaults: { rb: ROUTER_ID }, sameType: { rbw: "rb" }, record: "rb\tcom.example.IDE\n" });
  w.only("rbw", ROUTER_ID);
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^macOS 확인 창이 1번 뜹니다\./);
  assert.deepEqual(w.requests(), ["rb com.example.IDE"]);
  assert.doesNotMatch(r.stdout, /^바뀜:.* rbw\b/m);
  assert.match(r.stdout, /^바뀜: rb$/m);
  assert.match(r.stdout, /^라우터에 남음: rbw \(이 확장자를 맡은 앱이 라우터뿐입니다\)$/m);
});

test("restore uses a sibling's recorded app when the router holds the whole file type", () => {
  const w = world({ extensions: { markdown: [], image: [], code: ["cp", "cpp"] }, defaults: { cpp: ROUTER_ID }, sameType: { cp: "cpp" }, record: "cpp\tcom.example.IDE\n" });
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /macOS 확인 창이 1번 뜹니다\./);
  assert.deepEqual(w.requests(), ["cp com.example.IDE"]);
  assert.equal(w.defaultOf("cpp"), "com.example.IDE");
});

test("restore asks for TextEdit or Preview when the recorded app is no longer installed, and says so", () => {
  const w = world({ extensions: { markdown: ["md"], image: ["png"], code: [] }, defaults: { md: ROUTER_ID, png: ROUTER_ID }, record: "md\tcom.example.Gone\npng\tcom.example.Gone\n" });
  w.gone("com.example.Gone");
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /macOS 확인 창이 2번 뜹니다\./);
  assert.match(r.stdout, /^md: 원래 앱 com\.example\.Gone 이 없어 com\.apple\.TextEdit 으로 돌립니다\.$/m);
  assert.deepEqual(w.requests(), ["md com.example.Gone", "md com.apple.TextEdit", "png com.example.Gone", "png com.apple.Preview"]);
  assert.equal(w.defaultOf("md"), "com.apple.TextEdit");
  assert.equal(w.defaultOf("png"), "com.apple.Preview");
});

test("restore prefers a sibling's app to TextEdit when the recorded app is no longer installed", () => {
  const w = world({ extensions: { markdown: [], image: [], code: ["rb", "rbw"] }, defaults: { rb: "com.example.IDE" }, sameType: { rbw: "rb" }, record: "rbw\tcom.example.Gone\n" });
  w.only("rbw", ROUTER_ID);
  w.gone("com.example.Gone");
  const r = w.takeover("restore");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.requests(), ["rbw com.example.Gone", "rbw com.example.IDE"]);
});

test("make-default does not try another app when the router itself is not found", () => {
  const w = world({ extensions: { markdown: ["md"], image: [], code: [] }, defaults: { md: "com.example.Notes" } });
  w.gone(ROUTER_ID);
  const r = w.takeover("make-default");
  assert.equal(r.status, 1);
  assert.deepEqual(w.requests(), [`md ${ROUTER_ID}`]);
});

test("make-default speaks English when the first preferred language is not Korean, with the same exit code and line order", () => {
  const w = world({ extensions: { markdown: ["md"], image: ["png"], code: [] }, defaults: { md: "com.example.Notes", png: "com.apple.Preview" }, languages: ENGLISH });
  w.keep("png");
  const r = w.takeover("make-default");
  assert.equal(r.status, 3);
  assert.equal(
    r.stdout,
    "macOS will show 2 confirmation windows. In each window, choose to change to Side Viewer Router.\nChanged: md\nChose to keep: png\n",
  );
  assert.equal(r.stderr, "");
});

test("status prints the current default app and the recorded original app per extension", () => {
  const w = world({ extensions: { markdown: ["md", "mdx"], image: ["png"], code: [] }, defaults: { md: "com.example.Notes", png: "com.apple.Preview" } });
  assert.equal(w.takeover("status").stdout, "md\tcom.example.Notes\t-\nmdx\t-\t-\npng\tcom.apple.Preview\t-\n");
  w.takeover("make-default");
  assert.equal(
    w.takeover("status").stdout,
    `md\t${ROUTER_ID}\tcom.example.Notes\nmdx\t${ROUTER_ID}\t-\npng\t${ROUTER_ID}\tcom.apple.Preview\n`,
  );
});

test("a build that fails leaves the router app that was there in place", () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-build-"));
  const bin = join(dir, "bin");
  const app = join(dir, "apps", "Side Viewer Router.app");
  mkdirSync(bin);
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  writeFileSync(join(app, "Contents", "MacOS", "SideViewerRouter"), "the old router");
  writeFileSync(join(bin, "swiftc"), "#!/bin/sh\necho 'error: no such module' >&2\nexit 1\n");
  chmodSync(join(bin, "swiftc"), 0o755);
  const r = spawnSync("/bin/sh", [join(here, "build.sh")], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, SIDE_VIEWER_ROUTER_APP: app },
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.equal(readFileSync(join(app, "Contents", "MacOS", "SideViewerRouter"), "utf8"), "the old router");
  // Nothing half-built is left beside it.
  assert.deepEqual(readdirSync(join(dir, "apps")), ["Side Viewer Router.app"]);
});

test("install.sh changes nothing when the mod does not pass the check", { skip: process.platform !== "darwin" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "side-viewer-install-"));
  const bin = join(dir, "bin");
  const home = join(dir, "app-home");
  const app = join(dir, "apps", "Side Viewer Router.app");
  mkdirSync(bin);
  writeFileSync(join(bin, "herdr-app"), "#!/bin/sh\necho 'check failed' >&2\nexit 1\n");
  chmodSync(join(bin, "herdr-app"), 0o755);
  const r = spawnSync("/bin/sh", [join(here, "..", "..", "..", "install.sh")], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, HERDR_APP_HOME: home, SIDE_VIEWER_ROUTER_APP: app },
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.ok(!existsSync(home), "the mod was copied");
  assert.ok(!existsSync(join(dir, "apps")), "the router was built");
});

test("open-original opens the file in the recorded original app", () => {
  const w = world({ record: "md\tcom.example.Notes\n" });
  const r = w.openOriginal("/tmp/some dir/README.MD");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(w.opened(), "-b com.example.Notes /tmp/some dir/README.MD\n");
});

test("open-original uses TextEdit, or Preview for images, when there is no record", () => {
  const w = world();
  w.openOriginal("/tmp/a.py");
  w.openOriginal("/tmp/b.png");
  w.openOriginal("/tmp/Makefile");
  assert.equal(w.opened(), "-b com.apple.TextEdit /tmp/a.py\n-b com.apple.Preview /tmp/b.png\n-b com.apple.TextEdit /tmp/Makefile\n");
});

test("open-original never hands the file back to the router", () => {
  const w = world({ record: `md\t${ROUTER_ID}\n` });
  w.openOriginal("/tmp/a.md");
  assert.equal(w.opened(), "-b com.apple.TextEdit /tmp/a.md\n");
});

test("open-original falls back when the recorded app is no longer installed", () => {
  const w = world({ record: "png\tcom.example.Gone\n" });
  writeFileSync(join(w.state, "missing"), "com.example.Gone\n");
  const r = w.openOriginal("/tmp/b.png");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(w.opened(), "-b com.example.Gone /tmp/b.png\n-b com.apple.Preview /tmp/b.png\n");
});
