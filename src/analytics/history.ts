import { categoryForDomain, type Category, type CategoryOverrides } from "./categories";
import { rankRecommendations, RECOMMENDATIONS_KEY, type Recommendation } from "./recommend";

const DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_WINDOW_MAX_RESULTS = 5_000;
export const DEFAULT_MAX_HISTORY_URLS = 5_000;

export interface HistoryClient {
  search(query: chrome.history.HistoryQuery): Promise<chrome.history.HistoryItem[]>;
  getVisits(details: chrome.history.Url): Promise<chrome.history.VisitItem[]>;
}

export interface HistoryCollectionOptions {
  now?: number;
  lookbackDays?: number;
  maxResultsPerWindow?: number;
  maxUrls?: number;
}

export interface TimedHistoryVisit {
  url: string;
  visitTime: number;
}

export interface DomainHistoryStats {
  domain: string;
  visits: number;
  minuteVisits: Record<number, number>;
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
  },
  async getVisits(details) {
    return new Promise((resolve, reject) => {
      try {
        chrome.history.getVisits(details, (visits) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }

          resolve(visits);
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
  const maxUrls = options.maxUrls ?? DEFAULT_MAX_HISTORY_URLS;
  const byUrl = new Map<string, chrome.history.HistoryItem>();

  // Search returns URL summaries, not visits. Newest windows are sampled first so
  // the bounded visit lookup favors the user's most recent browsing activity.
  for (let offset = 0; offset < lookbackDays && byUrl.size < maxUrls; offset += 1) {
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

      if (!byUrl.has(url)) {
        byUrl.set(url, item);
      }

      if (byUrl.size >= maxUrls) {
        break;
      }
    }
  }

  return Array.from(byUrl.values());
}

export async function collectDomainHistory(
  client: HistoryClient,
  options: HistoryCollectionOptions & { categoryOverrides?: CategoryOverrides } = {}
): Promise<DomainHistoryStats[]> {
  const items = await collectHistoryItems(client, options);
  const now = options.now ?? Date.now();
  const startTime = now - (options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS) * DAY_MS;
  const byDomain = new Map<string, DomainHistoryStats>();

  // getVisits exposes the actual event timestamps. Lifetime HistoryItem counters
  // are deliberately ignored because they cannot describe a 30-day window.
  for (const item of items) {
    const url = item.url;
    const domain = domainFromUrl(url);
    if (!url || !domain) {
      continue;
    }

    const visits = await client.getVisits({ url });
    for (const visit of visits) {
      if (typeof visit.visitTime !== "number" || visit.visitTime < startTime || visit.visitTime > now) {
        continue;
      }

      addVisit(byDomain, { url, visitTime: visit.visitTime }, options.categoryOverrides);
    }
  }

  return sortedDomainStats(byDomain);
}

export function summarizeHistoryByDomain(
  visits: readonly TimedHistoryVisit[],
  categoryOverrides: CategoryOverrides = {}
): DomainHistoryStats[] {
  const byDomain = new Map<string, DomainHistoryStats>();

  for (const visit of visits) {
    addVisit(byDomain, visit, categoryOverrides);
  }

  return sortedDomainStats(byDomain);
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
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    return normalizeHostname(parsed.hostname);
  } catch {
    return undefined;
  }
}

export function makeEmptyMinuteVisits(): Record<number, number> {
  return {};
}

function addVisit(
  byDomain: Map<string, DomainHistoryStats>,
  visit: TimedHistoryVisit,
  categoryOverrides: CategoryOverrides = {}
): void {
  const domain = domainFromUrl(visit.url);
  if (!domain) {
    return;
  }

  const existing = byDomain.get(domain) ?? {
    domain,
    visits: 0,
    minuteVisits: makeEmptyMinuteVisits(),
    category: categoryForDomain(domain, categoryOverrides)
  };

  existing.visits += 1;
  const visitedAt = new Date(visit.visitTime);
  const minuteOfDay = visitedAt.getHours() * 60 + visitedAt.getMinutes();
  existing.minuteVisits[minuteOfDay] = (existing.minuteVisits[minuteOfDay] ?? 0) + 1;
  byDomain.set(domain, existing);
}

function sortedDomainStats(byDomain: Map<string, DomainHistoryStats>): DomainHistoryStats[] {
  return Array.from(byDomain.values()).sort((left, right) => left.domain.localeCompare(right.domain));
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\.+|\.+$/gu, "").replace(/^www\./u, "");
}
