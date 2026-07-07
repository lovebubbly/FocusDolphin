import type { Intensity, PetState } from "./types";
import { INTENSITY_MULTIPLIERS, PET_STAGE_THRESHOLDS } from "./gamification";

export function xpForSession(minutes: number, intensity: Intensity): number {
  const safeMinutes = Math.max(0, minutes);
  return Math.floor(safeMinutes * INTENSITY_MULTIPLIERS[intensity]);
}

export function stageForXp(xp: number): PetState["stage"] {
  const safeXp = Math.max(0, xp);
  return PET_STAGE_THRESHOLDS.find((threshold) => safeXp >= threshold.xp)?.stage ?? 0;
}
