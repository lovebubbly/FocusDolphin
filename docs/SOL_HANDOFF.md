# Focus Dolphin v1.0.0 Handoff

> **Goal 8 and rename supersession notice (2026-07-12 KST):** this document preserves the Goal 7/Goal 8 architecture and release-preparation baseline. `FocusWhale` was the unreleased development codename; **Focus Dolphin — Website Blocker** is the selected public identity. Exact frozen-bundle whale evidence and all pre-rename ZIPs/screenshots remain historical and must not be relabeled. For current operational gates, use [../QA.md](../QA.md), [../RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md), and [LICENSE_AND_IP_AUDIT_2026-07-12.md](LICENSE_AND_IP_AUDIT_2026-07-12.md).

> **Document provenance**
>
> - Product owner and requester: **Choi Yunseong (최윤성)**
> - Prepared and consolidated by: **OpenAI Codex (GPT-5)**
> - Original document created: **2026-07-09 21:11:44 KST**
> - Current release-preparation refresh: **2026-07-11 12:15 KST**
> - Time zone: **Asia/Seoul (UTC+09:00)**
> - Evidence basis: local source, current automated/static gates, current headed disposable-profile Whale locale/lifecycle checks, and the pre-Goal-7 `acb45b6` browser/recovery baseline recorded in `QA.md`
> - Approval caveat: this handoff does not claim product-owner approval, store review, or publication

## Executive State

Focus Dolphin is now a coherent **v1.0.0 local release candidate**, not merely the original MVP scaffold. The core session/DNR engine, crash recovery, pet settlement, four-mood sprite system, UI surfaces, optional local-history recommendations, privacy controls, install-only onboarding, Korean/English localization, and production build verification are implemented.

The following automated results belong to the last pre-rename candidate and remain regression evidence, not proof of the integrated Focus Dolphin package:

- `npm run typecheck`: pass.
- `npm test`: **34 Vitest files / 259 application tests plus the then-current release-package boundary tests**, pass.
- `npm run build`: pass.
- Classic content script: **203,956-byte IIFE**, SHA-256 `123c8ef35b632bb6b1ce590947924ced97673ad85e386824fca53ae33b3b0306`.
- Release verifier: 11 required manifest/onboarding/locale targets, English localized-manifest defaults, exact four web-accessible resources, no source maps, no unexpected external URLs, and matching packaged Pretendard license.

Commit `acb45b6` remains the exact pre-Goal-7 executable baseline for the recorded soft/medium/hard, recovery, DNR, pet, accessibility, and optional-history browser matrix. Those checks support unchanged core design, but they are not exact-current proof for the bilingual build.

On the pre-rename Goal 8 follow-up build, disposable-profile Whale and Chrome-for-Testing checks covered onboarding, popup, Options, blocked, overlay, light/dark, reduced motion, localization, session completion, DNR, recovery, and active-session locking. That candidate also added exact duration entry, a user-selected language preference, high-density mascot rendering, semantic motion, prominent bilingual first-run data disclosure, and an isolated-memory fix for soft-overlay temporary access. Reuse those results only as regression context until the integrated Focus Dolphin archive repeats the name/mascot-bearing paths.

The old Playwright-launched Whale alarm stall is retained only as historical Goal 7 evidence. Later visible Goal 8 automation completed real session starts, alarms, blocking, completion, reward acknowledgement, and restart/recovery paths. Exact-package QA must still be repeated after the Focus Dolphin commit and ZIP are fixed.

The candidate is **not store-published**. The integrated Focus Dolphin source now passes build, typecheck, 264 application tests, 9 package tests, 542-key locale parity, dependency audit, sensitive-data scan, deterministic asset checks, and a working-tree package rehearsal. Chrome Web Store and Whale Store are both targets. The exact `FocusWhale` collision was resolved by selecting Focus Dolphin before publication, and the owner accepted the documented conditional-go risk after correction of the irrelevant Apple metadata. The selected-commit rebuild, `lovebubbly/FocusDolphin` GitHub rename, both store dashboard renames, exact-package QA, fresh screenshots, and submission remain open. See `docs/LICENSE_AND_IP_AUDIT_2026-07-12.md` and `RELEASE_CHECKLIST.md`.

