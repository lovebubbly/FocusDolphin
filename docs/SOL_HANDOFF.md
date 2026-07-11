# FocusWhale v1.0.0 Handoff

> **Document provenance**
>
> - Product owner and requester: **Choi Yunseong (최윤성)**
> - Prepared and consolidated by: **OpenAI Codex (GPT-5)**
> - Original document created: **2026-07-09 21:11:44 KST**
> - Current release-preparation refresh: **2026-07-11 02:42 KST**
> - Time zone: **Asia/Seoul (UTC+09:00)**
> - Evidence basis: local source, current automated/static gates, exact-final disposable-profile Whale/Chrome-for-Testing runs, and the clean-profile extracted-archive smoke test recorded in `QA.md`
> - Approval caveat: this handoff does not claim product-owner approval, store review, or publication

## Executive State

FocusWhale is now a coherent **v1.0.0 local release candidate**, not merely the original MVP scaffold. The core session/DNR engine, crash recovery, pet settlement, four-mood sprite system, UI surfaces, optional local-history recommendations, privacy controls, and production build verification are implemented.

Automated release gates are green:

- `npm run typecheck`: pass.
- `npm test`: **30 files / 196 tests**, pass.
- `npm run build`: pass.
- Classic content script: **116,276-byte IIFE**.
- Release verifier: exact four web-accessible resources, no source maps, no unexpected external URLs, matching packaged Pretendard license.

The exact final bundle passed isolated Whale 4.38 checks for soft, medium, hard, popup emergency, Options, all 20 pet states, adversarial `x.com.`, both sides of browser-process restart, simultaneous natural/emergency alarms, all protected sync fields, and the next eligible schedule occurrence. Headed Whale additionally passed list-rerender dismissal, blank intent, Options keyboard/modal focus, normal/reduced completion motion, and a 13-state accessibility matrix with 68 contrast checks (minimum 4.94:1), 40 px minimum targets, 19 screenshots, and no page errors. Instrumented exact-build checks replaced the worker at both durable recovery-journal boundaries and held history computation open for five seconds while the due alarm and stale-result generation guard remained responsive. Headed Chrome for Testing 147 accepted the real optional-history prompt, verified domain-only results and extension-URL exclusion, revoked permission, and started a medium session afterward. A clean profile loaded the extracted release archive and fetched the exact content bundle. Visual assertions use local `/tmp` screenshots; no recording or external upload occurred.

The candidate is **not store-published**. The exact current `dist/` is packaged at `release/FocusWhale-1.0.0.zip` (2,694,409 bytes; SHA-256 `241a9863fde194a20d1f0f54dc1a7377bf9314dd40413e5fd1488dab52c97f18`). Its checksum passes; 33 entries / 25 files extract byte-equal to `dist/`; and a clean visible Whale 4.38 profile loaded the extracted copy as extension ID `ejhfobkhmdabjhobogffeineggppeafj`, rendered the popup with no page console errors, and opened the packaged Tailwind CSS/daisyUI/Vite notices. All executable files retain the fully tested candidate fingerprints; the archive adds only the required notice file. The archive token/path/email scan found no findings. Whale Store is selected as the first exact-package target. Listing copy, permission/privacy declarations, reviewer instructions, release notes, and exact-build store images are prepared under `store/` and `store-assets/`. GitHub Issues is the selected support/privacy channel, and the repository `PRIVACY.md` path is the intended policy URL. Public URL verification, owner approval, dashboard upload, review, and publication remain separate gates.

## Evidence Discipline

Use these labels in future updates:

- **HEADLESS EXACT BUILD**: directly exercised in an isolated temporary-profile, headless Whale after rebuilding and loading the exact current `dist/`.
- **HEADED EXACT BUILD**: directly exercised in an isolated temporary-profile, visible Whale or Chrome for Testing after loading the exact current `dist/`.
- **INSTRUMENTED EXACT BUILD**: the exact current bundle ran in a visible disposable profile while CDP supplied deterministic API latency or replaced the worker at a reviewed compiled-code boundary; the repository and bundle were not modified.
- **HEADLESS PRIOR CANDIDATE**: directly exercised headlessly before the final durability/recovery fixes.
- **LIVE PRIOR BUILD**: directly exercised in a visible Whale profile before the latest fixes/rebuild.
- **AUTOMATED CURRENT**: verified by tests/build/static checks on the current tree.
- **EARLIER BASELINE**: earlier browser screenshots/run, useful but not exact-final proof.
- **PENDING**: not yet verified at the required evidence level.

Never convert an automated, prior-build live, or earlier-baseline result into an exact-final claim. The detailed ledger is `QA.md`.

