# FocusWhale Decisions

Last refreshed: **2026-07-11 11:56 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

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

**Why:** Chromium/Whale behavior showed `x.com` was not reliably covered by the previous domain-only path. The pre-Goal-7 exact-build headless Whale run redirected a synthetic credential-bearing `x.com.` target, preserved the trailing dot/path, stripped sensitive return components, and returned to `about:blank`; Whale's HSTS preload safely upgraded HTTP to HTTPS before DNR capture.

## D-006: Two-Stage Production Build

**Decision:** Build extension pages/service worker with `vite.config.ts`, then append the manifest content script as a single IIFE with `vite.content.config.ts`.

**Why:** Manifest content scripts are classic scripts and cannot execute ESM imports. The separate build also avoids weakening the module service-worker/page architecture.

## D-007: Exact WAR Allowlist

**Decision:** Expose exactly the blocked page, atlas, Pretendard font, and 128 px fallback icon to HTTP(S) pages.

**Why:** The soft overlay needs these assets; a broad `assets/*` surface is unnecessary.

## D-008: Optional History

**Decision:** `history` is optional and requested only when the user starts recommendation analysis in Options. Onboarding never requests it. Persist domain aggregates only; never auto-block recommendations.

**Why:** Core focus features do not need browsing history, and raw URL/title/timestamp retention would violate data minimization.

## D-009: Storage And Deletion

**Decision:** Sync settings/lists/schedules/pet state; keep activity/analytics/journals and the versioned onboarding-completion record local. Provide history revoke and local-data clear in Options. Reject local clear while a session is active and preserve sync-backed data, the current week's emergency-use allowance, and any unexpired schedule-occurrence suppression. Clearing local data removes onboarding completion but does not automatically reopen the flow; Options provides explicit replay.

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

**Decision:** Distinguish isolated headed exact-build, headless exact-build, headless prior-candidate, visible-profile prior-build, automated current, earlier-baseline, harness-limited, and pending evidence in release docs. Record browser/profile, exact artifact boundary, and approval boundary with each run. A browser-automation stall may be classified as a harness limitation only when the exact baseline reproduces it at the same platform API boundary; that classification does not substitute for a normal-browser smoke.

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

**Decision:** Use [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) as the support/privacy contact channel. Use `https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md` as the stable policy URL; both were publicly reachable and the policy's Limited Use statement was verified on 2026-07-11.

**Why:** This provides one centralized repository channel and a stable, reviewable public policy target without introducing a developer backend.

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

## D-025: Measured Accessibility Overrides Theme Defaults

**Decision:** Small semantic labels use the full theme content token, the initial hard-emergency soft button keeps its error tint with readable content text, and every disclosure summary has a theme-primary two-pixel `focus-visible` treatment with a two-pixel offset.

**Why:** The headed matrix measured the default small-label contrast at 4.22:1 and the initial emergency action at 4.11:1, while disclosure summaries had no visible ring. The corrected exact build passes 68 contrast checks with a 4.94:1 minimum and exposes visible focus on all seven popup keyboard stops.

## D-026: Disclose Instrumented Exact-Build Evidence

**Decision:** Use `INSTRUMENTED EXACT BUILD` only when the unchanged production bundle runs in a disposable browser profile while CDP supplies deterministic platform responses/latency or terminates the worker at a reviewed compiled-code boundary. Record the instrumentation, loaded-bundle fingerprint, durable pre-interruption state, worker replacement evidence, and post-recovery invariants. Never relabel that result as an unmodified headed user flow.

**Why:** Real browser APIs do not offer a reliable user-facing control for pausing a history callback or killing an MV3 worker between two adjacent durable writes. Deterministic runtime fault injection can prove queue and journal behavior against the shipped bundle, but only if its boundary remains explicit and auditable.

## D-027: Whale-First Exact Package

**Decision:** Submit a newly rebuilt, exact reviewed 1.0.0 package to Naver Whale Store first. Manifest name, description, and action title use Chrome `_locales`; English is the default and Korean is selected for Korean browser UI language. Store metadata and imagery may describe both interfaces only after they are rechecked against that exact rebuilt package. Prepare Chrome Web Store disclosures and images as a secondary baseline, but keep browser-neutral wording for any Chrome upload.

**Why:** Goal 7 added a complete Korean/English interface and localized manifest metadata, so the earlier Korean-only/English-description constraint no longer reflects the product. The existing pre-Goal-7 ZIP is not byte-equal to the bilingual build and cannot be reused as its submission artifact.

## D-028: Publicly Viewable, All Rights Reserved

**Decision:** Make the repository's licensing status explicit with a top-level all-rights-reserved notice. Store installation permission does not grant source or package redistribution rights. Third-party components keep their own licenses.

**Why:** A public GitHub repository without a license already grants no general reuse rights, but an explicit notice removes ambiguity and repairs the generated-sprite notice that previously referred to a nonexistent repository license.

