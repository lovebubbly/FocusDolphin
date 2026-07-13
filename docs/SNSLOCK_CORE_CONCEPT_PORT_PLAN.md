# FocusWhale Core Concept Port Plan for SNSLOCK

Status: canonical implementation handoff  
Audit date: 2026-07-10 KST  
Source repository: this FocusWhale repository  
Target repository: the sibling SNSLOCK repository  
Target Codex task: private task reference intentionally omitted from this public document

## Bottom line

SNSLOCK is buildable, but it is not yet a faithful mobile FocusWhale.

The useful Android sensing foundation should be preserved:

- Instagram Accessibility detection and its regression fixtures.
- DM/Direct as an essential-contact route.
- The non-focusable, no-keyboard overlay constraint.
- Usage Access for coarse app-level analysis.
- Local Room event logs and the existing verification script.

The target control plane must be rebuilt:

- A focus session must become the single source of truth.
- Instagram and general-app decisions must use one intervention engine.
- Soft, medium, and hard must be three real behaviors.
- Completion, reward settlement, temporary access, hard emergency state, and schedule occurrences must be durable, session-bound, serialized, and idempotent.
- Completion and pet growth must be visible causal events, not transient UI state.

Do not start with a broad UI repaint. The first implementation goal is one correct, restart-safe vertical slice:

1. Start a medium session.
2. Encounter Instagram Reels.
3. See stable no-keyboard friction.
4. Keep Direct available.
5. Complete only at the natural deadline.
6. Receive exactly one durable pet-growth event.
7. See that event once, then acknowledge it.

## Audited baseline

### FocusWhale source

- Current branch: main at 00c43e5, ahead of origin and with a large dirty release-candidate worktree.
- The working tree is materially newer than the FocusWhale commit named in SNSLOCK/DECISIONS.md.
- Current verification on 2026-07-10:
  - npm run typecheck: pass.
  - npm test: pass, 28 files and 151 tests.
  - npm run build: pass, including the release verifier.
- The canonical source is the current worktree, not archived mockups and not the older 1477b88 snapshot.

### SNSLOCK target

- Current branch: main at 7cf153c with a large dirty worktree.
- The new session, pet, policy, recommendation, and usage packages are untracked; preserve them and do not reset the repository.
- Current verification on 2026-07-10:
  - scripts/verify-debug.sh: pass.
  - Unit, lint, assemble, privacy scan, APK metadata, Accessibility component, and required-permission checks: pass.
  - Current unit result files contain 47 tests, all passing.
  - Connected authorized devices in this audit: 0.
- Passing build gates prove that the prototype compiles. They do not prove the FocusWhale product contract.

### Why the existing mobile plan is stale

SNSLOCK/DECISIONS.md:8-10 records FocusWhale 1477b88 as the web baseline. The current FocusWhale tree contains later session hardening, serialized background ownership, schedule-occurrence suppression, durable growth settlement, acknowledgement-safe completion events, richer streak recovery, and the four-mood asset system. The July 9 mobile handoff correctly warns that the product flow is incomplete, but it still understates the amount of control-plane work required.

This document supersedes “Goals 2-8 complete” as an implementation-status claim. Existing SNSLOCK/HANDOFF.md remains useful product context.

## The portable FocusWhale contract

These are product invariants, not browser implementation details.

1. Deliberate bounded sessions
   - Enforcement is created by an active user-started or scheduled session.
   - The active session owns duration, intensity, target set, and deadline.
   - No active session means no session enforcement, unless a future separately named always-on guard is explicitly enabled.

2. One user-selected intensity
   - Soft, medium, or hard is selected at session start.
   - The system never escalates automatically.
   - A running session may only be explicitly upgraded, not silently changed or downgraded.

3. Humane friction
   - Soft pauses and reminds.
   - Medium creates meaningful friction and a bounded temporary allowance.
   - Hard removes casual bypasses but retains a safe valve.
   - Copy never shames, threatens, or harms the pet.

4. Honest commitment semantics
   - A session completes only at its natural deadline.
   - Early exit is aborted or interrupted, never completed.
   - Hard emergency exit is explicit, delayed, session-bound, and recoverable.
   - Scheduled occurrences do not immediately restart after an emergency exit.

5. Exactly-once growth
   - A completed session settles XP once.
   - Process death, repeated callbacks, UI recomposition, and concurrent service/UI requests cannot duplicate a reward.
   - Aborted or interrupted sessions do not reduce XP, stage, streak, badges, or pet wellbeing.

