# FocusWhale Goal 8 Handoff

> **Document provenance**
>
> - Product owner, requester, and Phase A approver: **Choi Yunseong (최윤성)**
> - Production implementation, verification, and this handoff: **OpenAI Codex (GPT-5)**
> - Prepared: **2026-07-12 KST**
> - Time zone: **Asia/Seoul (UTC+09:00)**
> - Working branch: `codex/goal-8-web-product-polish`
> - Approved Phase A commit: `e7274a1339a7f6849ace807c2fdaeeee33d031e8`
> - Approval recorded by commit: `fad859d`
> - Approval record: Choi Yunseong approved all presented states on 2026-07-11 with no exceptions, then requested the terminology-only public-history cleanup on 2026-07-12.
> - Approval boundary: all presented mockup states, no exceptions. This is not a store-publication approval.

## Executive State

Goal 8 moves FocusWhale from a function-complete extension UI to a coherent browser product organized around three jobs:

1. **Session**: act now in the toolbar popup and intervention surfaces.
2. **Rules**: configure future protection in Options.
3. **Review**: understand locally recorded focus, interventions, and whale growth.

Preferences remains secondary. The redesign borrows only structural lessons from a locally inspected focus-product reference: calm hierarchy, one dominant action, large time typography, compact rule rows, and clear separation of action/configuration/reflection. It does not copy third-party branding, navigation, scores, imagery, app grids, mobile permissions, or screen-time claims.

The current production tree keeps the existing MV3 runtime, shared contracts, message types, storage schema, session engine, DNR behavior, alarms, recovery journals, pet settlement, and privacy model. Goal 8 changes presentation and truthful view-model projections around those contracts. Two small pure helpers were added for display correctness: latest-badge selection by award time and recent Review aggregation.

One runtime integrity correction was required by exact browser QA: natural session finalization now invokes full pet reconciliation rather than XP-only settlement. This keeps XP, streak, badges, and their completion association inside one serialized mutation. A later popup reconciliation remains idempotent. The finalize-then-reconcile regression reproduces the real service-worker pipeline and verifies both first-session and first-hard badge events retain the completed session ID.

Final review found a separate presentation boundary: a session could associate more milestones than the four rows shown in the popup. The acknowledgement batch now contains the session overview plus at most those four rendered rows. Extra events remain pending, use the existing more-changes summary, and receive a later acknowledgement screen instead of being silently consumed.

Automated gates on the frozen production bundle are green:

- `npm run build`: pass.
- `npm run typecheck`: pass.
- `npm test`: **33 files / 250 tests**, pass.
- Final popup bundle: **25,240 bytes**, SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`.
- Classic content script: **194,791 bytes**.
- Build verifier: 11 manifest targets, exact four-resource web-accessible allowlist, no source maps, no root-relative asset URLs, no unexpected external network URLs, matching Pretendard license, and classic content output.
- Locale catalogs: **530 English / 530 Korean** keys with placeholder parity and production-reference coverage.
- Authored production surface CSS: **115 lines** across shared app/overlay entries and four one-line page imports.
- Raw colors: confined to the two daisyUI theme declarations.

The source still identifies as version 1.0.0. Goal 8 is a branch candidate, not a store submission or public release. The pre-Goal-8 ZIP and store screenshots are stale for this UI and must not be uploaded as the Goal 8 package.

## Frozen Product Invariants

The following remain release-blocking constraints:

- Manifest V3 only: module service worker, DNR, alarms, extension storage.
- No MV2 background page or blocking `webRequest` implementation.
- No automatic intensity escalation.
- No pet death, regression, sickness, punishment, shame, or loss-framed copy.
- Hard mode always keeps the delayed emergency valve.
- Emergency end remains two-step, delayed five minutes, and limited to one unique request per local week.
- Recommendations never auto-block a domain.
- Browsing analysis remains optional, local, and domain-level.
- No external transmission of browsing, session, intent, pet, or analytics data.
- XP remains contextual rather than a persistent pressure HUD.
- Active-session settings/list/schedule lock remains service-worker enforced.
- User-authored names, domains, schedules, and intent text remain verbatim data.

## Phase Boundary

Phase A changed only `mockups/goal-8/` and documented the approval gate. It produced the offline canonical Session, Rules, Review, Preferences, blocked, overlay, onboarding, pet-matrix, and theme-parity states.

Phase B began only after the exact approval above was recorded. Production implementation uses the approved layouts as a structural contract while preserving runtime semantics and accessibility. Decisions D-038 through D-041 record the compatibility, truthfulness, projection, and outcome-state choices made during integration.

## Production Mapping

### Session Popup

- Exact surface remains `360 x 580`.
- Idle state presents one duration stepper, one target summary, one explicit intensity choice, and one dominant Start action.
- English intensity copy wraps within its segmented control instead of overflowing.
- Active state uses the whale/radial timer as the hero and keeps target, mode, source, and end time visible.
- Intensity can only move upward through the existing runtime message; duration/end time never changes.
- Hard emergency confirmation keeps immutable facts, makes Keep focusing primary, and leaves scheduling as the error action.
- Completion uses a 128 px celebrating whale, locally settled growth, milestones, and explicit acknowledgement.
- When exactly one completion is newly settled, reconciliation associates its newly unlocked streak/badge milestones with that session. Ambiguous multi-session recovery leaves events global rather than inventing attribution.

Primary file: `src/pages/popup/main.ts`.

### Rules

- Rules is derived from existing schedules and site lists. There is no new Rule schema or storage key.
- Schedule rows show trigger, linked target list, domain count, enabled state, intensity, and focused Edit action.
- Target-list rows remain reusable blocklist/allowlist entities.
- Editors use existing entity-scoped service-worker messages.
- Active-session lock replaces the whole options workspace and does not expose mutation controls.
- At 390 px, schedule actions move to a separate row so English list/domain text does not split inside words.
- Nested delete confirmation returns keyboard focus to the visible row invoker, not a hidden editor button.

Primary files: `src/pages/options/main.ts`, `src/pages/options/model.ts`.

### Review

- Empty Review explains what will appear without inventing data.
- Populated Review shows current-week recorded focus, completed sessions, attempts, temporary access, eight-week focus, attempted targets/categories, and whale growth.
- `DailyStats.focusMinutes` is labeled recorded focus because interrupted/emergency-ended sessions can contribute partial minutes.
- Completed-session count remains a distinct metric derived from terminal status.
- Attempted targets mean blocked attempts, not passive browsing time.
- Latest badge is selected by `badgeAwards[badge].earnedAt`, with legacy ties preserving later array order.
- Review pet sizes are 160 px populated and 128 px empty.
- Growth remains additive and explicitly unchanged by rest days.

Primary files: `src/pages/options/main.ts`, `src/pages/options/model.ts`.

### Preferences

- Focus hours and soft wait remain future-session settings.
- Optional history analysis remains explicit and local-first.
- Page load checks `chrome.permissions.contains({ permissions: ["history"] })` without requesting access.
- The permission row shows Granted/Not granted and disables Revoke when access is absent.
- Analyze remains the only permission-request trigger.
- Replay onboarding and clear-local-data controls keep their prior ownership and lock behavior.

Primary file: `src/pages/options/main.ts`.

### Blocked Page

- Medium and hard use one centered card with a safe Return to focus primary action.
- Medium keeps the initial 30-second check, required intent, five-minute temporary allow, and sanitized HTTP(S) return target.
- Hard keeps no temporary allow and the existing weekly-bounded emergency valve.
- Clocks use `M:SS` below one hour and `H:MM:SS` from one hour upward.
- The hard-confirmation safe action now executes deterministic Return to focus instead of merely rerendering controls.
- Temporary-access success switches to a happy whale and outcome-led shell.
- Emergency pending switches to a resting whale, durable status, and dominant five-minute countdown.

Primary file: `src/pages/blocked/main.ts`.

### Soft Overlay

- Compiled CSS remains injected into the shadow root; host-page CSS cannot style FocusWhale controls.
- The host body is inert while the modal is open and restored afterward.
- Waiting keeps Return to focus primary and Continue disabled.
- Ready adds the approved Check-in complete badge and enables Continue.
- Session/domain ownership, page-session allow memory, deterministic `about:blank` focus exit, and cleanup behavior are unchanged.

Primary file: `src/content/index.ts`.

### Onboarding

- Install-only/replay lifecycle and versioned completion record remain unchanged.
- Step labels now expose current progress and one clear job per page.
- Intro uses a 128 px happy whale; completion uses a 160 px celebrating whale.
- Selected intensity styling follows the checked radio rather than stale rerender state.
- Programmatic focus still moves to each new heading for assistive technology, while non-interactive headings suppress the control-style outline. Interactive controls retain visible focus rings.
- History permission is never requested by onboarding.

Primary file: `src/pages/onboarding/main.ts`.

## Visual System

- Theme IDs stay `focuswhale` and `focuswhale-dark` for compatibility.
- The browser operating-system color scheme selects light/dark as before.
- Color values exist only in daisyUI theme declarations.
- UI uses neutral base tokens and a restrained teal primary; the whale remains the expressive color focus.
- Atmosphere/glass treatment is limited to the whale hero.
- daisyUI components provide buttons, cards, stats, tabs, fields, joins, badges, progress, alerts, and modals.
- Pretendard Variable remains locally bundled with SIL OFL.
- Numeric timers and metrics use tabular figures.
- Reduced-motion rules keep state transitions usable and collapse sprite animation to one frame.

## Pet Renderer Contract

`PET_RENDER_SIZES` defines:

- `default`: 96 px.
- `large`: 128 px.
- `hero`: 160 px.

The renderer scales container size, atlas background geometry, frame offsets, and animation endpoint together. It does not stretch a 96 px CSS background into a larger box. Tests cover 128/160 geometry and reduced-motion behavior.

## Localization Contract

- Korean and English catalogs contain the same 530 keys and placeholder structures.
- All new Goal 8 copy routes through the shared translator.
- Unsupported browser UI languages fall back to English.
- Korean Whale's observed stale runtime-catalog mismatch continues to use the bundled catalog matching `getUILanguage()`.
- Product defaults are localized; user-authored values are never translated.
- Catalog tests scan production TypeScript for referenced message families and reject missing keys.

## Verification Boundary

All exact headed suites used Naver Whale 4.38.386.14 / Chromium 148 and the same frozen 42,956-byte background worker, SHA-256 `172ca0d895958575048e022f1ef3051fb76d46b74ff1efe1ba80c731ab6f1d0e`.

- English popup/onboarding: the comprehensive suite passed **161/161 assertions**, zero console/page errors and zero failed requests before the final popup-only batching guard. It includes all onboarding steps/replay, exact 360 x 580 popup idle, real medium start, hard upgrade without deadline drift, hard confirmation/pending, true 25-minute hard completion, +37 XP, and session-associated First Ripple/First Deep Dive milestones.
- Final popup: exact 25,240-byte `popup.js`, SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`, passed **32/32** headed assertions. A session with five associated milestones acknowledged only the four rendered rows, preserved a truthful two-event follow-up, drained that screen separately, and stayed dismissed after reload. The standard two-milestone case also passed with zero UI/runtime diagnostics.
- English Options: Review empty/populated truthfulness, latest-badge ordering, Rules desktop/390 px, focused editors, destructive modal keyboard/focus behavior, Preferences permission containment, and whole-workspace active lock pass with zero extension diagnostics.
- Korean interventions: live `x.com`/`www.x.com`/`mobile.twitter.com` redirects, the real 30-second medium gate and five-minute allow, hard `H:MM:SS` clock, both safe return paths, two-step five-minute pending state, weekly rejection, and real-page soft-overlay isolation/focus/inert/session ownership all pass.
- Representative light/dark and reduced-motion states pass. Tested text did not overflow or leak translation keys, and tested controls were at least 40 px.
- Intervention teardown ended with no active session, no pending emergency, and zero DNR rules. Every temporary Whale profile was removed and CDP ports 9341-9344 were closed.

