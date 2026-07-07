import { describe, expect, it } from "vitest";
import { normalizePetState } from "./defaultState";

describe("normalizePetState", () => {
  it("migrates legacy state to v2 without lowering the pet stage", () => {
    expect(normalizePetState({
      stage: 4,
      xp: 1_000,
      streakDays: 3,
      streakFreezes: 1,
      lastActiveDate: "2026-07-06",
      badges: ["first-session"]
    })).toMatchObject({
      version: 2,
      stage: 4,
      totalFocusMinutes: 1_000,
      streak: { days: 3, state: "active", freezes: 1 },
      badgeAwards: { "first-session": { earnedAt: 0 } }
    });
  });
});
