# FocusWhale v1.0.0 Release Checklist

Last refreshed: **2026-07-11 12:15 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

The source version remains 1.0.0, but this checklist now gates the Goal 7 onboarding and Korean/English localization candidate on `codex/goal-7-onboarding-i18n`. Unchecked blocking rows mean the localized build is not ready to submit. Checked rows in the explicitly historical v1.0.0 sections are regression evidence only.

## Automated Gate

- [x] `npm run typecheck` passes.
- [x] `npm test` passes: 33 files / 237 tests.
- [x] `npm run build` passes.
- [x] Content script is a classic IIFE (178,301 bytes; SHA-256 `beed14e097185ddf2d31f3a17f07b9a422d99b715e22d9bc8eae17eb111e31a6`).
- [x] All 11 verified manifest/build targets exist, including onboarding and both locale catalogs.
- [x] Manifest uses localized name, description, and action title with `default_locale: en`.
- [x] English and Korean catalogs have exact key-count parity: 460 / 460.
- [x] WAR list contains exactly four reviewed resources.
- [x] Production output contains no source maps.
- [x] Production JS/CSS/HTML/JSON contains no unexpected external URLs.
- [x] Packaged Pretendard OFL exactly matches the source license.
- [x] Packaged Tailwind CSS, daisyUI, and Vite core MIT notices exactly match their installed dependency licenses.
- [x] Atlas report validates 384 x 1,920, 4 x 20, 80 frames.
- [x] Goal 7 release ZIP extracts byte-for-byte equal to executable commit `bc62727`'s clean rebuilt `dist/` with `manifest.json` at the root.

## Goal 7 Current Live QA

Headed disposable Naver Whale 4.38 / Chromium 148 evidence from the current rebuilt `dist/`:

- [x] English first-install onboarding renders all three steps, persists completion, and stays closed on later launches.
- [x] Korean first-install onboarding renders all three steps, persists `version: 1` / `outcome: setup_only`, and stays closed on later launches.
- [x] Onboarding defaults to soft, never escalates automatically, and describes the emergency valve only for hard sessions.
- [x] Onboarding does not request optional `history` permission in English or Korean.
- [x] Options exposes the replay entry; English activation opens the packaged onboarding URL with `?replay=1`, and the shared launch path is unit-tested.
- [x] English and Korean idle popup render at 360 x 600 with localized product defaults, visible pet/CTA, no message-key leak, no horizontal overflow, and no page console error.
- [x] English and Korean Options activity/replay surfaces render without message-key leak or horizontal overflow.
- [x] Korean blocked no-session page renders without message-key leak, overflow, or page console error.
- [x] Korean fallback handles Whale reporting `getUILanguage() = ko-KR` while the runtime catalog exposes `@@ui_locale = en_US`.
- [ ] English blocked no-session page is visually checked on the committed exact build.
- [ ] English and Korean active popup, medium/hard blocked flow, soft overlay, and completion overview pass in an ordinary visible Whale profile.
- [ ] English and Korean light/dark/reduced-motion localization matrix passes without copy clipping or key leaks.
- [ ] Live browser network trace confirms zero external fetches. The static production-URL scan already passes.
- [ ] Keyboard-only onboarding completion and Options replay are exercised in both locales.
- [ ] Product owner completes visual/copy judgment in both languages.

Playwright-launched Whale stalls at `chrome.alarms.create` during session start at roughly 97-100% CPU. The exact same stall reproduced at pre-Goal-7 baseline commit `acb45b6`; record it as a harness limitation/pre-existing baseline behavior, not a Goal 7 regression and not a normal-browser pass. Google Chrome is not counted as a Goal 7 smoke pass because browser URL policy blocked the extension pages before FocusWhale could be exercised.

## Prior v1.0.0 Live QA (Historical)

The checked rows in this section belong to the prior v1.0.0 release executable. They do not close the Goal 7 rows above.

