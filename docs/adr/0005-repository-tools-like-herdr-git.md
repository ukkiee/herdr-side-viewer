---
status: accepted
---

# 저장소 도구를 herdr-git과 맞춘다: 린트는 oxlint, 테스트와 전체 검사는 bun, 스크립트는 .mjs

저장소의 개발 도구를 herdr-git과 같은 모양으로 둔다. 린트는 oxlint(`bun run lint`, 규칙은 `.oxlintrc.json` 파일, 경고도 실패)가 맡는다. 경계 규칙(ADR 0004)과 함께, mod의 `.js` 파일에서 QuickJS에 없는 전역(`setTimeout`, `setInterval`, `Intl`, `navigator`, `process`)과 `Promise.race`를 막는다. oxlint는 저장소의 유일한 의존성이고 dev 의존성이다. `package.json`·`bun.lock` 파일을 커밋하고 `node_modules/`는 무시하며, 처음 한 번 `bun install`을 한다.

테스트와 전체 검사는 bun으로 돈다. 전체 검사는 `bun tools/check.mjs`(테스트, `herdr-app check mods/side-viewer`, 렌더 예산 `tools/render-budget.mjs` 순서)이고, `bun run check`는 그 앞에 린트를 돌린다. 테스트는 `node:test` API로 쓰므로 `bun test`와 `node --test` 둘 다로 돌고, `tools/check.mjs`와 `tools/render-budget.mjs`도 node로 돈다.

셸 스크립트는 `.mjs`로 쓴다. 설치는 저장소 루트의 `node install.mjs`이고, 설치하는 사람에게는 node만 있으면 되고 bun은 필요 없다. 설치 코드와 그 테스트(`install.test.mjs`)도 같은 JS라 다른 모듈처럼 테스트한다. 스크립트와 테스트는 `.mjs`, mod 파일은 `.js`다. Herdr가 mod 폴더에서 `main.js`, `link.js`와 `*.js`를 불러오기 때문이다.

## Considered Options

- **node만 쓰기**(`node --test`, 린트 없음). 의존성 없이 돌지만 QuickJS 전역 금지 같은 규칙을 걸 곳이 없고, herdr-git과 명령·설정이 갈려 두 저장소를 오가는 사람과 에이전트가 다른 절차를 외워야 한다. 그래서 택하지 않았다.
- **설치도 bun으로**(`bun install.mjs`). 설치하는 사람이 bun을 따로 깔아야 하는데, 설치 코드에는 bun에만 있는 기능이 필요 없다. 그래서 택하지 않았다.
- **설치와 렌더 예산을 셸 스크립트로 쓰기.** awk·sed·rsync에 기대어 단위 테스트가 어렵고, 키 병합은 node로 불러야 해서 언어가 둘로 나뉜다. 한 언어로 모아 테스트하려고 택하지 않았다.
- **mod 파일도 `.mjs`로**. Herdr가 `.js`만 불러오므로 택할 수 없다.

## Consequences

- 개발하려면 bun과 node가 둘 다 있어야 한다. 설치만 하려면 node만 있으면 된다.
- CI(`.github/workflows/check.yml`, macOS, Bun 1.4.5, Node 26)는 bun과 node를 함께 쓴다: `bun install --frozen-lockfile`, `bun run lint`, `bun tools/check.mjs`, 그다음 `node --test install.test.mjs`로 사람이 설치할 때 쓰는 node에서 설치 코드를 한 번 더 확인한다. CI에는 Herdr 앱이 없어 `herdr-app check`와 렌더 예산은 건너뛴 것으로 보고되고, 로컬에서 확인한다.
- 테스트는 bun에도 node에도 있는 `node:test` API만 쓴다. 한쪽에만 있는 기능을 쓰면 다른 쪽에서 깨진다.
- oxlint 버전(1.95.0)은 `package.json` 파일에 고정되고, 올릴 때는 `bun.lock` 파일과 함께 바꾼다.
