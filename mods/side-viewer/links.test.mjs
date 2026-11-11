// node --test: what a click on a link inside a markdown document does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMarkdown, linkAction, rawMarkdown, touches, watchedFolder } from "./links.js";

const DOC = "/Users/me/notes/guide/intro.md";
const HOME = "/Users/me";
const GROUPS = JSON.parse(readFileSync(new URL("./extensions.json", import.meta.url), "utf8"));
const act = (url, doc = DOC) => linkAction(url, doc, HOME, GROUPS);

test("a relative markdown link opens in the viewer, from the document's folder", () => {
  assert.deepEqual(act("setup.md"), { action: "show", file: "/Users/me/notes/guide/setup.md" });
  assert.deepEqual(act("./parts/a.markdown"), { action: "show", file: "/Users/me/notes/guide/parts/a.markdown" });
  assert.deepEqual(act("../README.MDX"), { action: "show", file: "/Users/me/notes/README.MDX" });
});

test("an absolute path, ~/ and file:// name the file directly", () => {
  assert.deepEqual(act("/etc/notes/a.md"), { action: "show", file: "/etc/notes/a.md" });
  assert.deepEqual(act("~/docs/a.md"), { action: "show", file: "/Users/me/docs/a.md" });
  assert.deepEqual(act("file:///Users/me/docs/a.md"), { action: "show", file: "/Users/me/docs/a.md" });
  assert.deepEqual(act("file://localhost/Users/me/docs/a.md"), { action: "show", file: "/Users/me/docs/a.md" });
});

test("web and mail addresses go to the system, untouched", () => {
  assert.deepEqual(act("https://example.com/a.md?x=1#top"), { action: "system", url: "https://example.com/a.md?x=1#top" });
  assert.deepEqual(act("HTTP://example.com"), { action: "system", url: "HTTP://example.com" });
  assert.deepEqual(act("mailto:someone@example.com"), { action: "system", url: "mailto:someone@example.com" });
});

test("any other local file is only shown in Finder, never opened", () => {
  assert.deepEqual(act("run.sh"), { action: "reveal", file: "/Users/me/notes/guide/run.sh" });
  assert.deepEqual(act("/Applications/Some.app"), { action: "reveal", file: "/Applications/Some.app" });
  assert.deepEqual(act("file:///Users/me/tool.command"), { action: "reveal", file: "/Users/me/tool.command" });
  assert.deepEqual(act("images/"), { action: "reveal", file: "/Users/me/notes/guide/images" });
});

test("a link that is only an anchor does nothing", () => {
  assert.deepEqual(act("#install"), { action: "none" });
  assert.deepEqual(act(""), { action: "none" });
  assert.deepEqual(act("?tab=2#x"), { action: "none" });
});

test("a query and an anchor after a path are dropped", () => {
  assert.deepEqual(act("setup.md#install"), { action: "show", file: "/Users/me/notes/guide/setup.md" });
  assert.deepEqual(act("setup.md?plain=1#L10"), { action: "show", file: "/Users/me/notes/guide/setup.md" });
  assert.deepEqual(act("data.csv#row"), { action: "reveal", file: "/Users/me/notes/guide/data.csv" });
});

test("percent-encoded names are decoded, after the anchor is cut", () => {
  assert.deepEqual(act("my%20notes/a%23b.md#top"), { action: "show", file: "/Users/me/notes/guide/my notes/a#b.md" });
  assert.deepEqual(act("%ED%95%9C%EA%B8%80.md"), { action: "show", file: "/Users/me/notes/guide/한글.md" });
  // A broken escape is kept as written rather than dropped.
  assert.deepEqual(act("100%.md"), { action: "show", file: "/Users/me/notes/guide/100%.md" });
});

test("other schemes are never run", () => {
  for (const url of ["javascript:alert(1)", "vscode://file/a.md", "ftp://host/a.md", "x-apple.systempreferences:a", "//example.com/a.md"]) {
    assert.deepEqual(act(url), { action: "none" }, url);
  }
});

test("dots cannot climb above the root, and a relative link needs a document", () => {
  assert.deepEqual(act("../../../../../../etc/a.md"), { action: "show", file: "/etc/a.md" });
  assert.deepEqual(act("a.md", null), { action: "none" });
  assert.deepEqual(act("/abs/a.md", null), { action: "show", file: "/abs/a.md" });
});

