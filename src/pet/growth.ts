import { BADGE_DEFINITIONS, currentStageThreshold, stageName } from "../shared/gamification";
import type { Intensity, PetStage } from "../shared/types";

export const GROWTH_LOG_KEY = "growthLog";
export const PENDING_CELEBRATIONS_KEY = "pendingCelebrations";
export const GROWTH_EVENT_PREFIX = "growthEvent:";
export const PENDING_CELEBRATION_PREFIX = "pendingCelebration:";
export const CELEBRATION_ACK_PREFIX = "celebrationAck:";
const MAX_GROWTH_EVENTS = 500;
const MAX_CELEBRATION_ACKS = 500;

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

  const snapshot = await chrome.storage.local.get(null);
  const existingLog = readEventSnapshot(snapshot, GROWTH_EVENT_PREFIX, GROWTH_LOG_KEY);
  const knownIds = new Set(existingLog.map((event) => event.id));
  const freshEvents = events.filter((event) => !knownIds.has(event.id));
  const acknowledgedIds = idsForPrefix(snapshot, CELEBRATION_ACK_PREFIX);
  const writes: Record<string, GrowthEvent> = {};

  for (const event of freshEvents) {
    writes[`${GROWTH_EVENT_PREFIX}${event.id}`] = event;
  }

  if (celebrate) {
    for (const event of events.filter(isCelebratoryEvent)) {
      const pendingKey = `${PENDING_CELEBRATION_PREFIX}${event.id}`;
      if (!acknowledgedIds.has(event.id) && snapshot[pendingKey] === undefined) {
        writes[pendingKey] = event;
      }
    }
  }

  if (Object.keys(writes).length > 0) {
    await chrome.storage.local.set(writes);
  }

  const retained = dedupeEvents([...freshEvents, ...existingLog])
    .sort((left, right) => right.ts - left.ts)
    .slice(MAX_GROWTH_EVENTS);
  const removableKeys = retained
    .map((event) => `${GROWTH_EVENT_PREFIX}${event.id}`)
    .filter((key) => snapshot[key] !== undefined || writes[key] !== undefined);
  if (removableKeys.length > 0) {
    await chrome.storage.local.remove(removableKeys);
  }
}

export async function readGrowthLog(limit = 20): Promise<GrowthEvent[]> {
  const snapshot = await chrome.storage.local.get(null);
  return readEventSnapshot(snapshot, GROWTH_EVENT_PREFIX, GROWTH_LOG_KEY)
    .sort((left, right) => right.ts - left.ts)
    .slice(0, Math.max(0, limit));
}

export async function drainPendingCelebrations(): Promise<GrowthEvent[]> {
  const fresh = await readPendingCelebrations();
  await acknowledgeCelebrations(fresh.map((event) => event.id));
  return fresh;
}

export async function readPendingCelebrations(): Promise<GrowthEvent[]> {
  const snapshot = await chrome.storage.local.get(null);
  const acknowledgedIds = idsForPrefix(snapshot, CELEBRATION_ACK_PREFIX);
  const pending = readEventSnapshot(snapshot, PENDING_CELEBRATION_PREFIX, PENDING_CELEBRATIONS_KEY);
  return pending
    .filter((event) => !acknowledgedIds.has(event.id))
    .sort((left, right) => left.ts - right.ts);
}

export async function acknowledgeCelebrations(eventIds: readonly string[]): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const targetIds = new Set(eventIds);
  const snapshot = await chrome.storage.local.get(null);
  const pending = readEventSnapshot(snapshot, PENDING_CELEBRATION_PREFIX, PENDING_CELEBRATIONS_KEY);
  const acknowledge: Record<string, number> = {};
  for (const id of targetIds) {
    const event = pending.find((candidate) => candidate.id === id);
    acknowledge[`${CELEBRATION_ACK_PREFIX}${id}`] = event?.ts ?? Date.now();
  }

  await chrome.storage.local.set(acknowledge);

  const legacyPending = Array.isArray(snapshot[PENDING_CELEBRATIONS_KEY])
    ? (snapshot[PENDING_CELEBRATIONS_KEY] as unknown[]).filter(isGrowthEvent)
    : [];
  const remainingLegacy = legacyPending.filter((event) => !targetIds.has(event.id));
  if (remainingLegacy.length > 0) {
    await chrome.storage.local.set({ [PENDING_CELEBRATIONS_KEY]: remainingLegacy });
  }

  const pendingKeys = Array.from(targetIds)
    .map((id) => `${PENDING_CELEBRATION_PREFIX}${id}`)
    .filter((key) => snapshot[key] !== undefined);
  if (snapshot[PENDING_CELEBRATIONS_KEY] !== undefined && remainingLegacy.length === 0) {
    pendingKeys.push(PENDING_CELEBRATIONS_KEY);
  }
  if (pendingKeys.length > 0) {
    await chrome.storage.local.remove(pendingKeys);
  }

  await pruneCelebrationAcks(snapshot, acknowledge);
}

function readEventSnapshot(snapshot: Record<string, unknown>, prefix: string, legacyKey: string): GrowthEvent[] {
  const prefixed = Object.entries(snapshot)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value)
    .filter(isGrowthEvent);
  const legacy = Array.isArray(snapshot[legacyKey])
    ? (snapshot[legacyKey] as unknown[]).filter(isGrowthEvent)
    : [];

  return dedupeEvents([...prefixed, ...legacy]);
}

function dedupeEvents(events: readonly GrowthEvent[]): GrowthEvent[] {
  return Array.from(new Map(events.map((event) => [event.id, event])).values());
}

function idsForPrefix(snapshot: Record<string, unknown>, prefix: string): Set<string> {
  return new Set(Object.keys(snapshot)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length)));
}

function isGrowthEvent(value: unknown): value is GrowthEvent {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as GrowthEvent).id === "string"
    && typeof (value as GrowthEvent).ts === "number"
    && typeof (value as GrowthEvent).type === "string"
  );
}

async function pruneCelebrationAcks(snapshot: Record<string, unknown>, writes: Record<string, number>): Promise<void> {
  const byKey = new Map<string, number>();
  for (const [key, value] of [...Object.entries(snapshot), ...Object.entries(writes)]) {
    if (!key.startsWith(CELEBRATION_ACK_PREFIX) || typeof value !== "number") {
      continue;
    }
    byKey.set(key, Math.max(byKey.get(key) ?? Number.NEGATIVE_INFINITY, value));
  }
  const acknowledgements = Array.from(byKey.entries())
    .sort((left, right) => right[1] - left[1]);
  const staleKeys = acknowledgements.slice(MAX_CELEBRATION_ACKS).map(([key]) => key);
  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }
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
    return `${details.minutes ?? 0}분 집중 완료 · +${details.xpDelta ?? 0} XP (${details.minutes ?? 0}분 × ${growthIntensityLabel(details.intensity ?? "medium")})`;
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
  const next = stage < 4 ? currentStageThreshold((stage + 1) as PetStage) : null;

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
  const next = stage < 4 ? currentStageThreshold((stage + 1) as PetStage) : null;
  if (!next) {
    return false;
  }

  const halfway = current.xp + (next.xp - current.xp) / 2;
  return previousXp < halfway && nextXp >= halfway && nextXp < next.xp;
}

export function growthIntensityLabel(intensity: Intensity): string {
  if (intensity === "soft") {
    return "가벼운 안내";
  }
  if (intensity === "hard") {
    return "완전 차단";
  }
  return "확인 후 허용";
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
