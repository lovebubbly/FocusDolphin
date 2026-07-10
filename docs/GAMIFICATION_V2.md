# FocusWhale Gamification v2

> **Document provenance**
>
> - Product owner and repository author of record: **Choi Yunseong (최윤성)** (`Yunseong Choi` in Git history)
> - Introduced in commit: `00c43e5` on **2026-07-07 18:16:28 KST**
> - Release-candidate accuracy refresh: **OpenAI Codex, GPT-5 coding agent**, on **2026-07-10 20:29 KST**
> - Time zone: **Asia/Seoul (UTC+09:00)**
> - Documentation attribution does not imply product-owner approval

This is the code-facing contract for pet growth, rewards, celebration delivery, and hard-mode escape in FocusWhale v1.0.0.

## Non-Negotiable Rules

- The pet never dies, regresses, becomes sick, or shows punishment/sadness for missed focus.
- XP is contextual: post-session overview and user-opened growth details, not a constant pressure HUD.
- Badges are additive only.
- Hard mode retains a delayed, limited emergency escape.
- Growth and intent data remain local; browser sync may handle the explicit sync-backed pet state.
- User-facing copy avoids guilt, shame, punishment, and loss framing.

## XP And Stages

Only completed sessions grant XP, once per session:

```text
XP = floor(completed_minutes * intensity_multiplier)
soft = 1.0
medium = 1.2
hard = 1.5
```

| Stage | Name | Threshold |
| ---: | --- | ---: |
| 0 | 알 | 0 XP |
| 1 | 새끼 고래 | 100 XP |
| 2 | 어린 고래 | 600 XP |
| 3 | 푸른 고래 | 2,000 XP |
| 4 | 별고래 | 6,000 XP |

`normalizePetState` never lowers an existing stage, even when migrating inconsistent legacy XP. Aborted/interrupted sessions subtract nothing and may add a neutral `session_ended_early` record.

## Authoritative Mutation Path

Pet mutation belongs to the MV3 service worker:

- `RECONCILE_PET` serializes XP settlement, streak/freeze reconciliation, badge awards, and event generation.
- `SET_PET_NAME` uses the same serialized mutation queue.
- `petLedger` prevents duplicate settlement for completed/ended-early session IDs and retains at most 5,000 IDs per category.
- `petSettlementJournal` is written before multi-key side effects and replayed after interruption.
- `petReconciliationJournal` and settlement recovery merge with newer synced progress instead of regressing XP, stage, streak, name, badges, focus minutes, or settled-session IDs.
- `petStreakLedger` holds durable streak/freeze reconciliation state.

Popup/options must not persist stale whole `petState` snapshots. New pet mutations should extend this authoritative queue and add concurrency/recovery tests.

## Growth Events And Delivery

Core event types:

```ts
type GrowthEventType =
  | "session_completed"
  | "stage_up"
  | "half_way"
  | "badge_earned"
  | "freeze_granted"
  | "freeze_used"
  | "streak_restored"
  | "streak_rest"
  | "streak_fresh_start"
  | "session_ended_early"
  | "migration";
```

`session_completed` records carry `xpBefore`, `xpAfter`, `progressBefore`, `progressAfter`, minutes, intensity, and session ID. This lets the popup animate the actual transition instead of reconstructing it from ambiguous current state.

Storage:

- `growthEvent:{eventId}`: durable per-event record.
- `pendingCelebration:{eventId}`: unacknowledged overview event.
- `celebrationAck:{eventId}`: explicit dismissal receipt.
- `growthLog` and `pendingCelebrations`: legacy migration compatibility only.

Growth events and acknowledgement records retain the newest 500 unique IDs. Pending celebrations remain until acknowledged. Acknowledging selected IDs does not erase a concurrently appended event, and retries are deduplicated before retention pruning.

## Post-Session Overview

After natural completion, the next popup reads pending events without deleting them and renders:

- `celebrate` pet mood;
- minutes, intensity, and XP awarded;
- animated XP total and progress transition;
- current stage;
- stage, half-way, badge, freeze, or streak milestones;
- optional name prompt when appropriate.

Only one completed-session group is presented and acknowledged at a time; later groups remain pending. Failed acknowledgement remains retryable. An unrelated popup rerender or list-mode toggle must not resurrect an acknowledged overview, and a saved name is merged into the current popup model immediately.

`prefers-reduced-motion: reduce` skips count-up/reveal motion and presents final accessible values immediately.

## Badges

Implemented stable IDs:

| ID | Display name |
| --- | --- |
| `first-session` | 첫 물결 |
| `first-hard` | 첫 깊은 잠수 |
| `focus-10-hours` | 열 시간의 바다 |
| `focus-50-hours` | 쉰 시간의 대양 |
| `five-day-week` | 한 주의 리듬 |
| `allowlist-10` | 등대지기 |
| `streak-7` | 이레의 물살 |
| `streak-30` | 서른 날의 해류 |
| `comeback` | 다시 만난 바다 |
| `first-schedule` | 물때표 |
| `steady-4w` | 꾸준한 물결 |

Descriptions explain meaning in growth details, and newly awarded badges appear in completion milestones. IDs must remain stable across copy changes.

## Streak And Freeze Language

- `active`: `N일째`
- `resting`: `쉬는 중`
- `fresh`: `새 출발`

Freeze UI uses `보호막`, not penalty language. A break with protection consumes a freeze without loss/shame copy; a later unprotected return becomes a neutral fresh start.

## Sprite Contract

Production atlas: `assets/sprites/focuswhale-atlas.png`.

- Dimensions: **384 x 1,920**.
- Grid: four columns x twenty rows.
- Frame: 96 x 96.
- Total: eighty frames.
- Stages: five.
- Moods: `idle`, `happy`, `focus`, `celebrate`.

Row mapping:

| Mood | Rows |
| --- | --- |
| `idle` | 0-4 |
| `happy` | 5-9 |
| `focus` | 10-14 |
| `celebrate` | 15-19 |

Each mood block maps stage 0 through stage 4 in order. Stage 4 is the star-marked adult whale; the earlier crown artwork is retired.

The deterministic assembler normalizes size/baseline, enforces safe margins, and writes `assets/sprites/atlas-report.json`. Renderer tests verify manifest dimensions, all 20 stage/mood mappings, all 80 frame metrics, and the atlas hash/report contract. The renderer injects styles into documents or shadow roots and falls back to the packaged icon on failure.

## Mood Usage

- `idle`: ordinary popup/options/rest state.
- `happy`: positive growth/detail state.
- `focus`: active popup, blocked page, soft overlay.
- `celebrate`: post-session overview and milestones.

Do not add a mood unless a concrete product state uses it. Missing/invalid assets must fall back safely rather than render a blank/black box.

## Hard Emergency Exit

Hard mode has no temporary allow. Emergency behavior:

1. Initial click opens confirmation only.
2. Second click schedules an end five minutes later.
3. The request is limited to one unique hard session per local week.
4. Repeated requests for the same pending session are idempotent.
5. Pending state is bound to that session and cannot abort a newer session.
6. Natural completion wins when the focus deadline already elapsed.
7. If the aborted session came from an active schedule occurrence, that occurrence remains suppressed until its exact original window end rather than immediately restarting. The session stores that boundary explicitly instead of deriving it from a rounded minute duration.

Storage uses `pendingEmergency`, `emergencyUsage`, and schedule-occurrence suppression; service-worker alarms and reconciliation restore pending work. Local activity clearing preserves the current week's emergency allowance and any unexpired occurrence suppression, preventing either safeguard from being reset through the clear control.

## Automated Evidence

Release-candidate gates refreshed by OpenAI Codex (GPT-5) for product owner Choi Yunseong on 2026-07-11 01:33 KST:

- Typecheck: pass.
- Vitest: **30 files / 196 tests**, pass.
- Two-stage production build and release verifier: pass.

Gamification coverage includes XP flooring, thresholds, migration non-regression, duplicate settlement, monotonic settlement/reconciliation journal recovery, growth transition values, per-session celebration batching, acknowledgement races/retention, name mutation without progress loss, streak/freeze behavior, badge awards, hard emergency limits/session binding, scheduled-occurrence suppression, atlas geometry/hash, shadow-root rendering, and wellness-copy guards.

## Live Evidence Boundary

The exact-final headless Whale matrix passes natural completion, sequential session/badge acknowledgement, close/reload dismissal, hard two-step/pending/reload/weekly behavior, scheduled-occurrence suppression, popup emergency access, pet-name persistence across a real browser restart, and all 20 stage/mood combinations. Headed Whale additionally passes the list-mode rerender acknowledgement path, normal-motion XP/progress count-up, immediate reduced-motion final values, visible milestone rows, and the surface-wide reduced-motion matrix. Chrome for Testing repeated the soft/medium completion paths and accepted the real optional-history permission prompt.

Product-owner judgment of reward meaning remains explicitly pending in `QA.md`; recovery fault-injection items are tracked separately from gamification presentation.
