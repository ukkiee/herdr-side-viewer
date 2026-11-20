// node --test: the path picker's decisions. Which paths a conversation's text offers, which of
// them exist on the machine, what typing keeps, which terminal is read and where a pick opens.
// The conversations below are made up in the shape agents print: tool calls, listed files,
// paths inside sentences, code spans and line numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openedConversation } from "./sent-conversation.js";
import { pathCandidates, existingPaths, filterPaths, listHeightOf, pickerWidthOf, PICKER_MIN_WIDTH, conversationOf, openTargetOf, pickedRequest, pickedSplit, readFailureOf, pickerFailureOf } from "./path-picker.js";

const groups = JSON.parse(readFileSync(new URL("./extensions.json", import.meta.url), "utf8"));
const HOME = "/Users/me";
const CWD = "/Users/me/work/app";
const candidates = (text, cwd = CWD) => pathCandidates({ text, cwd, home: HOME, groups });

const CONVERSATION = [
  "❯ 문서 정리해 줘",
  "",
  "⏺ Read(docs/plan.md)",
  "  ⎿  Read 120 lines",
  "",
  "⏺ 바꾼 파일:",
  "  - `mods/side-viewer/path-picker.js`",
  "  - mods/side-viewer/path-picker.test.mjs",
  "  - /Users/me/work/app/README.md:12",
  "  자세한 내용은 docs/notes.md를 보세요. 오류는 src/main.ts:40:7 에 있어요.",
  "  참고: https://example.com/guide.md, Makefile, docs/plan 은 열 수 없어요.",
  "  ~/notes/todo.md 와 /Users/me/work/app/docs/plan.md 도 바꿨어요.",
].join("\n");

test("a conversation offers its file paths, the latest first, each file once", () => {
  assert.deepEqual(candidates(CONVERSATION), [
    "/Users/me/work/app/docs/plan.md",
    "/Users/me/notes/todo.md",
    "/Users/me/work/app/src/main.ts",
    "/Users/me/work/app/docs/notes.md",
    "/Users/me/work/app/README.md",
    "/Users/me/work/app/mods/side-viewer/path-picker.test.mjs",
    "/Users/me/work/app/mods/side-viewer/path-picker.js",
  ]);
});

test("line numbers come off: a.md:12 and a.md:12:3 are a.md", () => {
  assert.deepEqual(candidates("see a.md:12 then b.md:12:3"), [`${CWD}/b.md`, `${CWD}/a.md`]);
});

test("relative paths resolve against the terminal's folder, ./ and ../ included", () => {
  assert.deepEqual(candidates("./docs/a.md ../shared/b.md"), [
    "/Users/me/work/shared/b.md",
    "/Users/me/work/app/docs/a.md",
  ]);
});

test("a code span keeps a path with spaces whole", () => {
  assert.ok(candidates("열었어요: `My Docs/report.md`").includes(`${CWD}/My Docs/report.md`));
  assert.ok(candidates("`/Users/me/My Notes/a.md` 를 보세요").includes("/Users/me/My Notes/a.md"));
});

test("a markdown link and bold text give the path inside", () => {
  assert.deepEqual(candidates("[계획](docs/plan.md) 과 **notes.md**"), [`${CWD}/notes.md`, `${CWD}/docs/plan.md`]);
});

test("only extensions the side viewer knows are offered, in any case", () => {
  assert.deepEqual(candidates("report.pdf notes.txt a.md.bak SHOT.PNG Makefile docs/plan"), [`${CWD}/SHOT.PNG`]);
});

test("web addresses are not files", () => {
  assert.deepEqual(candidates("https://example.com/a.md http://localhost:3000/app.js"), []);
});

test("without a folder for the terminal only absolute and ~ paths are offered", () => {
  assert.deepEqual(candidates("docs/a.md ~/b.md /tmp/c.md", null), ["/tmp/c.md", "/Users/me/b.md"]);
});

test("a text with no paths offers none", () => {
  assert.deepEqual(candidates("모두 끝났어요. 테스트 통과."), []);
  assert.deepEqual(candidates(""), []);
});

// The existence check's output: the paths that exist on the machine, one per line.
const output = (paths) => `${paths.join("\n")}\n`;

