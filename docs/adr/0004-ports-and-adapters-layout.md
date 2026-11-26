---
status: accepted
---

# mod 파일을 core와 adapters 폴더로 나누고, 경계는 node 테스트로 지킨다

mod 폴더의 모듈을 포트와 어댑터 구조로 나눈다. 판단은 core 폴더에 둔다: `domain/`(보이는 파일과 글의 규칙), `app/`(뷰어·경로 고르기 창·링크 핸들러가 파일·기계·대화를 두고 정하는 것), `ports/`(바깥이 돌려준 답과 거절의 뜻), `i18n/`(언어와 문구 표). 화면은 `adapters/in/` 아래(`viewer/`, `picker/`, `shared/`, 화면 쪽 순수 계산 `logic/`), `main.js`·링크 핸들러·화면이 부르는 읽기·쓰기·명령은 `adapters/out/` 아래(`file-access.js`, `open-beside.js`, `shell-pane.js`, `markdown-image-loader.js`)에 둔다. 의존은 `adapters/in` → `core` ← `adapters/out` 한쪽으로만 간다. core 모듈은 `herdr`·`gpui-*`·adapters를 import하지 않아 `node --test`가 그대로 불러 테스트한다. 화면은 out 어댑터를 직접 import해도 되고, out 어댑터는 화면을 import하지 않는다. 파일 이름은 그대로 둔다. 이름은 mod 안에서 하나뿐이고, RECIPE.md 파일과 주석, 테스트가 파일을 이름으로 가리키기 때문이다. 같은 구조를 herdr-git의 git-tools mod도 쓴다.

mod 루트에는 진입 파일과 설정, 아이콘(`main.js`, `link.js`, `mod.json`, `extensions.json`, `icons/`)을 둔다. Herdr는 mod 폴더 루트에서 화면의 진입 파일 `main.js`, 링크 핸들러의 진입 파일 `link.js` 두 가지를 찾는다(`~/.config/herdr-app/AGENTS.md` 파일의 mod 폴더 설명). 두 진입 파일은 아래 폴더를 import하고, 누구도 루트 파일을 import하지 않는다. mod는 JSON을 import할 수 없고 `import.meta.url`도 없어서, 확장자 목록은 실행 중에 고정 경로 `${appHome()}/mods/side-viewer/extensions.json`에서 읽는다. 아이콘도 코드가 고정 경로 `mods/side-viewer/icons/<이름>.svg`로 그리므로, 모듈이 어느 폴더에 있든 같은 경로를 쓴다.

키 병합 `keys-merge.js` 파일은 mod 밖 `scripts/`, 테스트 옆에 둔다. 설치 스크립트 `install.sh` 파일이 설치 때 node로 부르는 코드이고, mod가 실행 중에 쓰지 않는다. mod 폴더는 앱 홈에 통째로 복사되므로, 안에 두면 쓰이지 않는 파일이 설치본에 따라간다.

경계는 린트 대신 경계 검사 `mods/side-viewer/layers.test.mjs` 파일이 지킨다. node 내장 모듈만으로 소스의 import를 읽어 의존 방향, 폴더 허용 목록, 상대 import가 실제 파일을 가리키는지, import 순환, 테스트가 모듈 옆에 있는지를 본다. 이 저장소는 의존성이 없고 빌드 단계도 없다. 테스트는 `node --test mods/side-viewer/ scripts/` 하나로 돌고 CI도 같은 명령이다.

## Considered Options

- **평평한 폴더 그대로 두고 관례로 지키기.** 판단 모듈과 화면, Herdr와 닿는 코드가 한 폴더에서 이름으로만 구별되고, "판단 모듈은 `herdr`를 import하지 않는다"는 약속을 사람이 지켜야 한다. 판단과 그것을 부르는 코드를 폴더로 갈라 검사할 수 있게 하려고 택하지 않았다.
- **oxlint로 경계를 지키기(herdr-git 방식).** `no-restricted-imports`와 `import/no-cycle`로 같은 규칙을 걸 수 있지만, 저장소의 첫 의존성이 되고 검사 전에 설치 단계가 생긴다. 같은 검사를 node 테스트로 할 수 있어 택하지 않았다.
- **폴더 대신 이름에 뜻을 담기**(`domain-views.js` 같은 접두사). 문서·주석·테스트가 가리키는 이름을 모두 바꿔야 하고, 폴더가 이미 그 뜻을 가지므로 택하지 않았다.
- **키 병합을 mod 안 core 폴더에 두기.** 판단만 보면 core에 맞지만 mod가 실행 중에 부르지 않고, 설치본에 쓰이지 않는 파일이 따라가서 택하지 않았다.

## Consequences

- 새 모듈은 허용된 폴더 가운데 하나에 두고, 판단 모듈이면 테스트를 옆에 둔다. 목록 밖 폴더나 방향을 어긴 import는 경계 검사가 실패시킨다.
- 상대 import가 길어진다(`../../../core/domain/views.js`). mod 밖에서 모듈을 부르는 스크립트(`scripts/render-budget.sh`)도 폴더 경로를 안다.
- `herdr-app check`는 `gpui-kit`을 import하는 하위 폴더마다 `gpui-kit.d.ts`와 `jsconfig.json`을 쓴다. `.gitignore` 파일이 mods 폴더 아래의 그 파일들을 뺀다.