## Product Invariants

These constraints are release-blocking:

- Manifest V3 only: module service worker, DNR, alarms, extension storage.
- No MV2 background page or blocking `webRequest` implementation.
- No automatic intensity escalation.
- No pet death, regression, sickness, punishment, shame, or loss-framed copy.
- Hard mode always keeps the delayed emergency valve.
- Recommendations never automatically change a site list.
- Browsing analysis remains local and domain-level.
- No external transmission of session, intent, pet, or browsing data.
- XP remains contextual rather than a persistent pressure HUD.
- Active-session settings/list/schedule lock is enforced by the service worker, not only by disabled controls.

## Runtime Architecture

```text
popup/options/blocked/content
        |
        | chrome.runtime messages + storage change events
        v
MV3 service worker
  SessionManager mutation queue
  schedule reconcile
  DNR rule compilation/application
  alarm handling
  pet reconciliation/settlement queue
        |
        +-- chrome.storage.sync: settings, lists, schedules, pet state
        +-- chrome.storage.local: activity, stats, analytics, ledgers, journals
        +-- declarativeNetRequest dynamic rules
        +-- chrome.alarms
```

Important ownership rules:

- One background operation queue serializes state-mutating messages, alarms, lifecycle events, sync-storage changes, and tab updates. `SessionManager` additionally owns session, emergency, temp-allow, blocked-attempt, clear, and recovery transactions.
- Pet XP/name/streak/badge mutations run through the service worker's serialized reconciliation path.
- History recommendation results and celebration acknowledgements are written by the service worker, not directly by pages.
- UI pages consume state and send explicit messages; they must not write stale whole-state snapshots over authoritative data.
- Storage listeners keep open popup/options/blocked/content surfaces synchronized with service-worker state.

## Build And Packaging

The production build is intentionally two-stage:

1. `vite.config.ts` empties `dist/` and builds the module service worker plus popup/options/blocked pages.
2. `vite.content.config.ts` appends the content script as one classic IIFE with inline dynamic imports. A manifest content script cannot rely on ESM import syntax.
3. `scripts/verify-build.mjs` waits for build targets and validates:
   - every manifest entry exists;
   - `assets/content.js` has no `import`, `export`, or `import.meta` and is below 500 KB;
   - no `.map` files exist;
   - no unexpected external HTTP(S) URL appears in built JS/CSS/HTML/JSON;
   - the packaged Pretendard OFL exactly matches the source license;
   - web-accessible resources exactly equal the four-file release allowlist.

The four web-accessible resources are:

- `src/pages/blocked/index.html`
- `assets/focuswhale-atlas.png`
- `assets/PretendardVariable.woff2`
- `icons/focuswhale-128.png`

Do not broaden this list with `assets/*` without a reviewed need.

## Session And DNR Behavior

### Activation

Session activation validates the list and input, persists active state, installs DNR/alarms, and rolls back if a later activation step fails. A running session cannot be replaced by another start request.

Intensity upgrade uses the dedicated `UPGRADE_SESSION_INTENSITY` message and preserves the exact original `endsAt`; it cannot silently restart or extend a session.

### Finalization And Recovery

- Expired active state is reconciled on `GET_STATE`, startup, alarms, and other authoritative paths.
- `sessionFinalizationJournal` makes finalization replayable.
- `sessionStatsLedger` credits focus minutes once per session.
- Session logs retain at most 5,000 entries.
- Daily stats retain 400 days.
- If natural completion and emergency/interruption race, the natural deadline wins when it has already elapsed.
- Once a finalization journal records its terminal status, later recovery does not silently promote or replace that status.
- Active state, temporary allows, alarms, and DNR rules are cleared idempotently.
- Expired active state is settled before an idle local-data clear proceeds.
- Popup and Options reconcile authoritative session state before their first pet/celebration/stat snapshot, so a missed alarm cannot hide a just-finalized completion.
- Focus minutes are attributed across local calendar dates when a session crosses midnight.

### Active-Session Lock

Settings, site lists, and schedules are locked while a session is active. Options presents the lock, while a durable sync snapshot and service-worker storage listener reject/revert out-of-band writes. UI mutations are entity-scoped background messages that re-read the latest collection instead of writing stale arrays. Existing site lists are user-owned and defaults are not reinserted after deletion. Exact-final soft/restart checks passed visible lock, reverted settings, runtime mutation rejection, and post-completion unlock; automated coverage spans every protected field and expired-session unlock.

### `x.com` And Safe Return

