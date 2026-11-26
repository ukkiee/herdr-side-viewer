// Full offline check: every test, then `herdr-app check mods/side-viewer`, then the render budget.
//   bun tools/check.mjs      (node works too)
// One line per step (PASS, FAIL or skipped, its time, and the gist), with the last lines of a
// step that failed. Exits 1 when any step fails.
//
// - Tests: every *.test.mjs in the repo, on the runtime running this script. Under bun that is
//   `bun test`; under node it is `node --test`, the same files through the same node:test API.
//   Both leave node_modules out.
// - `herdr-app check` loads the mod in Herdr's own script engine, which catches what node can't:
//   a missing `herdr` or `gpui-*` export, a bad mod.json.
// - The render budget (tools/render-budget.mjs) fails when drawing a long document comes near
//   the 50 ms Herdr allows a render() (RECIPE.md, Watch out).
// Both Herdr steps need the Herdr app's command line. Without it they are reported as skipped,
// not failed: the tests alone still say whether the modules hold.
import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const MOD = "mods/side-viewer";
const onBun = Boolean(process.versions.bun);

const lines = (text) => text.trim().split("\n").filter(Boolean);

// The test runner's own totals: bun ends with "N pass / N fail / Ran N tests across N files",
// node with "ℹ tests N / ℹ pass N / ℹ fail N" (spec reporter) or "# tests N …" (tap).
function totals(out) {
  if (onBun) return lines(out).filter((l) => /^\s*(\d+ (pass|fail|skip|todo)\b|Ran \d+ tests)/.test(l)).map((l) => l.trim()).join(", ");
  return lines(out).filter((l) => /^(#|ℹ) (tests|pass|fail|skipped|todo) \d+/.test(l)).map((l) => l.slice(2)).join(", ");
}

const steps = [
  { name: onBun ? "bun test" : "node --test", args: onBun ? ["test"] : ["--test"], gist: totals },
  { name: `herdr-app check ${MOD}`, command: "herdr-app", args: ["check", MOD], herdr: true },
  { name: "render budget", args: [join(root, "tools/render-budget.mjs")], herdr: true, gist: (out) => lines(out).join("; ") },
];

// Looked up on PATH rather than run: the app binary is not a plain CLI to probe with a flag.
const hasHerdr = (process.env.PATH ?? "").split(delimiter).some((dir) => {
  try { accessSync(join(dir, "herdr-app"), constants.X_OK); return true; } catch { return false; }
});
let failed = 0;
for (const step of steps) {
  if (step.herdr && !hasHerdr) {
    console.log(`skipped ${step.name} (herdr-app is not on PATH)`);
    continue;
  }
  const started = Date.now();
  const r = spawnSync(step.command ?? process.execPath, step.args, { cwd: root, encoding: "utf8", timeout: 600000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ok = r.status === 0;
  if (!ok) failed++;
  const gist = ok && step.gist ? step.gist(out) : "";
  console.log(`${ok ? "PASS" : "FAIL"} ${step.name} (${Date.now() - started} ms)${gist ? ` ${gist}` : ""}`);
  if (!ok) console.log(lines(`${out}${r.error ? `\n${r.error.message}` : ""}`).slice(-40).join("\n"));
}
// exitCode, not exit(): a piped stdout on macOS is written asynchronously and exit() can cut it.
process.exitCode = failed ? 1 : 0;
