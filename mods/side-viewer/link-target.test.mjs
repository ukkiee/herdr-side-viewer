// node --test: what a cmd-click on a terminal link opens. Which conversation it opens beside,
// which file a link names, and that mod.json's link rule covers extensions.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkOpening, wantsHome, uriHost, linkFile, linkPattern } from "./link-target.js";

const groups = JSON.parse(readFileSync(new URL("./extensions.json", import.meta.url), "utf8"));
const mod = JSON.parse(readFileSync(new URL("./mod.json", import.meta.url), "utf8"));
const HOME = "/home/me";
const CWD = "/home/me/work/app";
const file = (link, cwd = CWD, home = HOME) => linkFile({ link: { kind: "file", path: null, ...link }, cwd, home, groups });

const PANES = [
  { pane: "linux/p1", tab: "linux/t5", terminal: "linux/t6" },
  { pane: "p1", tab: "t1", terminal: "t9" },
  { pane: "linux/p7", tab: "linux/t2", terminal: "linux/t3" },
];

test("the clicked pane is the conversation, with its space value", () => {
  assert.deepEqual(linkOpening({ pane: "p1", machine: null, space: "s1" }, PANES), { conversation: "p1", space: "s1" });
});

test("a remote pane is found under its machine prefix, whichever form the click gives", () => {
  const expected = { conversation: "linux/p7", space: "s2" };
  assert.deepEqual(linkOpening({ pane: "linux/p7", machine: "linux", space: "linux/s2" }, PANES), expected);
  assert.deepEqual(linkOpening({ pane: "p7", machine: "linux", space: "s2" }, PANES), expected);
});

test("a local pane is never taken for a remote one with the same id, listed first", () => {
  assert.deepEqual(linkOpening({ pane: "p1", machine: null, space: "s1" }, PANES), { conversation: "p1", space: "s1" });
  assert.deepEqual(linkOpening({ pane: "p7", machine: null, space: "s1" }, PANES), { conversation: null, space: "s1" });
});

test("a click from no listed pane (a layout's terminal block) keeps only the space", () => {
  assert.deepEqual(linkOpening({ pane: null, machine: null, space: "s1" }, PANES), { conversation: null, space: "s1" });
  assert.deepEqual(linkOpening({ pane: "p404", machine: null, space: "s1" }, PANES), { conversation: null, space: "s1" });
});

test("a click with no space passes on", () => {
  assert.equal(linkOpening({ pane: "p1", machine: null, space: null }, PANES), null);
  assert.equal(linkOpening(null, PANES), null);
});

test("a path Herdr resolved opens as it is", () => {
  assert.equal(file({ raw: "docs/plan.md:12", path: "/Users/me/app/docs/plan.md" }), "/Users/me/app/docs/plan.md");
});

test("a resolved path the viewer cannot show passes on", () => {
  assert.equal(file({ raw: "notes.txt", path: "/Users/me/notes.txt" }), null);
  assert.equal(file({ raw: "Makefile", path: "/Users/me/Makefile" }), null);
});

test("raw text is a path as it stands, with a line number, backticks or punctuation", () => {
  assert.equal(file({ raw: "/srv/app/README.md" }), "/srv/app/README.md");
  assert.equal(file({ raw: "docs/plan.md:12:3" }), `${CWD}/docs/plan.md`);
  assert.equal(file({ raw: "docs/plan.md:12-20" }), `${CWD}/docs/plan.md`);
  assert.equal(file({ raw: "`src/main.ts`" }), `${CWD}/src/main.ts`);
  assert.equal(file({ raw: "../other/a.json," }), "/home/me/work/other/a.json");
  assert.equal(file({ raw: "~/notes/todo.md" }), "/home/me/notes/todo.md");
  assert.equal(file({ raw: "c.json:3" }), `${CWD}/c.json`);
});

test("letters stuck to a path's end make it no path", () => {
  assert.equal(file({ raw: "docs/plan.md를" }), null);
  assert.equal(file({ raw: "/srv/app/README.md에서" }), null);
  assert.equal(file({ raw: "docs/plan.mdx2" }), null);
});

test("the shortest path is not taken when more extension follows", () => {
  assert.equal(file({ raw: "docs/a.md.bak" }), null);
  assert.equal(file({ raw: "dist/app.min.js" }), `${CWD}/dist/app.min.js`);
});

test("raw text that needs a folder or home it does not have passes on", () => {
  assert.equal(file({ raw: "docs/plan.md" }, null), null);
  assert.equal(file({ raw: "~/notes/todo.md" }, CWD, null), null);
});

test("a file URI with no host, or localhost, gives its decoded path, in any spelling", () => {
  assert.equal(file({ raw: "file:///home/me/My%20Docs/a.md" }), "/home/me/My Docs/a.md");
  assert.equal(file({ raw: "file://localhost/home/me/b.png" }), "/home/me/b.png");
  assert.equal(file({ raw: "FILE://LOCALHOST/home/me/b.png" }), "/home/me/b.png");
  assert.equal(file({ raw: "file:/home/me/b.png" }), "/home/me/b.png");
  assert.equal(file({ raw: "file:///home/me/%E0%A4%A.md" }), null);
});

test("a file URI naming a host opens only when it is the terminal's machine", () => {
  const named = (host) => linkFile({ link: { kind: "file", raw: "file://Build-Box/home/me/b.md", path: null }, cwd: CWD, home: HOME, host, groups });
  assert.equal(named("build-box"), "/home/me/b.md");
  assert.equal(named("other"), null);
  assert.equal(named(null), null);
});

test("only a raw file URI naming a host other than localhost asks for the host name", () => {
  assert.equal(uriHost({ raw: "file://Build-Box/a.md", path: null }), "Build-Box");
  assert.equal(uriHost({ raw: "file://localhost/a.md", path: null }), null);
  assert.equal(uriHost({ raw: "file:///a.md", path: null }), null);
  assert.equal(uriHost({ raw: "file://Build-Box/a.md", path: "/a.md" }), null);
  assert.equal(uriHost({ raw: "docs/a.md", path: null }), null);
});

test("a URL link is not a file", () => {
  assert.equal(linkFile({ link: { kind: "url", raw: "https://x.dev/a.md", url: "https://x.dev/a.md" }, cwd: CWD, home: HOME, groups }), null);
});

test("only an unresolved ~ path asks for the home", () => {
  assert.equal(wantsHome({ raw: "~/a.md", path: null }), true);
  assert.equal(wantsHome({ raw: "~/a.md", path: "/Users/me/a.md" }), false);
  assert.equal(wantsHome({ raw: "docs/a.md", path: null }), false);
});

test("mod.json's link rule is the pattern made from extensions.json", () => {
  const rules = mod.link_handlers;
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "file");
  assert.equal(rules[0].pattern, linkPattern(groups));
});

test("the link rule matches every listed extension, with a line number or punctuation after it", () => {
  // Rust's inline (?i) is JS's i flag; the rest of the pattern reads the same in both.
  const rule = new RegExp(linkPattern(groups).replace(/^\(\?i\)/, ""), "i");
  for (const extension of Object.values(groups).flat()) {
    assert.ok(rule.test(`/a/b.${extension}`), extension);
    assert.ok(rule.test(`b.${extension.toUpperCase()}:12`), extension);
  }
  assert.ok(rule.test("docs/plan.md를"));
  assert.ok(rule.test("`a.ts`"));
  assert.ok(!rule.test("/a/b.txt"));
  assert.ok(!rule.test("/a/b.mdown"));
  assert.ok(!rule.test("/a/b.json5"));
  assert.ok(!rule.test("Makefile"));
});
