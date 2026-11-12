// node --test: the path picker's decisions. Which paths a conversation's text offers, which of
// them exist on the machine, what typing keeps, which terminal is read and where a pick opens.
// The conversations below are made up in the shape agents print: tool calls, listed files,
// paths inside sentences, code spans and line numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathCandidates, existingPaths, filterPaths, conversationOf, openTargetOf, readFailureOf, pickerFailureOf } from "./path-picker.js";

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
