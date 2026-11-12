// node --test: what the viewer shows for a file and its text, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentOf, labelOf, noticeFor } from "./document.js";
import { translator } from "./i18n.js";

const ko = translator("ko");
const en = translator("en");

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

test("an empty or blank markdown or code file opens in its view with its text as it is", () => {
  assert.deepEqual(contentOf("/work/plan.md", "", markdown), { state: "markdown", text: "" });
  assert.deepEqual(contentOf("/work/plan.md", " \n\n", markdown), { state: "markdown", text: " \n\n" });
  const ts = { view: "code", language: "javascript" };
  assert.deepEqual(contentOf("/work/app.ts", "", ts), { state: "code", text: "", language: "javascript" });
  assert.deepEqual(contentOf("/work/app.ts", "\n", ts), { state: "code", text: "\n", language: "javascript" });
});

test("the empty notice keeps its words for the pictures that still get it", () => {
  assert.equal(noticeFor("empty", ko), "이 파일은 비어 있습니다.");
});

test("a file that is not there gets the gone notice", () => {
  assert.equal(contentOf("/work/plan.md", null, markdown).state, "missing");
  assert.equal(noticeFor("missing", ko),"이 파일은 더 이상 없습니다.");
});

test("a file with no text view is not drawn", () => {
  assert.equal(contentOf("/work/report.pdf", "%PDF", null).state, "unsupported");
  assert.equal(contentOf("/work/shot.png", "x", { view: "image", language: null }).state, "unsupported");
  assert.equal(noticeFor("unsupported", ko),"이 종류의 파일은 뷰어에서 열 수 없습니다.");
});

test("a file too large to open and one that cannot be read get their notices", () => {
  assert.equal(noticeFor("large", ko), "뷰어에서 열기에는 너무 큽니다.");
  assert.equal(noticeFor("unreadable", ko), "이 파일을 읽을 수 없습니다.");
});

test("while the text is being read the notice says so", () => {
  assert.equal(noticeFor("loading", ko), "불러오는 중…");
});

test("with no file open the notice says there is none", () => {
  assert.equal(noticeFor("none", ko), "열 파일이 없습니다.");
});

test("the notices in English", () => {
  assert.deepEqual(["large", "none", "loading", "empty", "missing", "unreadable", "unsupported"].map((state) => noticeFor(state, en)), [
    "Too large to open in the viewer.",
    "No file to open.",
    "Loading…",
    "This file is empty.",
    "This file no longer exists.",
    "Can't read this file.",
    "The viewer can't open this kind of file.",
  ]);
});

test("a state that draws content has no notice, in either language", () => {
  assert.equal(noticeFor("markdown", ko), null);
  assert.equal(noticeFor("code", en), null);
});

test("the header label is the file name and its folder, with home shortened", () => {
  assert.deepEqual(labelOf("/Users/me/work/내 문서/plan.md", "/Users/me"), { name: "plan.md", folder: "~/work/내 문서" });
  assert.deepEqual(labelOf("/Users/me/plan.md", "/Users/me"), { name: "plan.md", folder: "~" });
  assert.deepEqual(labelOf("/Users/merry/plan.md", "/Users/me"), { name: "plan.md", folder: "/Users/merry" });
  assert.deepEqual(labelOf("/plan.md", "/Users/me"), { name: "plan.md", folder: "/" });
});