`x.com` and `twitter.com` are aliases. Redirect rules use regex matching to handle `x.com` reliably and carry only scheme, host, and path into the blocked-page fragment. `sanitizeHttpReturnUrl` accepts only HTTP(S) and removes username, password, query, and fragment before navigation.

Exact-final Whale redirected a synthetic credential-bearing `x.com.` URL, retained its path/trailing hostname dot, stripped credentials/query/fragment, and returned to `about:blank`. Whale's HSTS preload safely upgraded the request to HTTPS before DNR capture. Chrome for Testing passed the exact core DNR flow.

### Medium And Hard Friction

Medium requires a countdown and non-empty intent before a five-minute temporary allow. The request is accepted only for the trusted blocked page, a running medium session, the same session/domain, and a domain still blocked by the current list. A mutation journal durably orders alarm, DNR, session snooze state, allow list, intent log, and daily-stat updates. Intent records are local and capped at 200 entries. Exact-final Whale and Chrome-for-Testing runs committed one allow transaction, expired it, reblocked navigation, recorded one completion, and acknowledged the session and badge panels separately.

Hard has no temporary allow, and upgrading a medium session to hard clears its temporary allows. The valve is available in both the popup and blocked page. Emergency end requires two clicks, waits five minutes, persists/reloads pending state, and allows one unique hard-session request per local week. Duplicate requests for the same pending session are idempotent. Exact-final Whale passed confirmation/cancel, the 300-second deadline, reload restoration, weekly rejection, idempotent repeat, and occurrence suppression after emergency completion.

### Scheduled Occurrence Suppression

Schedule reconciliation passes the exact occurrence boundary into `scheduleWindowEnd`; session `endsAt` uses that timestamp rather than a rounded-up minute duration. When a scheduled session ends early, finalization stores `scheduleId`, `listId`, that exact `windowEnd`, and the ended session ID. Reconciliation refuses to restart the occurrence before the boundary and removes stale suppression afterward. The suppression survives local activity clearing while still active. Exact-final Whale kept the occurrence idle and re-armed reconciliation at the true boundary; tests cover millisecond-offset starts and later-occurrence eligibility.

## Pet And Gamification

The pet is additive and non-regressing.

- XP: `floor(completed minutes * intensity multiplier)`.
- Multipliers: soft `1.0`, medium `1.2`, hard `1.5`.
- Stage thresholds: `0`, `100`, `600`, `2,000`, `6,000` XP.
- Settlement is idempotent per session and recovery-journaled.
- Settlement and reconciliation recovery merge monotonically with newer synced XP, stage, streak, badges, name, focus minutes, and ledger IDs.
- Name writes share the authoritative pet mutation queue.
- Growth events are per-event records plus a capped legacy-compatible view.
- Pending celebrations are read non-destructively and acknowledged by event ID.
- Growth events and acknowledgement records retain at most 500 unique IDs; acknowledgement retries are deduplicated before pruning.

The new atlas is `384 x 1920`, four columns by twenty rows, with eighty validated 96 px frames. It supplies five stages for `idle`, `happy`, `focus`, and `celebrate`. Stage 4 is a star-marked adult; the old clipped crown design is retired. Source sheets are deterministically assembled and recorded in `assets/sprites/atlas-report.json`.

The renderer resolves extension URLs correctly in pages and content-script shadow roots, validates geometry, injects CSS into the correct root, respects reduced motion, and falls back to the packaged icon on load failure. Exact-final popup, blocked, and overlay checks show visible focus pets. The installed-extension matrix rendered all 20 stage/mood combinations, used all 20 atlas rows, and disabled all animations under reduced motion.

See `docs/GAMIFICATION_V2.md` for the detailed contract.

## UI And Accessibility

Production UI uses Tailwind CSS 4, daisyUI 5, local Pretendard Variable, and only the supported light/dark theme pair. Popup, options, blocked page, and overlay share calm neutral themes; the pet carries most character/color.

Key interaction changes:

- Popup countdown updates without full rerender/focus churn.
- Multi-digit custom duration input preserves focus.
- Celebration dismissal waits for explicit acknowledgement and can retry on failure.
- Blocked page reacts to session/emergency storage changes and enforces required intent.
- Options uses WAI-style tab semantics, named dialogs, wrapping, horizontal four-metric summary stats, zero-state bars, 40 px targets, a 720 px content width, and an active-session clock/lock.
- Soft overlay uses compiled shadow-root CSS, focus containment, an inert host body, local font/assets, and state restoration. Exact-final Whale and Chrome-for-Testing runs passed the complete interaction path, extension-local font URL, and computed Pretendard.
- Motion paths include `prefers-reduced-motion` handling.

