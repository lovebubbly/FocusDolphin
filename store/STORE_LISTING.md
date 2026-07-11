# Store Listing Copy

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** on **2026-07-11 KST**.

## Submission Fields

| Field | Production value |
| --- | --- |
| Name | FocusWhale |
| Interface language | Korean |
| Exact-package manifest/store description | Personal screentime focus assistant for Naver Whale. |
| Whale category | 생산성 |
| Chrome category, after browser-neutral rebuild | Workflow & Planning |
| Adult content | No |
| Account required | No |
| Price | Free; no paid feature is implemented |

## Exact-Package Short Description

The reviewed ZIP contains this English `manifest.description`, which Whale documents as required and store-visible:

> Personal screentime focus assistant for Naver Whale.

Do not paste the Korean proposal below as if it were already inside the exact package. Using it requires an owner-authorized manifest localization/change, a rebuild, and renewed package verification.

## Korean Short-Description Proposal

> 집중 세션으로 방해 사이트에 부드러운 마찰을 더하고, 완료한 시간만큼 고래를 성장시키는 로컬 우선 집중 도우미.

## Korean Full Description

FocusWhale은 내가 정한 시간과 사이트에 집중하도록 돕는 로컬 우선 브라우저 확장 프로그램입니다. 차단 목록 또는 집중 허용 목록, 세션 시간, 강도를 직접 선택하면 방해 사이트 앞에 필요한 만큼의 마찰을 둡니다. 완료한 세션은 고래의 성장과 징표로 돌아옵니다.

집중 방식

- 가벼운 안내: 현재 페이지 위에 짧은 멈춤 오버레이를 보여 줍니다.
- 확인 후 허용: 차단 페이지에서 30초를 기다리고 이유를 적은 뒤 5분 동안만 열 수 있습니다.
- 완전 차단: 임시 허용 없이 차단합니다. 비상 종료는 두 번 확인한 뒤 5분 후 적용되며, 한 주에 한 번만 요청할 수 있습니다.

주요 기능

- 직접 시작하거나 요일과 시간으로 자동 시작
- 차단 목록과 집중 허용 목록
- 완료 세션 기반 XP, 다섯 성장 단계, 네 가지 고래 상태, 징표와 스트릭 보호막
- 세션 종료 후 XP와 성장 변화를 보여 주는 오버뷰
- 기기에 저장되는 집중 기록과 통계
- 사용자가 선택할 때만 실행되는 방문 기록 기반 도메인 추천
- 라이트/다크 테마, 키보드 조작, 모션 감소 설정 지원

강도는 자동으로 올라가지 않습니다. 고래는 퇴화하거나 아프거나 사라지지 않습니다. 추천 도메인은 자동 차단되지 않으며 사용자가 직접 추가해야 합니다. 완전 차단에도 비상 종료가 남아 있습니다.

FocusWhale에는 개발자 서버, 광고, 텔레메트리, 원격 AI 또는 외부 스크립트가 없습니다. 세션 규칙을 적용하기 위해 현재 HTTP(S) 페이지의 도메인을 확인하지만 페이지 글, 폼, 비밀번호 또는 메시지는 수집하지 않습니다.

방문 기록 분석은 옵션의 '방문 기록 분석'을 눌러 선택 권한을 승인할 때만 실행됩니다. 최근 30일, 최대 5,000개 URL을 기기 안에서 처리해 도메인, 분류, 방문 수 같은 집계 추천만 저장합니다. 원본 URL과 개별 방문 기록은 저장하거나 개발자에게 보내지 않습니다. 브라우저 동기화를 켠 경우 설정, 사이트 목록, 일정과 고래 상태는 브라우저 제공자의 동기화 서비스를 통해 동기화될 수 있습니다.

확인 후 허용에서 적는 이유는 기기에 저장되므로 민감한 정보는 입력하지 마세요. 권한 해제와 로컬 기록 삭제는 옵션에서 할 수 있습니다. 계정은 필요하지 않습니다.

개인정보 처리방침: https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md
지원: https://github.com/lovebubbly/FocusWhale/issues

## English Reference Copy

The current interface is Korean. Keep this copy as a translation reference or use it only after the store clearly identifies Korean as the interface language.

**Short description**

> Start bounded focus sessions, add humane friction to distracting sites, and grow a whale with completed focus time.

**Full description**

FocusWhale is a local-first browser extension that helps users focus on the sites and schedule they choose. Users select a blocklist or focus allowlist, session length, and intensity. FocusWhale adds the appropriate amount of friction before distracting sites, while completed sessions help a whale companion grow.

The three modes are a gentle on-page prompt, a confirmation flow with a 30-second pause and five-minute temporary access, and a full block with a delayed, weekly limited emergency exit. Features include manual and scheduled sessions, blocklists and allowlists, five non-regressing growth stages, four whale moods, badges, streak protection, a post-session XP overview, local focus statistics, light and dark themes, keyboard support, and reduced-motion behavior.

Intensity never increases automatically. The whale never becomes sick, dies, or regresses. Recommended domains are never blocked automatically. Full block always retains its emergency exit.

FocusWhale has no developer backend, ads, telemetry, remote AI, or remote scripts. Optional browser-history analysis runs only after the user invokes it and approves the browser prompt. It processes up to 5,000 URLs from the most recent 30 days on-device and retains only domain-level aggregates. Raw URLs and individual visit records are not retained or sent to the developer. Browser-provider sync may synchronize settings, site lists, schedules, and whale state when enabled. No account is required.

## Support Text

> 문제 제보 시 브라우저/확장 프로그램 버전, 재현 단계, 예상 결과와 실제 결과를 적어 주세요. 공개 이슈에 방문 기록, 의도 입력 또는 개인정보를 포함하지 마세요.

Support URL: <https://github.com/lovebubbly/FocusWhale/issues>

Privacy URL: <https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md>
