# Focus Dolphin v1.0.0 Release Checklist

Last refreshed: **2026-07-12 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

The source version remains 1.0.0. This checklist gates **Focus Dolphin — Website Blocker** on `main` for independent Chrome Web Store and Whale Store submissions. `FocusWhale` was the unreleased development codename. Choi Yunseong approved the complete Phase A mockup contract at commit `e7274a1` on 2026-07-11 with no exceptions; that historical whale-design approval does not approve the renamed archive, dolphin imagery, listing, or publication. Unchecked blocking rows mean the candidate must not be submitted.

## Pre-Rename Automated Evidence (Historical)

- [x] `npm run typecheck` passes.
- [x] `npm test` passes: 34 Vitest files / 259 application tests plus 6 release-package boundary tests.
- [x] `npm run build` passes.
- [x] Background worker is 42,956 bytes; SHA-256 `1e5cddc9a4cd79f0444b6927d17f77534b37bffaa7c6d1f59ccb2a098b85dfa2`.
- [x] Popup bundle is 27,173 bytes; SHA-256 `50c92044b6deb4b924e21c8d5a6cff20b52378544ffe92d1e2818220c1c77718`.
- [x] Content script is a classic IIFE (203,956 bytes; SHA-256 `123c8ef35b632bb6b1ce590947924ced97673ad85e386824fca53ae33b3b0306`).
- [x] All 11 verified manifest/build targets exist, including onboarding and both locale catalogs.
- [x] Manifest uses localized name, description, and action title with `default_locale: en`.
- [x] English and Korean catalogs have key and placeholder parity: 541 / 541; production message references are covered.
- [x] WAR list contains exactly four reviewed resources.
- [x] Production output contains no source maps or root-relative asset URLs.
- [x] Production JS/CSS/HTML/JSON contains no unexpected external URLs.
- [x] Packaged Pretendard OFL exactly matches the source license.
- [x] Packaged Tailwind CSS, daisyUI, and Vite core MIT notices exactly match their installed dependency licenses.
- [x] Atlas report validates 768 x 3,840, 4 x 20, 80 high-density source frames.
- [x] Atlas report records source/intermediate/final hashes; icons and promotional tile regenerate deterministically from the recorded mascot atlas.
- [x] Repository and package license boundaries are documented in `docs/LICENSE_AND_IP_AUDIT_2026-07-12.md`.
- [x] Authored production surface CSS is 115 lines; raw colors occur only in daisyUI theme declarations.
- [x] Deterministic release packager requires MV3/locales/licenses, sorts entries, fixes metadata, compares every file with `dist/`, proves cross-process byte stability, and rejects appended archive data. **The recorded output used the development codename and is not the Focus Dolphin store artifact.**
- [x] Run `npm run build`, `npm run typecheck`, and `npm test` against the integrated Focus Dolphin source; record the renamed bundle hashes and locale counts. **34 Vitest files / 264 application tests, 9 package tests, 542 / 542 locale keys; current hashes in `QA.md`.**
- [ ] Generate and verify `release/focus-dolphin-1.0.0.zip` from the selected executable commit. **The existing FocusWhale archives are historical and must not be relabeled.**

## 2026-07-12 Pre-Rename Follow-Up QA (Historical)

- [x] Live installed-Whale popup accepts direct `90` minute input and updates the CTA to `Start 90 min` without starting a session.
- [x] Live installed-Whale popup steps from the edited `90` value to `95`, confirming the five-minute controls use the current input rather than a stale render snapshot.
- [x] Live Options Review rendered the approved whale from the rebuilt atlas; this is historical pre-rename evidence and does not verify the dolphin atlas.
- [x] Exercise and restore Automatic, English, and Korean from the visible Preferences selector in an isolated Whale profile.
- [x] Change language during a live locked session: the selector remains available, Rules stay locked, and the active countdown continues without resetting.
- [x] Exercise semantic popup, Options, onboarding, blocked, and overlay motion in an isolated Whale profile; representative reduced-motion states produced zero new Web Animations, same-state rerenders did not replay, and timers/focus remained unchanged. **MOTION FOLLOW-UP EXACT BUILD; `QA.md`**
- [ ] Rerun the current bilingual onboarding disclosure and every mascot-bearing core state at 1280 x 800 and 720 x 820 in isolated Whale and Chrome profiles; verify Focus Dolphin copy/art, visible disclosure, reachable CTA, no horizontal overflow, and zero console/page/request/worker errors. **The earlier attempt was blocked before extension load and is not a pass/fail.**

## Goal 8 Baseline Live QA (Historical)

Headed disposable Naver Whale 4.38.386.14 / Chromium 148 evidence from the frozen Goal 8 baseline `dist/`; rows that cite the earlier popup hash remain baseline evidence rather than fingerprints of the current follow-up bundle:

