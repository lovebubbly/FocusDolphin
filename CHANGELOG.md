# Changelog

Documentation refresh: **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)**, **2026-07-11 01:33 KST**.

All notable FocusWhale changes are documented here. The project has not yet recorded a public store release.

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

### Verification

- Typecheck pass.
- 30 Vitest files / 196 tests pass.
- Two-stage production build pass.
- Classic content script: 116,276 bytes.
- No source maps or unexpected external URLs in the final bundle.
- Exact four-resource WAR allowlist.
- Release ZIP: 2,693,022 bytes, SHA-256 `4d766244997647161b63a6d7f5018970e5ab7df94a99af82cecfd6aa7469af0f`; checksum passes; 32 entries / 24 files extract byte-equal to `dist/`; token/path/email scan has no findings.
- Exact-final Whale 4.38 passes cover soft, medium, hard, popup emergency, Options, all 20 pet states, adversarial `x.com.`, and pre-deadline browser-process restart continuity. Restart after an already-overdue deadline and destructive recovery-journal fault injection remain open.
- Chrome for Testing 147 passes the exact-final soft and medium cross-browser paths.
- Headed Whale exact-build checks pass list-rerender dismissal, blank-intent rejection, Options keyboard/modal focus, normal and reduced completion motion, 13 visual states, 68 contrast checks with a 4.94:1 minimum, 40 px minimum inspected targets, 19 screenshots, and zero page errors.
- Headed Chrome for Testing 147 accepts the real optional-history prompt, renders controlled domain-only results with extension URLs excluded, revokes permission, and starts a medium session afterward.
- The extracted release archive loads in a clean profile under ID `codbhopmpipbogplaofkgndjeoemjbck` and fetches the exact 116,276-byte content script.

### Not Yet Released

- A verified local release ZIP exists; no store submission or publication is recorded.
- GitHub Issues is the selected support/privacy contact. The repository `PRIVACY.md` URL is the intended policy target, but the uncommitted policy is not yet verified as publicly published.
- Goal 5 opt-in LLM analysis is not included.
- Mobile/SNSLOCK implementation is outside this repository/version.