The archived `mockups/` files are Goal 6 Phase-A references, not the current production DOM specification and not QA evidence.

## Analytics, Privacy, And Deletion

History is optional. Options requests `history` only when the user invokes analysis and provides a revoke control. Analysis rejects non-HTTP(S) history items before domain extraction. Thirty-day metrics call `history.getVisits` for a bounded recent URL sample and count actual in-window timestamps rather than lifetime URL counters. Raw history/visit records remain in memory during analysis; persisted recommendations contain domain/category/visit aggregates, never titles, full paths, queries, or visit timestamps. Computation stays off the session-operation queue so a long scan cannot delay alarms. The final write re-enters the queue, and a mutation generation discards a stale result after a successful local clear. The headed Chrome-for-Testing run passed real grant, controlled domain-only results, extension-URL exclusion, revoke, and post-revoke session start.

FocusWhale has no backend, telemetry, advertising, crash-reporting, or remote AI integration. The current production build contains no unexpected external URLs and packages fonts/assets locally.

Repository documentation was also scanned for machine-specific path leakage; absolute `/Users/...` paths in `docs/SNSLOCK_CORE_CONCEPT_PORT_PLAN.md` were sanitized before the final archive scan.

Options provides `로컬 기록 지우기`. It:

- is rejected while a session is active;
- clears local activity, analytics, intent, growth-log, ledger, temporary-allow, and journal state;
- clears temp rules/alarms as part of the authoritative mutation;
- preserves sync-backed settings, lists, schedules, and pet state;
- preserves current-week emergency usage and any unexpired schedule-occurrence suppression so clear cannot bypass either limit.

The repository privacy policy is `PRIVACY.md`. [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) is the selected support/privacy channel. The intended stable policy URL is `https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md`; public reachability must be verified after the release-preparation commit is pushed.

## Notion Issue Resolution

The full ticket-by-ticket audit is `docs/NOTION_ISSUE_TRIAGE.md`. High-level status:

| Issue | Implementation status | Evidence status |
| --- | --- | --- |
| Rough blocked UI | Redesigned, reactive medium/hard states | Exact-final medium/hard/soft and headed light/dark/contrast pass |
| Refined product feel | Popup/options/blocked/overlay pass implemented | Exact-final 13-state visual matrix; owner review pending |
| Crown sprite defect | Old crown retired; star-marked adult in validated atlas | Exact-final 20-state matrix pass |
| Insufficient animation | Four moods and state motion implemented | Exact-final normal/reduced completion, soft, and pet matrix pass |
| Weak badge meaning | Descriptions, collection context, unlock overview | Exact-final completion/badge panels; owner judgment pending |
| Completion panel reappears | Per-event ack and in-memory clearing fixed | Exact-final acknowledgement/reload/list-rerender pass |
| Pet name does not save | Background-owned serialized save fixed | Exact-final close/reopen/browser-restart pass |
| Pet blank/black | URL/root/validation/fallback fixed | Exact-final popup/blocked/overlay and 20-state matrix pass |
| Alert colors inconsistent | Calmer theme-compatible treatment | Exact-final semantic and 68-check contrast pass |
| Settings vs schedules unclear | Four tabs and `자동 시작` IA | Exact-final layout/validation/lock/keyboard-modal pass |
| History visual effect weak | DOM summaries/loading/results, no black canvas | Exact-final real grant/domain results/revoke/post-revoke pass |
| Mobile version | Intentionally out of scope | Separate project/spec |
| Sprite variety | Four purposeful moods / eighty frames | Exact-final 20-state matrix pass |
| `x.com` not blocked | Alias + regex redirect fix | Exact-final adversarial Whale pass; Chrome-for-Testing core pass |
| Options editable in session | UI and SW lock/revert | Exact-final visible lock/restart/runtime rejection; automated full-field coverage |

## Current QA Boundary

Headless exact-final pass:

- complete soft overlay shadow/font/pet/focus/inert/countdown/continue/back/reduced-motion/completion flow in Whale and Chrome for Testing;
- medium friction, one transaction, sanitized continue, expiry/reblock, completion, and sequential acknowledgement in both browsers;
- hard confirmation/cancel/pending/reload/weekly rejection and scheduled-occurrence suppression in Whale;
- popup emergency valve with exact asset fingerprints and idempotent 300-second deadline;
- Options validation/focus/responsive layout/name/request-denial/zero states plus active lock and mutation rejection;
- 20 pet combinations / 20 atlas rows, adversarial credential-bearing `x.com.`, and true pre-deadline browser-process restart continuity;
- popup multi-digit input (`2 -> 24 -> 240`) and dark idle theme;
- clean-profile extracted-archive load with exact 116,276-byte content bundle.

