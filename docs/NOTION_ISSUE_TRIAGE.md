# FocusWhale Notion Issue Triage

> **Provenance and scope**
>
> - Source issue page: `FocusWhale 문제점` (`396e729950038016a240f746102a6982`)
> - Product owner: **Choi Yunseong (최윤성)**
> - Prepared by: **OpenAI Codex, GPT-5 coding agent**
> - Original triage: **2026-07-09 21:14:34 KST**
> - Current release-candidate refresh: **2026-07-11 01:33 KST**
> - This document records repository evidence; it does not claim that the Notion page was edited, that the owner approved the result, or that a store release exists

## Status Vocabulary

- **Implemented**: code exists in the current working tree.
- **Automated pass**: typecheck/test/build or targeted validation covers the behavior.
- **Live exact pass**: exercised in Whale after rebuilding and loading the exact current `dist/`.
- **Live prior-candidate pass**: exercised in Whale before the final durability fixes and rebuild.
- **Pending live**: not re-run against the exact final binary.
- **Deferred**: intentionally outside v1.0.0.

Automated baseline: typecheck pass, build/verification pass, 30 test files / 196 tests pass. The classic content IIFE is 116,276 bytes. Core issue paths have exact-build Whale evidence; headed Whale and Chrome-for-Testing checks now cover the previously open usability, accessibility, and real optional-history paths. Remaining recovery and publication boundaries are explicit below and in `QA.md`.

## Resolution Table

| # | Reported issue | Implementation | Evidence | Remaining decision/action |
| ---: | --- | --- | --- | --- |
| 1 | Blocked UI feels rough | Implemented | Exact-final medium/hard/soft plus headed light/dark/contrast passes | Owner review only |
| 2 | Cute but needs refined product feel | Implemented across primary surfaces | Headed exact 13-state visual matrix | Product-owner approval |
| 3 | Crown whale sprite error | Old crown retired; star-marked adult atlas | Exact-final 20-state matrix | None in implementation; owner review only |
| 4 | Animation is insufficient | Four moods plus purposeful state transitions | Exact-final soft/pet and headed normal/reduced completion passes | Owner review only |
| 5 | Badges lack meaning/discoverability | Descriptions, collection context, unlock overview | Exact-final sequential completion/badge panels | Subjective owner review |
| 6 | Completion panel reappears after toggle | Explicit per-event acknowledgement and local model clearing | Headed exact acknowledgement/reload/list-rerender pass | None |
| 7 | Pet name does not save | Background-owned serialized name mutation | Exact-final close/reopen/browser-restart pass | None |
| 8 | Pet becomes a black box or disappears | Extension URL, shadow-root CSS, geometry validation, fallback | Exact-final popup/blocked/overlay and 20-state matrix | Fallback failure path remains automated |
| 9 | Alert colors feel inconsistent | Calm theme-compatible information/pending styles | Headed exact semantic/light/dark matrix; 68 contrast checks, minimum 4.94:1 | Owner review only |
| 10 | Options settings vs schedules are unclear | Four top-level tabs; explicit `자동 시작` | Headed exact layout/validation/lock/keyboard/modal-focus pass | None |
| 11 | History analysis lacks visual effect | DOM loading/result/weekly summaries; black Canvas removed | Headed exact real grant/domain results/revoke/post-revoke pass | None |
| 12 | Mobile version is weak | Deferred | Out of scope | Separate Android/SNSLOCK plan |
| 13 | Sprite variety is missing | Four moods, five stages, eighty frames | Exact-final 20-state matrix | None |
| 14 | `x.com` does not block | Alias expansion and regex DNR redirect | Exact-final adversarial Whale pass; Chrome for Testing core pass | Consumer Chrome installed-profile spot check only |
| 15 | Options remains editable during a session | UI lock plus SW snapshot/revert | Exact-final visible lock/restart/runtime rejection | Full protected-field manual spot check |

## 1. Blocked UI

**Resolution: implemented, automated, and exact-final headless passed.**

The blocked surface is one centered, bounded card with pet, domain, remaining time, and one state-dependent action region. Exact-final medium passed its countdown, intent transaction, temporary allow, expiry/reblock, and deterministic exit. Hard mode passed the neutral return action, separate emergency action, confirmation/cancel, persisted pending countdown, weekly rejection, and scheduled-occurrence suppression; the popup valve also passed independently.