test("the existence check leaves out files the machine does not have, keeping the order", () => {
  const offered = candidates(CONVERSATION);
  const shown = existingPaths(offered, output([
    "/Users/me/work/app/README.md",
    "/Users/me/work/app/docs/plan.md",
    "/Users/me/notes/todo.md",
  ]));
  assert.deepEqual(shown, [
    "/Users/me/work/app/docs/plan.md",
    "/Users/me/notes/todo.md",
    "/Users/me/work/app/README.md",
  ]);
});

test("more than 30 files that exist show the 30 latest", () => {
  const listed = Array.from({ length: 40 }, (_, i) => `  - docs/note-${i + 1}.md`).join("\n");
  const offered = candidates(listed);
  assert.equal(offered.length, 40);
  const shown = existingPaths(offered, output(offered));
  assert.equal(shown.length, 30);
  assert.equal(shown[0], `${CWD}/docs/note-40.md`);
  assert.equal(shown[29], `${CWD}/docs/note-11.md`);
});

test("no file that exists, or an empty check, shows none", () => {
  assert.deepEqual(existingPaths(candidates(CONVERSATION), ""), []);
  assert.deepEqual(existingPaths([], output(["/Users/me/work/app/README.md"])), []);
});

test("typing keeps the paths that contain what was typed, in any case", () => {
  const shown = ["/Users/me/work/app/docs/plan.md", "/Users/me/notes/Todo.md", "/Users/me/work/app/README.md"];
  assert.deepEqual(filterPaths(shown, "readme"), ["/Users/me/work/app/README.md"]);
  assert.deepEqual(filterPaths(shown, "TODO"), ["/Users/me/notes/Todo.md"]);
  assert.deepEqual(filterPaths(shown, "work/app"), ["/Users/me/work/app/docs/plan.md", "/Users/me/work/app/README.md"]);
  assert.deepEqual(filterPaths(shown, ""), shown);
  assert.deepEqual(filterPaths(shown, "없는"), []);
});

// Rows are 32px, as in Herdr's own picker; the list stops growing at 11 rows (352px) and
// scrolls inside. A list with no set height folds to nothing in the popup.
test("the list is as tall as its rows, up to eleven rows", () => {
  assert.equal(listHeightOf(1), 32);
  assert.equal(listHeightOf(3), 96);
  assert.equal(listHeightOf(11), 352);
  assert.equal(listHeightOf(12), 352);
  assert.equal(listHeightOf(40), 352);
  assert.equal(listHeightOf(0), 0);
});

// Measured in a real window: a 1800pt window gets the full 640pt card, a 560pt window a 528pt
// card that leaves 16pt each side. viewport_size() is in pixels, so zoom 2 doubles them.
test("the card is 640 wide, narrower in a window that has no room for it", () => {
  assert.equal(pickerWidthOf(1800, 1), 640);
  assert.equal(pickerWidthOf(560, 1), 528);
  assert.equal(pickerWidthOf(672, 1), 640);
  assert.equal(pickerWidthOf(3600, 2), 640);
  assert.equal(pickerWidthOf(1120, 2), 528);
});

test("the card keeps 640 when the window size is unknown, and a floor in a tiny window", () => {
  assert.equal(pickerWidthOf(0, 1), 640);
  assert.equal(pickerWidthOf(NaN, 1), 640);
  assert.equal(pickerWidthOf(undefined, 1), 640);
  assert.equal(pickerWidthOf(560, undefined), 528);
  assert.equal(pickerWidthOf(560, 0), 528);
  assert.equal(pickerWidthOf(100, 1), PICKER_MIN_WIDTH);
  assert.ok(PICKER_MIN_WIDTH < 528);
});

// The card stays within 0.8 of the window's height, as Herdr's picker popup does. Its frame
// around the list is 74pt (14 padding, the 36pt filter, a 10pt gap, 14 padding), so a 400pt
// window leaves the list 0.8 × 400 − 74 = 246pt, and it scrolls inside that.
test("the list gives up height in a short window, keeping one row", () => {
  assert.equal(listHeightOf(40, 900, 1), 352);
  assert.equal(listHeightOf(3, 400, 1), 96);
  assert.equal(listHeightOf(40, 400, 1), 246);
  assert.equal(listHeightOf(40, 800, 2), 246);
  assert.equal(listHeightOf(40, 100, 1), 32);
  assert.equal(listHeightOf(0, 100, 1), 0);
  assert.equal(listHeightOf(40, undefined, 1), 352);
  assert.equal(listHeightOf(40, NaN, 1), 352);
  assert.equal(listHeightOf(40, 400, undefined), 246);
});

