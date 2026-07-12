# Changelog

Documentation refresh: **OpenAI Codex (GPT-5)** for requester and product owner **Choi Yunseong (최윤성)**, **2026-07-12 KST**.

All notable Focus Dolphin changes are documented here. `FocusWhale` was the unreleased development codename, so earlier entries and compatibility identifiers retain that name where historically or technically accurate. The project has not yet recorded a public store release.

## [Unreleased] - 2026-07-12 (Goal 8 Web Polish Candidate)

### Added

- Adopted the public product name **Focus Dolphin — Website Blocker** before the first store release; the GitHub remote and store dashboard records remain pending until renamed and verified live.
- Replaced the public mascot and animal-specific copy with a coherent dolphin identity while preserving legacy internal identifiers needed for development-install compatibility.
- User-selectable Automatic, English, or Korean UI language in Preferences, persisted independently from session policy.
- Direct whole-minute session entry for the full 1-240 minute range.
- Approved Goal 8 production information architecture: Session in the toolbar popup, Rules and Review in Options, and secondary Preferences.
- Locally truthful Review states for the current week, eight-week recorded focus, attempted targets/categories, dolphin growth, and timestamp-derived latest badges.
- Permission-status row for optional browsing-history analysis, including a non-prompting `contains` check and a disabled Revoke action when access is absent.
- Explicit 128 px large and 160 px hero pet-render sizes backed by 192 px source frames.
- Soft-overlay ready badge and outcome-led temporary-access/emergency-pending blocked states.
- Semantic, reduced-motion-aware surface transitions for popup state changes, Options views, onboarding steps, blocked states, and new soft overlays.
- An always-visible bilingual first-run data disclosure covering address handling, local records and intent text, optional history analysis, browser sync, and zero developer transfer.
- A reproducible icon and promotional-tile generator derived from the documented high-density mascot atlas.
- A deterministic, self-verifying Chrome/Whale release packager with fixed ZIP metadata, whole-archive comparison, SHA-256 sidecar, and per-file provenance report.
- A repository/package license and IP audit for Chrome Web Store and Whale Store release gating.

### Changed

- Duration minus/plus controls now move to adjacent five-minute marks; exact values remain directly editable.
- Reassembled the approved whale from its original high-resolution source sheets into a 768 x 3,840 atlas without changing animation, mood, or growth-stage identity. This records the pre-rename Goal 8 art baseline; the later Focus Dolphin migration supersedes it for publication.
- Made the eight-week Review chart grow from zero on first entry, added a one-time overlay-readiness confirmation pop, and added daisyUI busy indicators for local analysis and guarded mutations.
- Transplanted the product-owner-approved Goal 8 mockups from commit `e7274a1` into production after the exact no-exception approval recorded in `mockups/goal-8/PHASE_A_REPORT.md`.
- Reworked the popup around one duration stepper, one target summary, one user-selected intensity, one dominant Start action, an active radial timer, and a dolphin-led completion overview.
- Reworked Options into a 720 px Review/Rules workspace with compact schedule and target-list rows, focused editors, and separate Preferences.
- Reworked blocked and shadow-DOM intervention surfaces around a centered outcome card, safe return-to-focus primary action, and preserved medium/hard commitment mechanics.
- Updated both production themes while preserving the `focuswhale` / `focuswhale-dark` identifiers and operating-system theme selection.
- Expanded Korean/English localization to 541 parity-checked messages.

### Fixed

- English intensity labels overflowing the 360 px popup.
- Hard emergency confirmation dropping immutable target/mode/source facts.
- Blocked clocks displaying minute-only values above one hour.
- The blocked hard-confirmation safe action visually returning without actually navigating to focus.
- Nested delete confirmation restoring focus to a hidden editor control.
- Mobile Rules rows splitting `blocklist` and `domains` inside words.
- Review describing partial recorded focus as completed focus.
- Latest-badge display trusting incidental array order instead of award time.
- Preferences enabling history-permission revocation when access was not granted.
- Newly earned badge events lacking the completed session association and therefore disappearing from the post-session milestone batch.
- Completion acknowledgement consuming more session milestones than the four rows it displayed; extra events now remain pending for the next acknowledgement screen.
- Soft-overlay temporary access exposing its session identifier through host-page `sessionStorage`; the allowance now remains inside isolated content-script memory.

### Pre-Rename Automated Verification