The live `example.com` resource trace included `lc.getunicorn.org` resources injected by Naver Whale. They are not present in FocusWhale source/bundles and are not attributed to the extension. FocusWhale's static production verifier found no unexpected external URL.

Local screenshots and machine-generated metrics are stored under ignored `output/goal-8-final/`. They are evidence inputs, not shipped repository content. Invalid captures from compositor transitions are explicitly rejected and must not be cited.

## Public-Repository Hygiene

The intended working tree was scanned before staging for cloud/API/provider tokens, private-key headers, credential assignments, personal email addresses, `/Users/...` paths, environment/key files, browser history/cookie/profile/storage databases, and tracked QA-result files. No sensitive finding was present. `npm audit --omit=dev` reported zero vulnerabilities.

Credential-bearing URLs that remain in tests and `SMOKE_TEST.md` are explicitly dummy inputs used to verify that sanitization strips credentials, queries, and fragments. Ignored `dist/`, `output/`, and `release/` plus the pre-existing untracked `.playwright-mcp/` are not part of the intended commit. Repeat the scan against the regenerated release archive; this working-tree result cannot prove a future package.

## Files Changed By Phase B

Production:

- `public/_locales/en/messages.json`
- `public/_locales/ko/messages.json`
- `src/background/session.ts`
- `src/content/index.ts`
- `src/pages/blocked/index.html`
- `src/pages/blocked/main.ts`
- `src/pages/onboarding/index.html`
- `src/pages/onboarding/main.ts`
- `src/pages/options/index.html`
- `src/pages/options/main.ts`
- `src/pages/options/model.ts`
- `src/pages/popup/index.html`
- `src/pages/popup/main.ts`
- `src/pet/renderer.ts`
- `src/pet/reconcile.ts`
- `src/shared/gamification.ts`
- `src/styles/app.css`