Headed exact-build acceptance passed the light/dark states, keyboard path, minimum target sizing, measured contrast, and overlap checks. Product-owner visual judgment remains separate.

## 2. Refined Product Feel

**Resolution: implemented direction; owner approval pending.**

Tailwind/daisyUI tokens now carry ordinary UI, while pet artwork supplies most personality. Buttons/chips use calmer borders and shadows, options avoids oversized repeated cards, popup has one primary CTA, and the hero/pet area is the controlled decorative exception.

The remaining question is subjective: whether the owner considers the composition sufficiently refined. Documentation cannot substitute for that approval.

## 3. Crown Sprite Defect

**Resolution: source defect removed.**

The previous crown treatment was clipped/inconsistent and is no longer the stage-4 contract. The regenerated stage-4 adult uses attached star markings. The deterministic assembler produced a 384 x 1,920 atlas with 80 validated frames and safe geometry; `atlas-report.json` records metrics and hash evidence.

The exact-final installed-extension matrix inspected every stage-4 mood; the star adult remained centered and unclipped, and reduced motion disabled animation.

## 4. Animation

**Resolution: purposeful motion implemented; core exact-final motion passed.**

The pet now has `idle`, `happy`, `focus`, and `celebrate` moods. Popup completion, blocked state transitions, countdowns, options results, and progress use state-driven motion. Reduced-motion branches exist to skip nonessential transitions.

Headed Whale passed normal completion animation and reduced-motion final-state rendering; the existing exact overlay and 20-state pet checks cover the other purposeful motion surfaces.

## 5. Badge Meaning

**Resolution: implementation complete; value judgment pending.**

Badge IDs remain stable and additive-only. User-facing descriptions explain meaning; newly earned badges appear in the post-session milestone context; growth details present collection/progress without shame or loss framing.

Exact-final completion and separate badge panels pass. Owner judgment on whether the reward feels meaningful without pressure remains pending.

## 6. Completion Panel Reappears

**Resolution: race fixed; exact-final acknowledgement/reload/list-rerender passed.**

The popup reads celebrations non-destructively, clears its visible model before rerender, awaits acknowledgement, and acknowledges only displayed event IDs. Per-event `pendingCelebration:` and `celebrationAck:` records prevent a whole-array read/modify/write race and preserve newly appended events.

Headed Whale completed the acceptance path: complete one session, dismiss, change list mode, rerender/reopen, and verify that the old overview does not return and XP remains single-award.

## 7. Pet Name Persistence

**Resolution: stale-write root cause fixed; exact-final browser-restart proof passed.**

Popup/options send `SET_PET_NAME`; the service worker serializes it with other pet mutations. Normalization preserves bounded names, and name updates retain XP/stage/streak/badges.

The exact-final restart harness preserved the same name, session identity, deadline, rules, and alarm across a real browser process change without progress loss.

## 8. Black Box / Missing Pet

**Resolution: renderer and packaging hardened.**

The renderer resolves packaged asset URLs with `chrome.runtime.getURL`, injects CSS into the actual document/shadow root, validates manifest bounds and atlas dimensions, preloads the image, exposes diagnostics, and falls back to the packaged icon. The manifest exposes only the exact required atlas/font/icon/page resources.

Visible focus pets passed exact-final popup, blocked, and overlay states. The installed-extension matrix rendered all 20 stage/mood combinations with no page errors; fallback behavior remains covered by automated tests.

## 9. Alert Colors

**Resolution: calmer semantics implemented; theme matrix passed.**

Informational and pending states use soft theme-compatible treatments. Strong error styling is reserved for failures or confirmed destructive/emergency actions. Raw release colors remain in theme definitions rather than scattered markup CSS.

Headed Whale passed 13 light/dark states, 68 measured contrast checks with a 4.94:1 minimum, at-least-40-px inspected targets, 19 local screenshots, and no page errors.

## 10. Options Information Architecture

**Resolution: implemented.**

Options separates `기록`, `차단 규칙`, `자동 시작`, and `고래 성장`. Lists/schedules use compact rows and confirmation where destructive. Privacy controls sit with local-data/history behavior. WAI tab roles and keyboard navigation are implemented.

Exact-final Options checks passed narrow responsive layout, form validation/focus, dependent-list protection, horizontal summary stats, visible active-session lock, name close/reopen persistence, and runtime mutation rejection after restart. Headed Whale also passed tab keyboard semantics plus destructive-modal focus trap, Escape close, and focus restoration to the invoking control.

