import type { DailyStats, Session, SiteList } from "../../shared/types";
import type { Recommendation } from "../../analytics/recommend";

export interface OptionsSettings {
  focusHours: { startHHMM: string; endHHMM: string };
  softOverlaySeconds: number;
}

export const DEFAULT_OPTIONS_SETTINGS: OptionsSettings = {
  focusHours: { startHHMM: "09:00", endHHMM: "12:00" },
  softOverlaySeconds: 10
};

export function normalizeOptionsSettings(value: unknown): OptionsSettings {
  const candidate = value as Partial<OptionsSettings> | undefined;
  const focusHours = candidate?.focusHours;

  return {
    focusHours: {
      startHHMM: isHHMM(focusHours?.startHHMM) ? focusHours.startHHMM : DEFAULT_OPTIONS_SETTINGS.focusHours.startHHMM,
      endHHMM: isHHMM(focusHours?.endHHMM) ? focusHours.endHHMM : DEFAULT_OPTIONS_SETTINGS.focusHours.endHHMM
    },
    softOverlaySeconds: clampInt(candidate?.softOverlaySeconds, 3, 60, DEFAULT_OPTIONS_SETTINGS.softOverlaySeconds)
  };
}

export function collectDailyStats(snapshot: Record<string, unknown>): DailyStats[] {
  return Object.entries(snapshot)
    .filter(([key, value]) => key.startsWith("dailyStats:") && isDailyStats(value))
    .map(([, value]) => value as DailyStats)
    .sort((left, right) => left.date.localeCompare(right.date));
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

export function addRecommendationToBlocklist(siteLists: readonly SiteList[], recommendation: Recommendation): SiteList[] {
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
        name: "추천 차단 목록",
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
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//u, "")
    .split(/[/?#]/u)[0]
    ?.replace(/^\.+|\.+$/gu, "")
    .replace(/^www\./u, "") ?? "";
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function isHHMM(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}
