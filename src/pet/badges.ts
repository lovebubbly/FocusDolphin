import type { PetState, Session, SiteList } from "../shared/types";
import { dateKeyInKst, addDays } from "./streak";
import { BADGE_DEFINITIONS, type BadgeId } from "../shared/gamification";

export const BADGE_IDS = {
  firstSession: "first-session",
  firstHard: "first-hard",
  focus10Hours: "focus-10-hours",
  focus50Hours: "focus-50-hours",
  fiveDayWeek: "five-day-week",
  allowlist10: "allowlist-10",
  streak7: "streak-7",
  streak30: "streak-30",
  comeback: "comeback",
  firstSchedule: "first-schedule",
  steady4w: "steady-4w"
} as const;

export type { BadgeId };

function completedSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => session.status === "completed");
}

function minutesForSession(session: Session): number {
  return Math.max(0, Math.round((session.endsAt - session.startedAt) / 60_000));
}

function weekStartForDateKey(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, diffToMonday);
}

function hasFiveDayWeek(sessions: Session[]): boolean {
  const weeks = new Map<string, Set<string>>();

  for (const session of sessions) {
    const dateKey = dateKeyInKst(session.endsAt);
    const weekStart = weekStartForDateKey(dateKey);
    const week = weeks.get(weekStart) ?? new Set<string>();
    week.add(dateKey);
    weeks.set(weekStart, week);
  }

  return Array.from(weeks.values()).some((week) => week.size >= 5);
}

function hasSteadyFourWeeks(sessions: Session[]): boolean {
  const weeks = new Map<string, Set<string>>();
  for (const session of sessions) {
    const dateKey = dateKeyInKst(session.endsAt);
    const weekStart = weekStartForDateKey(dateKey);
    const week = weeks.get(weekStart) ?? new Set<string>();
    week.add(dateKey);
    weeks.set(weekStart, week);
  }

  const starts = Array.from(weeks.keys()).sort();
  for (const start of starts) {
    const chain = [0, 1, 2, 3].map((offset) => weeks.get(addDays(start, offset * 7))?.size ?? 0);
    if (chain.every((days) => days >= 3)) {
      return true;
    }
  }

  return false;
}

function withBadge(badges: string[], badge: BadgeId, earned: boolean): string[] {
  if (!earned || badges.includes(badge)) {
    return badges;
  }

  return [...badges, badge];
}

export function awardBadges(
  state: PetState,
  sessions: Session[],
  siteLists: SiteList[] = [],
  options: { comebackEligible?: boolean; now?: number } = {}
): PetState {
  const completed = completedSessions(sessions);
  const listModes = new Map(siteLists.map((list) => [list.id, list.mode]));
  const totalMinutes = completed.reduce((sum, session) => sum + minutesForSession(session), 0);
  const allowlistSessions = completed.filter((session) => listModes.get(session.listId) === "allowlist");

  let badges = Array.from(new Set(state.badges));
  badges = withBadge(badges, BADGE_IDS.firstSession, completed.length > 0);
  badges = withBadge(badges, BADGE_IDS.firstHard, completed.some((session) => session.intensity === "hard"));
  badges = withBadge(badges, BADGE_IDS.focus10Hours, totalMinutes >= 600);
  badges = withBadge(badges, BADGE_IDS.focus50Hours, totalMinutes >= 3_000);
  badges = withBadge(badges, BADGE_IDS.fiveDayWeek, hasFiveDayWeek(completed));
  badges = withBadge(badges, BADGE_IDS.allowlist10, allowlistSessions.length >= 10);
  badges = withBadge(badges, BADGE_IDS.streak7, state.streakDays >= 7);
  badges = withBadge(badges, BADGE_IDS.streak30, state.streakDays >= 30);
  badges = withBadge(badges, BADGE_IDS.comeback, Boolean(options.comebackEligible));
  badges = withBadge(badges, BADGE_IDS.firstSchedule, completed.some((session) => session.source === "schedule"));
  badges = withBadge(badges, BADGE_IDS.steady4w, hasSteadyFourWeeks(completed));

  const earnedAt = options.now ?? Date.now();
  const existingAwards = state.badgeAwards ?? {};
  const badgeAwards = badges.reduce<Record<string, { earnedAt: number }>>((awards, badge) => {
    awards[badge] = existingAwards[badge] ?? { earnedAt };
    return awards;
  }, {});

  return {
    ...state,
    badges,
    badgeAwards
  };
}

export function badgeName(id: string): string {
  return BADGE_DEFINITIONS[id as BadgeId]?.name ?? id;
}
