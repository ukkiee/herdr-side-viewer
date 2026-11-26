// Checks what oxlint cannot see in mods/side-viewer: which folders hold modules, that every test
// sits beside its module, and that every relative import is written in its shortest form and names
// a file the installed mod holds. The import direction between the folders, bare imports and cycles
// are oxlint's (.oxlintrc.json, bun run lint); its folder rules match the import text, so they hold
// only while that text is the shortest form checked here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOD = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "mods/side-viewer");
const ROOT = "root";
// main.js and link.js are the entry files Herdr loads by name, so they stay at the mod root.
const ROOT_FILES = ["main.js", "link.js"];
const FOLDERS = [
  "core/domain",
  "core/app",
  "core/ports",
  "core/i18n",
  "adapters/in/viewer",
  "adapters/in/picker",
  "adapters/in/shared",
  "adapters/in/logic",
  "adapters/out",
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(MOD).map((full) => path.relative(MOD, full).split(path.sep).join("/"));
const fileSet = new Set(files);
const scripts = files.filter((rel) => rel.endsWith(".js") || rel.endsWith(".mjs"));
const isTest = (rel) => rel.endsWith(".test.mjs");
const modules = scripts.filter((rel) => rel.endsWith(".js"));
const tests = scripts.filter(isTest);

function folderOf(rel) {
  const dir = path.posix.dirname(rel);
  if (dir === ".") return ROOT_FILES.includes(rel) ? ROOT : null;
  return FOLDERS.includes(dir) ? dir : null;
}

// A specifier must be a plain literal: a template with ${} is computed at run time and skipped.
const PATTERNS = [
  ["import", /^[ \t]*import\s+[\w$*{}\s,]+?\s*from\s*(["'])([^"'\n]+)\1/gm],
  ["import", /^[ \t]*export\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(["'])([^"'\n]+)\1/gm],
  ["import", /^[ \t]*import\s*(["'])([^"'\n]+)\1/gm],
  ["import()", /\bimport\s*\(\s*(["'`])([^"'`$\n]+)\1\s*\)/g],
  ["new URL", /\bnew\s+URL\s*\(\s*(["'`])([^"'`$\n]+)\1\s*,\s*import\.meta\.url\s*\)/g],
];

// A "/" here starts a regex literal rather than a division.
const BEFORE_REGEX = new Set([..."(,=:[!&|?{};+-*%<>~^", "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

// Turns every comment into spaces, newlines kept, so prose that quotes an import is not read as one
// while code after a comment on the same line still is, and line numbers stay right. Strings,
// templates and regex literals are passed over whole, so a "//" or "/*" inside one is not a comment.
function withoutComments(source) {
  const blank = (text) => text.replace(/[^\n]/g, " ");
  // One entry per open `${`: how many "{" opened inside it are still open.
  const templates = [];
  let out = "";
  let at = 0;
  let previous = "";
  const templateFrom = (start) => {
    let end = start;
    while (end < source.length) {
      if (source[end] === "\\") end += 2;
      else if (source[end] === "`") return end + 1;
      else if (source[end] === "$" && source[end + 1] === "{") {
        templates.push(0);
        previous = "{";
        return end + 2;
      } else end += 1;
    }
    return source.length;
  };
  while (at < source.length) {
    const char = source[at];
    const next = source[at + 1];
    let end = at + 1;
    if (char === "/" && next === "/") {
      end = source.indexOf("\n", at);
      if (end < 0) end = source.length;
      out += blank(source.slice(at, end));
      at = end;
      continue;
    }
    if (char === "/" && next === "*") {
      end = source.indexOf("*/", at + 2);
      end = end < 0 ? source.length : end + 2;
      out += blank(source.slice(at, end));
      at = end;
      continue;
    }
    if (/\s/.test(char)) {
      out += char;
      at = end;
      continue;
    }
    const regexMayStart = previous === "" || BEFORE_REGEX.has(previous);
    previous = "value";
    if (char === '"' || char === "'") {
      while (end < source.length && source[end] !== char && source[end] !== "\n") end += source[end] === "\\" ? 2 : 1;
      end = Math.min(end + 1, source.length);
    } else if (char === "`") {
      end = templateFrom(at + 1);
    } else if (char === "}" && templates.length > 0 && templates.at(-1) === 0) {
      templates.pop();
      end = templateFrom(at + 1);
    } else if (char === "/" && regexMayStart) {
      let inClass = false;
      while (end < source.length && source[end] !== "\n" && (inClass || source[end] !== "/")) {
        if (source[end] === "\\") end += 1;
        else if (source[end] === "[") inClass = true;
        else if (source[end] === "]") inClass = false;
        end += 1;
      }
      end += 1;
      while (end < source.length && /[a-z]/i.test(source[end])) end += 1;
    } else if (/[\w$]/.test(char)) {
      while (end < source.length && /[\w$]/.test(source[end])) end += 1;
      previous = source.slice(at, end);
    } else {
      if (char === "{" && templates.length > 0) templates[templates.length - 1] += 1;
      if (char === "}" && templates.length > 0) templates[templates.length - 1] -= 1;
      previous = char;
    }
    out += source.slice(at, end);
    at = end;
  }
  return out;
}

function importsOf(rel) {
  return importsIn(rel, fs.readFileSync(path.join(MOD, rel), "utf8"));
}

function importsIn(rel, source) {
  const code = withoutComments(source);
  return PATTERNS.flatMap(([kind, pattern]) =>
    [...code.matchAll(pattern)].map((match) => {
      const spec = match[2];
      const line = code.slice(0, match.index).split("\n").length;
      // new URL("x.json", import.meta.url) is relative even without "./".
      const relative = kind === "new URL" ? !/^[a-z][\w+.-]*:/i.test(spec) : spec.startsWith("./") || spec.startsWith("../");
      const target = relative ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)) : null;
      return { rel, spec, relative, target, where: `mods/side-viewer/${rel}:${line} ${kind} "${spec}"` };
    }),
  );
}

const relativeImports = scripts.flatMap(importsOf).filter((found) => found.relative);

// The shortest way to write a relative specifier: "./" or "../" only at the start, no "a/.." and
// no "//". A new URL path may also start bare ("extensions.json").
function shortestOf(spec) {
  const normal = path.posix.normalize(spec);
  return normal.startsWith("../") || !spec.startsWith("./") ? normal : `./${normal}`;
}

// Whether the path climbs above the mod root on the way, even if it comes back in: the folder it
// passes through is named by wherever the mod is installed, not by this repository.
function leavesMod(rel, spec) {
  let depth = path.posix.dirname(rel) === "." ? 0 : path.posix.dirname(rel).split("/").length;
  for (const part of spec.split("/")) {
    if (part === "..") depth -= 1;
    else if (part !== "." && part !== "") depth += 1;
    if (depth < 0) return true;
  }
  return false;
}

function failWith(rule, problems) {
  if (problems.length === 0) return;
  assert.fail(`${rule}: ${problems.join("\n")}\n(${problems.length} in all)`);
}

test("the scan read the whole mod, so the checks below cannot pass on nothing", () => {
  assert.ok(modules.length > 30, `only ${modules.length} .js modules found under ${MOD}`);
  assert.ok(tests.length > 15, `only ${tests.length} .test.mjs files found`);
  assert.ok(relativeImports.length > 80, `only ${relativeImports.length} relative imports read`);
  for (const folder of [ROOT, ...FOLDERS]) {
    assert.ok(modules.some((rel) => folderOf(rel) === folder), `no module found in ${folder}`);
  }
});

test("every module sits in an allowed folder and every test beside its module", () => {
  const problems = [];
  for (const rel of scripts) {
    if (isTest(rel)) {
      const module = rel.replace(/\.test\.mjs$/, ".js");
      if (!fileSet.has(module)) problems.push(`mods/side-viewer/${rel} has no ${module} beside it`);
    } else if (rel.endsWith(".mjs")) {
      problems.push(`mods/side-viewer/${rel} is an .mjs that is not a test; Herdr loads the mod's modules as .js`);
    } else if (!folderOf(rel)) {
      const dir = path.posix.dirname(rel);
      problems.push(
        dir === "."
          ? `mods/side-viewer/${rel} is at the mod root, where only ${ROOT_FILES.join(" and ")} belong`
          : `mods/side-viewer/${rel} is in ${dir}/, which is not one of ${FOLDERS.join(", ")}`,
      );
    }
  }
  failWith("folders", problems);
});

test("every relative import and new URL points at a file that exists", () => {
  const problems = relativeImports
    .filter(({ target }) => !fs.existsSync(path.join(MOD, target)) || !fs.statSync(path.join(MOD, target)).isFile())
    .map(({ where, target }) => `${where}: no file ${target}`);
  failWith("imports", problems);
});

test("every relative import is written in its shortest form, the text oxlint's folder rules read", () => {
  const problems = relativeImports
    .filter(({ spec }) => spec !== shortestOf(spec))
    .map(({ where, spec }) => `${where}: write it "${shortestOf(spec)}"`);
  failWith("import paths", problems);
});

test("every relative import names a file the installed mod holds, and none an entry file", () => {
  const problems = [];
  for (const { where, rel, spec, target } of relativeImports) {
    if (leavesMod(rel, spec)) problems.push(`${where}: leaves mods/side-viewer, which is installed on its own`);
    else if (isTest(target)) problems.push(`${where}: ${target} is a test, which the installer leaves out`);
    else if (!fileSet.has(target)) problems.push(`${where}: no file ${target} in the mod`);
    else if (ROOT_FILES.includes(target)) problems.push(`${where}: ${target} is an entry file Herdr loads, so nothing imports it`);
  }
  failWith("import targets", problems);
});

test("the shortest form keeps short paths and rewrites the long ways round", () => {
  for (const spec of ["./a.js", "../a.js", "../../b/c.js", "extensions.json"]) assert.equal(shortestOf(spec), spec);
  assert.equal(shortestOf("./../a.js"), "../a.js");
  assert.equal(shortestOf("a/../b.js"), "b.js");
  assert.equal(shortestOf("../x/./y.js"), "../x/y.js");
  assert.equal(shortestOf("../../.././link.js"), "../../../link.js");
  assert.equal(shortestOf("./a//b.js"), "./a/b.js");
  assert.equal(leavesMod("core/app/x.js", "../../main.js"), false);
  assert.equal(leavesMod("core/app/x.js", "../../../side-viewer/main.js"), true);
  assert.equal(leavesMod("main.js", "../install.mjs"), true);
});

test("the import reader reads code after a comment and not imports quoted in comments", () => {
  const read = (source) => importsIn("core/domain/x.js", source).map(({ spec, where }) => `${spec}@${where.split(":")[1].split(" ")[0]}`).sort();
  const source = [
    '/* note */ import "./a.js";',
    'export { b } /* c */ from "./b.js";',
    '// import "./quoted-line.js";',
    "/*",
    ' * import d from "./quoted-block.js";',
    " */",
    'const s = "/* not a comment";',
    'import "./after-string.js";',
    "const r = /[\"'/]/g;",
    'import "./after-regex.js";',
    "const t = `${\"}\"} // ${{ a: `/*` }.a}`;",
    'import "./after-template.js";',
    "const half = 4 / 2; // a division, then a comment",
    'import "./after-division.js";',
  ].join("\n");
  assert.deepEqual(read(source), [
    "./a.js@1",
    "./after-division.js@14",
    "./after-regex.js@10",
    "./after-string.js@8",
    "./after-template.js@12",
    "./b.js@2",
  ]);
});
