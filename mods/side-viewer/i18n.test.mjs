// node --test: choosing the viewer's language and wording its sentences from the message
// tables, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickLang, readAppleLanguages, systemLang, askAgainAfter, translator, TABLES } from "./i18n.js";
import { noticeFor } from "./document.js";
import { noticeOf } from "./terminal-insert.js";
import { unplacedNotice } from "./viewer-tab.js";

test("the first preferred language decides: Korean when it is Korean, English otherwise", () => {
  assert.equal(pickLang(["ko-KR"]), "ko");
  assert.equal(pickLang(["ko"]), "ko");
  assert.equal(pickLang(["ko_KR.UTF-8"]), "ko");
  assert.equal(pickLang(["KO-kr"]), "ko");
  assert.equal(pickLang(["en-US", "ko-KR"]), "en");
  assert.equal(pickLang(["ja-JP", "ko-KR"]), "en");
  assert.equal(pickLang([]), "en");
  assert.equal(pickLang([""]), "en");
  assert.equal(pickLang(null), "en");
  // A tag that only starts with the letters k, o is another language (Konkani).
  assert.equal(pickLang(["kok-IN"]), "en");
});

test("`defaults read -g AppleLanguages` output is read as its tags in order", () => {
  assert.deepEqual(readAppleLanguages('(\n    "ko-KR"\n)\n'), ["ko-KR"]);
  assert.deepEqual(readAppleLanguages('(\n    "en-US",\n    "ko-KR"\n)\n'), ["en-US", "ko-KR"]);
  assert.deepEqual(readAppleLanguages("(\n    en,\n    \"ko-KR\"\n)"), ["en", "ko-KR"]);
  assert.deepEqual(readAppleLanguages(""), []);
  assert.deepEqual(readAppleLanguages("The domain/default pair of (kCFPreferencesAnyApplication, AppleLanguages) does not exist"), []);
});

test("the system's language from the command's result; a failed or missing read is not known, never English", () => {
  assert.equal(systemLang({ code: 0, stdout: '(\n    "ko-KR",\n    en\n)\n' }), "ko");
  assert.equal(systemLang({ code: 0, stdout: '(\n    ko\n)\n' }), "ko");
  assert.equal(systemLang({ code: 0, stdout: '(\n    "en-US",\n    "ko-KR"\n)\n' }), "en");
  assert.equal(systemLang({ code: 0, stdout: "" }), "en", "an empty answer");
  assert.equal(systemLang({ code: 1, stdout: "" }), null, "the command failed");
  assert.equal(systemLang({ code: 1, stdout: '(\n    "ko-KR"\n)\n' }), null, "a failed command's output");
  assert.equal(systemLang(null), null, "the command couldn't run");
  assert.equal(systemLang(undefined), null);
});

test("a language not known yet is asked again after 1, 3 and 10 seconds, then every 15 seconds", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 20].map(askAgainAfter), [1000, 3000, 10000, 15000, 15000, 15000]);
});

test("t(key, args) words a key in its language and fills {name} places", () => {
  const tables = [{
    en: { "demo.plain": "Close", "demo.named": "Opened '{name}' ({n})." },
    ko: { "demo.plain": "닫기", "demo.named": "'{name}'({n})을 열었습니다." },
  }];
  const en = translator("en", tables), ko = translator("ko", tables);
  assert.equal(en("demo.plain"), "Close");
  assert.equal(ko("demo.plain"), "닫기");
  assert.equal(ko("demo.named", { name: "plan.md", n: 2 }), "'plan.md'(2)을 열었습니다.");
  // A value that holds braces or $& goes in as it is.
  assert.equal(en("demo.named", { name: "{n}", n: "$&" }), "Opened '{n}' ($&).");
  // A missing value keeps its place in sight, a missing key shows itself.
  assert.equal(en("demo.named", { n: 1 }), "Opened '{name}' (1).");
  assert.equal(ko("demo.nope"), "demo.nope");
  // A language it doesn't know is English; t says which language it speaks.
  assert.equal(translator("fr", tables)("demo.plain"), "Close");
  assert.equal(translator("fr", tables).lang, "en");
  assert.equal(ko.lang, "ko");
});

test("a part that words a sentence, called without a translator, throws instead of speaking English", () => {
  assert.throws(() => noticeFor("empty"), /translator/);
  assert.throws(() => noticeOf({ state: "failed" }), /translator/);
  assert.throws(() => unplacedNotice("/a/plan.md"), /translator/);
  assert.equal(noticeFor("empty", translator("ko")), "이 파일은 비어 있습니다.");
});

// Every message table in the folder, found rather than listed.
const here = path.dirname(fileURLToPath(import.meta.url));
const tableFiles = fs.readdirSync(here).filter((name) => /^messages-[a-z0-9-]+\.js$/.test(name)).sort();
const tables = await Promise.all(tableFiles.map(async (name) => ({ name, area: name.slice(9, -3), mod: await import(`./${name}`) })));
const areas = tables.map((table) => table.area);
const holes = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

