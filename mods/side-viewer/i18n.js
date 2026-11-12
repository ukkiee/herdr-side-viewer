// The words on the side viewer's screens in English and Korean: which language to use and
// the sentence a message key stands for. No Herdr imports, so it runs under `node --test`
// (i18n.test.mjs). main.js runs the command that reads the system's language and hands its
// result here.
//
// In the viewer `t` is the theme, so a translator is always called `tr`. The pure modules
// take one as their last argument and speak English without it.

import * as header from "./messages-header.js";
import * as body from "./messages-body.js";
import * as alerts from "./messages-alerts.js";

export const LANGS = ["en", "ko"];

// pickLang(tags) → "ko" | "en": Korean when the first preferred language is Korean
// ("ko-KR", "ko", "ko_KR.UTF-8"), English for anything else or nothing.
export function pickLang(tags) {
  const first = Array.isArray(tags) ? String(tags[0] ?? "") : "";
  return /^ko(?:$|[-_.@])/i.test(first.trim()) ? "ko" : "en";
}

// readAppleLanguages(stdout) → the tags in `defaults read -g AppleLanguages` output, in
// order: '(\n    "ko-KR",\n    en\n)' → ["ko-KR", "en"]. [] for anything else.
export function readAppleLanguages(text) {
  const s = String(text ?? "").trim();
  if (!s.startsWith("(") || !s.endsWith(")")) return [];
  return s.slice(1, -1).split(",").map((part) => part.trim().replace(/^"(.*)"$/s, "$1")).filter(Boolean);
}

// systemLang(read) → "ko" | "en" | null. read: { code, stdout } of `defaults read -g
// AppleLanguages`, or null when it couldn't run. null means not known, which is not English:
// the viewer keeps the language it has and asks again (askAgainAfter).
export function systemLang(read) {
  if (!read || read.code !== 0) return null;
  return pickLang(readAppleLanguages(read.stdout));
}

// Right after the app starts the command may not answer yet: the first asks come quickly,
// then the viewer keeps asking at a slow pace until it gets an answer.
const ASK_AGAIN = [1000, 3000, 10000];
const ASK_LATER = 15000;

// askAgainAfter(attempt) → how long to wait (ms) before asking again after `attempt` (from 0)
// asks went unanswered.
export const askAgainAfter = (attempt) => ASK_AGAIN[attempt] ?? ASK_LATER;

// Every message table, one per screen area (messages-<area>.js, each exporting { en, ko },
// keys starting with "<area>."). i18n.test.mjs fails for a table that isn't listed here,
// for a key no code uses and for a key the code uses that no table has.
export const TABLES = [header, body, alerts];

const merged = (tables, lang) => Object.assign({}, ...tables.map((table) => table?.[lang] ?? {}));

// translator(lang, tables?) → tr(key, args?): the sentence for `key` in `lang` (English when
// the language isn't one we have), its {name} places filled from args. A key no table has
// comes back as the key itself, so a missing sentence shows on screen instead of a blank; a
// place with no value stays as written. tr.lang: the language it speaks.
export function translator(lang, tables = TABLES) {
  const l = LANGS.includes(lang) ? lang : "en", words = merged(tables, l);
  const tr = (key, args = {}) => {
    const value = words[key];
    if (typeof value !== "string") return String(key);
    return value.replace(/\{(\w+)\}/g, (whole, name) => (args && args[name] !== undefined && args[name] !== null ? String(args[name]) : whole));
  };
  tr.lang = l;
  return tr;
}

const ENGLISH = translator("en");

// The translator a pure module speaks with: the one it was given, else English.
export const wordsOf = (tr) => (typeof tr === "function" ? tr : ENGLISH);