Headed exact-build pass:

- completion dismissal across list-mode rerender, normal/reduced completion motion, and blank-intent rejection in Whale;
- keyboard tabs plus destructive-modal focus trap/Escape/focus restoration in Options;
- 13 light/dark visual states, 68 contrast checks with a 4.94:1 minimum, all inspected targets at least 40 x 40 px, 19 local screenshots, and no page errors;
- real optional-history prompt, controlled domain-only results, extension-URL exclusion, revoke, and post-revoke medium-session start in Chrome for Testing 147;
- simultaneous natural/emergency alarms, deletion/replacement of all three protected sync collections, and next-eligible schedule recovery in visible Whale;
- restart only after the session was already overdue across three distinct Whale process IDs, plus a second restart proving completion remained exactly once.

Instrumented exact-build pass:

- five-second history callback latency while the due session was first observed complete 23 ms after its deadline; local clear then rejected the stale result without restoring recommendations;
- exact debugger pauses after the durable session-finalization and pet-settlement journal writes, worker-runtime replacement confirmed by new `performance.timeOrigin`, and one log/stats/settlement/growth result with no residual journal, rule, or alarm.

Pending manual/publication states:

- product-owner visual/reward judgment and final release sign-off;
- public policy URL verification, confirmation that the support channel will be monitored, owner approval of the prepared store pack, dashboard upload, review, and publication.

Consumer Google Chrome 148 rejects command-line unpacked-extension loading before FocusWhale runs; Chrome for Testing 147 is the supported disposable-profile cross-check. The browser-chrome optional-permission confirmation passed in the headed channel. These are evidence boundaries, not observed FocusWhale runtime failures.

## Release Handoff Sequence

1. Preserve the reviewed `acb45b6` release-candidate commit and this evidence-only documentation follow-up.
2. Run `npm run typecheck`, `npm test`, and `npm run build` again after any change.
3. Keep every technical evidence row in `QA.md` green if the binary changes.
4. Push the committed `PRIVACY.md`, verify the intended GitHub URL is publicly reachable, and use GitHub Issues as the support/privacy channel.
5. Run a final secret/privacy scan against the exact release diff and archive.
6. Re-verify the current ZIP/checksum and repeat the clean-profile archive load after the release commit if the build changes.
7. Review the prepared `store/` copy and `store-assets/` images against the exact build; do not replace them with simulated product UI.
8. Obtain product-owner release approval and confirmation that GitHub Issues will be monitored.
9. Upload the checksum-verified ZIP to Whale Store, request review, and record its item ID/date/URL. Prepare a separately reviewed browser-neutral manifest build before any Chrome Web Store upload.

Use `RELEASE_CHECKLIST.md` as the operational gate.

## Known Limits

- A user can disable/remove an extension or use another browser/profile; FocusWhale is not an enforcement/security boundary.
- Whale and Chrome can differ despite Chromium compatibility.
- Tailwind 4 automatic source detection can react to Markdown vocabulary. Even documentation-only changes must rerun the production build and compare the artifact; this refresh removed one accidental documentation candidate and restored byte equality with the reviewed ZIP.
- Local free-text intent can contain sensitive user-entered content; the UI cannot prevent that.
- Goal 5 remote/LLM analysis is absent by design and would require explicit opt-in plus a new privacy/security review.
- Mobile/SNSLOCK work belongs in a separate repository/spec because Android permissions and blocking surfaces differ materially from MV3.
- The repository is publicly viewable but all rights are reserved under the top-level `LICENSE`; no open-source license is granted.

## Failure And Recovery Conventions

- Shared message failures use the strict `MessageFailure` shape; callers must branch on the discriminant instead of treating arbitrary response objects as success.
- Generic storage helpers do not blindly replay writes. Multi-key effects use explicit journals, durable ordering, validation, or rollback designed for that mutation.
- Already-open-tab sweeps are fail-soft per tab so one inaccessible or closed tab does not prevent enforcement on the remaining tabs.
- Extension page, content, font, and atlas paths resolve through extension-safe URLs; do not reintroduce host-relative asset paths.

## Successor Guardrails

- Do not replace DNR with MV2 APIs.
- Do not broaden web-accessible resources or add external assets casually.
- Do not move history analysis or intent logs off-device.
- Do not bypass service-worker mutation queues with whole-object UI writes.
- Do not remove the hard emergency valve or its confirmation/weekly limit.
- Do not make pets regress or turn rewards into pressure.
- Do not call the candidate published until the public policy URL, verified-current package, owner approval, store upload, review, and publication URL are recorded.
