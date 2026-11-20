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
  assert.deepEqual(request, { id: "1800000000-4242", file: "/work/notes/plan.md", conversation: null });
});

test("a request names the conversation pane that sent the file", () => {
  const request = requestFrom(text({ id: "a1", file: "/a.md", at: AT, conversation: "p23db72f7" }), fresh);
  assert.deepEqual(request, { id: "a1", file: "/a.md", conversation: "p23db72f7" });
  const remote = requestFrom(text({ id: "a1", file: "/a.md", at: AT, conversation: "mini/p7" }), fresh);
  assert.equal(remote.conversation, "mini/p7");
});

test("a request without a usable conversation is still taken, with no conversation", () => {
  for (const conversation of [undefined, null, "", 7, true, { pane: "p1" }, ["p1"]]) {
    const request = requestFrom(text({ id: "a1", file: "/a.md", at: AT, conversation }), fresh);
    assert.deepEqual(request, { id: "a1", file: "/a.md", conversation: null }, String(conversation));
  }
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
  assert.deepEqual(requestFrom(same, { answered: "a0", now: NOW }), { id: "a1", file: "/a.md", conversation: null });
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
  assert.equal(requestFrom(text({ id: "a1", file: "/a.md", conversation: null }), fresh), null);
  assert.equal(requestFrom(text({ id: "a1", file: "/a.md", at: "soon" }), fresh), null);
});

// Spaces as spaces() gives them: two of this Mac's, bare, and a
// remote one with its `<machine>/` prefix. A viewer's space value is the id without it.
const HERE = "spfcbfd8b278fa8d8e02972c005e05b6ea";
const OTHER_HERE = "sp9f0a3f5d62c03718f911c1c8acd35d53";
const REMOTE = "spa386c8aedeec27b60120366586cddf4b";
const SPACES = [
  { id: HERE, machine: null, name: "work", tabs: [] },
  { id: OTHER_HERE, machine: null, name: "home", tabs: [] },
  { id: `mac-box/${REMOTE}`, machine: "mac-box", name: "imac", tabs: [] },
];
const asked = (space) => text({ id: "a1", file: "/a.md", at: AT, ...(space === undefined ? {} : { space }) });
const viewerIn = (space) => ({ ...fresh, space, spaces: SPACES });
const TAKEN = { id: "a1", file: "/a.md", conversation: null };

test("a viewer takes a request for its own space and leaves one for another space", () => {
  assert.deepEqual(requestFrom(asked(HERE), viewerIn(HERE)), TAKEN);
  assert.deepEqual(requestFrom(asked(REMOTE), viewerIn(REMOTE)), TAKEN);
  assert.equal(requestFrom(asked(OTHER_HERE), viewerIn(HERE)), null);
  assert.equal(requestFrom(asked(HERE), viewerIn(REMOTE)), null);
  assert.equal(requestFrom(asked(REMOTE), viewerIn(HERE)), null);
});

test("a request without a space value is for this Mac, so a remote space's viewer leaves it", () => {
  assert.deepEqual(requestFrom(asked(undefined), viewerIn(HERE)), TAKEN);
  assert.deepEqual(requestFrom(asked(null), viewerIn(HERE)), TAKEN);
  assert.deepEqual(requestFrom(asked(undefined), viewerIn(null)), TAKEN);
  assert.equal(requestFrom(asked(undefined), viewerIn(REMOTE)), null);
});

test("a viewer opened without a space value is on this Mac, so it leaves a remote space's request", () => {
  assert.deepEqual(requestFrom(asked(HERE), viewerIn(null)), TAKEN);
  assert.deepEqual(requestFrom(asked(HERE), viewerIn(undefined)), TAKEN);
  assert.equal(requestFrom(asked(REMOTE), viewerIn(null)), null);
});

test("a viewer whose space is not listed yet leaves a request without a space value", () => {
  // As after a restart, before Herdr lists a remote space: the viewer's space may be another
  // machine's, so a request for this Mac is not its to take.
  const UNLISTED = "sp0d6a4b1e9c7f2a3b5d8e0f1a2b3c4d5e";
  assert.equal(requestFrom(asked(undefined), viewerIn(UNLISTED)), null);
  assert.equal(requestFrom(asked(null), viewerIn(UNLISTED)), null);
  // A request for its own space is still its own.
  assert.deepEqual(requestFrom(asked(UNLISTED), viewerIn(UNLISTED)), TAKEN);
});

test("a request whose space value is no text is ignored", () => {
  for (const space of [7, {}, ["x"]]) assert.equal(requestFrom(asked(space), viewerIn(HERE)), null, String(space));
});

test("a viewer takes its own space's request from the data folder, and leaves another's unanswered", async () => {
  const data = folder({ "/data/request.json": asked(HERE) });
  assert.equal(await takeRequest(data.files, { ...here, space: REMOTE, spaces: SPACES }), null);
  assert.equal(data.held.has("/data/answer-a1"), false);
  assert.deepEqual(await takeRequest(data.files, { ...here, space: HERE, spaces: SPACES }), TAKEN);
  assert.ok(data.held.has("/data/answer-a1"));
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
  assert.deepEqual(await takeRequest(data.files, here), { id: "a1", file: "/a.md", conversation: null });
  assert.ok(data.held.has("/data/answer-a1"));
});

test("of two viewers showing in one tab, only the first takes the request", async () => {
  const data = waiting();
  const taken = [await takeRequest(data.files, here), await takeRequest(data.files, here)];
  assert.deepEqual(taken, [{ id: "a1", file: "/a.md", conversation: null }, null]);
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
