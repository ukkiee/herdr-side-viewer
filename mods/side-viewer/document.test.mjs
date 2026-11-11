// node --test: what the viewer shows for a file and its text, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentOf, labelOf, noticeFor } from "./document.js";

const markdown = { view: "markdown", language: null };

test("a markdown file with text is shown as markdown", () => {
  assert.deepEqual(contentOf("/work/plan.md", "# Plan\n", markdown), { state: "markdown", text: "# Plan\n" });
});

test("a code file with text is shown as code in its language", () => {
  assert.deepEqual(contentOf("/work/app.ts", "let a = 1;", { view: "code", language: "javascript" }),
    { state: "code", text: "let a = 1;", language: "javascript" });
  assert.deepEqual(contentOf("/work/server.log", "started", { view: "code", language: null }),
    { state: "code", text: "started", language: null });
});

test("an empty file gets the empty notice", () => {
  assert.equal(contentOf("/work/plan.md", "", markdown).state, "empty");
  assert.equal(contentOf("/work/plan.md", " \n\n", markdown).state, "empty");
  assert.equal(contentOf("/work/app.ts", "\n", { view: "code", language: "javascript" }).state, "empty");
  assert.equal(noticeFor("empty"), "이 파일은 비어 있습니다.");
});

test("a file that is not there gets the gone notice", () => {
  assert.equal(contentOf("/work/plan.md", null, markdown).state, "missing");
  assert.equal(noticeFor("missing"), "이 파일은 더 이상 없습니다.");
});

test("a file with no text view is not drawn", () => {
  assert.equal(contentOf("/work/report.pdf", "%PDF", null).state, "unsupported");
  assert.equal(contentOf("/work/shot.png", "x", { view: "image", language: null }).state, "unsupported");
  assert.equal(noticeFor("unsupported"), "이 종류의 파일은 뷰어에서 열 수 없습니다.");
});

test("a file too large to open and one that cannot be read get their notices", () => {
  assert.equal(noticeFor("large"), "뷰어에서 열기에는 너무 큽니다.");
  assert.equal(noticeFor("unreadable"), "이 파일을 읽을 수 없습니다.");
});

test("while the text is being read the notice says so", () => {
  assert.equal(noticeFor("loading"), "불러오는 중…");
});

test("the header label is the file name and its folder, with home shortened", () => {
  assert.deepEqual(labelOf("/Users/me/work/내 문서/plan.md", "/Users/me"), { name: "plan.md", folder: "~/work/내 문서" });
  assert.deepEqual(labelOf("/Users/me/plan.md", "/Users/me"), { name: "plan.md", folder: "~" });
  assert.deepEqual(labelOf("/Users/merry/plan.md", "/Users/me"), { name: "plan.md", folder: "/Users/merry" });
  assert.deepEqual(labelOf("/plan.md", "/Users/me"), { name: "plan.md", folder: "/" });
});
