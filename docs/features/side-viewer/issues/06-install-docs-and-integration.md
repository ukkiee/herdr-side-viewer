# 06: 설치 스크립트, 문서, 기능 전체 통합 검증

**What to build:** 저장소를 받은 사람이 스크립트 하나로 mod를 Herdr 앱 홈에 설치하고 라우터를 빌드할 수 있다. 기본 앱 넘겨받기는 스크립트가 하지 않고 README가 안내하는 별도 명령으로 한다. README(설치, 넘겨받기와 되돌리기, 알아 둘 한계)와 RECIPE(보이는 것, 동작, 구성, 주의, "Done when" 손 확인 목록)를 쓰고, 그 목록 전체를 실제 앱에서 수행해 **기능 전체 통합 검증**을 마친다.

**Blocked by:** 01, 03, 04, 05

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer/spec.md` (AC-10, 그리고 AC-1~AC-11 전체의 경계 4)

**파일 소유:** `install.sh`, `README.md`, `RECIPE.md`, `LICENSE`

**설계 계약:**
- `install.sh`: AC-10(넘겨받기를 하지 않는다), 선례 `herdr-worktrees`의 `install.sh`(`HERDR_APP_HOME` 존중, 복사 뒤 `herdr-app check`)
- `README.md`, `RECIPE.md`: `~/.config/herdr-app/AGENTS.md`의 "Layouts and mods other people made" 절(RECIPE 작성 순서), 명세 "범위 밖"·"참고"
- `LICENSE`: 없음 (`AGENTS.md`, `docs/adr/` 확인. 참고 레포는 MIT이나 코드를 가져오지 않으므로 고지 의무는 없다. 사용자가 고를 라이선스는 Comments에 질문으로 남긴다)

**검증 방법:**
- 경계 3: 설치 스크립트 실행 뒤 `herdr-app check`가 설치된 폴더에서 통과
- 전체 오프라인 검사: 저장소의 모든 `node --test` 테스트
- 경계 4(기능 전체 통합 검증): RECIPE "Done when" 목록 전체. 넘겨받기 → 에이전트 창에서 마크다운·코드·이미지 경로 cmd-클릭(절대·상대·줄 번호·코드 표기) → 재사용과 뒤로 가기 → 새로고침·버튼·링크 → 그릴 수 없는 파일 → Finder에서 열기(원래 앱) → 되돌리기 → 상태 보기로 복구 확인

- [ ] 설치 스크립트가 mod를 복사하고 `herdr-app check`를 통과시키며 라우터를 빌드한다
- [ ] 설치 스크립트는 기본 앱 설정을 바꾸지 않는다
- [ ] README에 설치, 넘겨받기, 되돌리기, 넘겨받은 확장자 목록(01의 실측 결과 반영), 한계(macOS 전용, 줄 번호 무시, 확장자 없는 파일, 다른 머신)가 있다
- [ ] RECIPE의 "Done when" 목록이 AC-1~AC-11을 모두 덮는다
- [ ] "Done when" 목록 전체를 실제 앱에서 수행했고 결과가 Comments에 남았다
- [ ] 명세에서 `미확인`으로 적은 항목(Herdr 판별 방식, 이미지 폴더 제약, 줄 번호 전달)의 확인 결과가 명세에 반영됐다
- [ ] 검증 뒤 이 머신의 기본 앱 설정에 대해 사용자가 넘겨받은 상태 유지와 되돌리기 중 무엇을 원하는지 확인했다

**완료 조건:** 위 항목 전부와 전체 오프라인 검사 통과.

## Comments