// Herdr's panes(): a terminal pane, or a mod pane (terminal null).
const pane = (id, tab, more = {}) => ({
  pane: id, tab, terminal: null, cwd: null, status: null, zoomed: false,
  program: { key: "shell", agent: false, shell: true }, ...more,
});
const agentPane = (id, tab, terminal, cwd) =>
  pane(id, tab, { terminal, cwd, status: "idle", program: { key: "claude", agent: true, shell: false } });
const shellPane = (id, tab, terminal, cwd) => pane(id, tab, { terminal, cwd });
const viewerPane = (id, tab, more = {}) =>
  pane(id, tab, { mod: "side-viewer", program: { key: "mod", agent: false, shell: false }, ...more });
const otherModPane = (id, tab) => pane(id, tab, { mod: "notes", program: { key: "mod", agent: false, shell: false } });
// Herdr's focused() on pane `id`.
const focusOn = (p) => ({ space: "s1", tab: p.tab, pane: p.pane, terminal: p.terminal, shown: null, agent: null, cwd: p.cwd });

const conversation = agentPane("p1", "w1", "t1", CWD);
const shell = shellPane("p2", "w1", "t2", "/tmp");
const viewer = viewerPane("p3", "w1");
const viewerTab = viewerPane("p9", "w2");
const PANES = [conversation, shell, viewer, viewerTab];

test("a focused terminal is the conversation that is read", () => {
  assert.deepEqual(conversationOf({ focused: focusOn(conversation), panes: PANES }), { pane: "p1", terminal: "t1", cwd: CWD });
  assert.deepEqual(conversationOf({ focused: focusOn(shell), panes: PANES }), { pane: "p2", terminal: "t2", cwd: "/tmp" });
});

test("a focused side viewer beside a conversation reads that conversation, an agent before a shell", () => {
  assert.deepEqual(conversationOf({ focused: focusOn(viewer), panes: PANES }), { pane: "p1", terminal: "t1", cwd: CWD });
  const shellOnly = [shellPane("p5", "w3", "t5", "/srv"), viewerPane("p6", "w3")];
  assert.deepEqual(conversationOf({ focused: focusOn(shellOnly[1]), panes: shellOnly }), { pane: "p5", terminal: "t5", cwd: "/srv" });
});

test("a focused side viewer reads the conversation that last sent its tab a file", () => {
  const second = agentPane("p5", "w1", "t5", "/work/b");
  const panes = [...PANES, second];
  assert.deepEqual(conversationOf({ focused: focusOn(viewer), panes, conversations: { w1: "p5" } }), { pane: "p5", terminal: "t5", cwd: "/work/b" });
  // A plain shell that sent the file counts as well.
  assert.deepEqual(conversationOf({ focused: focusOn(viewer), panes, conversations: { w1: "p2" } }), { pane: "p2", terminal: "t2", cwd: "/tmp" });
});

test("without a live sent conversation in its tab a focused side viewer reads the tab's agent", () => {
  const elsewhere = agentPane("p6", "w3", "t6", "/work/c");
  const panes = [...PANES, elsewhere];
  const first = { pane: "p1", terminal: "t1", cwd: CWD };
  for (const conversations of [undefined, {}, { w1: "p8" }, { w1: "p6" }, { w1: "p3" }, { w3: "p6" }]) {
    assert.deepEqual(conversationOf({ focused: focusOn(viewer), panes, conversations }), first, JSON.stringify(conversations));
  }
});

test("a focused terminal is read whatever conversation sent the file", () => {
  const second = agentPane("p5", "w1", "t5", "/work/b");
  const panes = [...PANES, second];
  assert.deepEqual(conversationOf({ focused: focusOn(conversation), panes, conversations: { w1: "p5" } }), { pane: "p1", terminal: "t1", cwd: CWD });
});

test("a remote conversation keeps its machine address", () => {
  const remote = [agentPane("p7", "w4", "nuc/t3", "/home/me/app"), viewerPane("p8", "w4")];
  assert.deepEqual(conversationOf({ focused: focusOn(remote[1]), panes: remote }), { pane: "p7", terminal: "nuc/t3", cwd: "/home/me/app" });
});

