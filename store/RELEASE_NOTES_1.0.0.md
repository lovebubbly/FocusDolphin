# FocusWhale 1.0.0 Release Notes

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** on **2026-07-11 KST**.

FocusWhale 1.0.0 is the first store candidate for the local-first Naver Whale focus extension.

## Included

- Manual and scheduled focus sessions with soft, medium, and hard intensity.
- User-owned blocklists and focus allowlists.
- A 30-second intent pause and five-minute temporary access in medium mode.
- A two-step, five-minute delayed, weekly limited emergency exit in hard mode.
- A non-regressing whale companion with five stages, four moods, badges, streak protection, and post-session growth summaries.
- Local statistics and optional, on-device browser-history recommendations.
- Light and dark themes, keyboard support, reduced-motion behavior, and isolated soft overlays.
- Recovery journals and idempotent settlement for MV3 service-worker interruption.
- A three-step, install-only onboarding flow for reviewing local-first behavior, editing the initial focus list, and optionally starting a 25-minute session.
- Complete Korean and English interfaces with localized browser metadata and English fallback.

Onboarding can be skipped, completed without starting a session, or replayed later from Options. It does not request browser-history access; that optional permission remains available only when the user explicitly starts browsing-history analysis.

## Privacy

FocusWhale has no developer backend, advertising, analytics SDK, remote AI, or remote code. Optional history analysis is user-invoked and local. Settings and pet progress may use browser-provider sync when enabled. See the public `PRIVACY.md` for the complete disclosure.

## Release Boundary

These notes describe the candidate; they do not claim store approval or publication. Store item IDs, dates, and URLs are recorded only after the product owner submits and a store publishes the extension.
