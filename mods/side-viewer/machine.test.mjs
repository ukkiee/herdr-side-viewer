// node --test: which machine a viewer reads from, and what it asks that machine, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spaceValue, machineOf, headerActions } from "./machine.js";

// Space ids as `herdr-app status` and spaces() give them (observed 2026-11-13): this Mac's
// bare, another machine's with its `<machine>/` prefix.
const HERE = "sp8b57a2baf6b934a06fdeccc6b38ed439";
const NUC = "sp05ca7f2f0e0d351c8ed546645cf8c425";

test("the space value is the space id without its machine prefix", () => {
  assert.equal(spaceValue(`nuc-pro/${NUC}`), NUC);
  assert.equal(spaceValue(HERE), HERE);
});

test("no space id gives no space value", () => {
  for (const id of [null, undefined, "", "nuc-pro/"]) assert.equal(spaceValue(id), null, String(id));
});

const space = (id, machine) => ({ id, machine, name: "work", tabs: [] });
const SPACES = [space(HERE, null), space(`nuc-pro/${NUC}`, "nuc-pro"), space("imac-i7/sp77", "imac-i7")];
const THIS_MAC = { machine: null, remote: false };

test("a viewer in a remote space reads from that space's machine", () => {
  assert.deepEqual(machineOf({ file: "/home/ukyi/a.md", space: NUC }, SPACES), { machine: "nuc-pro", remote: true });
  assert.deepEqual(machineOf({ space: "sp77" }, SPACES), { machine: "imac-i7", remote: true });
});

test("a viewer in a space on this Mac reads from this Mac", () => {
  assert.deepEqual(machineOf({ file: "/Users/ukyi/a.md", space: HERE }, SPACES), THIS_MAC);
});

test("the space value opened with the space id spaces() gives, prefix and all, still finds it", () => {
  assert.deepEqual(machineOf({ space: `nuc-pro/${NUC}` }, SPACES), { machine: "nuc-pro", remote: true });
});

test("a viewer whose props have no space value reads from this Mac", () => {
  for (const props of [null, undefined, {}, { file: "/Users/ukyi/a.md" }, { space: 7 }, { space: "" }]) {
    assert.deepEqual(machineOf(props, SPACES), THIS_MAC, JSON.stringify(props));
  }
});

test("a viewer whose space is not listed reads from this Mac", () => {
  assert.deepEqual(machineOf({ space: "sp-gone" }, SPACES), THIS_MAC);
  assert.deepEqual(machineOf({ space: NUC }, []), THIS_MAC);
  assert.deepEqual(machineOf({ space: NUC }, null), THIS_MAC);
});

test("a space value is matched whole, not as the end of a longer id", () => {
  assert.deepEqual(machineOf({ space: NUC.slice(4) }, SPACES), THIS_MAC);
});

test("a remote file's header has no original app and no Finder, only the new tab", () => {
  assert.deepEqual(headerActions({ remote: true, newTab: true }), ["newTab"]);
  assert.deepEqual(headerActions({ remote: true, newTab: false }), []);
});

test("a file on this Mac keeps every header action", () => {
  assert.deepEqual(headerActions({ remote: false, newTab: true }), ["newTab", "original", "finder"]);
  assert.deepEqual(headerActions({ remote: false, newTab: false }), ["original", "finder"]);
});
