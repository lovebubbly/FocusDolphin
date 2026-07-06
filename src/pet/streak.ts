import type { PetState, Session } from "../shared/types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_FREEZES = 2;

export interface StreakRecoveryState {
  pending: boolean;
  previousStreakDays: number;
  missedDate?: string;
  processedThroughDate?: string;
}

export interface StreakTransitionResult {
  state: PetState;
  recovery: StreakRecoveryState;
  status: "active" | "recoveryPending";
  freezeConsumed: boolean;
  freezeAwarded: boolean;
}

export const EMPTY_STREAK_RECOVERY: StreakRecoveryState = {
  pending: false,
  previousStreakDays: 0
};

export function dateKeyInKst(value: Date | number): string {
  const timestamp = typeof value === "number" ? value : value.getTime();
  return new Date(timestamp + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number): string {
  const base = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

function daysBetween(left: string, right: string): number {
  const start = Date.parse(`${left}T00:00:00.000Z`);
  const end = Date.parse(`${right}T00:00:00.000Z`);
  return Math.round((end - start) / DAY_MS);
}

function completedSessionDateKeys(sessions: Session[]): Set<string> {
  return new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => dateKeyInKst(session.endsAt))
  );
}

function normalizeRecovery(recovery?: StreakRecoveryState): StreakRecoveryState {
  return {
    pending: recovery?.pending ?? false,
    previousStreakDays: Math.max(0, Math.round(recovery?.previousStreakDays ?? 0)),
    missedDate: recovery?.missedDate,
    processedThroughDate: recovery?.processedThroughDate
  };
}

function continuityDate(state: PetState, recovery: StreakRecoveryState): string {
  return recovery.processedThroughDate ?? state.lastActiveDate;
}

export function transitionStreakDay(
  state: PetState,
  completed: boolean,
  dateKey: string,
  recoveryValue?: StreakRecoveryState
): StreakTransitionResult {
  const recovery = normalizeRecovery(recoveryValue);
  const referenceDate = continuityDate(state, recovery);

  if (completed) {
    if (referenceDate === dateKey && !recovery.pending) {
      return {
        state,
        recovery: { ...EMPTY_STREAK_RECOVERY, processedThroughDate: dateKey },
        status: "active",
        freezeConsumed: false,
        freezeAwarded: false
      };
    }

    const nextStreakDays = recovery.pending
      ? Math.max(1, Math.round(recovery.previousStreakDays * 0.5))
      : referenceDate && daysBetween(referenceDate, dateKey) === 1
        ? state.streakDays + 1
        : 1;

    const shouldAwardFreeze = nextStreakDays > 0 && nextStreakDays % 7 === 0 && state.streakFreezes < MAX_FREEZES;
    const nextState: PetState = {
      ...state,
      streakDays: nextStreakDays,
      streakFreezes: shouldAwardFreeze ? state.streakFreezes + 1 : state.streakFreezes,
      lastActiveDate: dateKey
    };

    return {
      state: nextState,
      recovery: { ...EMPTY_STREAK_RECOVERY, processedThroughDate: dateKey },
      status: "active",
      freezeConsumed: false,
      freezeAwarded: shouldAwardFreeze
    };
  }

  if (state.streakDays <= 0 || referenceDate === dateKey) {
    return {
      state,
      recovery: { ...recovery, processedThroughDate: referenceDate || recovery.processedThroughDate },
      status: recovery.pending ? "recoveryPending" : "active",
      freezeConsumed: false,
      freezeAwarded: false
    };
  }

  if (!recovery.pending && state.streakFreezes > 0) {
    return {
      state: {
        ...state,
        streakFreezes: state.streakFreezes - 1
      },
      recovery: {
        ...EMPTY_STREAK_RECOVERY,
        processedThroughDate: dateKey
      },
      status: "active",
      freezeConsumed: true,
      freezeAwarded: false
    };
  }

  const previousStreakDays = recovery.pending ? recovery.previousStreakDays : state.streakDays;

  return {
    state,
    recovery: {
      pending: true,
      previousStreakDays,
      missedDate: recovery.missedDate ?? dateKey,
      processedThroughDate: dateKey
    },
    status: "recoveryPending",
    freezeConsumed: false,
    freezeAwarded: false
  };
}

export function reconcileStreakFromSessions(
  state: PetState,
  sessions: Session[],
  options: { now?: Date; recovery?: StreakRecoveryState } = {}
): StreakTransitionResult {
  const todayKey = dateKeyInKst(options.now ?? new Date());
  const achievedDates = completedSessionDateKeys(sessions);
  const sortedAchievedDates = Array.from(achievedDates).sort(compareDateKeys);
  const initialRecovery = normalizeRecovery(options.recovery);
  const referenceDate = continuityDate(state, initialRecovery);
  const firstDate = referenceDate ? addDays(referenceDate, 1) : sortedAchievedDates[0] ?? todayKey;

  let result: StreakTransitionResult = {
    state,
    recovery: initialRecovery,
    status: initialRecovery.pending ? "recoveryPending" : "active",
    freezeConsumed: false,
    freezeAwarded: false
  };

  for (let dateKey = firstDate; compareDateKeys(dateKey, todayKey) < 0; dateKey = addDays(dateKey, 1)) {
    const next = transitionStreakDay(result.state, achievedDates.has(dateKey), dateKey, result.recovery);
    result = {
      ...next,
      freezeConsumed: result.freezeConsumed || next.freezeConsumed,
      freezeAwarded: result.freezeAwarded || next.freezeAwarded
    };
  }

  if (achievedDates.has(todayKey)) {
    const next = transitionStreakDay(result.state, true, todayKey, result.recovery);
    result = {
      ...next,
      freezeConsumed: result.freezeConsumed || next.freezeConsumed,
      freezeAwarded: result.freezeAwarded || next.freezeAwarded
    };
  }

  return result;
}