- [x] Phase A structure matches the approved `e7274a1` Session, Rules, Review, Preferences, blocked, overlay, onboarding, pet-size, and theme states.
- [x] English onboarding Steps 1-3, completion, persistence, replay, keyboard access, 128/160 px pets, light/dark representatives, and reduced motion pass.
- [x] English popup passes 161/161 assertions at exact 360 x 580, including English intensity wrapping, medium start, hard upgrade without deadline drift, hard confirmation, and durable pending state.
- [x] A true 25-minute hard completion awards +37 XP exactly once; First Ripple and First Deep Dive remain associated with that session and acknowledgement stays dismissed after reload.
- [x] Final popup batching regression passes 32/32 on SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`: session + four visible milestone rows, truthful deferred count, only rendered IDs acknowledged, remaining events shown next, and standard two-milestone flow preserved.
- [x] Review empty/populated data, truthful metric labels, latest-badge ordering, 128/160 px pets, light/dark, and reduced-motion representatives pass.
- [x] Rules desktop and 390 px, focused editors, validation, destructive modal trap/Escape/focus restoration, and active-session lock pass.
- [x] Preferences shows optional-history status without requesting access; Revoke is disabled when permission is absent.
- [x] Popup/onboarding and Options exact suites report zero page/request/extension diagnostic errors, no horizontal overflow, no message-key leakage, and no controls below 40 px in exercised states.
- [x] Programmatic onboarding heading focus remains assistive-technology-visible without a raw control outline; interactive focus rings remain visible.
- [x] The modal-layer duplicate-primary measurement is reviewed: only the modal primary is operable/focusable while the background is inert.
- [x] Korean exact blocked/overlay matrix passes: live `x.com` aliases, real medium 30-second gate and five-minute allow, hard long clock/two safe exits/two-step pending/weekly rejection, soft waiting/ready isolation/focus/inert/session ownership, light/dark/reduced motion, zero extension errors, and clean final session/DNR state.
- [ ] Product owner completes visual/copy judgment in both languages.

The earlier Goal 7 Playwright/Whale alarm stall is historical, not a current blocker: visible Goal 8 automation completed real session starts, alarms, DNR, completion, and acknowledgement. Temporary test profiles were removed and their CDP ports closed; screenshots/results remain only under ignored local `output/goal-8-final/`.

## Goal 7 Live QA (Historical)

The prior bilingual onboarding candidate and its archive remain regression context only. They do not close Goal 8 executable, package, imagery, approval, or publication rows.

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

The historical core matrix passed in Whale. The exact headed pass additionally covered list-rerender dismissal, blank intent, Options keyboard/modal focus, normal/reduced completion motion, the full visual/accessibility sweep, alarm/schedule/lock recovery, and overdue browser restart. Instrumented exact-build checks used deterministic in-memory history latency and debugger-controlled worker replacement without changing repository files or the loaded bundle. Chrome for Testing 147 accepted the real optional-history prompt and passed grant/results/revoke/post-revoke core use. Stock Google Chrome 148 rejected command-line unpacked extensions before the historical FocusWhale build ran, so it is not counted as an application failure or pass. Local screenshots were used for visual assertions; no recording or external upload occurred.

## Privacy And Security

- [x] `PRIVACY.md` covers the versioned onboarding record, user-selected language, domain-level attempt counts, local analytics, optional history, browser sync boundary, retention, and deletion behavior.
- [x] The first onboarding screen prominently discloses current-address handling, local records and intent text, optional 30-day history analysis, browser-sync fields, and zero developer transfer in both languages.
- [x] Soft-overlay temporary allow state stays inside the isolated content-script world and is not written to host-page `sessionStorage`; a source regression test enforces this boundary.
- [ ] Verify [Focus Dolphin GitHub Issues](https://github.com/lovebubbly/FocusDolphin/issues) after the repository remote is renamed; this is the intended support/privacy contact channel.
- [x] Manifest permissions remain `declarativeNetRequest`, `storage`, and `alarms`; `history` remains optional and is requested only from Analyze.
- [x] Static production verifier confirms no backend, telemetry, advertising, remote AI, CDN, remote font, or unexpected external URL.
- [x] Final Goal 8 intended working-tree scan finds no cloud/API/provider token, private key, personal email, `/Users/...` path, browser profile/storage/database, or QA-result file in tracked content; a live full `npm audit --audit-level=low` reports zero vulnerabilities. Dummy credential-bearing URLs remain only as explicit sanitization tests/checklist data. Ignored `dist/`, `output/`, `release/`, and `.playwright-mcp/` are excluded from staging.
- [ ] Repeat the same scan against the clean rebuilt Goal 8 archive after packaging.
- [ ] Re-verify the public privacy-policy URL and Limited Use statement immediately before store entry.
- [ ] Add the public privacy URL to store metadata.
- [ ] Product owner confirms the public support channel will be monitored.

## Package

- [x] Review and commit the exact Goal 8 executable candidate on the dedicated branch: `5029d2a924cc14b5175fe1da1f4f9a2fcf274fb8` (`Implement Goal 8 web product polish`).
- [ ] Rebuild the selected commit in a detached clean checkout after `npm ci`; require build, typecheck, 264 application tests plus 9 package tests, and byte-for-byte comparison with reviewed `dist/`.
- [ ] Run `npm run package:release` from that clean checkout and retain its `.sha256` and `.package-report.json` sidecars as release evidence.
- [ ] Regenerate `release/focus-dolphin-1.0.0.zip` with `manifest.json` at archive root. **Existing FocusWhale ZIPs predate the public rename and must not be relabeled.**
- [ ] Record new archive byte size, SHA-256, and file/entry count.
- [ ] Confirm localized manifest/version/icons and all required license notices in the extracted archive.
- [ ] Confirm no source maps, tests, TypeScript, source sheets, browser profiles/storage, local QA evidence, or private docs are included.
- [ ] Load the extracted Goal 8 ZIP in a clean ordinary Whale profile and repeat the critical Session, medium/hard block, overlay, completion, and settings-lock smoke.
- [ ] Refresh release notes to describe Goal 8 without claiming publication.
- [ ] Create a signed Git tag only after owner approval. **No pre-existing tag convention; no tag is required for the store ZIP itself**

Historical package evidence: the current tracked/release-area archive belongs to the earlier Goal 7 candidate. It passed its own clean rebuild and hygiene gates, but it predates the Goal 8 UI/runtime correction and is not reusable proof.

## Store Materials

- [x] Choose target stores. **Chrome Web Store and Whale Store; one exact MV3 ZIP may be reused only after separate browser QA, with independent listings, reviews, IDs, and publication records**
- [x] Draft bilingual listing title/description, category, and language coverage. **`store/STORE_LISTING.md`; re-review against Goal 8 before upload**
- [ ] Capture exact rebuilt-archive Goal 8 screenshots in English and Korean at store dimensions, with checksums and no personal data.
- [ ] Replace or explicitly archive every pre-Goal-8 core-flow composite before upload.
- [x] Confirm the packaged/store 128 px Focus Dolphin icons are byte-identical; regenerate the icon and copy-free promotional tile from the recorded mature-dolphin atlas frame. **SHA-256 `f2aad78150573693d4236377b830017315890d2c8f59cc85fabb2d0cc08e4714`; deterministic generator and provenance recorded.**
- [ ] Rename the GitHub repository/remote to `lovebubbly/FocusDolphin`, then verify the intended public Issues and privacy-policy URLs.
- [ ] Update the Chrome Web Store and Whale Store dashboard names independently; do not infer either external rename from source changes.
- [ ] Product owner confirms that the public support channel will be monitored.
- [x] Prepare the privacy URL and Limited Use statement. **Reachability must be re-verified; dashboard entry remains a separate gate**
- [x] Update reviewer instructions for first-install onboarding, language behavior, blocklist/medium/hard, and optional-history testing. **`store/REVIEWER_INSTRUCTIONS.md`**
- [x] Document why broad HTTP(S) host access and the content script are necessary. **`store/PERMISSIONS_AND_PRIVACY.md`**
- [x] Select the repository license deliberately. **Publicly viewable, all rights reserved; third-party licenses preserved**
- [x] Select a distinct public product name before publication. **Focus Dolphin — Website Blocker; FocusWhale remains an unreleased development codename only.**
- [x] Record owner acceptance of the residual Focus Dolphin knock-out-screen risk. **Choi Yunseong directed the project to proceed on 2026-07-12 after the Apple metadata correction; this is not legal clearance.**
- [ ] Complete broader international, common-law, and confusing-similarity review before asserting exclusivity; professional review remains recommended.

## Approval And Publication

- [x] Product owner approved the complete Goal 8 Phase A mockup commit `e7274a1` on 2026-07-11 with no exceptions.
- [ ] Product owner reviews the committed Goal 8 executable evidence and accepts/rejects any documented exceptions.
- [ ] Product owner approves the exact regenerated archive and current imagery.
- [ ] Product owner approves listing copy/assets/privacy disclosures.
- [ ] Submit to the selected store(s).
- [ ] Record submission ID/date/account owner.
- [ ] Resolve reviewer feedback without weakening wellness/privacy invariants.
- [ ] Record approval/publication URLs and dates.
- [ ] Update `CHANGELOG.md` from local release candidate to public release only after publication.

## Current Decision

**The public-name decision and documented conditional-go risk acceptance are complete, but the integrated Focus Dolphin candidate is not publication-ready.** The old FocusWhale archive, whale screenshots, and exact-build hashes remain historical rather than proof of the renamed build. A clean detached rebuild, regenerated/rescanned Focus Dolphin archive, extracted-archive critical-flow smoke in both browsers, refreshed bilingual dolphin imagery, live GitHub and dashboard renames, exact-package owner approval, two publisher submissions, reviews, and publication remain separate open gates.