6. Visible causality
   - “Session completed -> XP/stage/badge/streak change” is a durable event.
   - It survives restart until acknowledged.
   - It is not a permanent pressure HUD and does not reappear after acknowledgement.

7. Local-first, bounded data
   - No raw Accessibility tree, screen text, DM content, app-use event stream, or session data leaves the device.
   - Recommendations remain local and advisory.
   - Retention is bounded and deletion semantics are explicit.

8. Evidence honesty
   - Unit, emulator, current-device, older-device, and pending evidence are distinct.
   - A passing unit test is not described as live Instagram proof.

## What ports exactly, what adapts, and what does not port

| Area | Decision |
| --- | --- |
| Wellness and privacy invariants | Port exactly. |
| Session source of truth and natural completion | Port exactly. |
| Serialized mutations, recovery, ledgers, acknowledgement | Port semantically; implement with Android-native persistence. |
| XP flooring and stage thresholds | Port exactly. |
| Reward-only streak, badge, and growth semantics | Port exactly, using shared parity fixtures. |
| User-selected intensity | Port exactly; it must dominate per-target behavior. |
| Site lists | Adapt to target inclusion policies for packages and Instagram surfaces. |
| DNR redirects | Replace with Android signal detection plus a stable overlay/safe route. |
| Browser history | Replace with coarse UsageStats/UsageEvents analysis. |
| Medium free-form intent text | Do not port. Use predefined reflection/intent chips because text focus caused real-device flicker. |
| Browser service worker, Chrome storage, rule IDs, URL return fragments | Do not port. |
| Archived browser mockup DOM | Do not port as a mobile UI contract. |

## Reuse, refactor, and replace boundaries

| SNSLOCK component | Decision | Reason |
| --- | --- | --- |
| detector/InstagramSurfaceDetector.kt and tests | Preserve and harden | It contains valuable Direct/Reels/Home ambiguity fixes. |
| accessibility/AccessibilitySnapshotReader.kt | Preserve the bounded in-memory signal boundary | Accessibility must remain Instagram-specific and raw text must not persist. |
| accessibility/SnsLockAccessibilityService.kt | Keep as a signal producer, remove policy and overlay ownership | It currently decides policy and owns a WindowManager controller. |
| overlay/OverlayGateController.kt | Reuse no-keyboard primitives, replace ownership and state model | FLAG_NOT_FOCUSABLE, chips, and safe routes are good; instance-local state is not enough. |
| usage/UsageAnalysisEngine.kt | Reuse aggregation after boundary fixes | Historical summaries are useful; current-foreground sensing must be separated and corrected. |
| usage/WellbeingUsageRepository.kt | Reuse for local reports, not as the authoritative session engine | Usage Access is coarse and best-effort. |
| data/GateEventEntity.kt and Room | Extend | Add retention, deletion, sessions, settlement, growth, schedules, and migrations. |
| scripts/verify-debug.sh and instagram-fixture | Preserve and expand | They are the strongest target-side automated gate. |
| session/FocusSessionRepository.kt and codec | Replace | Current read-then-write finalization is not atomic and allows early completion. |
| pet/PetStateRepository.kt, codec, and reward engine | Replace against FocusWhale parity fixtures | Current math, thresholds, persistence, and idempotency diverge. |
| rules/RuleEngine.kt and policy/FocusPolicyEngine.kt | Replace with one intervention engine | Instagram is always-on while app policy is session-bound; neither uses one authoritative intensity model. |
| settings/InterventionMode Flow/Hard | Remove from the core model | Soft and medium currently collapse to Flow. |
| rules/GateRuntimeStore.kt | Replace with session-scoped runtime grants | Temporary access is currently global and can leak across sessions/targets. |
| service/ProtectionStatusService.kt | Refactor into the single runtime coordinator/overlay host | It currently polls forever and settles rewards outside an atomic operation. |
| MainActivity.kt | Decompose after the domain kernel is correct | It currently owns orchestration, navigation, ephemeral reward state, and six production/debug tabs. |

## Evidence-backed gap matrix

