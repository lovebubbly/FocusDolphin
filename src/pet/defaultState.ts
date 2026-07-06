import type { PetState } from "../shared/types";
import { stageForXp } from "../shared/xp";

export const DEFAULT_PET_STATE: PetState = {
  stage: 0,
  xp: 0,
  streakDays: 0,
  streakFreezes: 0,
  lastActiveDate: "",
  badges: []
};

export function normalizePetState(state?: PetState): PetState {
  const xp = Math.max(0, Math.round(state?.xp ?? DEFAULT_PET_STATE.xp));

  return {
    stage: stageForXp(xp),
    xp,
    streakDays: Math.max(0, Math.round(state?.streakDays ?? DEFAULT_PET_STATE.streakDays)),
    streakFreezes: Math.min(2, Math.max(0, Math.round(state?.streakFreezes ?? DEFAULT_PET_STATE.streakFreezes))),
    lastActiveDate: state?.lastActiveDate ?? DEFAULT_PET_STATE.lastActiveDate,
    badges: Array.from(new Set(state?.badges ?? DEFAULT_PET_STATE.badges))
  };
}
