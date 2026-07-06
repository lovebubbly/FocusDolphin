import { categoryForDomain, type Category, type CategoryOverrides } from "./categories";
import { rankRecommendations, RECOMMENDATIONS_KEY, type Recommendation } from "./recommend";

const DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_WINDOW_MAX_RESULTS = 5_000;

export interface HistoryClient {
  search(query: chrome.history.HistoryQuery): Promise<chrome.history.HistoryItem[]>;
}

export interface HistoryCollectionOptions {
  now?: number;
  lookbackDays?: number;
  maxResultsPerWindow?: number;
}

export interface DomainHistoryStats {
  domain: string;
  visits: number;
  hourlyVisits: number[];
  category: Category;
}

export interface RecommendationPipelineOptions extends HistoryCollectionOptions {
  blockedDomains?: readonly string[];
  categoryOverrides?: CategoryOverrides;
  focusHours?: { startHHMM: string; endHHMM: string };
  limit?: number;
}

export const chromeHistoryClient: HistoryClient = {
  async search(query) {
    return new Promise((resolve, reject) => {
      try {
        chrome.history.search(query, (items) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }

          resolve(items);
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
};

export async function collectHistoryItems(
  client: HistoryClient,
  options: HistoryCollectionOptions = {}
): Promise<chrome.history.HistoryItem[]> {
  const now = options.now ?? Date.now();
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxResultsPerWindow = options.maxResultsPerWindow ?? DEFAULT_WINDOW_MAX_RESULTS;
  const byUrl = new Map<string, chrome.history.HistoryItem>();

  for (let offset = lookbackDays - 1; offset >= 0; offset -= 1) {
    const startTime = now - (offset + 1) * DAY_MS;
    const endTime = now - offset * DAY_MS;
    const items = await client.search({
      text: "",
      startTime,
      endTime,
      maxResults: maxResultsPerWindow
    });

    for (const item of items) {
      const url = item.url;
      if (!url) {
        continue;
      }

      byUrl.set(url, mergeHistoryItem(byUrl.get(url), item));
    }
  }

  return Array.from(byUrl.values());
}

export async function collectDomainHistory(
  client: HistoryClient,
  options: HistoryCollectionOptions & { categoryOverrides?: CategoryOverrides } = {}
): Promise<DomainHistoryStats[]> {
  const items = await collectHistoryItems(client, options);
  return summarizeHistoryByDomain(items, options.categoryOverrides);
}

export function summarizeHistoryByDomain(
  items: readonly chrome.history.HistoryItem[],
  categoryOverrides: CategoryOverrides = {}
): DomainHistoryStats[] {
  const byDomain = new Map<string, DomainHistoryStats>();

  for (const item of items) {
    const domain = domainFromUrl(item.url);
    if (!domain) {
      continue;
    }

    const visits = Math.max(1, item.visitCount ?? 1);
    const existing = byDomain.get(domain) ?? {
      domain,
      visits: 0,
      hourlyVisits: makeEmptyHourlyVisits(),
      category: categoryForDomain(domain, categoryOverrides)
    };

    existing.visits += visits;

    if (typeof item.lastVisitTime === "number") {
      const hour = new Date(item.lastVisitTime).getHours();
      existing.hourlyVisits[hour] += visits;
    }

    byDomain.set(domain, existing);
  }

  return Array.from(byDomain.values()).sort((left, right) => left.domain.localeCompare(right.domain));
}

export async function runRecommendationPipeline(
  client: HistoryClient,
  storageArea: Pick<chrome.storage.StorageArea, "set">,
  options: RecommendationPipelineOptions = {}
): Promise<Recommendation[]> {
  const domainHistory = await collectDomainHistory(client, options);
  const recommendations = rankRecommendations(domainHistory, {
    blockedDomains: options.blockedDomains,
    focusHours: options.focusHours,
    limit: options.limit
  });

  await storageArea.set({ [RECOMMENDATIONS_KEY]: recommendations });

  return recommendations;
}

export function domainFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    return normalizeHostname(parsed.hostname);
  } catch {
    return undefined;
  }
}

export function makeEmptyHourlyVisits(): number[] {
  return Array.from({ length: 24 }, () => 0);
}

function mergeHistoryItem(
  existing: chrome.history.HistoryItem | undefined,
  next: chrome.history.HistoryItem
): chrome.history.HistoryItem {
  if (!existing) {
    return next;
  }

  return {
    ...next,
    visitCount: Math.max(existing.visitCount ?? 0, next.visitCount ?? 0),
    typedCount: Math.max(existing.typedCount ?? 0, next.typedCount ?? 0),
    lastVisitTime: Math.max(existing.lastVisitTime ?? 0, next.lastVisitTime ?? 0)
  };
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\.+|\.+$/gu, "").replace(/^www\./u, "");
}
