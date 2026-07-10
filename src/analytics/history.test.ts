import { describe, expect, it, vi } from "vitest";
import {
  collectDomainHistory,
  collectHistoryItems,
  domainFromUrl,
  summarizeHistoryByDomain,
  type HistoryClient
} from "./history";

const DAY_MS = 24 * 60 * 60 * 1_000;

describe("history collection", () => {
  it("queries newest daily windows first, dedupes URLs, and respects the URL cap", async () => {
    const now = new Date(2026, 6, 7, 0, 0, 0, 0).getTime();
    const duplicateUrl = "https://www.youtube.com/watch?v=focus";
    const client: HistoryClient = {
      search: vi.fn(async (query) => {
        if (query.startTime === now - DAY_MS) {
          return [
            historyItem("newest", duplicateUrl, 99),
            historyItem("instagram", "https://m.instagram.com/reel/1", 88)
          ];
        }

        if (query.startTime === now - 2 * DAY_MS) {
          return [
            historyItem("older-duplicate", duplicateUrl, 2),
            historyItem("github", "https://github.com/openai", 77)
          ];
        }

        return [];
      }),
      getVisits: vi.fn(async () => [])
    };

    const items = await collectHistoryItems(client, { now, lookbackDays: 30, maxUrls: 3 });

    expect(client.search).toHaveBeenCalledTimes(2);
    expect(client.search).toHaveBeenNthCalledWith(1, {
      text: "",
      startTime: now - DAY_MS,
      endTime: now,
      maxResults: 5_000
    });
    expect(client.search).toHaveBeenNthCalledWith(2, {
      text: "",
      startTime: now - 2 * DAY_MS,
      endTime: now - DAY_MS,
      maxResults: 5_000
    });
    expect(items).toHaveLength(3);
    expect(items.find((item) => item.url === duplicateUrl)?.id).toBe("newest");
  });

  it("uses the 30-day sliding window default", async () => {
    const client: HistoryClient = {
      search: vi.fn(async () => []),
      getVisits: vi.fn(async () => [])
    };

    await collectHistoryItems(client, { now: 1_000_000 });

    expect(client.search).toHaveBeenCalledTimes(30);
  });
});

describe("domain aggregation", () => {
  it("counts individual visit events in their actual local hours by normalized domain", () => {
    const fourteen = new Date(2026, 6, 6, 14, 0, 0, 0).getTime();
    const fifteen = new Date(2026, 6, 6, 15, 0, 0, 0).getTime();
    const summary = summarizeHistoryByDomain([
      { url: "https://www.youtube.com/watch?v=1", visitTime: fourteen },
      { url: "https://www.youtube.com/watch?v=1", visitTime: fifteen },
      { url: "https://m.youtube.com/watch?v=2", visitTime: fourteen },
      { url: "not a url", visitTime: fourteen }
    ]);

    expect(summary).toHaveLength(2);
    expect(summary.find((entry) => entry.domain === "youtube.com")).toMatchObject({
      visits: 2,
      category: "video"
    });
    expect(summary.find((entry) => entry.domain === "youtube.com")?.minuteVisits[14 * 60]).toBe(1);
    expect(summary.find((entry) => entry.domain === "youtube.com")?.minuteVisits[15 * 60]).toBe(1);
    expect(summary.find((entry) => entry.domain === "m.youtube.com")).toMatchObject({
      visits: 1,
      category: "video"
    });
  });

  it("uses getVisits timestamps and ignores lifetime counters outside the requested window", async () => {
    const now = new Date(2026, 6, 7, 0, 0, 0, 0).getTime();
    const startTime = now - DAY_MS;
    const url = "https://docs.google.com/document/1";
    const client: HistoryClient = {
      search: vi.fn(async () => [historyItem("docs", url, 999)]),
      getVisits: vi.fn(async () => [
        visitItem("window-start", startTime),
        visitItem("evening", new Date(2026, 6, 6, 21, 0, 0, 0).getTime()),
        visitItem("old", startTime - 1),
        visitItem("future", now + 1),
        visitItem("missing-time")
      ])
    };

    await expect(
      collectDomainHistory(client, {
        now,
        lookbackDays: 1,
        categoryOverrides: { "docs.google.com": "tools" }
      })
    ).resolves.toMatchObject([
      {
        domain: "docs.google.com",
        visits: 2,
        category: "tools"
      }
    ]);
    expect(client.getVisits).toHaveBeenCalledOnce();
    expect(client.getVisits).toHaveBeenCalledWith({ url });
  });

  it("normalizes only valid URLs into domains", () => {
    expect(domainFromUrl("https://www.github.com/openai")).toBe("github.com");
    expect(domainFromUrl("http://www.github.com/openai")).toBe("github.com");
    expect(domainFromUrl("chrome://extensions")).toBeUndefined();
    expect(domainFromUrl("chrome-extension://abcdefghijklmnop/options.html")).toBeUndefined();
    expect(domainFromUrl("file:///tmp/focuswhale.html")).toBeUndefined();
    expect(domainFromUrl(undefined)).toBeUndefined();
    expect(domainFromUrl("not a url")).toBeUndefined();
  });
});

function historyItem(id: string, url: string, lifetimeVisitCount: number): chrome.history.HistoryItem {
  return {
    id,
    url,
    title: id,
    visitCount: lifetimeVisitCount,
    typedCount: lifetimeVisitCount
  };
}

function visitItem(id: string, visitTime?: number): chrome.history.VisitItem {
  return {
    id,
    visitId: id,
    referringVisitId: "0",
    transition: "link",
    visitTime
  };
}