## Evidence Discipline

Use these labels in future updates:

- **HEADLESS EXACT BUILD**: directly exercised in an isolated temporary-profile, headless Whale after rebuilding and loading the exact current `dist/`.
- **HEADED EXACT BUILD**: directly exercised in an isolated temporary-profile, visible Whale or Chrome for Testing after loading the exact current `dist/`.
- **INSTRUMENTED EXACT BUILD**: the exact current bundle ran in a visible disposable profile while CDP supplied deterministic API latency or replaced the worker at a reviewed compiled-code boundary; the repository and bundle were not modified.
- **HEADLESS PRIOR CANDIDATE**: directly exercised headlessly before the final durability/recovery fixes.
- **LIVE PRIOR BUILD**: directly exercised in a visible Whale profile before the latest fixes/rebuild.
- **AUTOMATED CURRENT**: verified by tests/build/static checks on the current tree.
- **EARLIER BASELINE**: earlier browser screenshots/run, useful but not exact-final proof.
- **HARNESS-LIMITED**: an automation environment cannot complete a platform API path, and the exact baseline reproduces the same boundary. This is neither a product regression finding nor a normal-browser pass.
- **PENDING**: not yet verified at the required evidence level.

Never convert an automated, prior-build live, or earlier-baseline result into an exact-final claim. `QA.md` is the detailed historical browser ledger; the current Goal 7 locale/lifecycle checks are summarized in this handoff pending ledger consolidation.

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
onboarding/popup/options/blocked/content
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
        +-- chrome.storage.local: activity, stats, analytics, onboarding, ledgers, journals
        +-- declarativeNetRequest dynamic rules
        +-- chrome.alarms
