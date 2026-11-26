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

- The mod is plain JS under `mods/side-viewer/`: no dependencies, no build step.
- `mods/side-viewer/` is ports and adapters: `core/` (`domain/`, `app/`, `ports/`, `i18n/`) holds the decisions, `adapters/in/` the screens (`viewer/`, `picker/`, `shared/`, and `logic/` for their pure calculations), `adapters/out/` file access, the opening request and the shell pane; `main.js`, `link.js`, `mod.json`, `extensions.json` and `icons/` sit at the mod root. Imports go `adapters/in` → `core` ← `adapters/out`: `core/` imports no `herdr`, `gpui-*` or `adapters/`, screens may import out adapters directly, and nothing imports a root file. `mods/side-viewer/layers.test.mjs` fails a wrong import, a cycle or a test away from its module. A test sits beside its module; the folder rules are in RECIPE.md, Built from. Install-time code (`keys-merge.js`) sits outside the mod, in `scripts/`.
- The Herdr mod authoring guide is outside this repo, at `~/.config/herdr-app/AGENTS.md`. Read it before writing mod code.
- Full offline check: `node --test mods/side-viewer/ scripts/`, then `herdr-app check mods/side-viewer`, then
  `scripts/render-budget.sh` (Herdr stops a `render()` past 50 ms; RECIPE.md, Watch out).
- Install: `./install.sh` (checks Herdr's version and the mod, copies the mod into the app home, merges the cmd-o key).