test("isMarkdown knows the markdown extensions of the list", () => {
  for (const file of ["/a/b.md", "/a/b.MARKDOWN", "/a/b.mdx"]) assert.equal(isMarkdown(file, GROUPS), true, file);
  for (const file of ["/a/b.txt", "/a/md", "/a.md/b", null, ""]) assert.equal(isMarkdown(file, GROUPS), false, String(file));
});

test("the list alone says what markdown is: a changed list changes links with it", () => {
  const groups = { markdown: ["md", "qmd"], image: [], code: ["mdx"] };
  assert.equal(isMarkdown("/a/b.qmd", groups), true);
  assert.equal(isMarkdown("/a/b.mdx", groups), false);
  assert.equal(isMarkdown("/a/b.markdown", groups), false);
  assert.deepEqual(linkAction("b.qmd", DOC, HOME, groups), { action: "show", file: "/Users/me/notes/guide/b.qmd" });
  assert.deepEqual(linkAction("b.mdx", DOC, HOME, groups), { action: "reveal", file: "/Users/me/notes/guide/b.mdx" });
});

test("before the list has been read nothing counts as markdown, so a link only shows the file in Finder", () => {
  assert.equal(isMarkdown("/a/b.md", null), false);
  assert.equal(isMarkdown("/a/b.md", undefined), false);
  assert.deepEqual(linkAction("setup.md", DOC, HOME, null), { action: "reveal", file: "/Users/me/notes/guide/setup.md" });
  assert.deepEqual(linkAction("https://example.com", DOC, HOME, null), { action: "system", url: "https://example.com" });
});

test("rawMarkdown fences the source so it is drawn as written", () => {
  assert.equal(rawMarkdown("# Title\n*x*"), "```\n# Title\n*x*\n```");
  // The fence must be longer than any run of backticks inside.
  assert.equal(rawMarkdown("a\n```js\nx\n```\n"), "````\na\n```js\nx\n```\n````");
  assert.equal(rawMarkdown("`````"), "``````\n`````\n``````");
});

test("touches: a batch of changed paths concerns the shown file", () => {
  const file = "/tmp/docs/a.md";
  assert.equal(touches(["/tmp/docs/a.md"], file), true);
  assert.equal(touches(["/tmp/docs/b.md", "/tmp/docs/sub/a.md"], file), false);
  // A batch holding the watched folder itself means "anything may have changed".
  assert.equal(touches(["/tmp/docs"], file), true);
  // macOS reports /private/tmp for /tmp.
  assert.equal(touches(["/private/tmp/docs/a.md"], file), true);
  assert.equal(touches(["/private/tmp/docs"], file), true);
  assert.equal(touches([], file), false);
  assert.equal(touches(["/tmp/docs/a.md"], null), false);
  // Not an array: the platform gave something unexpected, so check to be safe.
  assert.equal(touches(undefined, file), true);
});

test("watchedFolder: the shown file's folder, but never the home folder or the root", () => {
  assert.equal(watchedFolder("/Users/me/notes/a.md", HOME), "/Users/me/notes");
  assert.equal(watchedFolder("/tmp/a.md", HOME), "/tmp");
  // Watching these would report every change under them; the slow recheck covers the file.
  assert.equal(watchedFolder("/Users/me/a.md", HOME), null);
  assert.equal(watchedFolder("/Users/me/a.md", "/Users/me/"), null);
  assert.equal(watchedFolder("/a.md", HOME), null);
  assert.equal(watchedFolder(null, HOME), null);
  // Without a known home folder only the root is left out.
  assert.equal(watchedFolder("/Users/me/a.md", ""), "/Users/me");
  assert.equal(watchedFolder("/Users/me/a.md", null), "/Users/me");
});

test("folderOf names the folder a file sits in", async () => {
  const { folderOf } = await import("./links.js");
  assert.equal(folderOf("/tmp/docs/a.md"), "/tmp/docs");
  assert.equal(folderOf("/a.md"), "/");
  assert.equal(folderOf(null), null);
});
