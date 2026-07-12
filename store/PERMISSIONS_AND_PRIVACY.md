# Permission And Privacy Declarations

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** and refreshed on **2026-07-12 KST**.

These are paste-ready explanations for store review. They describe version 1.0.0 and must be revised if permissions or data behavior change.

## Single Purpose

**Korean:** 사용자가 선택한 사이트 목록과 강도로 집중 세션을 운영하고, 완료한 집중을 돌고래 성장으로 보여주는 로컬 우선 브라우저 집중 도우미.

**English:** A local-first focus assistant that applies user-chosen site rules and turns completed sessions into dolphin growth.

## Permission Justifications

| Permission | Reviewer justification |
| --- | --- |
| `declarativeNetRequest` | Creates and removes session-scoped main-frame redirect and temporary-allow rules for domains chosen by the user. It does not inspect request bodies or transmit request data. |
| `storage` | Stores the UI language preference, settings, lists, schedules, and dolphin progress in browser sync; stores session state, onboarding completion, bounded statistics, recommendations, temporary allows, and recovery records locally. |
| `alarms` | Reliably handles session deadlines, scheduled starts, temporary-allow expiry, delayed emergency ending, and MV3 recovery while the service worker sleeps. |
| Optional `history` | Requested only when the user starts recommendation analysis. It processes up to the most recent 30 days locally into domain-level aggregates. Raw URLs and visit records are not persisted or transmitted, the permission can be revoked, and core focus features work without it. |
| `http://*/*`, `https://*/*` | Broad HTTP(S) access is necessary because users may configure any domain and allowlist mode applies to every web origin outside the selected list. Access excludes non-web schemes. |
| Content script on HTTP(S) pages | Reads extension-owned session state and the current hostname so user rules can apply to arbitrary domains, already-open pages, and single-page-app navigation. It shows an overlay or redirects only on a match. It does not extract page text, forms, passwords, messages, or other page content. |

`web_accessible_resources` exposes only the internal blocked page, dolphin atlas, local font, and icon required by redirects and the isolated soft overlay. There is no wildcard resource path.

## Onboarding Disclosure

- A bundled onboarding tab opens only for a fresh install. Updates and ordinary browser starts do not open it automatically.
- The three steps explain local-first behavior, let the user review or edit the initial focus list, and offer an optional 25-minute first session.
- Users may skip setup or finish without starting a session. The flow can be replayed from Options without resetting existing data.
- Onboarding stores only a local version, completion time, and outcome (`skipped`, `setup_only`, or `session_started`) in addition to choices the user explicitly saves.
- Onboarding does not request `history` or any other optional permission. Browser-history access remains user-triggered only from the recommendation analysis control in Options.
- The interface offers Automatic, English, and Korean. Automatic follows the browser's supported locale; the selected presentation preference may use browser sync but is never sent to a developer service.

## Chrome Privacy Dashboard

- Remote code: **No, I am not using remote code.** All scripts, styles, fonts, icons, and sprites are bundled in the ZIP.
- Data types to disclose: **Web history** and **User activity**.
- User activity includes locally retained session records, focus settings, and the optional free-text reason entered before temporary access.
- Do not select personally identifiable information, health information, financial information, authentication information, personal communications, location, or website content for the current implementation.
- Data use: extension functionality only.
- Data is not sold or transferred for advertising, creditworthiness, or unrelated purposes.
- Data is not made available for developer-side human review.
- Raw history URLs and visit records are processed transiently and are not persisted by Focus Dolphin.
- Browser-provider sync may transmit settings, site lists, schedules, and pet state when the user has browser sync enabled; Focus Dolphin has no developer-operated server.
- Privacy-policy URL: <https://github.com/lovebubbly/FocusDolphin/blob/main/PRIVACY.md> **intended; verify after the pending repository rename**

The privacy policy contains the affirmative Chrome Web Store Limited Use statement. Local-only processing is still disclosed; the submission must not claim that Focus Dolphin handles no user data.

## Whale Review Notes

Whale's public submission guide does not document dedicated permission-justification or privacy-policy fields. Include the local-processing, optional-history, revocation, no-page-content, privacy-policy URL, and support URL directly in the detailed listing. The exact 1.0.0 manifest has no `homepage_url`; if the live publisher dashboard separately exposes a developer-website field, the repository URL may be entered there, but the submission pack does not depend on that field.

## Support Boundary

Support URL: <https://github.com/lovebubbly/FocusDolphin/issues> **intended; verify after the pending repository rename**

The repository's bug-report form warns users not to post browsing details, intent text, account information, or other personal data. The owner must still confirm that this channel will be monitored before submission.
