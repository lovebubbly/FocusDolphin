# Focus Dolphin Store Submission Evidence

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** on **2026-07-13 KST** and refreshed on **2026-07-15 KST**.

## Release Artifact

- Product: **Focus Dolphin — Website Blocker**
- Version: **1.0.0**
- Source candidate: `09d7e26` (`Prepare Focus Dolphin release candidate`)
- Archive: `release/focus-dolphin-1.0.0.zip`
- Size: **3,715,534 bytes**
- Entries: **31**
- SHA-256: `9477352d13105d1176c3cf540550b5a0252cbb2422528d92b943820bba1f5048`

The same checksum-verified Manifest V3 archive was uploaded to both publisher dashboards after exact-package testing in ordinary Naver Whale and Chrome for Testing.

## Chrome Web Store

- Publisher ID: `99fafc2b-32d0-4e3a-8577-f76d721c2126`
- Item ID: `eacmhaieiibgiiflpjogoccoaikemopl`
- Dashboard URL: <https://chrome.google.com/webstore/devconsole/99fafc2b-32d0-4e3a-8577-f76d721c2126/eacmhaieiibgiiflpjogoccoaikemopl/edit>
- Submitted: **2026-07-13 KST**
- Approved and publicly available: **2026-07-15 KST**
- Public URL: <https://chromewebstore.google.com/detail/focus-dolphin-%E2%80%94-website-b/eacmhaieiibgiiflpjogoccoaikemopl>
- Current status: **Published / installable**, version **1.0.0**
- Account: publisher display `ysstar12356`; publisher ID recorded above
- Submitted listing: Focus Dolphin title and English description, Workflow & Planning category, store icon, five unique screenshots, small promotional tile, homepage, support URL, no mature content, free/public distribution, and all regions.
- Privacy record: single-purpose statement; `declarativeNetRequest`, `storage`, `alarms`, optional `history`, and host-access justifications; no remote code; Web history and User activity disclosures; all three Limited Use certifications; and the public `PRIVACY.md` URL.
- Reviewer instructions: onboarding, a two-minute medium session, temporary access, a 15-minute hard session, the two-step weekly emergency exit, and optional-history grant/revoke behavior. No account or credentials are required.
- Review note: Google warned that broad host permissions can lengthen review. Those permissions remain essential to user-selected blocking across arbitrary HTTP(S) sites and are documented in the submitted justification.

## Whale Store

- Item ID: `lfamocjkclmgodmjnaeophegmphejmgn`
- Dashboard URL: <https://store.whale.naver.com/developers/dashboard/extensions>
- Submitted: **2026-07-13 KST**
- Approved and publicly available: **2026-07-15 KST**
- Public URL: <https://store.whale.naver.com/detail/lfamocjkclmgodmjnaeophegmphejmgn/?hl=ko>
- Current status: **READY_FOR_OPEN / 승인 완료**, version **1.0.0**
- Account: developer display `버블리`
- Submitted listing: Focus Dolphin title, store icon, four unique common screenshots, English and Korean descriptions and release notes, search keywords, 생산성 category, all regions, no mature content, and public visibility.
- Privacy and support: the public privacy-policy and GitHub Issues URLs are present in both language descriptions because the Whale submission flow did not expose a separate privacy-policy field.
- Public evidence: the anonymous storefront API returns the exact item with `review: READY_FOR_OPEN`, installation support enabled, and version `1.0.0`.

## Version 1.0.1 Store Update - 2026-07-15 KST

- Source patch: local commit `47fd825`; identical committed tree published to GitHub `main` as `ddf5a018bdd5d8658698cce5a1e5077f7ec7f87c` through the connected GitHub app.
- Archive: `release/focus-dolphin-1.0.1.zip`
- Size: **3,716,109 bytes**
- Entries: **31**
- SHA-256: `cc63612f2bf6bb667b851bcfeac89cf67ae6b5a8ad431bdcc89068daa3553bab`
- Scope: correct gentle-overlay sizing on hosts such as YouTube and preserve a completed gentle check-in during same-hostname navigation for the active focus session.
- Permission impact: **none**. Existing `storage` permission holds the short-lived extension-session check-in; no host access, optional permission, or remote-data behavior changed.
- Verification: deterministic MV3 package and release verifier pass; typecheck passes; 10 focused content-script/session-allowance tests pass.
- Chrome Web Store: dashboard accepted draft version **1.0.1** and confirmed **Your extension was submitted for review**; subsequent item status is **Pending review**. Automatic publication after approval remains enabled. Public version remains 1.0.0 during review.
- Whale Store: dashboard accepted version **1.0.1**, saved matching English and Korean update notes, and now reports **심사 중**. Public version 1.0.0 remains 게시 중 during review.

## Version 1.0.0 Publication Boundary

Both stores now expose authoritative anonymous public records for the exact submitted item IDs. Chrome returns the titled listing with an active Add to Chrome control, version 1.0.0, and an updated date of July 15, 2026. Whale returns the exact public record with `READY_FOR_OPEN`, the state its storefront maps to approved/published, and installation support enabled.

The original release objective remains complete for version 1.0.0. Version 1.0.1 has now been separately packaged and submitted to both stores, but it must not be described as published until the public storefront versions change after review and rollout.