| Contract | FocusWhale source evidence | Current SNSLOCK evidence | Required change |
| --- | --- | --- | --- |
| Session-owned enforcement | FW src/content/index.ts:44-91 evaluates only an active session. | SN rules/RuleEngine.kt:8-59 checks protectionEnabled but has no FocusSession input. | Default Instagram enforcement to inactive outside a session; make any always-on guard a separate opt-in feature. |
| One intensity source | FW src/shared/types.ts:1 and session.ts:272-297 make intensity a session field and allow only explicit upgrade. | SN MainActivity.kt:1712-1717 maps both Soft and Medium to Flow; FocusPolicyEngine.kt:7-26 ignores session intensity. | Session intensity must determine the intervention. Target policy should select inclusion, not create a second competing intensity. |
| Natural completion | FW session.ts:300-317 rejects caller-requested early completion. | SN MainActivity.kt:341-348 calls endSession(Completed); FocusSessionRepository.kt:44-62 accepts it. | Remove the “complete now” action and reject completion before endsAt. |
| Serialized ownership | FW background/index.ts:22-77 and session.ts:119-200 serialize state mutations. | SN UI, foreground service, and Accessibility service mutate separate repositories and runtime stores. | Introduce one application-scoped SessionRuntimeCoordinator with one mutation queue/Mutex. |
| Crash-safe finalization | FW session.ts:783-908 uses a finalization journal and resumes it. | SN FocusSessionRepository.kt:65-71 clears the active session before reward settlement in another repository. | Use a Room transaction plus settlement outbox/ledger and boot reconciliation. |
| Exactly-once rewards | FW pet/xpEngine.ts:45-190 uses a session ledger and settlement journal. | SN PetStateRepository.kt:21-25 is unguarded read-compute-write and can be called by UI and service. | Key settlement by session ID; duplicate/repeated calls must be no-ops. |
| Durable completion UI | FW pet/growth.ts:54-150 persists pending events and acknowledges by event ID. | SN MainActivity.kt:228 and 341-347 store lastPetReward only in remember state. Auto completion never populates it. | Persist GrowthEvent rows and acknowledgement; render completion from pending events. |
| Three intervention behaviors | FW README.md:57-69 and blocked/main.ts:158-297 define distinct soft/medium/hard behavior. | SN UserSettings.kt:15-18 has only Flow/Hard; OverlayGateController.kt:41 and 181-215 branches only on that pair. | Implement a pure three-mode decision/render state machine. |
| Session-scoped temporary access | FW session.ts:360-436 validates matching active medium session and stores sessionId. | SN GateRuntimeStore.kt:41-46 stores global timestamps without session/target identity. | Bind grants to sessionId, targetKey, kind, and expiry; purge/reject on session mismatch. |
| Hard safe valve | FW session.ts:648-687 provides delayed, weekly-limited, idempotent emergency state. | SN hard overlay keeps Direct/Home, but MainActivity.kt:350-354 aborts any session immediately. | Preserve safe routing and add a separate product-level two-step delayed hard emergency flow. |
| Schedules | FW schedule.ts:17-68 and session.ts:893-899 preserve exact occurrence end/suppression. | SN FocusSessionSource.Schedule exists, but no scheduler, receiver, schedule repository, or UI exists. | Add occurrence-keyed schedules, reconciliation, and suppression. |
| Active configuration lock | FW DECISIONS.md:19-23 and session.ts:997-1025 snapshot/reject changes. | SN MainActivity.kt:609-703 exposes protection, intensity, Instagram rules, pause, and monitor controls during a session. | Capture the session policy snapshot and disable/reject session-affecting edits until finalization. |
| Pet parity | FW shared/gamification.ts:3-72 and shared/xp.ts:4-11 define thresholds and floor math. | SN PetRewardEngine.kt:101-118 rounds and uses 300/1500/5000/12000 thresholds. | Use floor and 0/100/600/2000/6000. Add parity vectors. |
| Pet presentation | FW pet/renderer.ts:4-130 validates five stages by four moods with fallback. | SN MainActivity.kt:726-756 always renders one static focuswhale_128 asset and raw stage/streak/freeze text. | Port the local atlas semantics, mood mapping, fallback, and reduced-motion behavior. |
| Bounded local data | FW README.md:86-108 defines storage, limits, and clearing. | SN GateEventDao.kt:9-16 only inserts and reads; there is no pruning or delete API. | Add retention jobs, user clear/revoke controls, and active-session safeguards. |
| Service lifecycle | FW alarms/reconciliation are tied to session operations. | SN ProtectionStatusService.kt:55-77 is START_STICKY and loops every two seconds; completion paths do not stop it. | Start only when required, update notification state, and stop when no session/always-on mode remains. |
| Overlay ownership | FW has one background authority and reactive surfaces. | SN Accessibility service, foreground service, and Test UI each instantiate their own OverlayGateController; its latch is instance-local. | Create one OverlayCoordinator/host and feed it desired state from all signal sources. |
| Mobile IA | FW product surfaces separate controls, active state, completion, growth, and review. | SN MainActivity.kt:180-454 is a monolith; AppTab at 1600-1606 exposes Logs and Test as top-level production tabs. | Introduce onboarding, session, completion, review, pet, rules/schedules, settings/privacy; hide developer tools. |

