// node --test: choosing the viewer's language and wording its sentences from the message
// tables, without Herdr.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickLang, readAppleLanguages, systemLang, askAgainAfter, translator, TABLES } from "./i18n.js";

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

// The parts that word a sentence speak English without a translator, so a call that forgets
// to pass the viewer's `tr` would stay English on a Korean system without failing anything else.
test("every call of a part that words a sentence passes the viewer's translator", () => {
  const parts = ["noticeFor", "statusOf", "barOf", "noticeOf", "unplacedNotice", "insertPlan", "pressOutcome", "renderNotice", "renderMarkdown", "renderHeader"];
  const sources = fs.readdirSync(here).filter((name) => name.endsWith(".js") && !name.startsWith("messages-") && name !== "i18n.js");
  const bare = [];
  let calls = 0;
  for (const name of sources) {
    const text = fs.readFileSync(path.join(here, name), "utf8").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
    for (const m of text.matchAll(new RegExp(`(function\\s+)?\\b(${parts.join("|")})\\(`, "g"))) {
      if (m[1]) continue;
      // The call's arguments, up to its closing parenthesis.
      let depth = 1, at = m.index + m[0].length;
      while (depth > 0 && at < text.length) depth += text[at] === "(" ? 1 : text[at] === ")" ? -1 : 0, at++;
      const args = text.slice(m.index + m[0].length, at - 1);
      calls++;
      // tr, or main.js's this.words() that makes it.
      if (!/\b(?:tr|words)\b/.test(args)) bare.push(`${name}: ${m[2]}(${args.replace(/\s+/g, " ").slice(0, 80)})`);
    }
  }
  assert.ok(calls > 10, "the scan finds the calls");
  assert.deepEqual(bare, []);
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
