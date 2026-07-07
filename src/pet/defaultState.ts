import type { PetState } from "../shared/types";
import { stageForXp } from "../shared/xp";

export const DEFAULT_PET_STATE: PetState = {
  version: 2,
  stage: 0,
  xp: 0,
  totalFocusMinutes: 0,
  streak: {
    days: 0,
    state: "fresh",
    freezes: 0
  },
  streakDays: 0,
  streakFreezes: 0,
  lastActiveDate: "",
  badges: [],
  badgeAwards: {}
};

export function normalizePetState(state?: Partial<PetState> | null): PetState {
  const xp = Math.max(0, Math.round(state?.xp ?? DEFAULT_PET_STATE.xp));
  const stage = Math.min(4, Math.max(state?.stage ?? DEFAULT_PET_STATE.stage, stageForXp(xp))) as PetState["stage"];
  const streakDays = Math.max(0, Math.round(state?.streak?.days ?? state?.streakDays ?? DEFAULT_PET_STATE.streakDays));
  const streakFreezes = Math.min(2, Math.max(0, Math.round(state?.streak?.freezes ?? state?.streakFreezes ?? DEFAULT_PET_STATE.streakFreezes)));
  const badgeAwards = { ...(state?.badgeAwards ?? {}) };
  const badges = Array.from(new Set(state?.badges ?? Object.keys(badgeAwards) ?? DEFAULT_PET_STATE.badges));
  const normalizedBadgeAwards = badges.reduce<Record<string, { earnedAt: number }>>((awards, badge) => {
    awards[badge] = badgeAwards[badge] ?? { earnedAt: 0 };
    return awards;
  }, {});

  return {
    version: 2,
    stage,
    xp,
    totalFocusMinutes: Math.max(0, Math.round(state?.totalFocusMinutes ?? xp)),
    streak: {
      days: streakDays,
      state: state?.streak?.state ?? (streakDays > 0 ? "active" : "fresh"),
      restingSince: state?.streak?.restingSince,
      freezes: streakFreezes
    },
    streakDays,
    streakFreezes,
    lastActiveDate: state?.lastActiveDate ?? DEFAULT_PET_STATE.lastActiveDate,
    badges,
    badgeAwards: normalizedBadgeAwards
  };
}
