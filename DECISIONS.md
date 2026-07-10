# FocusWhale Decisions

Last refreshed: **2026-07-11 01:33 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

This file records durable choices that are easy to accidentally undo. New undocumented choices should be added here with rationale.

## D-001: Local-First, Non-Punitive Product

**Decision:** No external browsing/session telemetry, automatic intensity escalation, pet regression/death, shame copy, or removal of the hard emergency valve.

**Why:** These are core wellness and privacy constraints, not optional UI preferences.

## D-002: Manifest V3 And DNR

**Decision:** Use an MV3 module service worker, `declarativeNetRequest`, alarms, and extension storage. Do not add MV2 background pages or blocking `webRequest`.

**Why:** Required platform architecture and least-surprise browser behavior.

## D-003: Serialized Background Ownership

**Decision:** State-mutating background entry points (messages, alarms, startup/install, sync-storage changes, and tab updates) pass through one service-worker operation queue. History computation runs outside that queue so a long scan cannot delay a session alarm; its final write re-enters the queue and a mutation generation rejects the result if a successful local clear occurred meanwhile. Session, history-result, celebration-acknowledgement, and pet mutations are background-owned. UI surfaces send messages and consume state; they do not overwrite authoritative whole-object snapshots.

**Why:** MV3 workers suspend/restart and multiple pages can write concurrently. Queues, idempotent ledgers, and journals prevent stale writes and duplicate rewards.

## D-004: Safe DNR Return URL

**Decision:** Redirects preserve only HTTP(S) scheme, host, and path. Userinfo, query, and fragment are removed; invalid/missing targets fall back to deterministic `about:blank` return-to-focus behavior.

**Why:** Avoid persisting/leaking sensitive query/fragment data and avoid unreliable tab-history guesses.

## D-005: `x.com` / `twitter.com` Alias

**Decision:** Treat `x.com` and `twitter.com` as aliases and use regex DNR matching where required.

**Why:** Chromium/Whale behavior showed `x.com` was not reliably covered by the previous domain-only path. The exact-final headless Whale run redirected a synthetic credential-bearing `x.com.` target, preserved the trailing dot/path, stripped sensitive return components, and returned to `about:blank`; Whale's HSTS preload safely upgraded HTTP to HTTPS before DNR capture.

## D-006: Two-Stage Production Build

**Decision:** Build extension pages/service worker with `vite.config.ts`, then append the manifest content script as a single IIFE with `vite.content.config.ts`.

**Why:** Manifest content scripts are classic scripts and cannot execute ESM imports. The separate build also avoids weakening the module service-worker/page architecture.

## D-007: Exact WAR Allowlist

**Decision:** Expose exactly the blocked page, atlas, Pretendard font, and 128 px fallback icon to HTTP(S) pages.

**Why:** The soft overlay needs these assets; a broad `assets/*` surface is unnecessary.

## D-008: Optional History

**Decision:** `history` is optional and requested only when the user starts recommendation analysis. Persist domain aggregates only; never auto-block recommendations.

**Why:** Core focus features do not need browsing history, and raw URL/title/timestamp retention would violate data minimization.

## D-009: Storage And Deletion

**Decision:** Sync settings/lists/schedules/pet state; keep activity/analytics/journals local. Provide history revoke and local-data clear in Options. Reject local clear while a session is active and preserve sync-backed data, the current week's emergency-use allowance, and any unexpired schedule-occurrence suppression.

**Why:** Clearing active state/rules mid-session would bypass the selected commitment. Clearing weekly emergency usage or current-occurrence suppression would create a second bypass. Sync-backed configuration/progress is a separate deletion domain.

## D-010: Bounded Retention

**Decision:** Cap session logs/settlement ledgers at 5,000, intent entries at 200, daily stats at 400 days, and growth/ack records at 500. Remove temporary/recovery records after expiry/completion.

**Why:** Local-first does not mean unbounded retention.

## D-011: Four-Mood Star Whale Atlas

**Decision:** Use a deterministic 384 x 1,920 atlas with five stages and four moods (`idle`, `happy`, `focus`, `celebrate`). Stage 4 uses attached star markings; the crown design is retired.

**Why:** The old crown frames clipped and the two-mood atlas lacked purposeful product states. Deterministic assembly provides repeatable geometry and validation.

## D-012: Archived Mockups

**Decision:** Keep `mockups/` as Goal 6 Phase-A references, not as the current production DOM contract.

**Why:** Production interaction/state/accessibility work has evolved while preserving the approved visual direction.

## D-013: Evidence Levels

