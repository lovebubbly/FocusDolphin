import type { Category } from "./categories";
import type { DomainHistoryStats } from "./history";

export const RECOMMENDATIONS_KEY = "recommendations";

export interface FocusHours {
  startHHMM: string;
  endHHMM: string;
}

export interface Recommendation {
  domain: string;
  category: Category;
  score: number;
  visits: number;
  focusVisitRatio: number;
}

export interface RecommendationOptions {
  blockedDomains?: readonly string[];
  focusHours?: FocusHours;
  limit?: number;
}

const CATEGORY_WEIGHTS: Record<Category, number> = {
  sns: 2,
  video: 2,
  community: 2,
  news: 1.2,
  shopping: 1.2,
  game: 2,
  entertainment: 1.5,
  study: 0,
  dev: 0,
  tools: 0.5,
  uncategorized: 0.5
};

export function rankRecommendations(
  domainStats: readonly DomainHistoryStats[],
  options: RecommendationOptions = {}
): Recommendation[] {
  const limit = options.limit ?? 10;

  return domainStats
    .filter((stats) => !isBlockedDomain(stats.domain, options.blockedDomains ?? []))
    .map((stats) => {
      const focusVisitRatio = focusHourRatio(stats.minuteVisits, options.focusHours);
      const score = recommendationScore(stats.visits, stats.category, focusVisitRatio);

      return {
        domain: stats.domain,
        category: stats.category,
        score,
        visits: stats.visits,
        focusVisitRatio
      };
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => {
      const byScore = right.score - left.score;
      if (byScore !== 0) {
        return byScore;
      }

      const byVisits = right.visits - left.visits;
      return byVisits !== 0 ? byVisits : left.domain.localeCompare(right.domain);
    })
    .slice(0, limit);
}

export function recommendationScore(visits: number, category: Category, focusVisitRatio: number): number {
  const boundedRatio = Math.min(1, Math.max(0, focusVisitRatio));
  return Math.log1p(Math.max(0, visits)) * CATEGORY_WEIGHTS[category] * (1 + boundedRatio);
}

export function focusHourRatio(minuteVisits: Readonly<Record<number, number>>, focusHours?: FocusHours): number {
  const entries = Object.entries(minuteVisits).map(([minute, visits]) => [Number(minute), Math.max(0, visits)] as const);
  const totalVisits = entries.reduce((sum, [, visits]) => sum + visits, 0);

  if (!focusHours || totalVisits === 0) {
    return 0;
  }

  const startMinute = parseHHMM(focusHours.startHHMM);
  const endMinute = parseHHMM(focusHours.endHHMM);

  if (startMinute === undefined || endMinute === undefined || startMinute === endMinute) {
    return 0;
  }

  const focusVisits = entries.reduce((sum, [minute, visits]) => (
    isMinuteInRange(minute, startMinute, endMinute) ? sum + visits : sum
  ), 0);

  return focusVisits / totalVisits;
}

export function isBlockedDomain(domainInput: string, blockedDomains: readonly string[]): boolean {
  const domain = normalizeDomainForMatch(domainInput);

  return blockedDomains.some((blocked) => {
    const blockedDomain = normalizeDomainForMatch(blocked);
    return Boolean(blockedDomain) && (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`));
  });
}

function parseHHMM(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return undefined;
  }

  return hours * 60 + minutes;
}

function isMinuteInRange(minute: number, startMinute: number, endMinute: number): boolean {
  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }

  return minute >= startMinute || minute < endMinute;
}

function normalizeDomainForMatch(input: string): string {
  return input.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//u, "").split(/[/?#]/u)[0]?.replace(/^\.+|\.+$/gu, "").replace(/^www\./u, "") ?? "";
}
