// Checks the mod's folder layers by reading import lines, since the repo keeps no lint
// dependency to do it. core/ runs both under node --test, which has no herdr or gpui-* modules,
// and inside Herdr's QuickJS, which has no node:* modules, so core/ (and the screens' pure
// adapters/in/logic) import nothing bare. Imports point one way, adapters/in -> core <- adapters/out,
// and never in a circle. main.js and link.js are the entry files Herdr loads: they import any
// layer and nothing imports them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOD = path.dirname(fileURLToPath(import.meta.url));
const SELF = path.basename(fileURLToPath(import.meta.url));
const ROOT = "root";
const ROOT_FILES = ["main.js", "link.js"];
const CORE = ["core/domain", "core/app", "core/ports", "core/i18n"];
const SCREENS = ["adapters/in/viewer", "adapters/in/picker", "adapters/in/shared"];
const LOGIC = "adapters/in/logic";
const OUT = "adapters/out";
const LAYERS = [...CORE, ...SCREENS, LOGIC, OUT];

// Which layers a layer's modules may import by relative path. Screens may use out adapters
// directly; out adapters never reach back into adapters/in.
const ALLOWED = {
  [ROOT]: LAYERS,
  "core/domain": ["core/domain", "core/i18n", "core/ports"],
  "core/app": CORE,
  "core/ports": ["core/ports"],
  "core/i18n": ["core/i18n"],
  ...Object.fromEntries(SCREENS.map((layer) => [layer, LAYERS])),
  [LOGIC]: [...CORE, LOGIC],
  [OUT]: [...CORE, OUT],
};
const NO_BARE = [...CORE, LOGIC];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(MOD).map((full) => path.relative(MOD, full).split(path.sep).join("/"));
const scripts = files.filter((rel) => rel.endsWith(".js") || rel.endsWith(".mjs"));
const isTest = (rel) => rel.endsWith(".test.mjs");
const modules = scripts.filter((rel) => rel.endsWith(".js"));
const tests = scripts.filter(isTest);

function layerOf(rel) {
  const dir = path.posix.dirname(rel);
  if (dir === ".") return ROOT_FILES.includes(rel) ? ROOT : null;
  return LAYERS.includes(dir) ? dir : null;
}

