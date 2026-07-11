# FocusWhale v1.0.0 Release Checklist

Last refreshed: **2026-07-12 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

The source version remains 1.0.0. This checklist gates the Goal 8 candidate on `codex/goal-8-web-product-polish`. Choi Yunseong approved the complete Phase A mockup contract at commit `e7274a1` on 2026-07-11 with no exceptions. That approval authorized Phase B; it does not approve the future archive, store imagery, listing, or publication. Unchecked blocking rows mean the branch must not be submitted.

## Automated Gate

- [x] `npm run typecheck` passes.
- [x] `npm test` passes: 33 files / 250 tests.
- [x] `npm run build` passes.
- [x] Background worker is 42,956 bytes; SHA-256 `172ca0d895958575048e022f1ef3051fb76d46b74ff1efe1ba80c731ab6f1d0e`.
- [x] Popup bundle is 25,240 bytes; SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`.
- [x] Content script is a classic IIFE (194,791 bytes; SHA-256 `1e61912aa791d63278fa79a8233ef5118c537e302e0c73d3f2948dc9f515b2df`).
- [x] All 11 verified manifest/build targets exist, including onboarding and both locale catalogs.
- [x] Manifest uses localized name, description, and action title with `default_locale: en`.
- [x] English and Korean catalogs have key and placeholder parity: 530 / 530; production message references are covered.
- [x] WAR list contains exactly four reviewed resources.
- [x] Production output contains no source maps or root-relative asset URLs.
- [x] Production JS/CSS/HTML/JSON contains no unexpected external URLs.
- [x] Packaged Pretendard OFL exactly matches the source license.
- [x] Packaged Tailwind CSS, daisyUI, and Vite core MIT notices exactly match their installed dependency licenses.
- [x] Atlas report validates 384 x 1,920, 4 x 20, 80 frames.
- [x] Authored production surface CSS is 115 lines; raw colors occur only in daisyUI theme declarations.
- [ ] Regenerate and verify a Goal 8 release ZIP from the selected executable commit. **The existing archive predates Goal 8.**

## Goal 8 Current Live QA

Headed disposable Naver Whale 4.38.386.14 / Chromium 148 evidence from the frozen rebuilt `dist/`, fingerprinted by the background hash above:

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

The core matrix passed in Whale. The exact headed pass additionally covered list-rerender dismissal, blank intent, Options keyboard/modal focus, normal/reduced completion motion, the full visual/accessibility sweep, alarm/schedule/lock recovery, and overdue browser restart. Instrumented exact-build checks used deterministic in-memory history latency and debugger-controlled worker replacement without changing repository files or the loaded bundle. Chrome for Testing 147 accepted the real optional-history prompt and passed grant/results/revoke/post-revoke core use. Stock Google Chrome 148 rejects command-line unpacked extensions before FocusWhale runs, so it is not counted as an application failure or pass. Local screenshots were used for visual assertions; no recording or external upload occurred.

## Privacy And Security

- [x] `PRIVACY.md` covers the versioned onboarding record, local analytics, optional history, browser sync boundary, retention, and deletion behavior.
- [x] [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) remains the prepared support/privacy contact channel.
- [x] Manifest permissions remain `declarativeNetRequest`, `storage`, and `alarms`; `history` remains optional and is requested only from Analyze.
- [x] Static production verifier confirms no backend, telemetry, advertising, remote AI, CDN, remote font, or unexpected external URL.
- [x] Final Goal 8 intended working-tree scan finds no cloud/API/provider token, private key, personal email, `/Users/...` path, browser profile/storage/database, or QA-result file in tracked content; `npm audit --omit=dev` reports zero vulnerabilities. Dummy credential-bearing URLs remain only as explicit sanitization tests/checklist data. Ignored `dist/`, `output/`, and `release/` plus the pre-existing untracked `.playwright-mcp/` are excluded from staging.
- [ ] Repeat the same scan against the clean rebuilt Goal 8 archive after packaging.
- [ ] Re-verify the public privacy-policy URL and Limited Use statement immediately before store entry.
- [ ] Add the public privacy URL to store metadata.
- [ ] Product owner confirms the public support channel will be monitored.

## Package

- [ ] Review and commit the exact Goal 8 executable candidate on the dedicated branch.
- [ ] Rebuild the selected commit in a detached clean checkout after `npm ci`; require build, typecheck, 33/250 tests, and byte-for-byte comparison with reviewed `dist/`.
- [ ] Regenerate `release/FocusWhale-1.0.0.zip` with `manifest.json` at archive root. **The existing ZIP predates Goal 8 and must not be relabeled.**
- [ ] Record new archive byte size, SHA-256, and file/entry count.
- [ ] Confirm localized manifest/version/icons and all required license notices in the extracted archive.
- [ ] Confirm no source maps, tests, TypeScript, source sheets, browser profiles/storage, local QA evidence, or private docs are included.
- [ ] Load the extracted Goal 8 ZIP in a clean ordinary Whale profile and repeat the critical Session, medium/hard block, overlay, completion, and settings-lock smoke.
- [ ] Refresh release notes to describe Goal 8 without claiming publication.
- [ ] Create a signed Git tag only after owner approval. **No pre-existing tag convention; no tag is required for the store ZIP itself**

Historical package evidence: the current tracked/release-area archive belongs to the earlier Goal 7 candidate. It passed its own clean rebuild and hygiene gates, but it predates the Goal 8 UI/runtime correction and is not reusable proof.

## Store Materials

- [x] Choose the first target store. **Whale Store first; Chrome follows only after separate browser-specific QA and listing approval**
- [x] Draft bilingual listing title/description, category, and language coverage. **`store/STORE_LISTING.md`; re-review against Goal 8 before upload**
- [ ] Capture exact rebuilt-archive Goal 8 screenshots in English and Korean at store dimensions, with checksums and no personal data.
- [ ] Replace or explicitly archive every pre-Goal-8 core-flow composite before upload.
- [x] Confirm the icon and copy-free promotional tile remain byte-identical and accurate.
- [x] Prepare support URL. **Public GitHub Issues**
- [ ] Product owner confirms that the public support channel will be monitored.
- [x] Prepare the privacy URL and Limited Use statement. **Reachability must be re-verified; dashboard entry remains a separate gate**
- [x] Update reviewer instructions for first-install onboarding, language behavior, blocklist/medium/hard, and optional-history testing. **`store/REVIEWER_INSTRUCTIONS.md`**
- [x] Document why broad HTTP(S) host access and the content script are necessary. **`store/PERMISSIONS_AND_PRIVACY.md`**
- [x] Select the repository license deliberately. **Publicly viewable, all rights reserved; third-party licenses preserved**

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

**Goal 8 source-level automated gates and all exact unpacked-build Whale suites are green, but the candidate is not publication-ready.** The old archive and store imagery are stale. A selected executable commit, clean detached rebuild, regenerated/rescanned archive, extracted-archive critical-flow smoke, refreshed bilingual imagery, exact-package owner approval, support/privacy metadata, publisher upload, review, and publication remain separate open gates.
