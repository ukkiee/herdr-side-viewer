# Side Viewer

A Herdr mod that opens a cmd-clicked file path in a pane beside the agent's conversation.
It takes the click as a link handler, so it needs Herdr 0.1.17 or newer.

## Docs

- `GLOSSARY.md`: the project's vocabulary. Use these terms in code and docs.
- `docs/adr/`: decisions that are hard to reverse.
- `docs/samples/`: markdown and code samples the viewer is checked against by hand.
- `RECIPE.md`: what the build does, what to watch out for, and the checks in Done when.
- `README.md`, `README.ko.md`: install and use, in English and Korean.

## Working here

- The mod is plain JS under `mods/side-viewer/`: no dependencies, no build step. Mod files are `.js`, as Herdr loads them; scripts and tests are `.mjs`. Tests use `node:test`, so they run under `bun test` and `node --test`.
- `mods/side-viewer/` is ports and adapters: `core/` (`domain/`, `app/`, `ports/`, `i18n/`) holds the decisions, `adapters/in/` the screens (`viewer/`, `picker/`, `shared/`, and `logic/` for their pure calculations), `adapters/out/` file access, the opening request and the shell pane; `main.js`, `link.js`, `mod.json`, `extensions.json` and `icons/` sit at the mod root. Imports go `adapters/in` → `core` ← `adapters/out`: lint fails a `core/` import of `herdr`, `gpui-*` or `adapters/`, an import of a root file and an import cycle, and screens may import out adapters directly. `tools/mod-folders.test.mjs` fails a module outside the allowed folders, a test away from its module and a relative import that names no file. A test sits beside its module; the folder rules are in RECIPE.md, Built from. The installer (`install.mjs`, with `install.test.mjs`) sits at the repository root, outside the mod.
- The Herdr mod authoring guide is outside this repo, at `~/.config/herdr-app/AGENTS.md`. Read it before writing mod code.
- Lint: `bun run lint` (oxlint, warnings fail; rules in `.oxlintrc.json`, including the QuickJS limits for mod code). `bun install` once first: oxlint is the repo's only dependency, a dev one.
- Full offline check: `bun tools/check.mjs` (every `*.test.mjs`, then `herdr-app check mods/side-viewer`, then the render budget `tools/render-budget.mjs`: Herdr stops a `render()` past 50 ms; RECIPE.md, Watch out). `bun run check` runs the lint first.
- Install: `node install.mjs` (Node only, no bun; checks Herdr's version and the mod, copies the mod into the app home, merges the cmd-o key).