```

Important ownership rules:

- One background operation queue serializes state-mutating messages, alarms, lifecycle events, sync-storage changes, and tab updates. `SessionManager` additionally owns session, emergency, temp-allow, blocked-attempt, clear, and recovery transactions.
- Pet XP/name/streak/badge mutations run through the service worker's serialized reconciliation path.
- History recommendation results and celebration acknowledgements are written by the service worker, not directly by pages.
- UI pages consume state and send explicit messages; they must not write stale whole-state snapshots over authoritative data.
- Storage listeners keep open popup/options/blocked/content surfaces synchronized with service-worker state.
- All product-authored surface copy routes through the shared Korean/English translator; user-authored values remain data, not translation keys.

## Build And Packaging

The production build is intentionally two-stage:

1. `vite.config.ts` empties `dist/` and builds the module service worker plus popup/options/blocked pages.
2. `vite.content.config.ts` appends the content script as one classic IIFE with inline dynamic imports. A manifest content script cannot rely on ESM import syntax.
3. `scripts/verify-build.mjs` waits for build targets and validates:
   - every manifest entry exists;
   - the onboarding page and both locale catalogs exist;
   - manifest name/description use localized message keys and `default_locale` is English;
   - `assets/content.js` has no `import`, `export`, or `import.meta` and is below 500 KB;
   - no `.map` files exist;
   - no unexpected external HTTP(S) URL appears in built JS/CSS/HTML/JSON;
   - the packaged Pretendard OFL exactly matches the source license;
   - web-accessible resources exactly equal the four-file release allowlist.

The four web-accessible resources are:

- `src/pages/blocked/index.html`
- `assets/focusdolphin-atlas.png`
- `assets/PretendardVariable.woff2`
- `icons/focusdolphin-128.png`

Do not broaden this list with `assets/*` without a reviewed need.

The DNR adapter reads currently installed dynamic rules before removal, intersects requested removal IDs with rules that exist, and skips `updateDynamicRules` when both the filtered removal set and addition set are empty. This no-op hardening stays inside the browser adapter; it does not change compilation, matching, rule IDs, or session ownership.

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

The runtime atlas is `768 x 3840`, four columns by twenty rows, with eighty validated 192 px source frames. It supplies five stages for `idle`, `happy`, `focus`, and `celebrate` while keeping 96/128/160 CSS px render sizes. Stage 4 is a star-marked adult; the old clipped crown design is retired. Source sheets are deterministically assembled and recorded in `assets/sprites/atlas-report.json`.

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

## Onboarding And Localization

Onboarding is a three-step, install-only experience:

1. Introduce the local-first, non-punitive companion model.
2. Select and optionally edit a focus list; domains are normalized before the existing background mutation is requested.
3. Choose an explicit intensity for an optional 25-minute first session. The default is `soft`; no intensity is raised automatically.

The user may skip, finish setup without a session, or explicitly start the session. Completion is stored in `chrome.storage.local` as `focuswhaleOnboarding` with schema version `1`, `completedAt`, and outcome `skipped`, `setup_only`, or `session_started`. That key intentionally retains the unreleased development codename for compatibility. Automatic opening is limited to `runtime.onInstalled` reason `install` and a missing valid current-version record. Updates and browser startups do not open it. Options can open `?replay=1` intentionally. Onboarding does not request optional history permission.

The English and Korean locale catalogs must retain matching keys and placeholders. Manifest name, description, and action title use `__MSG_*__`; English is the manifest fallback. Popup, Options, blocked page, soft overlay, onboarding, pet stages, badges, growth copy, product defaults, validation, and runtime errors use the shared translator. Korean UI-language tags select Korean; other/unsupported tags select English. If Whale's requested UI language and `@@ui_locale` runtime catalog disagree, the bundled catalog matching the requested language is used. Product defaults are localized, while user-authored pet/list names, domains, schedules, and intent text remain verbatim. Record the final post-rename catalog count only after the full suite runs.

## Analytics, Privacy, And Deletion

History is optional. Options requests `history` only when the user invokes analysis and provides a revoke control; onboarding never requests it. Analysis rejects non-HTTP(S) history items before domain extraction. Thirty-day metrics call `history.getVisits` for a bounded recent URL sample and count actual in-window timestamps rather than lifetime URL counters. Raw history/visit records remain in memory during analysis; persisted recommendations contain domain/category/visit aggregates, never titles, full paths, queries, or visit timestamps. Computation stays off the session-operation queue so a long scan cannot delay alarms. The final write re-enters the queue, and a mutation generation discards a stale result after a successful local clear. The pre-Goal-7 headed Chrome-for-Testing baseline passed real grant, controlled domain-only results, extension-URL exclusion, revoke, and post-revoke session start.

Focus Dolphin has no backend, telemetry, advertising, crash-reporting, or remote AI integration. The production build packages fonts/assets locally and its exact renamed output must repeat the external-URL verifier before release.

Repository documentation was also scanned for machine-specific path leakage; absolute `/Users/...` paths in `docs/SNSLOCK_CORE_CONCEPT_PORT_PLAN.md` were sanitized before the final archive scan.

Options provides a localized local-data clear action. It:

- is rejected while a session is active;
- clears local activity, analytics, intent, growth-log, ledger, temporary-allow, journal, and onboarding-completion state;
- clears temp rules/alarms as part of the authoritative mutation;
- preserves sync-backed settings, lists, schedules, and pet state;
- preserves current-week emergency usage and any unexpired schedule-occurrence suppression so clear cannot bypass either limit.

Clearing the onboarding record does not fire a new install event, so it does not reopen the flow by itself. Options replay remains available.

The repository privacy policy is `PRIVACY.md`. The intended public support channel is [Focus Dolphin GitHub Issues](https://github.com/lovebubbly/FocusDolphin/issues), and the intended policy URL is `https://github.com/lovebubbly/FocusDolphin/blob/main/PRIVACY.md`. The former FocusWhale URLs and Limited Use statement were publicly verified on 2026-07-11; the repository/remote rename and verification of the new URLs remain pending.

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

Automated pre-rename baseline, verified 2026-07-12 KST:

- typecheck, 34 Vitest files / 259 application tests, the then-current release-package boundary tests, and the two-stage production build pass;
- 541-key Korean/English catalog parity, declared placeholders, manifest localization, computed-key families, and referenced-key coverage pass;
- verifier confirms 11 required manifest/onboarding/locale targets, four exact WAR entries, a 203,956-byte classic content script, no source maps, no root-relative asset URLs, no unexpected external URLs, and exact Pretendard licensing;
- live full dependency audit reports zero vulnerabilities;
- the generated mascot sources, transparent intermediates, final atlas, icons, and promotional tile have recorded hashes and deterministic generation paths.

Pre-rename exact unpacked-build evidence:

- visible disposable-profile Goal 8 suites exercised English/Korean onboarding, popup, Options, blocked, overlay, true hard completion, milestone batching, DNR, recovery, active-session locking, accessibility, contrast, keyboard use, and reduced motion;
- isolated Whale 4.38 and Chrome for Testing 147 load the current production extension without console, page, request, or worker errors;
- the normal user browser profile was not modified by isolated QA;
- use `QA.md` for exact browser/profile/fingerprint details and keep direct-page, unpacked-build, extracted-ZIP, and store-installed evidence distinct.

Pending publication states:

- record final confusing-similarity risk acceptance for Focus Dolphin; the knock-out screen is not legal clearance;
- commit and push the selected source, rename the GitHub repository/remote to `lovebubbly/FocusDolphin`, then verify the intended Issues and privacy URLs;
- update the Chrome Web Store and Whale Store dashboard names independently;
- build a clean exact bilingual ZIP, record checksum/entry count, compare its extracted tree with reviewed `dist/`, and repeat dependency/license/secret scans;
- run critical-flow smoke from that exact extracted package in Whale and Chrome;
- capture four current English and four current Korean 1280 x 800 screenshots without personal data;
- complete independent Chrome Web Store and Whale Store metadata, owner confirmation at the final submit actions, review, and publication records.

## Release Handoff Sequence

1. Treat **Focus Dolphin — Website Blocker** as the selected public name and keep `FocusWhale` only in compatibility identifiers and truthful historical labels.
2. Run `npm run typecheck`, `npm test`, and `npm run build` after integration; commit and push the selected candidate.
3. Rename the GitHub repository/remote to `lovebubbly/FocusDolphin`, then verify the public `PRIVACY.md` URL and GitHub Issues support channel.
4. Build the release ZIP in a clean checkout, record its checksum and entries, prove its extracted tree equals `dist/`, and repeat full dependency/license/secret scans.
5. Load that extracted package in disposable Whale and Chrome profiles and repeat the critical session, blocking, overlay, completion, language, and active-session-lock journeys.
6. Capture and checksum four current English plus four current Korean store screenshots from the exact package.
7. Review the bilingual `store/` copy, declarations, icon, promotional tile, and screenshots against the exact package.
8. Complete both publisher dashboards up to the final submit action and obtain action-time product-owner confirmation.
9. Submit independently to Chrome Web Store and Whale Store, then record both item IDs, dates, review feedback, approval states, and publication URLs.

Use `RELEASE_CHECKLIST.md` as the operational gate.

## Known Limits

- A user can disable/remove an extension or use another browser/profile; Focus Dolphin is not an enforcement/security boundary.
- Whale and Chrome can differ despite Chromium compatibility.
- Tailwind automatic discovery is disabled with `source(none)`; explicit `@source` directives cover production page, content, and pet code. Preserve that boundary or add new production directories explicitly so documentation prose cannot alter executable CSS.
- Playwright-launched Whale 4.38 currently stalls at `chrome.alarms.create`, including on exact baseline `acb45b6`. Keep this separate from normal-browser product behavior.
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
- Do not request optional history permission during onboarding.
- Do not translate or rewrite user-authored pet/list names, domains, schedules, or intent text.
- Keep Korean/English catalogs in key and placeholder parity, and preserve English fallback for unsupported locales.
- Do not bypass service-worker mutation queues with whole-object UI writes.
- Do not remove the hard emergency valve or its confirmation/weekly limit.
- Do not make pets regress or turn rewards into pressure.
- Do not call the candidate published until the public policy URL, verified-current package, owner approval, store upload, review, and publication URL are recorded.
