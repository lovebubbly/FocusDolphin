import { BADGE_DEFINITIONS, currentStageThreshold, nextStageThreshold, stageName } from "../shared/gamification";
import { getTyped, setTyped } from "../shared/storage";
import type { Intensity, PetStage } from "../shared/types";

export const GROWTH_LOG_KEY = "growthLog";
export const PENDING_CELEBRATIONS_KEY = "pendingCelebrations";
const MAX_GROWTH_EVENTS = 500;

export type GrowthEventType =
  | "session_completed"
  | "stage_up"
  | "half_way"
  | "badge_earned"
  | "freeze_granted"
  | "freeze_used"
  | "streak_restored"
  | "streak_rest"
  | "streak_fresh_start"
  | "session_ended_early"
  | "migration";

export interface GrowthEvent {
  id: string;
  ts: number;
  type: GrowthEventType;
  xpDelta?: number;
  xpBefore?: number;
  xpAfter?: number;
  progressBefore?: number;
  progressAfter?: number;
  minutes?: number;
  intensity?: Intensity;
  sessionId?: string;
  badgeId?: string;
  stageFrom?: PetStage;
  stageTo?: PetStage;
  streakFrom?: number;
  streakTo?: number;
  text: string;
}

export interface GrowthProgress {
  currentStageName: string;
  nextStageName: string | null;
  currentStageXp: number;
  nextStageXp: number | null;
  percentToNext: number;
  remainingXp: number;
}

export async function appendGrowthEvents(events: readonly GrowthEvent[], celebrate = true): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const [existingLog = [], existingPending = []] = await Promise.all([
    getTyped<GrowthEvent[]>("local", GROWTH_LOG_KEY),
    getTyped<GrowthEvent[]>("local", PENDING_CELEBRATIONS_KEY)
  ]);

  const knownIds = new Set(existingLog.map((event) => event.id));
  const freshEvents = events.filter((event) => !knownIds.has(event.id));
  if (freshEvents.length === 0) {
    return;
  }

  await setTyped("local", GROWTH_LOG_KEY, [...freshEvents, ...existingLog].slice(0, MAX_GROWTH_EVENTS));

  const celebratory = freshEvents.filter(isCelebratoryEvent);
  if (celebrate && celebratory.length > 0) {
    await setTyped("local", PENDING_CELEBRATIONS_KEY, [...existingPending, ...celebratory]);
  }
}

export async function readGrowthLog(limit = 20): Promise<GrowthEvent[]> {
  const events = (await getTyped<GrowthEvent[]>("local", GROWTH_LOG_KEY)) ?? [];
  return events.slice(0, Math.max(0, limit));
}

export async function drainPendingCelebrations(): Promise<GrowthEvent[]> {
  const pending = (await getTyped<GrowthEvent[]>("local", PENDING_CELEBRATIONS_KEY)) ?? [];
  if (pending.length > 0) {
    await setTyped<GrowthEvent[]>("local", PENDING_CELEBRATIONS_KEY, []);
  }

  return pending;
}

export function createGrowthEvent(
  type: GrowthEventType,
  ts: number,
  details: Omit<GrowthEvent, "id" | "ts" | "type" | "text"> & { text?: string }
): GrowthEvent {
  return {
    ...details,
    id: eventId(type, ts, details),
    ts,
    type,
    text: details.text ?? describeGrowthEvent(type, details)
  };
}

export function describeGrowthEvent(
  type: GrowthEventType,
  details: Omit<GrowthEvent, "id" | "ts" | "type" | "text">
): string {
  if (type === "session_completed") {
    return `${details.minutes ?? 0}분 집중 완료 · +${details.xpDelta ?? 0} XP (${details.minutes ?? 0}분 × ${details.intensity ?? "medium"})`;
  }

  if (type === "stage_up") {
    return `${stageName(details.stageTo ?? 0)}로 성장했어요. 누적 집중이 만든 변화예요.`;
  }

  if (type === "half_way") {
    return `${stageName(details.stageTo ?? 0)}까지 절반을 지났어요.`;
  }

  if (type === "badge_earned") {
    const badge = details.badgeId ? BADGE_DEFINITIONS[details.badgeId as keyof typeof BADGE_DEFINITIONS] : undefined;
    return badge ? `징표 획득 — ${badge.name}` : "새 징표를 얻었어요.";
  }

  if (type === "freeze_granted") {
    return "물방울 보호막 +1";
  }

  if (type === "freeze_used") {
    return "물방울 보호막이 스트릭을 지켜줬어요.";
  }

  if (type === "streak_restored") {
    return `다시 돌아왔어요. ${details.streakTo ?? 1}일째로 이어받았어요.`;
  }

  if (type === "streak_rest") {
    return "쉬어가는 중이에요. 오늘 한 번이면 이어받을 수 있어요.";
  }

  if (type === "streak_fresh_start") {
    return "새로운 바다가 열렸어요. 지난 기록은 성장 로그에 그대로 있어요.";
  }

  if (type === "session_ended_early") {
    return "세션을 일찍 마쳤어요. XP는 더하지 않았어요.";
  }

  return "성장 시스템이 새로워졌어요.";
}

export function growthProgress(xp: number, stage: PetStage): GrowthProgress {
  const current = currentStageThreshold(stage);
  const next = nextStageThreshold(xp);

  if (!next) {
    return {
      currentStageName: current.name,
      nextStageName: null,
      currentStageXp: current.xp,
      nextStageXp: null,
      percentToNext: 100,
      remainingXp: 0
    };
  }

  const span = Math.max(1, next.xp - current.xp);
  const progress = Math.max(0, Math.min(1, (xp - current.xp) / span));

  return {
    currentStageName: current.name,
    nextStageName: next.name,
    currentStageXp: current.xp,
    nextStageXp: next.xp,
    percentToNext: Math.round(progress * 100),
    remainingXp: Math.max(0, next.xp - xp)
  };
}

export function growthTransition(
  xpBefore: number,
  xpAfter: number,
  stageFrom: PetStage,
  stageTo: PetStage
): Pick<GrowthEvent, "xpBefore" | "xpAfter" | "progressBefore" | "progressAfter" | "stageFrom" | "stageTo"> {
  return {
    xpBefore,
    xpAfter,
    progressBefore: growthProgress(xpBefore, stageFrom).percentToNext,
    progressAfter: growthProgress(xpAfter, stageTo).percentToNext,
    stageFrom,
    stageTo
  };
}

export function crossedHalfWay(previousXp: number, nextXp: number, stage: PetStage): boolean {
  const current = currentStageThreshold(stage);
  const next = nextStageThreshold(previousXp);
  if (!next || next.stage !== stage + 1) {
    return false;
  }

  const halfway = current.xp + (next.xp - current.xp) / 2;
  return previousXp < halfway && nextXp >= halfway && nextXp < next.xp;
}

function isCelebratoryEvent(event: GrowthEvent): boolean {
  return event.type !== "session_ended_early" && event.type !== "streak_rest" && event.type !== "migration";
}

function eventId(type: GrowthEventType, ts: number, details: Omit<GrowthEvent, "id" | "ts" | "type" | "text">): string {
  return [
    type,
    details.sessionId,
    details.badgeId,
    details.stageFrom,
    details.stageTo,
    details.streakFrom,
    details.streakTo,
    ts
  ].filter((part) => part !== undefined && part !== "").join(":");
}
