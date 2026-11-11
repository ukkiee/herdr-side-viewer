// node --test: reading the request open.sh leaves for a showing viewer, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUEST_FILE, answerFile, requestFrom, takeRequest } from "./request.js";

const NOW = 1_800_000_000_000;
const AT = NOW / 1000;
const text = (request) => JSON.stringify(request);
const fresh = { answered: null, now: NOW };

test("a request names the file to show and the id to answer with", () => {
  const request = requestFrom(text({ id: "1800000000-4242", file: "/work/notes/plan.md", at: AT }), fresh);
  assert.deepEqual(request, { id: "1800000000-4242", file: "/work/notes/plan.md" });
});

test("the request and the answer have fixed names in the data folder", () => {
  assert.equal(REQUEST_FILE, "request.json");
  assert.equal(answerFile("1800000000-4242"), "answer-1800000000-4242");
});

test("a path with spaces, quotes, a backslash and Korean comes through intact", () => {
  const file = '/work/내 문서/it\'s "final" a\\b 계획.md';
  assert.equal(requestFrom(text({ id: "a1", file, at: AT }), fresh).file, file);
});

test("no request file means there is nothing to take", () => {
  assert.equal(requestFrom(null, fresh), null);
  assert.equal(requestFrom(undefined, fresh), null);
  assert.equal(requestFrom("", fresh), null);
});

test("a broken request is ignored", () => {
  for (const broken of ['{"id":"a1","file":"/a.md"', "not json", "null", "[]", '"text"', "7"]) {
    assert.equal(requestFrom(broken, fresh), null, broken);
  }
});

test("a request without a usable id is ignored", () => {
  for (const id of [undefined, null, "", 7, "../escape", "a/b", "a b", "a.b"]) {
    assert.equal(requestFrom(text({ id, file: "/a.md", at: AT }), fresh), null, String(id));
  }
});

test("a request without an absolute file path is ignored", () => {
  for (const file of [undefined, null, "", 7, "notes/plan.md", "~/plan.md"]) {
    assert.equal(requestFrom(text({ id: "a1", file, at: AT }), fresh), null, String(file));
  }
});

test("a request this viewer already answered is not taken again", () => {
  const same = text({ id: "a1", file: "/a.md", at: AT });
  assert.equal(requestFrom(same, { answered: "a1", now: NOW }), null);
  assert.deepEqual(requestFrom(same, { answered: "a0", now: NOW }), { id: "a1", file: "/a.md" });
});

test("a request nobody is waiting on any more is ignored", () => {
  const at = (seconds) => requestFrom(text({ id: "a1", file: "/a.md", at: AT - seconds }), fresh);
  assert.notEqual(at(0), null);
  assert.notEqual(at(5), null);
  assert.equal(at(6), null);
  assert.equal(at(3600), null);
});

test("a request stamped slightly ahead of the viewer's clock is still taken, a far one is not", () => {
  const at = (seconds) => requestFrom(text({ id: "a1", file: "/a.md", at: AT + seconds }), fresh);
  assert.notEqual(at(1), null);
  assert.equal(at(3600), null);
});

test("a request without a time is ignored", () => {
  assert.equal(requestFrom(text({ id: "a1", file: "/a.md" }), fresh), null);
  assert.equal(requestFrom(text({ id: "a1", file: "/a.md", at: "soon" }), fresh), null);
});

// A data folder in memory. `create` refuses a name that is taken, as the real one does.
function folder(files = {}) {
  const held = new Map(Object.entries(files));
  return {
    held,
    files: {
      read: async (path) => (held.has(path) ? held.get(path) : null),
      create: async (path, text) => {
        if (held.has(path)) throw new Error("exists");
        held.set(path, text);
      },
    },
  };
}
const waiting = (id = "a1", file = "/a.md") => folder({ "/data/request.json": text({ id, file, at: AT }) });
const here = { folder: "/data", answered: null, now: NOW };

test("a viewer that takes a request leaves the answer the asker waits for", async () => {
  const data = waiting();
  assert.deepEqual(await takeRequest(data.files, here), { id: "a1", file: "/a.md" });
  assert.ok(data.held.has("/data/answer-a1"));
});

test("of two viewers showing in one tab, only the first takes the request", async () => {
  const data = waiting();
  const taken = [await takeRequest(data.files, here), await takeRequest(data.files, here)];
  assert.deepEqual(taken, [{ id: "a1", file: "/a.md" }, null]);
});

test("a request the asker has already closed is not taken", async () => {
  const data = waiting();
  data.held.set("/data/answer-a1", "");
  assert.equal(await takeRequest(data.files, here), null);
});

test("with no request, or one that cannot be read, nothing is taken and no answer is left", async () => {
  const empty = folder();
  assert.equal(await takeRequest(empty.files, here), null);
  const failing = { read: async () => { throw new Error("denied"); }, create: empty.files.create };
  assert.equal(await takeRequest(failing, here), null);
  assert.equal(empty.held.size, 0);
});

test("a request already answered by this viewer leaves no second answer", async () => {
  const data = waiting();
  assert.equal(await takeRequest(data.files, { ...here, answered: "a1" }), null);
  assert.equal(data.held.has("/data/answer-a1"), false);
});
