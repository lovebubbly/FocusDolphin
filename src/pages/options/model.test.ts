import { describe, expect, it, vi } from "vitest";
import type { Recommendation } from "../../analytics/recommend";
import type { SiteList } from "../../shared/types";
import {
  addRecommendationToBlocklist,
  blockedDomainsFromLists,
  collectDailyStats,
  isOptionsLocked,
  normalizeDomainList,
  normalizeOptionsSettings
} from "./model";

describe("options model helpers", () => {
  it("collects daily stats from storage snapshots in date order", () => {
    const stats = collectDailyStats({
      "dailyStats:2026-07-07": { date: "2026-07-07", focusMinutes: 20, blockedAttempts: 2, overrides: 0, domainVisits: {} },
      unrelated: true,
      "dailyStats:2026-07-06": { date: "2026-07-06", focusMinutes: 10, blockedAttempts: 1, overrides: 1, domainVisits: {} }
    });

    expect(stats.map((entry) => entry.date)).toEqual(["2026-07-06", "2026-07-07"]);
  });

  it("normalizes settings and domain lists", () => {
    expect(normalizeOptionsSettings({ focusHours: { startHHMM: "25:00" }, softOverlaySeconds: 100 })).toEqual({
      focusHours: { startHHMM: "09:00", endHHMM: "12:00" },
      softOverlaySeconds: 60
    });
    expect(normalizeDomainList("https://www.Example.com/a\ninstagram.com, example.com")).toEqual([
      "example.com",
      "instagram.com"
    ]);
  });

  it("adds recommendations only through a blocklist", () => {
    vi.setSystemTime(new Date("2026-07-06T00:00:00Z"));
    const lists: SiteList[] = [{ id: "a", name: "A", mode: "allowlist", domains: ["docs.google.com"] }];
    const rec: Recommendation = { domain: "youtube.com", category: "video", score: 10, visits: 100, focusVisitRatio: 0.5 };

    expect(addRecommendationToBlocklist(lists, rec)).toEqual([
      ...lists,
      { id: "recommended-blocklist", name: "추천 차단 목록", mode: "blocklist", domains: ["youtube.com"] }
    ]);
  });

  it("dedupes blocked domains and locks options during any active session", () => {
    expect(blockedDomainsFromLists([
      { id: "a", name: "A", mode: "blocklist", domains: ["youtube.com", "www.youtube.com"] },
      { id: "b", name: "B", mode: "allowlist", domains: ["docs.google.com"] }
    ])).toEqual(["youtube.com"]);

    for (const intensity of ["soft", "medium", "hard"] as const) {
      expect(isOptionsLocked({
        id: `s-${intensity}`,
        source: "manual",
        listId: "a",
        intensity,
        startedAt: 0,
        endsAt: Date.now() + 60_000,
        status: "active",
        snoozeCount: 0,
        nextSnoozeDelayMin: 15
      })).toBe(true);
    }

    expect(isOptionsLocked({
      id: "ended",
      source: "manual",
      listId: "a",
      intensity: "hard",
      startedAt: 0,
      endsAt: Date.now() - 1,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    })).toBe(false);
  });
});
