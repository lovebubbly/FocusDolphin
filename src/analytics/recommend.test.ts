import { describe, expect, it } from "vitest";
import { makeEmptyMinuteVisits, type DomainHistoryStats } from "./history";
import { focusHourRatio, isBlockedDomain, rankRecommendations, recommendationScore } from "./recommend";

describe("recommendation scoring", () => {
  it("ranks by weighted score, focus-hour ratio, and excludes blocked/study/dev domains", () => {
    const stats: DomainHistoryStats[] = [
      makeStats("m.youtube.com", "video", 500, { 600: 500 }),
      makeStats("instagram.com", "sns", 100, { 600: 100 }),
      makeStats("dcinside.com", "community", 120, { 1_380: 120 }),
      makeStats("namu.wiki", "entertainment", 180, { 600: 90, 1_380: 90 }),
      makeStats("github.com", "dev", 1_000, { 600: 1_000 }),
      makeStats("docs.google.com", "study", 1_000, { 600: 1_000 })
    ];

    const recommendations = rankRecommendations(stats, {
      blockedDomains: ["youtube.com"],
      focusHours: { startHHMM: "09:00", endHHMM: "18:00" }
    });

    expect(recommendations.map((recommendation) => recommendation.domain)).toEqual([
      "instagram.com",
      "namu.wiki",
      "dcinside.com"
    ]);
    expect(recommendations.some((recommendation) => recommendation.domain.includes("youtube"))).toBe(false);
    expect(recommendations.some((recommendation) => recommendation.category === "study")).toBe(false);
    expect(recommendations.some((recommendation) => recommendation.category === "dev")).toBe(false);
  });

  it("keeps focus-hour weight in the 1.0 to 2.0 range", () => {
    const lowFocus = recommendationScore(10, "sns", 0);
    const highFocus = recommendationScore(10, "sns", 1);

    expect(highFocus).toBeCloseTo(lowFocus * 2);
  });

  it("supports overnight focus-hour ranges", () => {
    const minuteVisits = makeEmptyMinuteVisits();
    minuteVisits[23 * 60 + 30] = 3;
    minuteVisits[60 + 30] = 1;
    minuteVisits[12 * 60] = 4;

    expect(focusHourRatio(minuteVisits, { startHHMM: "22:00", endHHMM: "02:00" })).toBe(0.5);
  });

  it("honors minute-level focus boundaries", () => {
    const minuteVisits = makeEmptyMinuteVisits();
    minuteVisits[9 * 60 + 29] = 1;
    minuteVisits[9 * 60 + 30] = 2;
    minuteVisits[10 * 60 + 29] = 3;
    minuteVisits[10 * 60 + 30] = 4;

    expect(focusHourRatio(minuteVisits, { startHHMM: "09:30", endHHMM: "10:30" })).toBe(0.5);
  });

  it("matches blocked root domains against subdomains", () => {
    expect(isBlockedDomain("m.youtube.com", ["youtube.com"])).toBe(true);
    expect(isBlockedDomain("youtube.com", ["m.youtube.com"])).toBe(false);
  });
});

function makeStats(
  domain: string,
  category: DomainHistoryStats["category"],
  visits: number,
  minuteCounts: Record<number, number>
): DomainHistoryStats {
  const minuteVisits = makeEmptyMinuteVisits();
  for (const [minute, value] of Object.entries(minuteCounts)) {
    minuteVisits[Number(minute)] = value;
  }

  return { domain, category, visits, minuteVisits };
}
