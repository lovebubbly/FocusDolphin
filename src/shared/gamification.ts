import type { Intensity, PetStage } from "./types";
import { translate, type SupportedLocale } from "./i18n";

export const PET_STAGE_THRESHOLDS: Array<{ stage: PetStage; xp: number; name: string }> = [
  { stage: 4, xp: 6_000, name: "별고래" },
  { stage: 3, xp: 2_000, name: "푸른 고래" },
  { stage: 2, xp: 600, name: "어린 고래" },
  { stage: 1, xp: 100, name: "새끼 고래" },
  { stage: 0, xp: 0, name: "알" }
];

export const INTENSITY_MULTIPLIERS: Record<Intensity, number> = {
  soft: 1,
  medium: 1.2,
  hard: 1.5
};

export const BADGE_DEFINITIONS = {
  "first-session": {
    name: "첫 물결",
    description: "첫 집중이 바다에 첫 물결을 만들었어요.",
    kind: "progress"
  },
  "first-hard": {
    name: "첫 깊은 잠수",
    description: "스스로 선택한 깊은 바다를 끝까지 헤엄쳤어요.",
    kind: "surprise"
  },
  "focus-10-hours": {
    name: "열 시간의 바다",
    description: "조금씩 모인 열 시간이에요.",
    kind: "progress"
  },
  "focus-50-hours": {
    name: "쉰 시간의 대양",
    description: "쉰 시간, 대양 하나를 건넜어요.",
    kind: "progress"
  },
  "five-day-week": {
    name: "한 주의 리듬",
    description: "닷새의 리듬을 만들었어요. 연속일 필요는 없어요.",
    kind: "progress"
  },
  "allowlist-10": {
    name: "등대지기",
    description: "필요한 불빛만 켜고 열 번을 항해했어요.",
    kind: "surprise"
  },
  "streak-7": {
    name: "이레의 물살",
    description: "이레 동안 물살이 이어졌어요.",
    kind: "progress"
  },
  "streak-30": {
    name: "서른 날의 해류",
    description: "한 달의 해류가 생겼어요.",
    kind: "progress"
  },
  comeback: {
    name: "다시 만난 바다",
    description: "돌아오는 게 제일 어려운 일이에요. 다시 만나서 반가워요.",
    kind: "surprise"
  },
  "first-schedule": {
    name: "물때표",
    description: "물때에 맞춰 저절로 바다가 열렸어요.",
    kind: "surprise"
  },
  "steady-4w": {
    name: "꾸준한 물결",
    description: "완벽하지 않아도 꾸준했어요. 그게 진짜예요.",
    kind: "progress"
  }
} as const;

export type BadgeId = keyof typeof BADGE_DEFINITIONS;

export const FORBIDDEN_WELLNESS_COPY = [
  "실패",
  "놓쳤",
  "놓치",
  "잃",
  "아깝",
  "처벌",
  "작아지",
  "사라지",
  "아프거나",
  "해치",
  "하지 않으면"
];

export function stageName(stage: PetStage, localeOverride?: SupportedLocale): string {
  return translate(`petStageName${stage}`, undefined, localeOverride);
}

export function nextStageThreshold(
  xp: number,
  localeOverride?: SupportedLocale
): { stage: PetStage; xp: number; name: string } | null {
  const safeXp = Math.max(0, xp);
  const threshold = [...PET_STAGE_THRESHOLDS]
    .reverse()
    .find((entry) => entry.xp > safeXp) ?? null;
  return threshold ? { ...threshold, name: stageName(threshold.stage, localeOverride) } : null;
}

export function currentStageThreshold(
  stage: PetStage,
  localeOverride?: SupportedLocale
): { stage: PetStage; xp: number; name: string } {
  const threshold = PET_STAGE_THRESHOLDS.find((entry) => entry.stage === stage)
    ?? PET_STAGE_THRESHOLDS[PET_STAGE_THRESHOLDS.length - 1];
  return { ...threshold, name: stageName(threshold.stage, localeOverride) };
}
