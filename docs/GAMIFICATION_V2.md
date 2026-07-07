# FocusWhale Gamification v2

This document describes the current pet growth system implemented on July 7, 2026. It is the code-facing companion to the Notion v2 XP research/spec page.

## Product Rules

- The pet never dies, regresses, becomes sick, or displays a sad state.
- XP is not a constant HUD. It appears in the post-session overview and in user-opened growth details.
- Hard mode emergency escape remains available, but it is guarded by confirmation and weekly limits.
- Growth data stays local in extension storage.
- Browser history-derived recommendations remain domain-only and user-approved.
- UI copy must avoid shame, punishment, and loss-framed language.

## XP Formula

Completed sessions grant XP only once.

```text
XP = floor(completed_minutes * intensity_multiplier)
```

Intensity multipliers:

| Intensity | Multiplier | 25 min example |
| --- | ---: | ---: |
| soft | 1.0 | 25 XP |
| medium | 1.2 | 30 XP |
| hard | 1.5 | 37 XP |

Aborted and interrupted sessions do not subtract XP. They may create a neutral `session_ended_early` growth event for the ledger.

## Stage Thresholds

The v2 stage thresholds live in `src/shared/gamification.ts`.

| Stage | Name | XP threshold |
| --- | --- | ---: |
| 0 | 알 | 0 |
| 1 | 새끼 고래 | 100 |
| 2 | 어린 고래 | 600 |
| 3 | 푸른 고래 | 2,000 |
| 4 | 별고래 | 6,000 |

Migration must never lower an existing pet stage. `normalizePetState` preserves a higher stored stage even if the current XP would calculate a lower stage.

## Growth Ledger

Growth events are stored locally under `growthLog` as a capped newest-first ring buffer of 500 events. Pending post-session celebrations are stored locally under `pendingCelebrations` until the popup drains them.

Core event type:

```ts
interface GrowthEvent {
  id: string;
  ts: number;
  type:
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
  xpDelta?: number;
  xpBefore?: number;
  xpAfter?: number;
  progressBefore?: number;
  progressAfter?: number;
  minutes?: number;
  intensity?: "soft" | "medium" | "hard";
  sessionId?: string;
  badgeId?: string;
  stageFrom?: 0 | 1 | 2 | 3 | 4;
  stageTo?: 0 | 1 | 2 | 3 | 4;
  streakFrom?: number;
  streakTo?: number;
  text: string;
}
```

`session_completed` events include before/after XP and before/after progress values so the popup can animate growth without recalculating from ambiguous historic state.

## Post-Session Growth Overview

When the popup opens after a completed session, it drains `pendingCelebrations` and renders a post-session overview.

The overview includes:

- Happy pet sprite.
- Session summary: minutes, intensity, and awarded XP.
- Animated total XP count-up from `xpBefore` to `xpAfter`.
- Animated progress bar from `progressBefore` to `progressAfter`.
- Current stage name.
- Stage-up, half-way, badge, freeze, and streak milestones revealed as rows.
- Optional pet naming prompt after a stage-up when the pet has no saved name.
- A dismiss button that removes the overview from the current popup view.

Animation guardrails:

- `prefers-reduced-motion: reduce` is respected by jumping to final values.
- The growth overview is shown after a completed session, not during a blocked-page conflict moment.
- Blocked page and soft overlay do not show XP.

## Badges

Badge definitions live in `src/shared/gamification.ts`. Stored IDs remain stable, but user-facing names and descriptions are wellness-oriented.

Implemented badges:

- `first-session` -> 첫 물결
- `first-hard` -> 첫 깊은 잠수
- `focus-10-hours` -> 열 시간의 바다
- `focus-50-hours` -> 쉰 시간의 대양
- `five-day-week` -> 한 주의 리듬
- `allowlist-10` -> 등대지기
- `streak-7` -> 이레의 물살
- `streak-30` -> 서른 날의 해류
- `comeback` -> 다시 만난 바다
- `first-schedule` -> 물때표
- `steady-4w` -> 꾸준한 물결

Badges are additive-only. They are never removed as punishment.

## Streak And Freeze Language

User-facing streak states:

- `active`: `N일째`
- `resting`: `쉬는 중`
- `fresh`: `새 출발`

The legacy `recoveryPending` label should not appear in UI. Freeze copy uses `보호막`, not penalty language.

## Hard Emergency Exit

Hard mode has no temporary allow, but the emergency end valve remains.

Current behavior:

- Blocked page first shows `비상 종료 요청`.
- First click only opens a confirmation state.
- Second click schedules the emergency end.
- The session ends after a 5-minute delay.
- Emergency end requests are limited to one unique hard session per local week.
- Duplicate clicks for the same already pending hard session are idempotent and do not spend extra allowance.

Storage:

- `pendingEmergency`: `{ sessionId, dueAt }`
- `emergencyUsage`: `{ weekKey, sessionIds, usedAt }`

## Tests

Required checks:

```sh
npm run typecheck
npm test
npm run build
```

Coverage added for v2:

- XP floors hard 25-minute sessions to 37 XP.
- Stage thresholds are `100 / 600 / 2,000 / 6,000`.
- Growth ledger records `xpBefore`, `xpAfter`, `progressBefore`, and `progressAfter`.
- Pet state migration does not lower existing stage.
- Streak resting/fresh-start behavior.
- Hard emergency requests are one per local week.
- Wellness copy guard blocks shame/loss/punishment terms in UI-facing code.

## Manual QA

Suggested browser check after rebuilding and reloading `dist/`:

1. Start a short medium session.
2. Let it complete.
3. Open the popup.
4. Confirm the post-session growth overview appears.
5. Confirm total XP counts upward.
6. Confirm the progress bar fills.
7. Confirm happy pet animation plays.
8. Confirm stage-up or badge rows reveal when applicable.
9. Open `성장 자세히 보기` and confirm XP details are visible only there.
10. Start a hard session and open a blocked page.
11. Confirm emergency end requires two clicks.
12. Confirm a second hard session in the same week cannot schedule another emergency end.