## D-029: Ship Third-Party Notices Without Changing Executable Code

**Decision:** Package exact MIT notices for Tailwind CSS, daisyUI, and the emitted Vite core runtime beside Pretendard's SIL OFL. The historical pre-Goal-7 notice refresh kept executable files byte-identical; every later rebuild, including Goal 7, must carry the notices and repeat full archive verification.

**Why:** Public source attribution alone does not satisfy the distribution notice carried by MIT-licensed code and styles in the extension ZIP. Goal 7 changes the executable package, so its new archive cannot inherit the old byte-equality claim.

## D-030: Install-Only, Versioned Onboarding

**Decision:** Open onboarding automatically only for `runtime.onInstalled` reason `install` and only when a valid current-version local completion record is absent. Record schema version, completion timestamp, and one of `skipped`, `setup_only`, or `session_started`. Offer an explicit replay from Options without treating replay as a new install.

**Why:** New users need a clear first-run path, while updates and ordinary browser restarts must not repeatedly interrupt them. A versioned record supports future schema changes without collecting an account identifier or adding a backend.

## D-031: Explicit First-Session Consent

**Decision:** Onboarding may edit the selected focus list and let the user choose `soft`, `medium`, or `hard`, but it defaults to `soft`, never escalates automatically, and starts the optional 25-minute session only from the dedicated user action. Finishing setup or skipping does not start a session. Onboarding does not request browser-history permission.

**Why:** The first-run experience must teach the commitment model without silently changing browsing behavior or bundling an unrelated sensitive permission request.

## D-032: Korean And English Locale Contract

**Decision:** Ship matching Korean and English catalogs for every product-authored surface and manifest field. Choose Korean for Korean UI language tags and English otherwise; unsupported locales fall back to English. Prefer `chrome.i18n` when its runtime catalog matches the requested language, and use the bundled matching catalog when Whale reports a stale/mismatched runtime catalog. Preserve user-authored values verbatim.

**Why:** A localized release must avoid mixed-language UI and untranslated keys, while respecting names and content the user supplied. The runtime-catalog check addresses an observed Whale profile mismatch without changing the browser's locale settings.

## D-033: No-Op-Safe DNR Adapter

**Decision:** Before a dynamic-rule update, intersect requested removal IDs with currently installed rule IDs. Skip the browser update entirely when there are neither existing removals nor additions.

**Why:** Removing nonexistent IDs or issuing an empty update has no product value and can expose browser-specific no-op behavior. Filtering stays inside the DNR adapter and does not change rule compilation, matching, IDs, or MV3 ownership.

## D-034: Playwright-Launched Whale Alarm Boundary

**Decision:** Record the current Playwright-launched Whale 4.38 stall at `chrome.alarms.create` as a harness limitation/pre-existing baseline behavior because the exact `acb45b6` executable reproduces it identically. Do not present that result as a Goal 7 regression or as proof that normal-browser session start passes.

**Why:** Baseline reproduction isolates the stall from onboarding/localization changes, but an automated harness cannot stand in for the outstanding normal-browser/manual session smoke required for publication.

## D-035: Explicit Tailwind Source Boundary

**Decision:** Disable Tailwind's repository-wide automatic source discovery with `source(none)` and enumerate the production page, content, and pet source paths with `@source`.

**Why:** Documentation vocabulary changed the compiled CSS/content-script bytes even when application source was untouched. An explicit source boundary makes release artifacts reproducible and requires future production directories to be added deliberately.

## D-036: External References Inform Structure, Not Product Identity

**Decision:** Translate the directly observed mobile focus-product hierarchy into three FocusWhale browser jobs: Session in the toolbar popup and intervention surfaces, Rules in Options, and Review in Options. Keep Preferences secondary. Adopt dark-first spatial hierarchy, one dominant action, large time typography, compact rule rows, and restrained selected/hero emphasis without copying another product's navigation, scores, imagery, copy, branding, permissions, or platform-specific semantics.

**Why:** The useful evidence is the separation of act now, configure future behavior, and understand the day. FocusWhale has different browser capabilities, a local-only privacy contract, explicit intensity meanings, a whale identity, and no defensible composite score. Literal mobile or visual copying would weaken those boundaries rather than polish the existing product.

## D-037: Goal 8 Mockup Approval Freezes Production

**Decision:** Keep Goal 8 Phase A under `mockups/goal-8/` with offline local assets, real Korean/English copy, dark-first and representative light states, the current `384 x 1,920` atlas, and an explicit approval record. Do not change `src/`, `public/`, package metadata, Vite configuration, or build verification until the product owner approves an exact mockup commit. Preserve the archived Goal 6 files separately. Production starts from the existing 79-line custom-CSS baseline and must consolidate rather than add an independent visual layer.

**Why:** The approved mockups become the structural layout contract for a broad cross-surface redesign. Freezing production prevents partial implementation from outrunning product review and preserves a clear audit trail for every runtime, accessibility, localization, and release invariant.