## Additional verified target defects

These are not all blockers for the first kernel milestone, but they must remain in the backlog rather than being hidden by a visual redesign.

- The active-session clock is not driven by a ticker. MainActivity.kt:1729 computes from the current time only when Compose happens to recompose.
- Session Usage Access data is loaded when the active session ID changes, not continuously, so the “opened apps” summary can remain stale during the session (MainActivity.kt:270-294).
- MainActivity requests only the 50 most recent gate events and then derives “today” totals from that truncated list (MainActivity.kt:124 and 234-250; GateEventDao.kt:14-15).
- Built-in Test events are written into the same Room table and can contaminate product analytics (MainActivity.kt:441-445 and 1762-1792).
- Accessibility duplicate-log suppression is never reset on an Allow transition, so a later legitimate detection with the same key may not be logged (SnsLockAccessibilityService.kt:80-85 and 174-177).
- A detected event can be logged even when OverlayGateController.show returns early because overlay permission is missing. Analytics must distinguish detected, requested, shown, acted on, and failed.
- UsageAnalysisEngine keeps recentForegroundPackage after a matching Background event. Historical aggregation and current-foreground sensing must be separate contracts (UsageAnalysisEngine.kt:48-66).
- Feed grace expiry is event-driven. If no new Accessibility event arrives, the app does not schedule evaluation at the grace deadline (SnsLockAccessibilityService.kt:61-69 and 123-139).
- Detector confidence is stored but RuleEngine ignores it. The unified intervention engine must apply a conservative threshold/Unknown policy.
- AppRecommendationGenerator can recommend Instagram as Hard while FocusPolicyEngine always allows the Instagram package. Recommendations must target the actual Instagram surface policy or exclude Instagram from package recommendations.
- The hard app safe route calls setTemporaryUnlock for 20 seconds (OverlayGateController.kt:170-179 and 400-403). A safe Home route may suppress immediate bounce-back for that target, but it must not become a global hard-mode temporary allowance.
- The current original Android specification still describes free-form overlay input. It is historical and must not override the proven no-text-focus rule.
- Current Gradle verification has no repository/service/Room/overlay/Compose instrumentation coverage, and device count is informational rather than a required gate.

## Target behavior decisions

### Resolve the dual-intensity conflict

The browser model has target membership plus one session intensity. SNSLOCK currently has both a session intensity and per-app Off/Soft/Medium/Hard policies.

For the first faithful mobile port:

- Session intensity is authoritative.
- Package and Instagram-surface policies answer only “included in this session?”.
- Migrate any existing non-Off app policy to FollowSession.
- Keep Off as excluded.
- Recommendations propose adding an app to the focus target set; they do not propose silently raising intensity.
- If per-target overrides return later, name them explicitly, snapshot them at session start, and cap them at the user-selected session intensity.

### Resolve the legacy protection toggle

- Remove protectionEnabled as a second hidden session system.
- Derive session enforcement from activeSession.
- If the original SNSLOCK always-on Instagram Guard is retained, expose it later as a separately named opt-in mode, default off, with independent explanation and tests.
- Do not let an always-on guard masquerade as an active FocusWhale session or earn session rewards.

### Android intensity semantics

Soft:

- Compact or visually light, stable reminder.
- Immediate safe return to Home/Direct.
- Delayed continue/dismiss after a short bounded pause.
- No persistent temporary-access grant is needed after a simple dismissal.

Medium:

- Stronger full-screen friction.
- Initial countdown plus one predefined reflection/intent chip.
- No EditText, requestFocus, or forced keyboard.
- Five-minute temporary access, scoped to session plus target.
- Repeated bypass attempts may increase friction according to the captured session rule, but never change the selected intensity.

Hard:

- Full-screen intervention.
- No quick dismiss and no short temporary access.
- Keep Direct for Instagram and Home for general apps.
- Product-level session emergency is a separate two-step action, delayed five minutes, limited to one request per local week, and reconciled after restart.

Unknown:

- Never hard-block on an uncertain detector state.
- Preserve a currently valid visible intervention during short transient uncertainty.
- Otherwise allow or use soft-only behavior.