Regression coverage:

- `src/background/session.test.ts`
- `src/pages/blocked/main.test.ts`
- `src/pages/options/main.test.ts`
- `src/pages/options/model.test.ts`
- `src/pages/popup/main.test.ts`
- `src/pet/renderer.test.ts`
- `src/pet/reconcile.test.ts`
- `src/shared/i18n.test.ts`
- `src/shared/wellnessCopy.test.ts`

Documentation:

- `CHANGELOG.md`
- `DECISIONS.md`
- `README.md`
- `QA.md`
- `RELEASE_CHECKLIST.md`
- `SMOKE_TEST.md`
- `docs/SOL_HANDOFF.md`
- `docs/GOAL_8_HANDOFF_2026-07-12.md`

Documentation was intentionally updated only after exact runtime evidence became available.

## Successor Commands

```sh
npm ci
npm run build
npm run typecheck
npm test
git diff --check
```

Load only the freshly generated `dist/` in a clean Whale profile. Do not reuse the old release ZIP as proof of this branch.

## Remaining Publication Sequence

1. Select and review the committed Goal 8 executable hash.
2. Rebuild that commit in a detached clean checkout after `npm ci`.
3. Compare the clean `dist/` byte-for-byte with the reviewed branch output.
4. Regenerate `release/FocusWhale-1.0.0.zip` with `manifest.json` at archive root.
5. Repeat secret, private-key, personal-email, machine-path, profile, source-map, test/source, and production dependency scans.
6. Load the extracted ZIP in a clean ordinary Whale profile and repeat the critical Session/blocked/overlay/completion journey.
7. Refresh the stale core-flow store composites from that exact archive.
8. Recheck bilingual listing copy, permission disclosures, privacy URL, support-channel ownership, and reviewer instructions.
9. Obtain product-owner approval of the exact package and current imagery.
10. Upload through the Whale publisher account, record submission metadata, resolve review feedback, and only then record publication.

## Explicit Non-Claims

- No store upload, review, approval, or publication is recorded by Goal 8.
- No version bump is included.
- No mobile/SNSLOCK code is included.
- No React or other component framework was introduced.
- No backend, telemetry, advertising, remote AI, CDN, or external font/asset load was introduced.
- Phase A mockup approval does not automatically approve a future rebuilt ZIP or store imagery.

## Ownership And Attribution

Git history remains the source of code authorship. This document records that OpenAI Codex (GPT-5) performed the Goal 8 implementation/verification work at Choi Yunseong's request, and that Choi Yunseong approved the exact Phase A mockup commit on 2026-07-11. Documentation attribution does not transfer repository ownership or grant an open-source license.
