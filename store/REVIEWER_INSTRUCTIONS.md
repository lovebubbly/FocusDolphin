# Reviewer Instructions

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** and refreshed on **2026-07-12 KST**.

No login, subscription, reviewer credential, developer server, or external service is required. Version 1.0.0 supports Korean and English. Automatic follows the browser locale and falls back to English; reviewers may explicitly select English or Korean in Preferences.

## Install And Onboarding

1. Install the submitted ZIP and pin Focus Dolphin's toolbar icon.
2. A bundled onboarding tab should open once for a fresh install. No permission prompt should appear.
3. Continue from `Meet your focus companion` / `집중을 함께할 돌고래를 만나보세요`.
4. At `Choose what should wait` / `잠시 미뤄둘 사이트를 골라요`, keep the default blocklist and add `example.com` on a new line.
5. At `Choose how much friction you want` / `원하는 만큼의 멈춤을 선택하세요`, review the three levels and select `Finish without starting` / `세션 없이 마치기`.
6. The completion view should appear. Close the onboarding tab.

The onboarding tab opens automatically only after installation, not after ordinary startup or update. It can be reopened manually from `Settings` / `설정` > `Activity` / `기록` > `Privacy and local data` / `개인정보와 로컬 데이터` > `View onboarding again` / `온보딩 다시 보기`. Replaying it must not request optional history access or erase existing settings.

## Medium Flow

1. Reopen the popup and select the default blocklist.
2. Enter a two-minute `Custom duration` / `직접 입력`, select `Confirm to continue` / `확인 후 허용`, and start the session.
3. Open <https://example.com/>. The Focus Dolphin blocked page should appear.
4. Select `Open anyway` / `그래도 열기`, wait 30 seconds, enter the non-sensitive text `review test`, and request five-minute temporary access.
5. Select `Continue` / `계속하기`. The sanitized destination opens temporarily. Focus Dolphin never requires a real account or personal website for this test.

## Hard Flow

1. After the prior session completes and its overview is dismissed, start a 15-minute `Full block` / `완전 차단` session and open <https://example.com/>. This leaves enough review time beyond the five-minute emergency delay.
2. Confirm that no temporary-allow action is available.
3. Select `Request emergency end` / `비상 종료 요청` once. This first action shows confirmation only.
4. Select `Go back` / `되돌아가기` to verify that cancellation does not spend the request.
5. Repeat, then select `Schedule end in 5 minutes` / `5분 뒤 종료 예약`. A five-minute countdown appears and the session ends when it expires.
6. After that emergency end completes, start a second 15-minute `Full block` / `완전 차단` session in the same local week.
7. Request and confirm emergency end for the second session. Focus Dolphin rejects this second unique weekly request. Repeated messages for the first already completed request do not create another end or spend another allowance.

## Optional History Flow

1. Run this only while no session is active.
2. Visit <https://example.org/> once or twice.
3. Open `Settings` / `설정`, choose `Activity` / `기록`, then use `Analyze browsing history` / `방문 기록 분석` in the recommendation section.
4. Approve the browser's optional history prompt.
5. Results show domain, category, and recent visit aggregates only. They do not show titles, paths, queries, or individual timestamps.
6. Select `Revoke browsing-history access` / `방문 기록 권한 해제`, then start another focus session. Core controls continue to work without history permission.

## Expected Privacy Behavior

- Network inspection should find no developer API, analytics, advertising, remote code, CDN, or remote font request.
- HTTP(S) access is used only to compare the current hostname with user-owned rules and apply the selected friction.
- The content script does not extract page text, forms, passwords, messages, or page content.
- Browser-history analysis is user-invoked, optional, local, revocable, and reduced to domain aggregates.
- Initial onboarding never requests browser-history access and does not send setup choices to a developer service.
- The current policy is `PRIVACY.md` at the public repository URL recorded in the submission.

## Localization Check

In `Settings` / `설정` > `Preferences` / `환경설정`, select English and repeat the popup idle state, Options navigation, and blocked-page heading; then select Korean and repeat them. Restore Automatic when finished. Changing this presentation preference during an active session must not reset the countdown or unlock Rules. Unsupported browser locales use English while Automatic is selected. This document does not claim that those exact-package checks have passed until the final submission artifact is regenerated and recorded in the release checklist.
