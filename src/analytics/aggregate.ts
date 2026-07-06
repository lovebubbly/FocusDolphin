import { categoryForDomain, type Category, type CategoryOverrides, CATEGORIES } from "./categories";
import type { DailyStats, Session } from "../shared/types";

export interface CategoryVisitSummary {
  visits: number;
  domains: number;
}

export interface WeeklySummary {
  weekStart: string;
  focusMinutes: number;
  blockedAttempts: number;
  overrides: number;
  categories: Record<Category, number>;
}

export interface SessionStatusSummary {
  completed: number;
  aborted: number;
  interrupted: number;
  active: number;
}

export interface DashboardAggregate {
  totalFocusMinutes: number;
  blockedAttempts: number;
  overrides: number;
  categories: Record<Category, CategoryVisitSummary>;
  weekly: WeeklySummary[];
  sessions: SessionStatusSummary;
}

export interface AggregateOptions {
  categoryOverrides?: CategoryOverrides;
  weekStartsOn?: 0 | 1;
}

export function aggregateDashboard(
  dailyStats: readonly DailyStats[],
  sessions: readonly Session[] = [],
  options: AggregateOptions = {}
): DashboardAggregate {
  const categoryOverrides = options.categoryOverrides ?? {};
  const categories = makeCategorySummary();
  const weekly = new Map<string, WeeklySummary>();
  let totalFocusMinutes = 0;
  let blockedAttempts = 0;
  let overrides = 0;

  for (const dailyStat of dailyStats) {
    totalFocusMinutes += dailyStat.focusMinutes;
    blockedAttempts += dailyStat.blockedAttempts;
    overrides += dailyStat.overrides;

    const weekStart = weekStartForDate(dailyStat.date, options.weekStartsOn ?? 1);
    const week = weekly.get(weekStart) ?? {
      weekStart,
      focusMinutes: 0,
      blockedAttempts: 0,
      overrides: 0,
      categories: makeCategoryVisitCounts()
    };

    week.focusMinutes += dailyStat.focusMinutes;
    week.blockedAttempts += dailyStat.blockedAttempts;
    week.overrides += dailyStat.overrides;

    for (const [domain, visits] of Object.entries(dailyStat.domainVisits)) {
      const safeVisits = Math.max(0, visits);
      const category = categoryForDomain(domain, categoryOverrides);

      categories[category].visits += safeVisits;
      categories[category].domains += 1;
      week.categories[category] += safeVisits;
    }

    weekly.set(weekStart, week);
  }

  return {
    totalFocusMinutes,
    blockedAttempts,
    overrides,
    categories,
    weekly: Array.from(weekly.values()).sort((left, right) => left.weekStart.localeCompare(right.weekStart)),
    sessions: summarizeSessions(sessions)
  };
}

export function summarizeSessions(sessions: readonly Session[]): SessionStatusSummary {
  return sessions.reduce<SessionStatusSummary>(
    (summary, session) => {
      summary[session.status] += 1;
      return summary;
    },
    { completed: 0, aborted: 0, interrupted: 0, active: 0 }
  );
}

function weekStartForDate(date: string, weekStartsOn: 0 | 1): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = parsed.getUTCDay();
  const distanceFromStart = (day - weekStartsOn + 7) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - distanceFromStart);
  return parsed.toISOString().slice(0, 10);
}

function makeCategorySummary(): Record<Category, CategoryVisitSummary> {
  return CATEGORIES.reduce<Record<Category, CategoryVisitSummary>>((summary, category) => {
    summary[category] = { visits: 0, domains: 0 };
    return summary;
  }, {} as Record<Category, CategoryVisitSummary>);
}

function makeCategoryVisitCounts(): Record<Category, number> {
  return CATEGORIES.reduce<Record<Category, number>>((summary, category) => {
    summary[category] = 0;
    return summary;
  }, {} as Record<Category, number>);
}
