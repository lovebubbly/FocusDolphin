# Store Listing Copy

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** and refreshed on **2026-07-13 KST**.

## Submission Fields

| Field | Production value |
| --- | --- |
| Name | Focus Dolphin — Website Blocker |
| Interface languages | Korean and English; Automatic follows the browser locale, and users may explicitly choose either language |
| Localized manifest description (Korean) | 건강한 브라우징 습관을 위한 로컬 우선 집중 도우미입니다. |
| Localized manifest description (English) | A local-first focus assistant for healthier browsing habits. |
| Whale category | 생산성 |
| Chrome category | Workflow & Planning |
| Adult content | No |
| Account required | No |
| Price | Free; no paid feature is implemented |

## Localized Manifest Descriptions

The 1.0.0 source uses `__MSG_appDescription__` with `default_locale: "en"`. Confirm these values again in the final regenerated ZIP before submission.

**Korean**

> 건강한 브라우징 습관을 위한 로컬 우선 집중 도우미입니다.

**English**

> A local-first focus assistant for healthier browsing habits.

## Korean Short Description

> 방해 사이트 앞에 필요한 만큼의 멈춤을 더하고, 완료한 집중으로 돌고래를 성장시키는 로컬 우선 집중 도우미.

## Korean Full Description

Focus Dolphin은 내가 정한 시간과 사이트에 집중하도록 돕는 로컬 우선 브라우저 확장 프로그램입니다. 차단 목록 또는 집중 허용 목록, 세션 시간, 강도를 직접 선택하면 방해 사이트 앞에 필요한 만큼의 마찰을 둡니다. 완료한 세션은 돌고래의 성장과 징표로 돌아옵니다.

집중 방식

- 가벼운 안내: 현재 페이지 위에 짧은 멈춤 오버레이를 보여 줍니다.
- 확인 후 허용: 차단 페이지에서 30초를 기다리고 이유를 적은 뒤 5분 동안만 열 수 있습니다.
- 완전 차단: 임시 허용 없이 차단합니다. 비상 종료는 두 번 확인한 뒤 5분 후 적용되며, 한 주에 한 번만 요청할 수 있습니다.

주요 기능

- 직접 시작하거나 요일과 시간으로 자동 시작
- 설치 직후 목록과 첫 25분 세션을 선택할 수 있는 3단계 온보딩
- 차단 목록과 집중 허용 목록
- 완료 세션 기반 XP, 다섯 성장 단계, 네 가지 돌고래 상태, 징표와 스트릭 보호막
- 세션 종료 후 XP와 성장 변화를 보여 주는 오버뷰
- 기기에 저장되는 집중 기록과 통계
- 사용자가 선택할 때만 실행되는 방문 기록 기반 도메인 추천
- 라이트/다크 테마, 키보드 조작, 모션 감소 설정 지원
- 자동/한국어/영어를 직접 고를 수 있는 언어 설정과 영어 기본 대체 언어

강도는 자동으로 올라가지 않습니다. 돌고래는 퇴화하거나 아프거나 사라지지 않습니다. 추천 도메인은 자동 차단되지 않으며 사용자가 직접 추가해야 합니다. 완전 차단에도 비상 종료가 남아 있습니다.

Focus Dolphin에는 개발자 서버, 광고, 텔레메트리, 원격 AI 또는 외부 스크립트가 없습니다. 세션 규칙을 적용하기 위해 현재 HTTP(S) 페이지의 도메인을 확인하지만 페이지 글, 폼, 비밀번호 또는 메시지는 수집하지 않습니다.

방문 기록 분석은 옵션의 '방문 기록 분석'을 눌러 선택 권한을 승인할 때만 실행됩니다. 최근 30일, 최대 5,000개 URL을 기기 안에서 처리해 도메인, 분류, 방문 수 같은 집계 추천만 저장합니다. 원본 URL과 개별 방문 기록은 저장하거나 개발자에게 보내지 않습니다. 브라우저 동기화를 켠 경우 언어 선택, 설정, 사이트 목록, 일정과 돌고래 상태는 브라우저 제공자의 동기화 서비스를 통해 동기화될 수 있습니다.

확인 후 허용에서 적는 이유는 기기에 저장되므로 민감한 정보는 입력하지 마세요. 권한 해제와 로컬 기록 삭제는 옵션에서 할 수 있습니다. 계정은 필요하지 않습니다.

처음 설치하면 로컬 우선 원칙, 집중 목록, 첫 세션 강도를 확인하는 3단계 온보딩이 열립니다. 건너뛰거나 세션 없이 마칠 수 있고 설정에서 다시 열 수 있습니다. 온보딩은 방문 기록 권한을 요청하지 않습니다.

개인정보 처리방침: https://github.com/lovebubbly/FocusDolphin/blob/main/PRIVACY.md
지원: https://github.com/lovebubbly/FocusDolphin/issues

## English Listing Copy

**Short description**

> Start bounded focus sessions, add humane friction to distracting sites, and grow a dolphin with completed focus time.

**Full description**

Focus Dolphin is a local-first browser extension that helps users focus on the sites and schedule they choose. Users select a blocklist or focus allowlist, session length, and intensity. Focus Dolphin adds the appropriate amount of friction before distracting sites, while completed sessions help a dolphin companion grow.

The three modes are a gentle on-page prompt, a confirmation flow with a 30-second pause and five-minute temporary access, and a full block with a delayed, weekly limited emergency exit. Features include direct 1-240 minute entry with five-minute step controls, manual and scheduled sessions, blocklists and allowlists, five non-regressing growth stages, four dolphin moods, badges, streak protection, a post-session XP overview, local focus statistics, explicit Automatic/English/Korean language selection, light and dark themes, keyboard support, semantic motion, and reduced-motion behavior.

A three-step welcome flow opens after the first install. It explains local-first behavior, lets the user edit the initial focus list, and offers an optional 25-minute first session. Users can skip it, finish without starting a session, or replay it later from Options. Onboarding does not request browsing-history access.

Intensity never increases automatically. The dolphin never becomes sick, dies, or regresses. Recommended domains are never blocked automatically. Full block always retains its emergency exit.

Focus Dolphin has no developer backend, ads, telemetry, remote AI, or remote scripts. Optional browser-history analysis runs only after the user invokes it and approves the browser prompt. It processes up to 5,000 URLs from the most recent 30 days on-device and retains only domain-level aggregates. Raw URLs and individual visit records are not retained or sent to the developer. Browser-provider sync may synchronize the UI language preference, settings, site lists, schedules, and dolphin state when enabled. No account is required.

## Support Text

> 문제 제보 시 브라우저/확장 프로그램 버전, 재현 단계, 예상 결과와 실제 결과를 적어 주세요. 공개 이슈에 방문 기록, 의도 입력 또는 개인정보를 포함하지 마세요.

> When reporting a problem, include the browser and extension versions, reproduction steps, expected result, and actual result. Do not include browsing history, intention entries, or personal information in a public issue.

Support URL: <https://github.com/lovebubbly/FocusDolphin/issues>

Privacy URL: <https://github.com/lovebubbly/FocusDolphin/blob/main/PRIVACY.md>

The URLs above are the canonical values. The repository, privacy policy, and Issues endpoint were verified live on 2026-07-13; recheck them immediately before each final dashboard submission.
