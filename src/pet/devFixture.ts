import type { PetState, Session, SiteList } from "../shared/types";

export const DEV_SITE_LISTS: SiteList[] = [
  {
    id: "deep-work",
    name: "Deep Work",
    mode: "blocklist",
    domains: ["youtube.com", "instagram.com", "reddit.com"]
  },
  {
    id: "writing-allowlist",
    name: "Writing Allowlist",
    mode: "allowlist",
    domains: ["docs.google.com", "notion.so"]
  }
];

export const DEV_PET_STATE: PetState = {
  stage: 2,
  xp: 1_680,
  streakDays: 6,
  streakFreezes: 1,
  lastActiveDate: "2026-07-05",
  badges: ["first-session", "first-hard"]
};

function timestamp(value: string): number {
  return Date.parse(value);
}

function completedSession(id: string, listId: string, intensity: Session["intensity"], start: string, minutes: number): Session {
  const startedAt = timestamp(start);

  return {
    id,
    source: "manual",
    listId,
    intensity,
    startedAt,
    endsAt: startedAt + minutes * 60_000,
    status: "completed",
    snoozeCount: 0,
    nextSnoozeDelayMin: 5
  };
}

export const DEV_SESSION_LOG: Session[] = [
  completedSession("dev-1", "deep-work", "medium", "2026-07-01T08:30:00+09:00", 25),
  completedSession("dev-2", "deep-work", "hard", "2026-07-02T09:00:00+09:00", 50),
  completedSession("dev-3", "writing-allowlist", "medium", "2026-07-03T10:00:00+09:00", 25),
  completedSession("dev-4", "writing-allowlist", "soft", "2026-07-04T11:00:00+09:00", 15),
  completedSession("dev-5", "deep-work", "medium", "2026-07-05T13:00:00+09:00", 90),
  completedSession("dev-6", "writing-allowlist", "medium", "2026-07-06T08:00:00+09:00", 25)
];