- `npm run build`: pass; 11 manifest targets, exact four-resource WAR, local font/license, classic content output, no source maps, root-relative asset URLs, or unexpected external URLs.
- `npm run typecheck`: pass.
- `npm test`: 34 Vitest files / 259 application tests plus the then-current release-package boundary tests pass.
- English/Korean catalogs: 541 / 541 keys with placeholder parity.
- Authored production surface CSS: 115 lines; raw colors remain confined to theme definitions.
- The integrated Focus Dolphin build, final package-test total, exact hashes, and browser evidence must be recorded after the full suite reruns.

### Release Boundary

- Source version remains 1.0.0 and no store publication is claimed.
- Every existing FocusWhale ZIP and whale screenshot is historical. A Focus Dolphin ZIP and fresh bilingual screenshots must be generated and reviewed from the selected executable before submission.
- Chrome Web Store and Whale Store are both release targets. The exact-name `FocusWhale` conflict was resolved for this product by selecting **Focus Dolphin — Website Blocker** before publication; final confusing-similarity review and live repository/dashboard renames remain release gates.
- Phase A approval covers every presented mockup state with no exceptions. It does not by itself constitute store submission or publication approval.

## [1.0.0] - 2026-07-10 (Local Release Candidate)

### Added

- MV3 focus sessions with soft, medium, and hard intensity.
- Blocklist/allowlist DNR rules, scheduled sessions, alarms, and temporary allows.
- Two-step, five-minute hard emergency end with a one-request-per-local-week limit.
- Popup, options, blocked page, and shadow-DOM soft overlay.
- Optional on-device history recommendations with explicit permission grant/revoke.
- Local-data clear control, unavailable during an active session.
- Pet XP v2, stages, streak protection, additive badges, growth ledger, and post-session overview.
- Four-mood (`idle`, `happy`, `focus`, `celebrate`) 80-frame star-whale atlas.
- Session/pet recovery journals, per-session ledgers, and active-session lock snapshot.
- Global service-worker serialization across state-mutating messages, alarms, lifecycle events, storage changes, and tab updates.
- Journaled medium temporary-allow mutations and scheduled-occurrence suppression after early end.
- Build verifier for manifest targets, exact WAR resources, classic content script, source maps, external URLs, and font licensing.
- Local Pretendard Variable font and SIL OFL packaging.
- Install-only three-step onboarding with a versioned local completion record, skip/setup-only outcomes, focus-list editing, an explicit optional 25-minute first session, and an Options replay action.
- Complete Korean and English catalogs for onboarding, popup, Options, blocked page, soft overlay, pet stages, badges, growth copy, product defaults, validation/errors, and manifest metadata.

### Changed

- Reworked options into records, blocking rules, automatic start, and whale growth tabs.
- Refined popup/blocked/options/overlay styling and accessibility behavior.
- Reduced production theme variants to the supported light/dark pair.
- Made browser history an optional permission requested only on analysis.
- Made 30-day history metrics count actual `history.getVisits` timestamps instead of lifetime URL counters.
- Moved history-result and celebration-acknowledgement writes behind background messages.
- Kept long history computation off the session-operation queue while guarding its queued commit with a local-data mutation generation.
- Preserved exact session end time when upgrading intensity.
- Replaced the clipped crown adult with a star-marked stage-4 whale.
- Replaced the two-mood 384 x 960 atlas with a four-mood 384 x 1,920 atlas.
- Kept Options summary metrics in one compact horizontal row and widened active-popup status copy without changing the 360 px surface.
- Focused hard-mode blocked pages on the neutral return button instead of outlining the entire action region.
- Split the build so the content script ships as a classic IIFE while the service worker remains a module.
- Made blocked-page return URLs HTTP(S)-only and stripped credentials/query/fragment.
- Made return-to-focus deterministic through `about:blank`.
- Preserved weekly emergency usage and active schedule suppression when local activity data is cleared.
- Sanitized machine-specific `/Users/...` paths from `docs/SNSLOCK_CORE_CONCEPT_PORT_PLAN.md`.
- Localized manifest name, description, and action title through Chrome `_locales`, with English as the fallback for unsupported browser languages.
- Preserved user-authored pet/list names, domains, schedules, and intent text while translating product-authored defaults.
- Hardened the DNR adapter to remove only rules that currently exist and to skip an empty browser update.

### Fixed

