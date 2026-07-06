import { describe, expect, it, vi } from "vitest";
import {
  collectDomainHistory,
  collectHistoryItems,
  domainFromUrl,
  summarizeHistoryByDomain,
  type HistoryClient
} from "./history";

describe("history collection", () => {
  it("queries recent history in daily windows with maxResults 5000 and dedupes by URL", async () => {
    const now = new Date(2026, 6, 7, 0, 0, 0, 0).getTime();
    const duplicateUrl = "https://www.youtube.com/watch?v=focus";
    const firstVisitTime = new Date(2026, 6, 5, 10, 0, 0, 0).getTime();
    const secondVisitTime = new Date(2026, 6, 6, 10, 0, 0, 0).getTime();
    const client: HistoryClient = {
      search: vi.fn(async (query) => {
        if (query.startTime === now - 2 * 24 * 60 * 60 * 1_000) {
          return [
            {
              id: "first",
              url: duplicateUrl,
              title: "Video",
              visitCount: 2,
              typedCount: 0,
              lastVisitTime: firstVisitTime
            }
          ];
        }

        if (query.startTime === now - 24 * 60 * 60 * 1_000) {
          return [
            {
              id: "second",
              url: duplicateUrl,
              title: "Video again",
              visitCount: 4,
              typedCount: 1,
              lastVisitTime: secondVisitTime
            },
            {
              id: "third",
              url: "https://m.instagram.com/reel/1",
              title: "SNS",
              visitCount: 3,
              typedCount: 0,
              lastVisitTime: secondVisitTime
            }
          ];
        }

        return [];
      })
    };

    const items = await collectHistoryItems(client, { now, lookbackDays: 2 });

    expect(client.search).toHaveBeenCalledTimes(2);
    expect(client.search).toHaveBeenNthCalledWith(1, {
      text: "",
      startTime: now - 2 * 24 * 60 * 60 * 1_000,
      endTime: now - 24 * 60 * 60 * 1_000,
      maxResults: 5_000
    });
    expect(client.search).toHaveBeenNthCalledWith(2, {
      text: "",
      startTime: now - 24 * 60 * 60 * 1_000,
      endTime: now,
      maxResults: 5_000
    });
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.url === duplicateUrl)).toMatchObject({
      visitCount: 4,
      typedCount: 1,
      lastVisitTime: secondVisitTime
    });
  });

  it("uses the 30-day sliding window default", async () => {
    const client: HistoryClient = { search: vi.fn(async () => []) };

    await collectHistoryItems(client, { now: 1_000_000 });

    expect(client.search).toHaveBeenCalledTimes(30);
  });
});

describe("domain aggregation", () => {
  it("aggregates visit counts and lastVisitTime hour distribution by normalized domain", async () => {
    const visitTime = new Date(2026, 6, 6, 14, 0, 0, 0).getTime();
    const summary = summarizeHistoryByDomain([
      {
        id: "one",
        url: "https://www.youtube.com/watch?v=1",
        title: "Video",
        visitCount: 2,
        typedCount: 0,
        lastVisitTime: visitTime
      },
      {
        id: "two",
        url: "https://m.youtube.com/watch?v=2",
        title: "Video",
        visitCount: 3,
        typedCount: 0,
        lastVisitTime: visitTime
      },
      {
        id: "invalid",
        url: "not a url",
        title: "Ignored",
        visitCount: 99,
        typedCount: 0,
        lastVisitTime: visitTime
      }
    ]);

    expect(summary).toHaveLength(2);
    expect(summary.find((entry) => entry.domain === "youtube.com")).toMatchObject({
      visits: 2,
      category: "video"
    });
    expect(summary.find((entry) => entry.domain === "m.youtube.com")).toMatchObject({
      visits: 3,
      category: "video"
    });
    expect(summary.find((entry) => entry.domain === "m.youtube.com")?.hourlyVisits[14]).toBe(3);
  });

  it("collects and categorizes domain history with overrides", async () => {
    const now = new Date(2026, 6, 7, 0, 0, 0, 0).getTime();
    const client: HistoryClient = {
      search: vi.fn(async () => [
        {
          id: "docs",
          url: "https://docs.google.com/document/1",
          title: "Doc",
          visitCount: 5,
          typedCount: 0,
          lastVisitTime: new Date(2026, 6, 6, 9, 0, 0, 0).getTime()
        }
      ])
    };

    await expect(
      collectDomainHistory(client, {
        now,
        lookbackDays: 1,
        categoryOverrides: { "docs.google.com": "tools" }
      })
    ).resolves.toMatchObject([{ domain: "docs.google.com", visits: 5, category: "tools" }]);
  });

  it("normalizes only valid URLs into domains", () => {
    expect(domainFromUrl("https://www.github.com/openai")).toBe("github.com");
    expect(domainFromUrl("chrome://extensions")).toBe("extensions");
    expect(domainFromUrl(undefined)).toBeUndefined();
    expect(domainFromUrl("not a url")).toBeUndefined();
  });
});
