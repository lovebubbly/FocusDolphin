import { describe, expect, it } from "vitest";
import type { PetState, Session } from "../shared/types";
import { normalizePetState } from "./defaultState";
import { dateKeyInKst, reconcileStreakFromSessions, transitionStreakDay } from "./streak";

function petState(overrides: Partial<PetState> = {}): PetState {
  return normalizePetState({
    stage: 0,
    xp: 0,
    streakDays: 0,
    streakFreezes: 0,
    lastActiveDate: "",
    badges: [],
    ...overrides
  });
}

function completedSession(id: string, endsAt: string): Session {
  const end = Date.parse(endsAt);

  return {
    id,
    source: "manual",
    listId: "list-1",
    intensity: "medium",
    startedAt: end - 25 * 60_000,
    endsAt: end,
    status: "completed",
    snoozeCount: 0,
    nextSnoozeDelayMin: 5
  };
}

describe("streak transitions", () => {
  it("increments when a completed session lands on the next local day", () => {
    const result = transitionStreakDay(
      petState({ streakDays: 3, lastActiveDate: "2026-07-05" }),
      true,
      "2026-07-06"
    );

    expect(result.state).toMatchObject({ streakDays: 4, lastActiveDate: "2026-07-06" });
    expect(result.status).toBe("active");
  });

  it("consumes a freeze for a missed day and preserves continuity", () => {
    const missed = transitionStreakDay(
      petState({ streakDays: 5, streakFreezes: 1, lastActiveDate: "2026-07-05" }),
      false,
      "2026-07-06"
    );
    const recovered = transitionStreakDay(missed.state, true, "2026-07-07", missed.recovery);

    expect(missed.freezeConsumed).toBe(true);
    expect(missed.state).toMatchObject({ streakDays: 5, streakFreezes: 0 });
    expect(recovered.state).toMatchObject({ streakDays: 6, lastActiveDate: "2026-07-07" });
  });

  it("keeps resting visible and restores half plus today", () => {
    const missed = transitionStreakDay(
      petState({ streakDays: 9, streakFreezes: 0, lastActiveDate: "2026-07-05" }),
      false,
      "2026-07-06"
    );
    const recovered = transitionStreakDay(missed.state, true, "2026-07-07", missed.recovery);

    expect(missed.status).toBe("resting");
    expect(missed.state.streakDays).toBe(9);
    expect(missed.recovery).toMatchObject({ pending: true, previousStreakDays: 9 });
    expect(recovered.state.streakDays).toBe(5);
    expect(recovered.streakRestored).toBe(true);
  });

  it("turns a long rest into a fresh start without deleting history", () => {
    const result = transitionStreakDay(
      petState({ streakDays: 9, streakFreezes: 0, lastActiveDate: "2026-07-05" }),
      false,
      "2026-07-13",
      { pending: true, previousStreakDays: 9, missedDate: "2026-07-06", processedThroughDate: "2026-07-12" }
    );

    expect(result.status).toBe("fresh");
    expect(result.state.streakDays).toBe(0);
    expect(result.freshStarted).toBe(true);
  });

  it("awards one freeze per seven-day milestone with a maximum of two", () => {
    const day7 = transitionStreakDay(
      petState({ streakDays: 6, streakFreezes: 0, lastActiveDate: "2026-07-05" }),
      true,
      "2026-07-06"
    );
    const day14 = transitionStreakDay(
      petState({ streakDays: 13, streakFreezes: 1, lastActiveDate: "2026-07-12" }),
      true,
      "2026-07-13"
    );
    const day21 = transitionStreakDay(
      petState({ streakDays: 20, streakFreezes: 2, lastActiveDate: "2026-07-19" }),
      true,
      "2026-07-20"
    );

    expect(day7.state.streakFreezes).toBe(1);
    expect(day14.state.streakFreezes).toBe(2);
    expect(day21.state.streakFreezes).toBe(2);
  });

  it("uses Asia/Seoul date boundaries when reconciling sessions", () => {
    const result = reconcileStreakFromSessions(
      petState(),
      [completedSession("kst-session", "2026-07-05T15:30:00Z")],
      { now: new Date("2026-07-06T12:00:00+09:00") }
    );

    expect(dateKeyInKst(Date.parse("2026-07-05T15:30:00Z"))).toBe("2026-07-06");
    expect(result.state).toMatchObject({ streakDays: 1, lastActiveDate: "2026-07-06" });
  });
});