- `x.com`/Twitter alias blocking in Whale.
- Options mutations remaining reachable during an active session.
- Pet missing/black-box behavior caused by asset URL and shadow-root style handling.
- Completion overview reappearing after unrelated popup rerenders/toggles.
- Pet name updates losing/persisting stale progress.
- Duplicate XP/stats awards and interrupted multi-key finalization.
- Unsafe session replacement, expiration reconciliation, and emergency-session races.
- Scheduled sessions immediately restarting after an emergency/early end inside the same occurrence window.
- Rounded scheduled-session duration extending `endsAt` or suppression beyond the exact occurrence boundary.
- Medium temporary allows surviving the wrong session/domain/mode or partially applying across DNR, alarm, storage, and intent/stat writes.
- Hard upgrades retaining stale medium allows.
- Expiry/finalization ordering and status drift during journal recovery.
- Expired-session settlement before local clearing.
- Credential-bearing blocked return targets and content-page return-path handling.
- Extension asset/font resolution across page and shadow-root contexts, including explicit overlay inheritance from `src/styles/overlay.css`.
- Tab sweeps failing as a whole when one tab cannot be inspected or redirected.
- Ambiguous message-failure typing and unsafe generic write retries.
- Popup custom-duration focus loss and active countdown rerender churn.
- Blocked intent submission without meaningful input.
- Black Canvas analytics rendering path.
- User-edited default lists being silently repopulated on popup/startup.
- Stale whole-array Options writes, expired-session false locks, and configuration mutation races.
- Hard emergency exit being unreachable from the popup when no blocked page was open.
- Cold-start popup/options reads missing an overdue session's final reward or dashboard credit.
- Stale settlement/reconciliation journals regressing newer pet, streak, badge, or ledger progress.
- Multiple pending completion groups being acknowledged together and pet-name saves snapping back in the same popup.
- Schedule boundary alarms being lost after transient creation failures.
- Minute-level focus-window scoring and cross-midnight daily focus attribution.
- Duplicate celebration acknowledgements prematurely consuming the retention cap.
- Non-HTTP(S) browser-history items entering domain recommendations.
- Destructive Options dialogs failing to trap focus and restore it to the invoking control.
- Low-contrast semantic summaries and incomplete visible-focus treatment found in the headed accessibility sweep.
- Whale profiles reporting a Korean UI language with a stale English runtime message catalog; the translator now selects the bundled catalog matching the browser UI language.
- Korean growth-stage particle selection (`알과`, `새끼 고래와`) without changing English output.

### Verification

- Typecheck pass.
- 33 Vitest files / 237 tests pass.
- Two-stage production build pass.
- Classic content script: 178,301 bytes.
- No source maps or unexpected external URLs in the final bundle.
- Exact four-resource WAR allowlist.
- Build verification requires the onboarding page, both 460-key locale catalogs, localized manifest fields, and English `default_locale` in addition to the existing MV3/package checks.
- Headed disposable-profile Whale 4.38 visual checks pass English and Korean onboarding, popup, Options, and Korean blocked-page localization with no message-key leakage, horizontal overflow, missing pet, or page-console errors. Install-only completion suppression and explicit Options replay also pass.
- Playwright-launched Whale 4.38 stalls when session startup reaches `chrome.alarms.create`. The exact executable baseline at `acb45b6` reproduces the same stall, establishing a harness limitation/pre-existing baseline behavior rather than a Goal 7 regression. This result is not a normal-browser session smoke, so that smoke remains required before publication.
- Commit `acb45b6` remains the pre-Goal-7 behavioral baseline for the previously recorded soft/medium/hard, recovery, DNR, pet, accessibility, and optional-history browser matrix. Those results are historical evidence for unchanged core behavior, not exact-current proof for the bilingual build.
- The regenerated 2,754,338-byte release ZIP has SHA-256 `cba02253a1422d8f19ed7ddb16288f0c51a442656cbd02cf459740e68b5656a0`; 31 files extract byte-equal to `dist/`, and archive/privacy/dependency scans pass.

### Not Yet Released

- Executable commit `bc62727` passes a detached clean `npm ci` rebuild, typecheck, 237 tests, build verification, and byte comparison with all 31 archive files. Extracted-archive ordinary-browser load and normal-browser active-session smoke remain pending. No store submission or publication is recorded.
- Whale Store is selected as the first target. Listing copy, privacy/permission declarations, reviewer instructions, release notes, and store images under `store/` and `store-assets/` must be rechecked against the final rebuilt bilingual package.
- GitHub Issues is the public support/privacy contact. The repository `PRIVACY.md` HTTPS page and its Limited Use statement were publicly verified on 2026-07-11; entering those URLs in the publisher submission remains an owner/store step.
- The repository now records an explicit all-rights-reserved source and original-asset license; third-party licenses remain unchanged.
- Goal 5 opt-in LLM analysis is not included.
- Mobile/SNSLOCK implementation is outside this repository/version.