- [x] Load the exact rebuilt `dist/` in isolated headless Whale profiles and exercise that exact output. **Whale 4.38 / Chromium 148**
- [x] Popup active state and visible focus pet in Whale. **Headless exact-final pass**
- [x] Active-session options lock is visible in Whale. **Headless exact-final pass**
- [x] Trailing-dot, credential-bearing `x.com.` navigation redirects in Whale. **Headless exact-final pass**
- [x] Blocked return target retains the path/trailing hostname dot while stripping credentials, query, and fragment. **Headless exact-final pass; HSTS upgraded HTTP to HTTPS**
- [x] Medium commits exactly one temporary-allow transaction, then expires and reblocks. **Whale and Chrome for Testing exact-final pass**
- [x] Deterministic return-to-focus `about:blank` exit. **Headless exact-final pass**
- [x] Popup idle and multi-digit custom duration. **Headless exact-final pass: 2 -> 24 -> 240**
- [x] Natural completion creates one completion log and separately acknowledged reward panels; acknowledgement stays dismissed after reload. **Headless exact-final pass**
- [x] Hard confirmation, pending reload, five-minute deadline, and weekly rejection. **Headless exact-final pass**
- [x] Emergency-end a scheduled hard session and verify the same occurrence does not restart before its exact window end, including a sub-minute reconcile offset. **Headless exact-final pass**
- [x] Full soft overlay flow on a real host page. **Whale and Chrome for Testing exact-final pass**
- [x] Pet name persistence across popup/options/browser restart. **Headless exact-final pass**
- [x] Optional history grant/analyze/revoke, domain-only output, extension-URL exclusion, and post-revoke core use. **Headed Chrome for Testing 147 exact-build pass**
- [x] Long history analysis does not delay session completion, and a successful local clear invalidates an older in-flight result. **Instrumented exact-build pass: five-second callback remained pending, session first observed complete at +23 ms, clear invalidated the stale commit**
- [x] Local-data clear when idle and rejection while active. **Headless exact-final pass**
- [x] Restart before `endsAt` preserves the active session, rules, alarm, name, and lock across a real browser PID change. **Headless exact-build pass**
- [x] Restart only after `endsAt` and verify exactly-once completion across another restart. **Headed exact-build pass: three distinct Whale PIDs, one log/stats/XP/growth settlement, zero residual rules/alarms/journals**
- [x] Replace the MV3 worker at the durable session-finalization and pet-settlement journal boundaries. **Instrumented exact-build pass: both worker runtimes replaced; each recovered exactly once under repeated reconciliation**
- [x] Race the natural and emergency alarms at the same deadline. **Headed exact-build pass: natural completion won exactly once**
- [x] Delete and replace every protected sync collection during an active session. **Headed exact-build pass: settings, lists, and schedules restored without losing session/rules/alarm**
- [x] Expire a prior schedule suppression and start the next eligible occurrence. **Headed exact-build pass: exact window deadline, DNR, session alarm, and reconcile alarm**
- [x] Light/dark visual and contrast matrix. **Headed Whale exact-build pass: 13 states, 68 contrast checks, minimum 4.94:1, 19 screenshots, no page errors**
- [x] Reduced-motion matrix for overlay, all 20 pet states, and completion. **Headless/headed exact-build pass**
- [x] All five stages x four moods in installed extension. **20 sprites / 20 atlas rows**
- [x] Chrome cross-check for core redirect/overlay behavior. **Chrome for Testing 147 exact-final soft/medium pass**

The core matrix passed in Whale. The exact headed pass additionally covered list-rerender dismissal, blank intent, Options keyboard/modal focus, normal/reduced completion motion, the full visual/accessibility sweep, alarm/schedule/lock recovery, and overdue browser restart. Instrumented exact-build checks used deterministic in-memory history latency and debugger-controlled worker replacement without changing repository files or the loaded bundle. Chrome for Testing 147 accepted the real optional-history prompt and passed grant/results/revoke/post-revoke core use. Stock Google Chrome 148 rejects command-line unpacked extensions before FocusWhale runs, so it is not counted as an application failure or pass. Local screenshots were used for visual assertions; no recording or external upload occurred.

## Privacy And Security

- [x] Reconcile `PRIVACY.md` against the versioned local onboarding completion record (`focuswhaleOnboarding`) and replay behavior.
- [x] Set [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) as the support/privacy contact channel.
- [ ] Publish the Goal 7-reconciled `PRIVACY.md` at the existing stable public HTTPS URL and re-verify the Limited Use statement. **The prior v1 page was reachable on 2026-07-11**
- [ ] Add the public privacy URL to store metadata.
- [x] Secret/privacy scan passes against executable commit `bc62727`, its clean rebuilt output, and the regenerated release archive.
- [x] Confirm no real browsing exports, browser profiles, extension storage, or personal screenshots are included in the Goal 7 diff/archive.
- [x] Sanitize machine-specific `/Users/...` paths from `docs/SNSLOCK_CORE_CONCEPT_PORT_PLAN.md`.
- [x] Review all permissions/host permissions and onboarding behavior. **`history` remains optional and is not requested during onboarding; `store/PERMISSIONS_AND_PRIVACY.md` updated**
- [x] Static production scan confirms no backend, telemetry, advertising, remote AI, CDN, remote font, or other unexpected external URL was introduced.

