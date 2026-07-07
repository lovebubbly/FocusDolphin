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
  status: "active" | "resting" | "fresh";
  freezeConsumed: boolean;
  freezeAwarded: boolean;
  streakRestored: boolean;
  restStarted: boolean;
  freshStarted: boolean;
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

function withStreakState(
  state: PetState,
  patch: Partial<Pick<PetState, "streakDays" | "streakFreezes" | "lastActiveDate">> & {
    stateName?: PetState["streak"]["state"];
    restingSince?: string;
  }
): PetState {
  const streakDays = patch.streakDays ?? state.streakDays;
  const streakFreezes = patch.streakFreezes ?? state.streakFreezes;
  const streakState = patch.stateName ?? state.streak?.state ?? (streakDays > 0 ? "active" : "fresh");

  return {
    ...state,
    streakDays,
    streakFreezes,
    lastActiveDate: patch.lastActiveDate ?? state.lastActiveDate,
    streak: {
      days: streakDays,
      state: streakState,
      restingSince: patch.restingSince,
      freezes: streakFreezes
    }
  };
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
        state: withStreakState(state, { stateName: "active" }),
        recovery: { ...EMPTY_STREAK_RECOVERY, processedThroughDate: dateKey },
        status: "active",
        freezeConsumed: false,
        freezeAwarded: false,
        streakRestored: false,
        restStarted: false,
        freshStarted: false
      };
    }

    const restored = recovery.pending;
    const nextStreakDays = recovery.pending
      ? Math.max(1, Math.floor(recovery.previousStreakDays * 0.5) + 1)
      : referenceDate && daysBetween(referenceDate, dateKey) === 1
        ? state.streakDays + 1
        : 1;

    const shouldAwardFreeze = nextStreakDays > 0 && nextStreakDays % 7 === 0 && state.streakFreezes < MAX_FREEZES;
    const nextState: PetState = withStreakState(state, {
      streakDays: nextStreakDays,
      streakFreezes: shouldAwardFreeze ? state.streakFreezes + 1 : state.streakFreezes,
      lastActiveDate: dateKey,
      stateName: "active"
    });

    return {
      state: nextState,
      recovery: { ...EMPTY_STREAK_RECOVERY, processedThroughDate: dateKey },
      status: "active",
      freezeConsumed: false,
      freezeAwarded: shouldAwardFreeze,
      streakRestored: restored,
      restStarted: false,
      freshStarted: false
    };
  }

  if (state.streakDays <= 0 || referenceDate === dateKey) {
    return {
      state: withStreakState(state, { stateName: recovery.pending ? "resting" : state.streak?.state ?? "fresh", restingSince: recovery.missedDate }),
      recovery: { ...recovery, processedThroughDate: referenceDate || recovery.processedThroughDate },
      status: recovery.pending ? "resting" : state.streak?.state === "fresh" ? "fresh" : "active",
      freezeConsumed: false,
      freezeAwarded: false,
      streakRestored: false,
      restStarted: false,
      freshStarted: false
    };
  }

  if (!recovery.pending && state.streakFreezes > 0) {
    return {
      state: withStreakState(state, { streakFreezes: state.streakFreezes - 1, stateName: "active" }),
      recovery: {
        ...EMPTY_STREAK_RECOVERY,
        processedThroughDate: dateKey
      },
      status: "active",
      freezeConsumed: true,
      freezeAwarded: false,
      streakRestored: false,
      restStarted: false,
      freshStarted: false
    };
  }

  if (recovery.pending && recovery.missedDate && daysBetween(recovery.missedDate, dateKey) >= 7) {
    return {
      state: withStreakState(state, {
        streakDays: 0,
        stateName: "fresh",
        restingSince: undefined
      }),
      recovery: { ...EMPTY_STREAK_RECOVERY, processedThroughDate: dateKey },
      status: "fresh",
      freezeConsumed: false,
      freezeAwarded: false,
      streakRestored: false,
      restStarted: false,
      freshStarted: true
    };
  }

  const previousStreakDays = recovery.pending ? recovery.previousStreakDays : state.streakDays;

  return {
    state: withStreakState(state, { stateName: "resting", restingSince: recovery.missedDate ?? dateKey }),
    recovery: {
      pending: true,
      previousStreakDays,
      missedDate: recovery.missedDate ?? dateKey,
      processedThroughDate: dateKey
    },
    status: "resting",
    freezeConsumed: false,
    freezeAwarded: false,
    streakRestored: false,
    restStarted: !recovery.pending,
    freshStarted: false
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
    status: initialRecovery.pending ? "resting" : state.streak?.state === "fresh" ? "fresh" : "active",
    freezeConsumed: false,
    freezeAwarded: false,
    streakRestored: false,
    restStarted: false,
    freshStarted: false
  };

  for (let dateKey = firstDate; compareDateKeys(dateKey, todayKey) < 0; dateKey = addDays(dateKey, 1)) {
    const next = transitionStreakDay(result.state, achievedDates.has(dateKey), dateKey, result.recovery);
    result = {
      ...next,
      freezeConsumed: result.freezeConsumed || next.freezeConsumed,
      freezeAwarded: result.freezeAwarded || next.freezeAwarded,
      streakRestored: result.streakRestored || next.streakRestored,
      restStarted: result.restStarted || next.restStarted,
      freshStarted: result.freshStarted || next.freshStarted
    };
  }

  if (achievedDates.has(todayKey)) {
    const next = transitionStreakDay(result.state, true, todayKey, result.recovery);
    result = {
      ...next,
      freezeConsumed: result.freezeConsumed || next.freezeConsumed,
      freezeAwarded: result.freezeAwarded || next.freezeAwarded,
      streakRestored: result.streakRestored || next.streakRestored,
      restStarted: result.restStarted || next.restStarted,
      freshStarted: result.freshStarted || next.freshStarted
    };
  }

  return result;
}
