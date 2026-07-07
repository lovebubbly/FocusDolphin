import { getTyped, setTyped, STORAGE_KEYS } from "../shared/storage";
import type { PetState, Session } from "../shared/types";
import { stageForXp, xpForSession } from "../shared/xp";
import { appendGrowthEvents, createGrowthEvent, crossedHalfWay, growthTransition, type GrowthEvent } from "./growth";
import { normalizePetState } from "./defaultState";

export const PET_LEDGER_KEY = "petLedger";

export interface PetLedger {
  settledSessionIds: string[];
  settledEarlySessionIds?: string[];
  updatedAt: number;
}

export interface XpSettlementResult {
  awardedXp: number;
  settledSessionIds: string[];
  events: GrowthEvent[];
  petState: PetState;
}

function minutesForSession(session: Session): number {
  return Math.max(0, Math.round((session.endsAt - session.startedAt) / 60_000));
}

function defaultLedger(): PetLedger {
  return {
    settledSessionIds: [],
    updatedAt: 0
  };
}

export async function settleCompletedSessionXp(now: Date = new Date()): Promise<XpSettlementResult> {
  const [sessionLog = [], ledgerValue, storedPetState] = await Promise.all([
    getTyped("local", STORAGE_KEYS.local.sessionLog),
    getTyped<PetLedger>("local", PET_LEDGER_KEY),
    getTyped("sync", STORAGE_KEYS.sync.petState)
  ]);

  const ledger = ledgerValue ?? defaultLedger();
  const settled = new Set(ledger.settledSessionIds);
  const settledEarly = new Set(ledger.settledEarlySessionIds ?? []);
  const newlySettled: string[] = [];
  const newlySettledEarly: string[] = [];
  let awardedXp = 0;
  const events: GrowthEvent[] = [];
  const normalized = normalizePetState(storedPetState);
  let nextXp = normalized.xp;
  let nextStage = normalized.stage;
  let totalFocusMinutes = normalized.totalFocusMinutes;
  const eventTs = now.getTime();

  for (const session of sessionLog) {
    if (session.status !== "completed") {
      if ((session.status === "aborted" || session.status === "interrupted") && !settledEarly.has(session.id)) {
        events.push(createGrowthEvent("session_ended_early", eventTs, { sessionId: session.id }));
        settledEarly.add(session.id);
        newlySettledEarly.push(session.id);
      }

      continue;
    }

    if (settled.has(session.id)) {
      continue;
    }

    const minutes = minutesForSession(session);
    const sessionXp = xpForSession(minutes, session.intensity);
    const previousXp = nextXp;
    const previousStage = nextStage;
    awardedXp += sessionXp;
    nextXp += sessionXp;
    totalFocusMinutes += minutes;
    nextStage = Math.max(previousStage, stageForXp(nextXp)) as PetState["stage"];
    events.push(createGrowthEvent("session_completed", session.endsAt, {
      sessionId: session.id,
      xpDelta: sessionXp,
      ...growthTransition(previousXp, nextXp, previousStage, nextStage),
      minutes,
      intensity: session.intensity
    }));

    if (crossedHalfWay(previousXp, nextXp, previousStage)) {
      events.push(createGrowthEvent("half_way", session.endsAt, {
        sessionId: session.id,
        stageFrom: previousStage,
        stageTo: (previousStage + 1) as PetState["stage"]
      }));
    }

    if (nextStage > previousStage) {
      events.push(createGrowthEvent("stage_up", session.endsAt, {
        sessionId: session.id,
        stageFrom: previousStage,
        stageTo: nextStage
      }));
    }

    settled.add(session.id);
    newlySettled.push(session.id);
  }

  const petState: PetState = {
    ...normalized,
    xp: nextXp,
    totalFocusMinutes,
    stage: Math.max(normalized.stage, stageForXp(nextXp)) as PetState["stage"]
  };

  if (storedPetState === undefined || storedPetState.version !== 2) {
    events.push(createGrowthEvent("migration", eventTs, { text: "성장 시스템이 새로워졌어요." }));
  }

  if (awardedXp > 0 || normalized.stage !== petState.stage || storedPetState === undefined || storedPetState.version !== 2) {
    await setTyped("sync", STORAGE_KEYS.sync.petState, petState);
  }

  if (events.length > 0) {
    await appendGrowthEvents(events, true);
  }

  if (newlySettled.length > 0 || newlySettledEarly.length > 0 || ledgerValue === undefined) {
    await setTyped<PetLedger>("local", PET_LEDGER_KEY, {
      settledSessionIds: Array.from(settled),
      settledEarlySessionIds: Array.from(settledEarly),
      updatedAt: now.getTime()
    });
  }

  return {
    awardedXp,
    settledSessionIds: newlySettled,
    events,
    petState
  };
}
