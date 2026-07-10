import { describe, expect, it, vi } from "vitest";
import { RECOMMENDATIONS_KEY } from "./recommend";
import { runRecommendationPipeline, type HistoryClient } from "./history";

describe("deterministic recommendation pipeline fixture", () => {
  it("produces stable domain-only recommendations from 1,000 history items", async () => {
    const now = new Date(2026, 6, 7, 0, 0, 0, 0).getTime();
    const fixture = makeHistoryFixture(now);
    const fixtureByUrl = new Map(fixture.map((item) => [item.url, item]));
    const client: HistoryClient = {
      search: vi.fn(async (query) =>
        fixture.filter((item) => {
          const lastVisitTime = item.lastVisitTime ?? 0;
          return lastVisitTime >= (query.startTime ?? 0) && lastVisitTime < (query.endTime ?? Number.MAX_SAFE_INTEGER);
        })
      ),
      getVisits: vi.fn(async ({ url }) => {
        const item = fixtureByUrl.get(url);
        return item?.lastVisitTime === undefined
          ? []
          : [{
              id: item.id,
              visitId: item.id,
              referringVisitId: "0",
              transition: "link",
              visitTime: item.lastVisitTime
            }];
      })
    };
    const stored: Record<string, unknown> = {};
    const storageArea = {
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(stored, items);
      })
    };

    const recommendations = await runRecommendationPipeline(client, storageArea, {
      now,
      blockedDomains: ["instagram.com"],
      focusHours: { startHHMM: "09:00", endHHMM: "18:00" }
    });

    expect(fixture).toHaveLength(1_000);
    expect(client.search).toHaveBeenCalledTimes(30);
    expect(client.getVisits).toHaveBeenCalledTimes(1_000);
    expect(recommendations.map((recommendation) => recommendation.domain)).toEqual([
      "dcinside.com",
      "namu.wiki",
      "news.naver.com"
    ]);
    expect(recommendations.map((recommendation) => recommendation.visits)).toEqual([240, 200, 160]);
    expect(stored[RECOMMENDATIONS_KEY]).toEqual(recommendations);
    expect(storageArea.set).toHaveBeenCalledWith({ [RECOMMENDATIONS_KEY]: recommendations });
    expect(
      recommendations.every((recommendation) => !recommendation.domain.includes("/") && !recommendation.domain.includes(":"))
    ).toBe(true);
  });
});

function makeHistoryFixture(now: number): chrome.history.HistoryItem[] {
  const domains = [
    { domain: "instagram.com", count: 300 },
    { domain: "dcinside.com", count: 240 },
    { domain: "namu.wiki", count: 200 },
    { domain: "news.naver.com", count: 160 },
    { domain: "docs.google.com", count: 100 }
  ];
  const items: chrome.history.HistoryItem[] = [];

  for (const { domain, count } of domains) {
    for (let index = 0; index < count; index += 1) {
      const dayOffset = items.length % 30;
      const visitTime = new Date(2026, 6, 6 - dayOffset, 10, 0, 0, 0).getTime();

      items.push({
        id: `${domain}-${index}`,
        url: `https://${domain}/fixture/${index}`,
        title: domain,
        visitCount: 99,
        typedCount: 0,
        lastVisitTime: Math.min(visitTime, now - 1)
      });
    }
  }

  return items;
}
