import { describe, expect, it } from "vitest";
import { aggregateDashboard } from "./aggregate";
import type { DailyStats, Session } from "../shared/types";

describe("aggregateDashboard", () => {
  it("summarizes weekly stats, categories, sessions, and blocked attempts without invented time metrics", () => {
    const dailyStats: DailyStats[] = [
      {
        date: "2026-07-06",
        focusMinutes: 50,
        blockedAttempts: 3,
        overrides: 1,
        domainVisits: {
          "instagram.com": 7,
          "docs.google.com": 5
        }
      },
      {
        date: "2026-07-12",
        focusMinutes: 25,
        blockedAttempts: 2,
        overrides: 0,
        domainVisits: {
          "m.youtube.com": 4,
          "unknown.example": 2
        }
      },
      {
        date: "2026-07-13",
        focusMinutes: 30,
        blockedAttempts: 1,
        overrides: 1,
        domainVisits: {
          "github.com": 6
        }
      }
    ];
    const sessions: Session[] = [
      makeSession("completed"),
      makeSession("completed"),
      makeSession("aborted"),
      makeSession("interrupted")
    ];

    const result = aggregateDashboard(dailyStats, sessions);

    expect(result.totalFocusMinutes).toBe(105);
    expect(result.blockedAttempts).toBe(6);
    expect(result.overrides).toBe(2);
    expect(result.categories.sns.visits).toBe(7);
    expect(result.categories.video.visits).toBe(4);
    expect(result.categories.study.visits).toBe(5);
    expect(result.categories.dev.visits).toBe(6);
    expect(result.categories.uncategorized.visits).toBe(2);
    expect(result.weekly).toHaveLength(2);
    expect(result.weekly[0]).toMatchObject({
      weekStart: "2026-07-06",
      focusMinutes: 75,
      blockedAttempts: 5,
      overrides: 1
    });
    expect(result.weekly[1]).toMatchObject({
      weekStart: "2026-07-13",
      focusMinutes: 30,
      blockedAttempts: 1,
      overrides: 1
    });
    expect(result.sessions).toEqual({
      completed: 2,
      aborted: 1,
      interrupted: 1,
      active: 0
    });
    expect(result).not.toHaveProperty("savedTime");
  });
});

function makeSession(status: Session["status"]): Session {
  return {
    id: status,
    source: "manual",
    listId: "default",
    intensity: "soft",
    startedAt: 0,
    endsAt: 1,
    status,
    snoozeCount: 0,
    nextSnoozeDelayMin: 5
  };
}