**Decision:** Distinguish isolated headed exact-build, headless exact-build, headless prior-candidate, visible-profile prior-build, automated current, earlier-baseline, and pending evidence in release docs. Record browser/profile, exact artifact boundary, and approval boundary with each run.

**Why:** Browser-extension behavior cannot be declared exact-final verified solely from unit tests or screenshots of an older build. Even a one-line post-run change makes the earlier binary a prior candidate rather than exact, and a headless temporary-profile result must not be presented as a normal-profile manual run.

## D-014: Publication Is A Separate Gate

**Decision:** Version 1.0.0 in source/manifest does not mean publicly released. Publication requires the exact-final browser matrix, a verified public policy URL, store support metadata, a verified current archive, listing/reviewer material, scans, and owner approval.

**Why:** Prevent accidental store-ready claims and undocumented release artifacts.

## D-015: Suppress An Aborted Scheduled Occurrence

**Decision:** Pass the exact schedule-window end into the created session rather than reconstructing it from a rounded-up duration. When a scheduled session ends early, record the schedule ID, list ID, exact occurrence end, and session ID. Reconciliation must not restart that occurrence before its exact window end; later occurrences remain eligible.

**Why:** The prior-build hard-mode run showed that immediately reconciling a still-active schedule could undo the emergency end by starting a replacement session. Exact deadline propagation also prevents a millisecond start offset plus minute rounding from extending suppression/session time beyond the true boundary.

## D-016: Use Actual Visit Timestamps

**Decision:** Thirty-day recommendation metrics enumerate `history.getVisits` records for the bounded URL sample and count only visits whose timestamps fall inside the analysis window. Do not use lifetime `HistoryItem.visitCount` values as 30-day measurements.

**Why:** Lifetime counters can materially overstate recent behavior and cannot support focus-hour ratios for a bounded period.

## D-017: Explicit Recovery, Not Blanket Write Replay

**Decision:** Storage helpers do not indiscriminately retry writes. Multi-key mutations use operation-specific journals, validation, durable ordering, or rollback where their semantics are known. Message failures use the strict shared failure contract.

**Why:** Blindly replaying a non-idempotent write can duplicate effects or hide partial failure. Recovery must be designed around each transaction.

## D-018: Repository Support And Policy Target

**Decision:** Use [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) as the support/privacy contact channel. Use `https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md` as the intended stable policy URL only after the policy is committed and publicly reachable.

**Why:** This provides one centralized repository channel and a stable, reviewable policy target without claiming that an uncommitted working-tree file is already published.

## D-019: Two Production Themes

**Decision:** Support only the default light theme and `focuswhale-dark` in the production extension. Retired color variants are not part of the release surface.

**Why:** A light/dark pair keeps the visual system, contrast review, and browser QA bounded while preserving the neutral UI and pet-led color hierarchy.

## D-020: Existing Site Lists Are User-Owned

**Decision:** Product defaults are created only when site-list storage is absent/empty. Startup and popup loads do not merge defaults into an existing list. `x.com` was present in the earliest repository default, and runtime alias expansion covers `twitter.com` from either alias.

**Why:** Reapplying defaults cannot distinguish an untouched legacy list from a domain the user deliberately removed. Repeated merging silently reverses user intent.

## D-021: Reconcile Before Initial UI Snapshots

**Decision:** Popup and Options call authoritative `GET_STATE` before reading pet rewards, celebrations, session logs, recommendations, or daily statistics. Fallback popup state filters expired sessions and mismatched emergency records.

**Why:** A missed alarm can finalize an overdue session during the first state request. Reads taken before that request can miss the completion and no listener exists yet to repair the first render.

## D-022: Shared Settings Defaults

**Decision:** UI display, background configuration patches, persisted initialization, and history recommendation scoring share one normalized settings default (`09:00`-`12:00`, ten-second soft pause).

**Why:** Showing one focus window while the service worker scored with no window made recommendations internally inconsistent.

## D-023: Analyze Only HTTP(S) History

**Decision:** Browser-history analysis rejects every item whose URL is not HTTP or HTTPS before domain extraction, scoring, or persistence. Extension, browser-internal, file, and other schemes cannot appear in recommendations.

**Why:** Optional history access can expose internal URLs that are neither actionable distraction domains nor appropriate persisted aggregates. The headed permission run verified controlled domain-only results and excluded extension URLs.

## D-024: Destructive Modal Focus Contract

**Decision:** Destructive Options dialogs move focus into the modal, trap keyboard focus while open, close on Escape where cancellation is available, and restore focus to the invoking control.

**Why:** A visible modal without focus containment leaves keyboard users operating obscured controls and makes destructive confirmation ambiguous.