## Proposed target architecture

### Durable state

Use Room for operational state that must be atomic and recoverable. Keep DataStore for simple user preferences.

Suggested Room v2 tables:

- FocusSessionEntity
  - id, source, intensity, startedAt, plannedEndsAt, finalizedAt, status
  - scheduleId, scheduleWindowStart, scheduleWindowEnd
  - captured policy version
- ActiveSessionEntity
  - singleton pointer to active session and mutation version
- SessionTargetEntity
  - sessionId plus target type/package/surface
- RuntimeGrantEntity
  - id, sessionId, targetKey, grant kind, expiresAt
- EmergencyRequestEntity
  - sessionId, requestedAt, dueAt, localWeekKey, state
- ScheduleEntity and ScheduleSuppressionEntity
  - occurrenceKey, window boundaries, suppression expiry
- SessionSettlementEntity
  - sessionId primary key, XP delta, settledAt
- PetStateEntity
  - version, name, stage, XP, total focus minutes, streak state, freezes
- BadgeAwardEntity
  - stable badge ID, earnedAt
- GrowthEventEntity
  - stable event ID, sessionId, type, payload, occurredAt, acknowledgedAt
- GateEventEntity
  - retain existing data with bounded cleanup

Export the Room schema and add explicit migration tests. Migrate current DataStore session/pet/policy values before deleting the codecs.

### Single state owner

Create:

- domain/session/SessionRuntimeCoordinator.kt
  - the only public mutator for start, upgrade, request exit, complete due, reconcile, schedule start/end, grant temporary access, clear data, and acknowledge completion.
  - one application-scoped Mutex or serialized command queue.
  - an immutable StateFlow for UI/services.
- domain/intervention/InterventionPolicyEngine.kt
  - pure input: active session snapshot, target signal, session target policy, runtime grant, current time.
  - pure output: Allow, SoftReminder, MediumFriction, HardGate, or SafeRoute.
- domain/growth/GrowthEngine.kt
  - pure parity-tested calculations.
- runtime/OverlayCoordinator.kt
  - exactly one WindowManager owner.
  - accepts desired intervention state keyed by sessionId plus targetKey plus decision revision.
  - updates, replaces, or hides deterministically.
- scheduler/SessionScheduler.kt
  - stores occurrence keys and reconciles app start, service start, boot, clock, and time-zone changes.

Signal producers must not own policy:

- Accessibility service produces InstagramSurfaceSignal.
- Usage foreground sensor produces AppTargetSignal.
- Both send signals to SessionRuntimeCoordinator.
- Only the coordinator invokes the intervention engine and overlay coordinator.

### Finalization transaction

Natural completion should perform, or durably enqueue, this logical transaction:

1. Verify active session ID and deadline.
2. Finalize the session once.
3. Insert SessionSettlementEntity if absent.
4. Apply XP/streak/badges if and only if settlement was newly inserted.
5. Insert stable GrowthEvent rows.
6. Clear session-bound grants and pending emergency state.
7. Mark any schedule occurrence state.
8. Clear active-session pointer.
9. Publish the new state.

Any external side effect that cannot be inside the Room transaction must be derived from durable desired state and reconciled after restart.

## Golden vertical slice

Implement this before broad navigation or visual work:

1. Permission readiness can be understood.
2. User chooses one-minute test duration and Medium.
3. User starts a session with Reels included.
4. Accessibility detects Reels.
5. Unified engine emits MediumFriction.
6. The single overlay host shows a stable chip-and-countdown gate.
7. Direct remains available and never shows the gate.
8. A five-minute grant, if chosen, is bound to the active session and Reels target.
9. At the natural deadline, the session finalizes once.
10. Overlay and foreground service stop.
11. One completion/growth event survives process restart.
12. The completion screen acknowledges exactly the rendered event IDs.

This slice is the proof that FocusWhale exists on Android. A dashboard with six tabs is not that proof.

## Implementation milestones

### Milestone 0 — Freeze and contract the baseline

Work:

- Preserve both dirty worktrees; never reset or overwrite unrelated changes.
- Record git status and current hashes in the target handoff.
- Copy this plan into SNSLOCK as FOCUSWHALE_CORE_MIGRATION_PLAN.md or reference this absolute path.
- Mark the old Goal 2-8 completion wording as prototype capability, not product completion.
- Capture current Home, permission, session, overlay, report, and test states before changing them.
- Preserve the detector and privacy regression suite.

Acceptance:

- Current scripts/verify-debug.sh passes.
- Every existing target modification/untracked file is accounted for.
- Evidence labels distinguish automated, emulator, current real-device, older real-device, and pending.

### Milestone 1 — Atomic session kernel

Work:

- Add Room operational schema and migration.
- Implement SessionRuntimeCoordinator.
- Make plannedEndsAt immutable.
- Remove caller-controlled Completed before the deadline.
- Add settlement and growth-event ledgers.
- Reconcile current active sessions and unfinished settlement on process start.
- Stop the foreground service when no active session/explicit guard requires it.

Acceptance:

- Starting a second session is rejected.
- Early “complete” is rejected; early exit becomes Aborted and grants zero XP.
- One hundred concurrent/repeated finalization calls create one final session, one settlement, one XP delta, and one pending completion event.
- A crash between any two logical finalization steps recovers without loss or duplication.
- Current persisted prototype state migrates or fails safely with documented fallback.

### Milestone 2 — Unified intervention and Medium golden path

Work:

- Replace RuleEngine plus FocusPolicyEngine split with InterventionPolicyEngine.
- Make active session required by default.
- Convert target policies to Off/FollowSession.
- Introduce one OverlayCoordinator.
- Implement the Medium chip/countdown/five-minute flow.
- Scope grants to session and target.

Acceptance:

- The golden vertical slice passes.
- Soft and Medium no longer map to the same model.
- Only one overlay window can exist across Accessibility, app sensing, and test tooling.
- Unknown/transient signals do not flicker or incorrectly hide a valid gate.
- A new session cannot inherit an older grant.
- Session-affecting settings cannot change the captured policy.

### Milestone 3 — Soft, hard, emergency, and schedules

Work:

- Implement Soft and Hard behaviors.
- Add hard two-step delayed emergency state with a local-week ledger.
- Add schedule models, overnight windows, occurrence keys, reconciliation, and suppression.
- Handle natural completion racing emergency completion.
- Add service/process restart and clock/time-zone reconciliation.

Acceptance:

- Hard has no quick dismiss or temporary allowance and always retains Direct/Home.
- Duplicate emergency requests for the same session are idempotent.
- One weekly hard emergency request is enforced locally.
- Natural completion wins if its deadline arrives first.
- Emergency-ending a scheduled occurrence does not restart it before the original window ends.
- Late schedule wake starts only the remaining window and ends at the original boundary.
- Fake-clock tests cover overnight, DST/time-zone changes, and reboot reconciliation.

Before choosing an exact-alarm implementation, run a focused target-SDK-36 platform spike. Document schedule tolerance honestly if the chosen Android mechanism cannot guarantee exact wake time.

### Milestone 4 — Gamification parity and durable completion

Work:

- Port shared golden fixtures for XP, stages, badges, streaks, recovery, and event descriptions.
- Implement floor-based XP and thresholds 0/100/600/2000/6000.
- Add pet name and total focus minutes.
- Add durable growth events and per-event acknowledgement.
- Port the five-stage/four-mood local atlas semantics to Android with deterministic asset validation.
- Map idle, focus, happy, and celebrate to actual product state.
- Respect reduced motion and provide a packaged fallback.

Acceptance:

- Kotlin and TypeScript parity fixtures match.
- A 25-minute hard completion awards 37 XP, not 38.
- Aborted/interrupted sessions never lower pet progress.
- Name persists across restart.
- Killing the app before acknowledgement re-shows the completion; acknowledging it prevents reappearance.
- All 20 stage/mood combinations render or use the tested fallback.
- XP is not a permanent active-session pressure HUD.

### Milestone 5 — Analytics, privacy, retention, and deletion

Work:

- Separate current foreground sensing from historical UsageEvents aggregation.
- Fix foreground/background boundary and stale-current-package cases.
- Refresh active-session and review snapshots predictably.
- Filter self/system packages and label uncertainty.
- Add bounded retention and explicit local clearing.
- Add permission-revoke guidance.

Acceptance:

- Window-boundary fixtures produce correct durations/current-app state.
- Recommendations never write policy without user confirmation.
- “Distracting minutes” is not calculated by summing every app indiscriminately.
- Gate/session/growth retention is bounded.
- Active-session clear is rejected.
- Clear semantics state exactly what is preserved: settings, targets, pet progress, weekly emergency allowance, and active schedule suppression.
- Privacy scan still proves no network client and no Accessibility text outside the detector boundary.

### Milestone 6 — Mobile information architecture

Work:

- Split MainActivity into ViewModels and focused screens.
- First launch: product sentence plus permission readiness, not empty metrics.
- Home: pet, duration, intensity, one primary start action.
- Active session: remaining time, chosen intensity, target summary, safe emergency semantics.
- Completion: durable growth event and explicit acknowledgement.
- Review: local patterns and suggestions.
- Pet: growth, stages, badges, name.
- Rules and schedules: user decisions, not implementation jargon.
- Settings/privacy: defaults, permissions, retention, deletion.
- Move Logs and Test behind a developer/debug surface.

Acceptance:

- The active timer visibly ticks without depending on unrelated state changes.
- Active session has one dominant state and no mutable rule controls.
- First-use empty states are useful.
- Permission revocation fails safely and explains lost capability.
- TalkBack, font scaling, contrast, touch targets, dark/light themes, and reduced motion pass.

### Milestone 7 — Device and release evidence

Work:

- Expand verify-debug.sh with Room migration, parity, repository concurrency, and state-machine suites.
- Add Compose/instrumentation tests.
- Add a device-required verification command that fails when no authorized device is present.
- Run API 29 and API 35/36 emulator checks.
- Run the real Samsung/Instagram matrix.

Real-device matrix:

- Direct remains allowed.
- Story, Reels, Explore, and Feed behavior for all three intensities.
- App switching while a gate is visible.
- Keyboard never appears.
- No overlay flicker or stuck window.
- Session expiry while target is foreground.
- Foreground-service restart and process death.
- Permission revocation during and outside a session.
- Temporary grant expiry.
- Hard emergency persistence.
- Scheduled occurrence suppression.
- Completion acknowledgement across restart.

Acceptance:

- Automated, emulator, and real-device evidence are reported separately.
- No unchecked device row is called complete.
- Public release remains a separate owner-approved gate.

## Required automated contract matrix

At minimum, add tests for:

- No active session -> no session overlay.
- Direct -> always safe.
- Unknown -> never hard.
- Soft, Medium, Hard -> distinct decisions.
- Session intensity -> authoritative.
- App target Off -> allow.
- App target FollowSession -> use session intensity.
- Policy mutation during session -> rejected or does not alter snapshot.
- Temporary grant -> matching session and target only.
- Expired/old-session grant -> ignored and pruned.
- Early complete -> rejected.
- Repeated/concurrent finalize -> exactly once.
- Crash/restart after session finalization but before reward display -> recover.
- Repeated settlement -> no extra XP.
- Growth event ack race -> newly appended event remains pending.
- Hard emergency duplicate -> idempotent.
- Weekly limit -> enforced.
- Natural deadline vs emergency -> natural completion wins.
- Scheduled abort -> same occurrence suppressed.
- Overnight schedule -> correct original boundary.
- XP and stage parity.
- Streak freeze/rest/recovery parity.
- Name persistence.
- Gate-event retention and clearing.
- No Accessibility text persistence.
- One overlay owner and deterministic keyed updates.

## Risks that must remain explicit

1. Android cannot reproduce browser DNR guarantees exactly.
   - Usage Access foreground inference is coarse.
   - Accessibility must remain narrowly scoped.
   - Describe enforcement honestly as best-effort outside the Instagram surface detector.

2. Overlay stability is a real-device concern.
   - Do not reintroduce text input.
   - Do not replace the current no-focus behavior without device proof.
   - Improve visuals on top of a tested overlay state machine.

3. Foreground-service and scheduler behavior are platform-sensitive.
   - Do not assume a two-second polling loop is an acceptable permanent architecture.
   - Choose and document restart/wake tolerances before promising exact schedules.

4. The worktrees are dirty.
   - Never reset, checkout over, or bulk-rewrite them.
   - Make small, reviewable milestones and re-run verification after each.

5. Current passing tests encode some wrong semantics.
   - The Android pet test currently expects rounded hard XP.
   - Replace such tests with shared product-parity vectors rather than preserving a known mismatch.

6. UI polish can hide architectural failure.
   - A polished overlay that still runs outside a session, duplicates XP, or loses completion on restart is not progress toward the core concept.

## Copy-paste directive for the SNSLOCK task

Use this as the next prompt in the SNSLOCK task:

> Treat `docs/SNSLOCK_CORE_CONCEPT_PORT_PLAN.md` in the FocusWhale repository as the canonical migration contract. Do not trust the old “Goals 2-8 complete” wording as proof of product completeness. Preserve the dirty worktree, Instagram detector/fixtures, Accessibility privacy boundary, DM safe route, no-keyboard overlay behavior, Usage Access foundation, Room gate logs, and verify-debug.sh. Implement Milestone 0 and Milestone 1 first: one Room-backed serialized SessionRuntimeCoordinator, immutable deadline, early-completion rejection, captured session targets, idempotent session settlement, durable GrowthEvent acknowledgement, restart reconciliation, and correct foreground-service shutdown. Do not broadly redesign MainActivity or the overlay until the one-minute Medium golden vertical slice and concurrency/restart tests pass. Report exact files changed, migrations, tests, remaining device-only uncertainty, and do not claim live verification without a connected device.

## Evidence index

### FocusWhale

- README.md:3-5 — local-first, bounded, non-punitive concept.
- README.md:31-55 — feature and wellness contract.
- README.md:57-69 — soft, medium, hard semantics.
- README.md:84-105 — idempotent growth and bounded local data.
- DECISIONS.md:7-23 — wellness invariants and serialized background ownership.
- DECISIONS.md:49-65 — optional advisory history, storage, deletion, retention.
- src/background/index.ts:22-77 — central operation queue and reconciliation entry points.
- src/background/session.ts:119-200 — serialized SessionManager API.
- src/background/session.ts:235-317 — start, explicit upgrade, and natural completion rule.
- src/background/session.ts:360-436 — matching-session medium temporary allowance.
- src/background/session.ts:648-800 — hard emergency, rollback-aware activation, finalization journal.
- src/background/session.ts:880-1048 — settlement, occurrence suppression, cleanup, locking, idempotent log.
- src/background/schedule.ts:17-68 — schedule-window reconciliation.
- src/content/index.ts:44-91 — enforcement only from active session state.
- src/pages/blocked/main.ts:158-297 — medium and hard user flows.
- src/shared/gamification.ts:3-75 and src/shared/xp.ts:4-11 — canonical XP/stage/badge semantics.
- src/pet/xpEngine.ts:45-190 — settlement ledger/journal.
- src/pet/growth.ts:54-150 — durable growth events and acknowledgement.
- src/pet/renderer.ts:4-170 — five stages, four moods, validation, fallback.

### SNSLOCK

- DECISIONS.md:6-10 — older FocusWhale baseline.
- app/src/main/java/com/snslock/android/MainActivity.kt:180-454 — monolithic orchestration and ephemeral UI state.
- MainActivity.kt:334-369 — start, manual completion/reward, immediate abort, global pause.
- MainActivity.kt:609-703 — active card followed by mutable protection/rule/monitor controls.
- MainActivity.kt:706-805 — static pet, raw metrics, early complete/abort, fixed 25-minute CTA.
- MainActivity.kt:1600-1717 — production debug tabs and Soft/Medium-to-Flow collapse.
- rules/RuleEngine.kt:8-59 — always-on legacy Instagram policy without FocusSession.
- policy/FocusPolicyEngine.kt:6-27 — session-bound app policy that ignores session intensity.
- session/FocusSessionRepository.kt:21-88 — non-atomic start/finalize and early completion.
- service/ProtectionStatusService.kt:71-145 — polling, split completion/settlement, app overlay ownership.
- overlay/OverlayGateController.kt:34-255 — one-instance latch and Flow/Hard-only rendering.
- pet/PetRewardEngine.kt:11-129 — divergent math/thresholds and unused recovery path.
- pet/PetStateRepository.kt:14-31 — non-idempotent read-compute-write settlement.
- data/GateEventDao.kt:9-16 — no pruning/deletion.
- AndroidManifest.xml:36-56 — no schedule/boot receiver.
- QA_CHECKLIST.md:16-71 and 104-112 — major current device flows remain unchecked.

## Definition of done

The port is complete only when all of the following are true:

- A deliberate session owns all default enforcement.
- Soft, medium, and hard are distinct and user-selected.
- Direct/Home remain safe.
- Natural completion, early exit, hard emergency, temporary access, and schedules survive restart correctly.
- One session can produce at most one reward settlement and one acknowledgement-safe completion event.
- Kotlin matches the canonical FocusWhale reward fixtures.
- Pet growth is visible, non-punitive, local, and not a pressure HUD.
- Settings and targets cannot silently change a running commitment.
- Analytics are local, advisory, bounded, and honestly labeled.
- The UI expresses one coherent journey from readiness to session to friction to return to completion to review.
- Automated, emulator, and real-device evidence all pass at their stated levels.