Historical v1.0.0 security evidence: commit `6dfb1cd` and its extracted archive had no secret/token/private-key/machine-path finding. Repeat that scan because Goal 7 changes the executable and package.

## Package

- [x] Review the final Goal 7 `git status` and diff; preserve intentional user changes.
- [x] Commit the exact reviewed Goal 7 executable candidate. **`bc62727` (`Add onboarding and bilingual localization`)**
- [x] Rebuild `bc62727` in a detached clean checkout after `npm ci`; typecheck, 33/237 tests, build/verifier, and byte-for-byte comparison with all 31 packaged files pass.
- [x] Regenerate `release/FocusWhale-1.0.0.zip` from executable commit `bc62727`'s exact `dist/` with `manifest.json` at archive root.
- [ ] Load the extracted Goal 7 ZIP into a clean ordinary Whale profile and complete the current smoke matrix.
- [x] Record the Goal 7 archive: 2,754,338 bytes; SHA-256 `cba02253a1422d8f19ed7ddb16288f0c51a442656cbd02cf459740e68b5656a0`; 31 entries / 31 files.
- [x] Confirm localized manifest name/description/version/icons in the extracted archive.
- [x] Confirm no source maps, tests, TypeScript, generated source sheets, browser profiles, or private docs are in the ZIP; required third-party notices are included.
- [x] Update the draft version 1.0.0 release notes for onboarding and Korean/English support. **`store/RELEASE_NOTES_1.0.0.md`**
- [ ] Create a signed Git tag only after owner approval. **No pre-existing tag convention; no tag is required for the store ZIP itself**

Historical package evidence: `acb45b6` was the prior executable candidate and `6dfb1cd` the prior publication pack. Their 2,694,409-byte ZIP (`241a9863fde194a20d1f0f54dc1a7377bf9314dd40413e5fd1488dab52c97f18`, 33 entries / 25 files, 116,276-byte content script) passed byte-equality and clean Whale load, but it predates Goal 7.

## Store Materials

- [x] Choose the first target store. **Whale Store first for the localized Goal 7 package; Chrome follows only after separate browser-specific QA and listing approval**
- [x] Draft bilingual listing title/description, category, and language coverage for the Goal 7 candidate. **`store/STORE_LISTING.md`**
- [x] Capture exact Goal 7 onboarding screenshots in English and Korean at 1280 x 800, with checksums and no personal data.
- [ ] Refresh or explicitly approve the four prior-build core-flow composites before upload.
- [x] Confirm the icon and copy-free promotional tile remain byte-identical and accurate.
- [x] Prepare support URL. **Public GitHub Issues**
- [ ] Product owner confirms that the public support channel will be monitored.
- [x] Prepare the privacy URL and Limited Use statement. **Public reachability is historical; dashboard entry remains a separate gate**
- [x] Update reviewer instructions for first-install onboarding, language behavior, blocklist/medium/hard, and optional-history testing. **`store/REVIEWER_INSTRUCTIONS.md`**
- [x] Document why broad HTTP(S) host access and the content script are necessary. **`store/PERMISSIONS_AND_PRIVACY.md`**
- [x] Select the repository license deliberately. **Publicly viewable, all rights reserved; third-party licenses preserved**

## Approval And Publication

- [ ] Product owner reviews unresolved QA evidence and accepts/rejects exceptions.
- [ ] Product owner approves listing copy/assets/privacy disclosures.
- [ ] Submit to the selected store(s).
- [ ] Record submission ID/date/account owner.
- [ ] Resolve reviewer feedback without weakening wellness/privacy invariants.
- [ ] Record approval/publication URLs and dates.
- [ ] Update `CHANGELOG.md` from local release candidate to public release only after publication.

## Current Decision

**The Goal 7 source/build, clean committed rebuild, archive, static privacy scan, and bilingual onboarding-image gates are green, but the localized release is not publication-ready yet.** Remaining technical gates are a normal-browser active-session/blocked/overlay/completion sweep in both locales, English blocked no-session check, light/dark/reduced-motion and keyboard checks, a live zero-network trace, extracted-archive browser load, and refresh or approval of the four older core-flow composites. Owner approval, support-channel monitoring, publisher-dashboard metadata, upload, review, and publication also remain open. The prior v1.0.0 browser evidence is preserved only as regression context.
