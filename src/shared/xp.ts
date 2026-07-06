import type { Intensity, PetState } from "./types";

const INTENSITY_MULTIPLIERS: Record<Intensity, number> = {
  soft: 1,
  medium: 1.2,
  hard: 1.5
};

const STAGE_THRESHOLDS: Array<{ stage: PetState["stage"]; xp: number }> = [
  { stage: 4, xp: 12_000 },
  { stage: 3, xp: 5_000 },
  { stage: 2, xp: 1_500 },
  { stage: 1, xp: 300 },
  { stage: 0, xp: 0 }
];

export function xpForSession(minutes: number, intensity: Intensity): number {
  const safeMinutes = Math.max(0, minutes);
  return Math.round(safeMinutes * INTENSITY_MULTIPLIERS[intensity]);
}

export function stageForXp(xp: number): PetState["stage"] {
  const safeXp = Math.max(0, xp);
  return STAGE_THRESHOLDS.find((threshold) => safeXp >= threshold.xp)?.stage ?? 0;
}
