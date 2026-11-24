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

- The mod is plain JS under `mods/side-viewer/`: no dependencies, no build step. Decisions sit in modules without `herdr` imports, each with a `*.test.mjs`.
- The Herdr mod authoring guide is outside this repo, at `~/.config/herdr-app/AGENTS.md`. Read it before writing mod code.
- Full offline check: `node --test mods/side-viewer/`, then `herdr-app check mods/side-viewer`.
- Install: `./install.sh` (checks Herdr's version and the mod, copies the mod into the app home, merges the cmd-o key).