test("every table has the same keys in both languages, under its area, with the same places", () => {
  assert.ok(tableFiles.length > 0);
  assert.equal(TABLES.length, tableFiles.length, "every messages-*.js is listed in i18n.js TABLES");
  const seen = new Map();
  for (const { name, area, mod } of tables) {
    assert.ok(TABLES.includes(mod), `${name} is listed in i18n.js TABLES`);
    assert.deepEqual(Object.keys(mod.ko).sort(), Object.keys(mod.en).sort(), `${name}: the same keys in both languages`);
    for (const key of Object.keys(mod.en)) {
      assert.ok(key.startsWith(`${area}.`), `${name}: ${key} starts with "${area}."`);
      assert.ok(!seen.has(key), `${key} is in ${seen.get(key)} and ${name}`);
      seen.set(key, name);
      assert.deepEqual(holes(mod.ko[key]), holes(mod.en[key]), `${name}: ${key} has the same places in both languages`);
      for (const lang of ["en", "ko"]) assert.ok(typeof mod[lang][key] === "string" && mod[lang][key].trim(), `${name}: ${lang} ${key} isn't empty`);
    }
  }
});

// The keys the code uses: string literals that start with an area's name ("header.save").
// A key the code builds out of parts would not be found, so keys are always written whole.
function usedKeys() {
  const sources = fs.readdirSync(here).filter((name) => name.endsWith(".js") && !name.startsWith("messages-") && name !== "i18n.js");
  const pattern = new RegExp(`(["'\`])((?:${areas.join("|")})\\.[A-Za-z0-9_.-]+)\\1`, "g");
  const used = [];
  for (const name of sources) {
    // Comment lines left out: they may show a key without using it.
    const text = fs.readFileSync(path.join(here, name), "utf8").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
    for (const m of text.matchAll(pattern)) used.push([name, m[2]]);
  }
  return used;
}

test("every key the code uses is in a table, and every table key is used", () => {
  const used = usedKeys();
  const en = translator("en"), ko = translator("ko");
  for (const [name, key] of used) {
    assert.notEqual(en(key), key, `${name} uses ${key}, which no table has`);
    assert.notEqual(ko(key), key, `${name} uses ${key}, which no table has`);
  }
  const usedSet = new Set(used.map(([, key]) => key));
  for (const { name, mod } of tables) {
    for (const key of Object.keys(mod.en)) assert.ok(usedSet.has(key), `${name}: ${key} is used nowhere`);
  }
});

// The parts that word a sentence throw without a translator (wordsOf), so a forgotten `tr` on a
// path the unit tests run already fails there. This scan backs that up for the wiring no unit test
// runs: main.js, shell-pane.js and the views that hand `tr` down while drawing.
// A part is found, so a new step that carries `tr` is checked too. What the scan finds as a part:
// - a function or method written `name(…) {` or `function name(…) {` whose parameters hold tr;
// - an arrow function written `name = (…) =>` or `name: (…) =>` whose parameters hold tr;
// - a table: an object `NAME = { … }` holding such arrow functions, called as `NAME[key](…)`;
// - renderHeader, which reads tr from main.js's header() object.
// Not found: an arrow with one bare parameter (`tr => …`), parameters with parentheses in them
// (`tr = wordsOf()`), and a part reached through a variable (`const f = TABLE[key]; f(…)`).
// Calls are matched by name alone, so another object's method of a part's name fails the test
// too; that is the safe way to be wrong, and the message names the call.
const codeSources = fs.readdirSync(here).filter((name) => name.endsWith(".js") && !name.startsWith("messages-") && name !== "i18n.js");
// Comment lines left out: they may show a call without making it.
const codeOf = (name) => fs.readFileSync(path.join(here, name), "utf8").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "function", "return"]);
// tr as an object's key: `{ tr }`, `{ a, tr, b }`, `{ tr: this.words() }`.
const trKey = /(?:^|[{,])\s*tr\s*(?:[:,}]|$)/;

// What a definition's parameters say. Keyed: tr comes in an options object, so a call must give
// that object a tr key.
const paramsOf = (params) => ({ takesTr: /\btr\b/.test(params), keyed: /\{[^}]*\btr\b[^}]*\}/.test(params) });
const ARROW = /\b(\w+)\s*[:=]\s*(?:async\s*)?\(([^()]*)\)\s*=>/g;
const add = (map, fnName, file, def) => {
  if (!map.has(fnName)) map.set(fnName, new Map());
  map.get(fnName).set(file, def);
};