## 11. History Analysis Visuals

**Resolution: black-canvas cause removed; real permission lifecycle and results pass.**

The old Canvas path was replaced with DOM summaries and bars, plus loading/error/success states. Recommendations remain compact domain/category/visit rows with explicit manual block action. `history` is optional and requested only when the user starts analysis. Non-HTTP(S) items are rejected before domain extraction.

Headed Chrome for Testing 147 accepted the real browser prompt, rendered controlled domain-only results without extension URLs, revoked permission, and then started a medium session successfully.

## 12. Mobile

**Resolution: deferred by architecture, not forgotten.**

Android/SNSLOCK needs a separate repository/thread and a new permission model around UsageStats/Digital Wellbeing/Accessibility. Reusing FocusWhale product principles and gamification is appropriate; mixing Android implementation into the MV3 repository is not.

## 13. Sprite Variety

**Resolution: implemented.**

The five stages now have four purposeful moods:

- `idle`: resting/default surfaces;
- `happy`: positive growth/detail moments;
- `focus`: active session, blocked page, and overlay;
- `celebrate`: completion and milestone moments.

The manifest has twenty rows and eighty frames. Every mood is used by a product state, avoiding decorative asset expansion without purpose.

## 14. `x.com` Blocking

**Resolution: implemented/automated; exact-final Whale pass.**

`x.com` and `twitter.com` expand as aliases. Regex DNR matching handles main-frame navigation, including paths and a trailing hostname dot. Exact-final Whale redirected a synthetic credential-bearing `x.com.` URL, preserved the path/dot, stripped credentials/query/fragment, and returned to `about:blank`; HSTS safely upgraded the request to HTTPS. Chrome for Testing passed the exact-final core DNR path.

## 15. Options During Active Session

**Resolution: visible lock and restart enforcement exact-final passed.**

Options displays the lock, but the security/behavioral contract is background-owned: a stored snapshot of protected sync fields allows the service worker to reject and revert changes while a session is active. Exact-final soft/restart checks confirmed visible lock, a reverted out-of-band settings change, runtime mutation rejection, and unlock after completion; tests cover every protected field and expired-session unlock.

## Additional Reliability Work

The polish pass also closed issues that were not purely visual:

- activation rollback on DNR/alarm/storage failure;
- exact-end-time intensity upgrade;
- expired-session reconciliation on state reads;
- replayable session finalization and pet settlement journals;
- per-session idempotent stats and XP ledgers;
- serialized blocked-attempt increments;
- hard-emergency session binding/idempotence;
- natural completion precedence over late emergency/interruption;
- local-data clear blocked during active sessions;
- global service-worker serialization across state-mutating messages, alarms, lifecycle events, storage changes, and tab updates;
- background-owned history-result and celebration-acknowledgement writes;
- actual 30-day visit metrics from `history.getVisits` timestamps;
- off-queue history computation plus a queued generation-guarded commit, so scans do not delay alarms and a successful clear invalidates stale results;
- journaled and session/domain/mode-validated temporary allows;
- temporary-allow removal on hard upgrade;
- durable expiry/finalization ordering and fixed terminal-status recovery;
- expired-session settlement before local clearing;
- preserved weekly emergency allowance and active schedule suppression across local clear;
- exact schedule-window deadline propagation and occurrence suppression after emergency/early end;
- credential-safe DNR redirects, content return paths, extension-safe font/atlas URLs, and fail-soft tab sweeps;
- strict message-failure typing and removal of unsafe generic write retries;
- two-stage classic content-script build and release verifier;
- authoritative initial-state reconciliation before popup/options snapshots;
- entity-scoped serialized configuration mutations and preservation of user-edited default lists;
- monotonic XP/reconciliation journal replay and deduplicated celebration-ack pruning;
- minute-precise focus-window scoring and cross-midnight daily-stat attribution;
- retried recovery alarms after transient schedule-boundary creation failures.

## Done Boundary

Implementation/automated work is at release-candidate level, but publication is not done until:

- every blocking pending row in `QA.md` is run on the latest rebuilt binary;
- the reconciled privacy policy is committed and verified at its intended public URL; GitHub Issues is the selected contact channel;
- final secret/privacy/archive scans pass;
- the existing release ZIP is loaded in a clean profile and listing/reviewer materials are prepared and tested;
- product owner explicitly approves release.

The operational list is `RELEASE_CHECKLIST.md`.