// A specifier string must be a plain literal: a template with ${} is computed at run time and skipped.
const PATTERNS = [
  ["import", /^[ \t]*import\s+[\w$*{}\s,]+?\s*from\s*(["'])([^"'\n]+)\1/gm],
  ["import", /^[ \t]*export\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(["'])([^"'\n]+)\1/gm],
  ["import", /^[ \t]*import\s*(["'])([^"'\n]+)\1/gm],
  ["import()", /\bimport\s*\(\s*(["'`])([^"'`$\n]+)\1\s*\)/g],
  ["new URL", /\bnew\s+URL\s*\(\s*(["'`])([^"'`$\n]+)\1\s*,\s*import\.meta\.url\s*\)/g],
];

// Lines that start as comments are blanked first, keeping line numbers, so prose that quotes an
// import is not read as one.
function importsOf(rel) {
  const code = fs
    .readFileSync(path.join(MOD, rel), "utf8")
    .split("\n")
    .map((line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? "" : line))
    .join("\n");
  return PATTERNS.flatMap(([kind, pattern]) =>
    [...code.matchAll(pattern)].map((match) => {
      const spec = match[2];
      const line = code.slice(0, match.index).split("\n").length;
      // new URL("x.json", import.meta.url) is relative even without "./".
      const relative = kind === "new URL" ? !/^[a-z][\w+.-]*:/i.test(spec) : spec.startsWith("./") || spec.startsWith("../");
      const target = relative ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)) : null;
      return { from: rel, line, kind, spec, relative, target, where: `${rel}:${line} ${kind} "${spec}"` };
    }),
  );
}

const imports = scripts.flatMap(importsOf);
const relativeImports = imports.filter((found) => found.relative);
const fileSet = new Set(files);

function failWith(rule, problems) {
  if (problems.length === 0) return;
  assert.fail(`${rule}: ${problems[0]}${problems.length > 1 ? `\n${problems.slice(1).join("\n")}` : ""}\n(${problems.length} in all)`);
}

test("the scan read the whole mod, so the rules below cannot pass on nothing", () => {
  assert.ok(modules.length > 30, `only ${modules.length} .js modules found under ${MOD}`);
  assert.ok(tests.length > 15, `only ${tests.length} .test.mjs files found`);
  assert.ok(scripts.length > 40, `only ${scripts.length} script files found`);
  assert.ok(relativeImports.length > 80, `only ${relativeImports.length} relative imports read`);
  for (const layer of [ROOT, ...LAYERS]) {
    assert.ok(modules.some((rel) => layerOf(rel) === layer), `no module found in ${layer}`);
  }
});

test("R1 every module sits in an allowed folder and every test beside its module", () => {
  const problems = [];
  for (const rel of scripts) {
    if (rel === SELF) continue;
    if (isTest(rel)) {
      const module = rel.replace(/\.test\.mjs$/, ".js");
      if (!fileSet.has(module)) problems.push(`${rel} has no ${module} beside it`);
    } else if (rel.endsWith(".mjs")) {
      problems.push(`${rel} is an .mjs that is not a test; modules are .js`);
    } else if (!layerOf(rel)) {
      const dir = path.posix.dirname(rel);
      problems.push(dir === "." ? `${rel} is at the mod root, where only ${ROOT_FILES.join(" and ")} belong` : `${rel} is in ${dir}/, which is not one of ${LAYERS.join(", ")}`);
    }
  }
  failWith("R1", problems);
});

test("R2 every relative import points at a file that exists", () => {
  const problems = relativeImports
    .filter(({ target }) => !fs.existsSync(path.join(MOD, target)) || !fs.statSync(path.join(MOD, target)).isFile())
    .map(({ where, target }) => `${where}: no file ${target}`);
  failWith("R2", problems);
});

test("R3 imports follow the layers: adapters/in -> core <- adapters/out, nothing imports the root", () => {
  const problems = [];
  for (const found of relativeImports) {
    if (isTest(found.from) || !/\.m?js$/.test(found.target)) continue;
    const from = layerOf(found.from);
    const to = layerOf(found.target);
    if (!from) continue; // R1 names the module that sits outside the layers.
    if (to === ROOT) problems.push(`${found.where}: nothing may import the entry file ${found.target}`);
    else if (!to) problems.push(`${found.where}: ${found.target} is outside the mod's layers`);
    else if (!ALLOWED[from].includes(to)) problems.push(`${found.where}: ${from} may not import ${to}`);
  }
  failWith("R3", problems);
});

test("R4 core and adapters/in/logic have no bare imports (herdr, gpui-*, node:*, fs/promises)", () => {
  const problems = imports
    .filter((found) => !found.relative && !isTest(found.from) && NO_BARE.includes(layerOf(found.from)))
    .map(({ where, from }) => `${where}: ${layerOf(from)} must run without Herdr and without node, so it imports only relative paths`);
  failWith("R4", problems);
});

test("R5 modules import each other without cycles", () => {
  const edges = new Map(modules.map((rel) => [rel, []]));
  for (const found of relativeImports) {
    if (found.kind === "new URL" || !edges.has(found.from) || !edges.has(found.target)) continue;
    edges.get(found.from).push(found.target);
  }
  const done = new Set();
  const stack = [];
  const cycles = new Map();
  function visit(rel) {
    if (done.has(rel)) return;
    const at = stack.indexOf(rel);
    if (at >= 0) {
      const loop = stack.slice(at);
      // One cycle reached from different starts is named once, from its smallest file.
      const start = loop.indexOf([...loop].sort()[0]);
      const named = [...loop.slice(start), ...loop.slice(0, start)];
      cycles.set(named.join(" -> "), [...named, named[0]].join(" -> "));
      return;
    }
    stack.push(rel);
    for (const next of edges.get(rel)) visit(next);
    stack.pop();
    done.add(rel);
  }
  for (const rel of [...edges.keys()].sort()) visit(rel);
  failWith("R5", [...cycles.values()].map((loop) => `import cycle ${loop}`));
});