// Every definition, by name and then by file: two files may each keep a private function of the
// same name (header.js and code-card.js both have renderActions), and a call means its own file's.
function definitions() {
  const defs = new Map();
  for (const name of codeSources) {
    const text = codeOf(name);
    for (const m of text.matchAll(/\b(\w+)\s*\(([^()]*)\)\s*\{/g)) {
      if (!KEYWORDS.has(m[1])) add(defs, m[1], name, paramsOf(m[2]));
    }
    for (const m of text.matchAll(ARROW)) add(defs, m[1], name, paramsOf(m[2]));
  }
  defs.set("renderHeader", new Map([["header.js", { takesTr: true, keyed: false }]]));
  return defs;
}

// Every object that holds arrow functions taking tr, by name and then by file. A call
// `NAME[key](…)` may reach any of them, so its arguments must suit every one.
function partTables() {
  const found = new Map();
  for (const name of codeSources) {
    const text = codeOf(name);
    for (const m of text.matchAll(/\b(\w+)\s*=\s*\{/g)) {
      let depth = 1, at = m.index + m[0].length;
      while (depth > 0 && at < text.length) depth += text[at] === "{" ? 1 : text[at] === "}" ? -1 : 0, at++;
      const entries = [...text.slice(m.index + m[0].length, at - 1).matchAll(ARROW)].map((e) => paramsOf(e[2])).filter((def) => def.takesTr);
      if (entries.length) add(found, m[1], name, { takesTr: true, entries });
    }
  }
  return found;
}

// The part a call in `file` reaches: its own file's definition, else one elsewhere that takes tr.
const partFor = (defs, fnName, file) => {
  const byFile = defs.get(fnName);
  if (byFile.has(file)) return byFile.get(file).takesTr ? byFile.get(file) : null;
  return [...byFile.values()].find((def) => def.takesTr) ?? null;
};

// tr, or main.js's this.words() that makes it. A keyed part needs tr as a key; header.js hands
// its parts renderHeader's whole `header`, whose tr is checked in the next test.
const passes = (part, args) => part.entries ? part.entries.every((entry) => passes(entry, args))
  : part.keyed ? trKey.test(args) || /^t,\s*header\b/.test(args.trim()) : /\b(?:tr|words)\b/.test(args);

test("every call of a part that words a sentence passes the viewer's translator", () => {
  const defs = definitions();
  const parts = [...defs.keys()].filter((fnName) => [...defs.get(fnName).values()].some((def) => def.takesTr));
  for (const step of ["noticeFor", "statusOf", "barOf", "noticeOf", "unplacedNotice", "insertPlan", "pressOutcome", "renderNotice", "renderMarkdown",
    "renderBody", "header", "insert", "put", "send", "renderStatus", "renderSwitch", "renderActions"]) {
    assert.ok(parts.includes(step), `the scan finds ${step} as a part that takes tr`);
  }
  const tabled = partTables();
  assert.ok(tabled.has("STATUS_BUTTONS"), "the scan finds header.js's STATUS_BUTTONS as a table of parts that take tr");
  // `name(` for a part, `NAME[…](` for a table.
  const call = new RegExp(`\\b(?:(${parts.join("|")})|(${[...tabled.keys()].join("|")})\\[[^\\[\\]\\n]*\\])\\(`, "g");
  const bare = [];
  let calls = 0, tableCalls = 0;
  for (const name of codeSources) {
    const text = codeOf(name);
    for (const m of text.matchAll(call)) {
      const part = m[1] ? partFor(defs, m[1], name) : partFor(tabled, m[2], name);
      if (!part) continue;
      // The call's arguments, up to its closing parenthesis.
      let depth = 1, at = m.index + m[0].length;
      while (depth > 0 && at < text.length) depth += text[at] === "(" ? 1 : text[at] === ")" ? -1 : 0, at++;
      const args = text.slice(m.index + m[0].length, at - 1);
      // A definition, not a call: `function noticeFor(state, tr) {`, `async put(…, tr, cx) {`.
      if (/^\s*\{/.test(text.slice(at))) continue;
      calls++;
      if (m[2]) tableCalls++;
      if (!passes(part, args)) bare.push(`${name}: ${m[0]}${args.replace(/\s+/g, " ").slice(0, 80)})`);
    }
  }
  assert.ok(calls > 20, "the scan finds the calls");
  assert.ok(tableCalls > 0, "the scan finds the calls through a table");
  assert.deepEqual(bare, []);
});

// renderHeader's parts read tr off the object main.js's header(tr) builds, so that object has to
// carry it; a mention of tr elsewhere in header() (statusOf's) is not enough.
test("the header object main.js builds carries the viewer's translator", () => {
  const text = codeOf("main.js");
  const start = text.search(/^\s*header\(tr\)\s*\{/m);
  assert.ok(start >= 0, "main.js has header(tr)");
  const body = text.slice(start).match(/\{([\s\S]*?)\n {2}\}/)[1];
  const object = body.slice(body.indexOf("return {"));
  // Only the object's own keys: what nested calls take is left out.
  let flat = "", depth = 0;
  for (const ch of object.slice("return {".length)) {
    if (ch === "(") depth++;
    if (depth === 0) flat += ch;
    if (ch === ")") depth--;
  }
  assert.match(flat, trKey);
});

test("no Korean is left on screen outside the message tables", () => {
  const sources = fs.readdirSync(here).filter((name) => name.endsWith(".js") && !name.startsWith("messages-"));
  const found = [];
  for (const name of sources) {
    fs.readFileSync(path.join(here, name), "utf8").split("\n").forEach((line, at) => {
      if (!line.trim().startsWith("//") && /[가-힣]/.test(line)) found.push(`${name}:${at + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(found, []);
});
