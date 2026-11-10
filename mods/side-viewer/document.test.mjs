// node --test: what the viewer shows for a file and its text, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentOf, labelOf, noticeFor } from "./document.js";

test("a markdown file with text is shown as markdown", () => {
  assert.deepEqual(contentOf("/work/plan.md", "# Plan\n"), { state: "markdown", text: "# Plan\n" });
  assert.equal(contentOf("/work/PLAN.MARKDOWN", "x").state, "markdown");
  assert.equal(contentOf("/work/page.mdx", "x").state, "markdown");
});

test("an empty markdown file gets the empty notice", () => {
  assert.equal(contentOf("/work/plan.md", "").state, "empty");
  assert.equal(contentOf("/work/plan.md", " \n\n").state, "empty");
  assert.equal(noticeFor("empty"), "이 파일은 비어 있습니다.");
});

test("a file that is not there gets the gone notice", () => {
  assert.equal(contentOf("/work/plan.md", null).state, "missing");
  assert.equal(noticeFor("missing"), "이 파일은 더 이상 없습니다.");
});

test("a file that is not markdown is not drawn", () => {
  assert.equal(contentOf("/work/app.ts", "let a = 1;").state, "unsupported");
  assert.equal(contentOf("/work/notes.md/README", "x").state, "unsupported");
  assert.equal(noticeFor("unsupported"), "이 종류의 파일은 뷰어에서 열 수 없습니다.");
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
