# 19: 언어 지원 문서·미리보기 그림·손 확인

**What to build:** README.md(영어)와 README.ko.md(한국어)를 언어 지원에 맞춘다: README.md의 화면 문구 인용은 영어 문구로, README.ko.md는 한국어 문구로, 두 문서 모두 언어를 고르는 규칙을 적는다. herdr-git처럼 영어 화면의 `preview.png`와 한국어 화면의 `preview.ko.png`를 두고 README.ko.md는 `preview.ko.png`를 쓴다. RECIPE에 언어 모듈·표를 적고 "Done when"에 언어 확인 단계를 더한다. 실제 앱에서 두 언어를 확인한다.

**Blocked by:** 17, 18

**Status:** done

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-23, "구현 결정"의 "언어(AC-23)", "테스트 결정")

**결정 근거:** 2026-11-12 통합 검증 뒤 사용자: "사용하는 언어를 읽고 한국어나 영어로 지원을 해줄거야", "herdr-git처럼". 라우터 안내 범위 질문에 "라우터 안내도 바꾸기". 미리보기 그림은 사용자가 "일단 찍지말아봐"로 멈췄고, 언어 지원 뒤 두 언어로 찍는다(찍기 전에 사용자에게 묻는다).

**파일 소유:** `README.md`, `README.ko.md`, `RECIPE.md`, `preview.png`, `preview.ko.png`(새로).

**설계 계약:**
- 형식: `~/personal/herdr-git/README.md`·`README.ko.md`(언어 링크, `preview.ko.png`)
- 문구: 17·18 Comments의 영어 문구 목록, 명세 AC-23

**검증 방법:**
- 경계 4: 실제 앱에서 한국어와 영어 화면(머리줄, 상태 글, 안내, 알림, 코드 카드), 라우터 `--status` 안내 두 언어(기본 앱을 바꾸지 않는 명령만), 설치와 check
- 문서: README 두 개의 화면 문구 인용이 코드의 표와 글자 그대로인지 대조

- [x] README.md는 영어 문구, README.ko.md는 한국어 문구로 화면을 말하고 언어 규칙을 적는다 (재검토 sv2-rv10이 인용 28개를 표와 대조)
- [x] `preview.png`(영어)·`preview.ko.png`(한국어)가 v2 화면이다 (영어 화면은 사용자 제안으로 영어 샘플 `markdown-sample.en.md`)
- [x] RECIPE에 언어 모듈과 확인 단계가 있다 (Done when v2 30·31)
- [x] 실제 앱에서 두 언어가 확인됐다 (머리줄·툴팁·편집됨·빈 파일 안내·언어 바꾸고 되돌리기. 미실행은 아래)

**완료 조건:** 위 항목 전부. 확인하지 못한 항목은 이유와 함께 남긴다.

## Comments

### 2026-11-12 통합 (주 진행자)

- **문서(`ab2abcb`, 작업자 sv2-19d):** README.md는 화면 문구 인용을 영어 표 문구로 바꾸고, 두 README에 `### Language`/`### 언어` 절(첫 선호 언어, 다시 읽기 1·3·10초 뒤 15초마다, 이미 열린 뷰어는 새 뷰어가 열릴 때 따라옴, 라우터는 실행마다 한 번, 바꾸지 않는 것), "Programs"에 `defaults read -g AppleLanguages`, 공유 상태 `side-viewer.lang`, 한계 문장을 더했다. README.ko.md는 `preview.ko.png`. RECIPE는 언어 모듈·`system_lang`·`say`, Watch out(check 첫 화면 `No file to open.`, `tr`/`t` 함정), Done when v2 30·31(번호 참조 그대로).
- **그림(`ba38258`, 주 진행자):** 사용자가 고른 방식(선호 언어를 잠깐 영어로 바꿨다 되돌리기, 마크다운 샘플). 사용자 제안("찍을때 md파일도 영어로 작성된걸로")으로 영어 샘플 `docs/features/side-viewer-v2/markdown-sample.en.md`를 만들어 영어 화면을 찍었다. `preview.png`(영어, "Rendered | Source"), `preview.ko.png`(한국어, "렌더링 | 원문"), 둘 다 뷰어 pane만 1910×1818.
- **실제 앱(설치본 `ab2abcb`):** `("ko-KR")`에서 한국어. 사용자가 `defaults write -g AppleLanguages -array en-US ko-KR`(주 진행자의 같은 명령은 권한 확인에서 거절) → 새 탭으로 새 뷰어 → 그 탭과 대화 옆 뷰어가 바로 영어("Rendered | Source", 툴팁 "Open in New Tab", 원문 수정 시 "Edited"+"Save", 빈 md "This file is empty."). 사용자가 `-array ko-KR`로 되돌림 → 새 뷰어를 열었다 닫으니 한국어로 돌아옴. 시험 탭은 닫음.
- **미실행:** Herdr를 다시 켠 뒤 공유 상태가 남는지(RECIPE 31의 앱 부분), 영어의 좁은 머리줄·알림 폭, 라우터 영어 안내의 실제 출력(가짜 `defaults` 시험 52개로만; 기본 앱을 바꾸는 명령은 돌리지 않음).
- **재검토(sv2-rv10, `5041503..54048cd`):** 통과. 문서 인용·언어 규칙·RECIPE 30·31·그림(개인 정보 없음) 확인. F-2(Minor, `tr` 검사가 화살표 함수·계산된 호출을 못 봄)는 sv2-fix7이 고친다. O-1(라우터 usage 줄은 영어뿐이라는 말이 README에 없음), O-3, O-4는 선택 개선으로 남김.

### 2026-11-12 완료 (주 진행자)

- 리뷰·재검토 모두 통과(마지막 sv2-rv10과 F-2 직접 재검토), 통합 검증(티켓 12·19) 통과, 최종 단계(change-review phase=final: PR 초안·회고 후보, 원본 해시 일치) 완료. 통합 head `d990852`: `node --test mods/side-viewer/` 362 통과·0 실패·0 skip·0 취소, `herdr-app check` 통과. push·PR은 하지 않았다(사용자: "pr 올리기전까지만").
