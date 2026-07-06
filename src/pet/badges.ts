import type { PetState, Session, SiteList } from "../shared/types";
import { dateKeyInKst, addDays } from "./streak";

export const BADGE_IDS = {
  firstSession: "first-session",
  firstHard: "first-hard",
  focus10Hours: "focus-10-hours",
  focus50Hours: "focus-50-hours",
  fiveDayWeek: "five-day-week",
  allowlist10: "allowlist-10",
  streak7: "streak-7",
  streak30: "streak-30"
} as const;

export type BadgeId = (typeof BADGE_IDS)[keyof typeof BADGE_IDS];

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

function withBadge(badges: string[], badge: BadgeId, earned: boolean): string[] {
  if (!earned || badges.includes(badge)) {
    return badges;
  }

  return [...badges, badge];
}

export function awardBadges(state: PetState, sessions: Session[], siteLists: SiteList[] = []): PetState {
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

  return {
    ...state,
    badges
  };
}
