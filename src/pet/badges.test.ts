import { describe, expect, it } from "vitest";
import type { PetState, Session, SiteList } from "../shared/types";
import { awardBadges, BADGE_IDS } from "./badges";

const SITE_LISTS: SiteList[] = [
  { id: "allow", name: "Allow", mode: "allowlist", domains: ["docs.google.com"] },
  { id: "block", name: "Block", mode: "blocklist", domains: ["youtube.com"] }
];

function petState(overrides: Partial<PetState> = {}): PetState {
  return {
    stage: 0,
    xp: 0,
    streakDays: 0,
    streakFreezes: 0,
    lastActiveDate: "",
    badges: [],
    ...overrides
  };
}

function completedSession(id: string, listId: string, start: string, minutes: number, hard = false): Session {
  const startedAt = Date.parse(start);

  return {
    id,
    source: "manual",
    listId,
    intensity: hard ? "hard" : "medium",
    startedAt,
    endsAt: startedAt + minutes * 60_000,
    status: "completed",
    snoozeCount: 0,
    nextSnoozeDelayMin: 5
  };
}

describe("awardBadges", () => {
  it("awards every collection badge without removing existing badges", () => {
    const sessions: Session[] = [
      completedSession("s1", "allow", "2026-06-29T09:00:00+09:00", 300, true),
      completedSession("s2", "allow", "2026-06-30T09:00:00+09:00", 300),
      completedSession("s3", "allow", "2026-07-01T09:00:00+09:00", 300),
      completedSession("s4", "allow", "2026-07-02T09:00:00+09:00", 300),
      completedSession("s5", "allow", "2026-07-03T09:00:00+09:00", 300),
      completedSession("s6", "allow", "2026-07-04T09:00:00+09:00", 300),
      completedSession("s7", "allow", "2026-07-05T09:00:00+09:00", 300),
      completedSession("s8", "allow", "2026-07-06T09:00:00+09:00", 300),
      completedSession("s9", "allow", "2026-07-07T09:00:00+09:00", 300),
      completedSession("s10", "allow", "2026-07-08T09:00:00+09:00", 300),
      completedSession("s11", "block", "2026-07-09T09:00:00+09:00", 25)
    ];

    const result = awardBadges(petState({ streakDays: 30, badges: ["legacy-badge"] }), sessions, SITE_LISTS);
    const secondPass = awardBadges(result, sessions, SITE_LISTS);

    expect(result.badges).toEqual([
      "legacy-badge",
      BADGE_IDS.firstSession,
      BADGE_IDS.firstHard,
      BADGE_IDS.focus10Hours,
      BADGE_IDS.focus50Hours,
      BADGE_IDS.fiveDayWeek,
      BADGE_IDS.allowlist10,
      BADGE_IDS.streak7,
      BADGE_IDS.streak30
    ]);
    expect(secondPass.badges).toEqual(result.badges);
  });
});
