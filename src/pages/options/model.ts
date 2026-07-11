import type { DailyStats, Schedule, Session, SiteList } from "../../shared/types";
import type { Recommendation } from "../../analytics/recommend";
import { normalizeDomain } from "../../background/rules";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../shared/storage";
import { translate, type SupportedLocale } from "../../shared/i18n";

export interface OptionsSettings {
  focusHours: { startHHMM: string; endHHMM: string };
  softOverlaySeconds: number;
}

export interface AttemptedTarget {
  domain: string;
  attempts: number;
}

export interface FocusWeek {
  weekStart: string;
  focusMinutes: number;
}

export type ScheduleValidationResult =
  | { valid: true }
  | {
      valid: false;
      field: "time" | "days" | "list";
      message: string;
    };

export const DEFAULT_OPTIONS_SETTINGS: OptionsSettings = {
  focusHours: { ...DEFAULT_SETTINGS.focusHours },
  softOverlaySeconds: DEFAULT_SETTINGS.softOverlaySeconds
};

export function normalizeOptionsSettings(value: unknown): OptionsSettings {
  return normalizeSettings(value);
}

export function collectDailyStats(snapshot: Record<string, unknown>): DailyStats[] {
  return Object.entries(snapshot)
    .filter(([key, value]) => key.startsWith("dailyStats:") && isDailyStats(value))
    .map(([, value]) => value as DailyStats)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function collectAttemptedTargets(
  dailyStats: readonly DailyStats[],
  limit = 5
): AttemptedTarget[] {
  const attemptsByDomain = new Map<string, number>();

  for (const entry of dailyStats) {
    for (const [rawDomain, attempts] of Object.entries(entry.domainVisits)) {
      const domain = normalizeDomainInput(rawDomain);
      const safeAttempts = Number.isFinite(attempts) ? Math.max(0, attempts) : 0;
      if (!domain || safeAttempts === 0) {
        continue;
      }
      attemptsByDomain.set(domain, (attemptsByDomain.get(domain) ?? 0) + safeAttempts);
    }
  }

  return Array.from(attemptsByDomain, ([domain, attempts]) => ({ domain, attempts }))
    .sort((left, right) => right.attempts - left.attempts || left.domain.localeCompare(right.domain))
    .slice(0, Math.max(0, limit));
}

export function localWeekStartKey(now = Date.now()): string {
  const date = new Date(now);
  const day = date.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - distanceFromMonday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

export function completedSessionsInLocalWeek(
  sessions: readonly Session[],
  now = Date.now()
): number {
  const [year, month, day] = localWeekStartKey(now).split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return sessions.filter((session) => (
    session.status === "completed"
    && session.endsAt >= start.getTime()
    && session.endsAt < end.getTime()
  )).length;
}

export function recentFocusWeeks(
  weekly: readonly FocusWeek[],
  count = 8,
  now = Date.now()
): FocusWeek[] {
  const byWeek = new Map(weekly.map((entry) => [entry.weekStart, entry.focusMinutes]));
  const currentMonday = new Date(`${localWeekStartKey(now)}T00:00:00`);
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const date = new Date(currentMonday);
    date.setDate(date.getDate() - (count - index - 1) * 7);
    const weekStart = localWeekStartKey(date.getTime());
    return { weekStart, focusMinutes: Math.max(0, byWeek.get(weekStart) ?? 0) };
  });
}

export function latestEarnedBadge(
  petState: {
    badges: readonly string[];
    badgeAwards: Readonly<Record<string, { earnedAt: number }>>;
  }
): string | null {
  let latest: string | null = null;
  let latestEarnedAt = Number.NEGATIVE_INFINITY;

  for (const badge of petState.badges) {
    const earnedAt = petState.badgeAwards[badge]?.earnedAt ?? 0;
    if (earnedAt >= latestEarnedAt) {
      latest = badge;
      latestEarnedAt = earnedAt;
    }
  }

  return latest;
}

export function blockedDomainsFromLists(siteLists: readonly SiteList[]): string[] {
  return Array.from(
    new Set(
      siteLists
        .filter((list) => list.mode === "blocklist")
        .flatMap((list) => list.domains.map(normalizeDomainInput))
        .filter(Boolean)
    )
  );
}

export function addRecommendationToBlocklist(
  siteLists: readonly SiteList[],
  recommendation: Recommendation,
  localeOverride?: SupportedLocale
): SiteList[] {
  const domain = normalizeDomainInput(recommendation.domain);
  if (!domain) {
    return [...siteLists];
  }

  const existingIndex = siteLists.findIndex((list) => list.mode === "blocklist");
  if (existingIndex === -1) {
    return [
      ...siteLists,
      {
        id: "recommended-blocklist",
        name: translate("recommendedBlocklistName", undefined, localeOverride),
        mode: "blocklist",
        domains: [domain]
      }
    ];
  }

  return siteLists.map((list, index) => {
    if (index !== existingIndex || list.domains.includes(domain)) {
      return list;
    }

    return {
      ...list,
      domains: [...list.domains, domain]
    };
  });
}

export function isOptionsLocked(session: Session | null | undefined, now = Date.now()): boolean {
  return Boolean(session?.status === "active" && session.endsAt > now);
}

export function normalizeDomainList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/u)
        .map(normalizeDomainInput)
        .filter(Boolean)
    )
  );
}

export function validateScheduleConfiguration(
  schedule: Pick<Schedule, "startHHMM" | "endHHMM" | "days" | "listId">,
  localeOverride?: SupportedLocale
): ScheduleValidationResult {
  if (!isHHMM(schedule.startHHMM) || !isHHMM(schedule.endHHMM)) {
    return {
      valid: false,
      field: "time",
      message: translate("scheduleTimesRequired", undefined, localeOverride)
    };
  }

  if (schedule.startHHMM === schedule.endHHMM) {
    return {
      valid: false,
      field: "time",
      message: translate("scheduleTimesMustDiffer", undefined, localeOverride)
    };
  }

  if (schedule.days.length === 0 || schedule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return {
      valid: false,
      field: "days",
      message: translate("scheduleDayRequired", undefined, localeOverride)
    };
  }

  if (!schedule.listId.trim()) {
    return {
      valid: false,
      field: "list",
      message: translate("scheduleListRequired", undefined, localeOverride)
    };
  }

  return { valid: true };
}

export function schedulesReferencingSiteList(
  schedules: readonly Schedule[],
  listId: string
): Schedule[] {
  return schedules.filter((schedule) => schedule.listId === listId);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isDailyStats(value: unknown): value is DailyStats {
  const candidate = value as DailyStats;
  return Boolean(
    candidate &&
    typeof candidate.date === "string" &&
    typeof candidate.focusMinutes === "number" &&
    typeof candidate.blockedAttempts === "number" &&
    typeof candidate.overrides === "number" &&
    candidate.domainVisits &&
    typeof candidate.domainVisits === "object"
  );
}

function normalizeDomainInput(value: string): string {
  return normalizeDomain(value);
}

function isHHMM(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}
