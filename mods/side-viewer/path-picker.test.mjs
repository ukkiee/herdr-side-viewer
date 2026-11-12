// node --test: the path picker's decisions. Which paths a conversation's text offers, which of
// them exist on the machine, what typing keeps, which terminal is read and where a pick opens.
// The conversations below are made up in the shape agents print: tool calls, listed files,
// paths inside sentences, code spans and line numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathCandidates, existingPaths, filterPaths } from "./path-picker.js";

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