test("focus on a viewer tab, another mod or nothing has no conversation", () => {
  const notes = otherModPane("p4", "w1");
  assert.equal(conversationOf({ focused: focusOn(viewerTab), panes: PANES }), null);
  assert.equal(conversationOf({ focused: focusOn(notes), panes: [...PANES, notes] }), null);
  assert.equal(conversationOf({ focused: { ...focusOn(conversation), pane: null, terminal: null }, panes: PANES }), null);
  assert.equal(conversationOf({ focused: null, panes: PANES }), null);
});

test("a pick opens in the side viewer shown in the conversation's tab", () => {
  assert.deepEqual(openTargetOf({ conversation: "p1", panes: PANES }), { viewer: "p3" });
});

test("without a shown side viewer in its tab a pick splits the conversation to the right", () => {
  const alone = [conversation, viewerTab];
  assert.deepEqual(openTargetOf({ conversation: "p1", panes: alone }), { split: { pane: "p1", direction: "right" } });
  const zoomed = [{ ...conversation, zoomed: true }, viewer];
  assert.deepEqual(openTargetOf({ conversation: "p1", panes: zoomed }), { split: { pane: "p1", direction: "right" } });
});

// A pick of /b/plan.md in the conversation studio/p7 of the remote space studio/s3, at AT.
const AT = 1800000000;
const PICK = { file: "/b/plan.md", space: "s3", conversation: "studio/p7", at: AT };

test("a pick's request names the conversation as this screen does, for the viewers on this screen", () => {
  assert.deepEqual(pickedRequest({ id: `${AT}-picker-ab12`, ...PICK }), { id: `${AT}-picker-ab12`, file: "/b/plan.md", at: AT, space: "s3", conversation: "studio/p7" });
  assert.deepEqual(pickedRequest({ id: `${AT}-picker-ab12`, ...PICK, space: "s1", conversation: "p1" }).conversation, "p1");
});

test("a pick's new viewer splits off the conversation, and its props keep the conversation without the machine and the time it opened", () => {
  assert.deepEqual(pickedSplit(PICK), { pane: "studio/p7", direction: "right", mod: "side-viewer", props: { file: "/b/plan.md", space: "s3", conversation: "p7", at: AT } });
  assert.deepEqual(pickedSplit({ ...PICK, space: "s1", conversation: "p1" }).props, { file: "/b/plan.md", space: "s1", conversation: "p1", at: AT });
});

test("the new viewer finds the picked conversation on a screen that calls the machine by another name", () => {
  const { props } = pickedSplit(PICK);
  assert.equal(openedConversation(props, { now: AT * 1000, spaces: [{ id: "mini/s3", machine: "mini" }] }), "mini/p7");
  assert.equal(openedConversation(props, { now: AT * 1000, spaces: [{ id: "studio/s3", machine: "studio" }] }), "studio/p7");
});

// `hc read t9999 --lines 1` for a terminal that is gone: exit 3, on stderr.
const NO_TERMINAL = { code: 3, stdout: "", stderr: '{"error":{"hint":"see `hc ls --all`","kind":"not_found","message":"no terminal \\"t9999\\""}}\n' };

test("a failed read of the conversation's terminal fails the picker with hc's own words", () => {
  assert.deepEqual(pickerFailureOf(readFailureOf(NO_TERMINAL)), { state: "failed", reason: 'no terminal "t9999"' });
});

test("a read that says nothing fails the picker with its exit code", () => {
  assert.deepEqual(pickerFailureOf(readFailureOf({ code: 5, stdout: "", stderr: "" })), { state: "failed", reason: "hc read exited 5" });
  assert.deepEqual(pickerFailureOf(readFailureOf({ code: 1, stdout: "", stderr: "sh: hc: not found\n" })), { state: "failed", reason: "sh: hc: not found" });
});

test("a machine out of reach or a Windows machine gets its own state, not a failure", () => {
  assert.equal(pickerFailureOf(new Error("machine linux-box is unreachable")).state, "unreachable");
  assert.equal(pickerFailureOf(new Error("`herdr.exec`: [hc] timed out after 1005 ms: ended")).state, "unreachable");
  assert.equal(pickerFailureOf(new Error("cannot start sh: program not found")).state, "windows");
});

test("a failure's reason is its first line", () => {
  assert.deepEqual(pickerFailureOf(new Error("first\nsecond")), { state: "failed", reason: "first" });
});
