import { getTyped, setTyped, STORAGE_KEYS } from "../shared/storage";
import type { PetState, Session } from "../shared/types";
import { stageForXp, xpForSession } from "../shared/xp";
import { appendGrowthEvents, createGrowthEvent, crossedHalfWay, growthTransition, type GrowthEvent } from "./growth";
import { normalizePetState } from "./defaultState";

export const PET_LEDGER_KEY = "petLedger";
export const PET_SETTLEMENT_JOURNAL_KEY = "petSettlementJournal";
const MAX_SETTLED_SESSION_IDS = 5_000;

interface PetSettlementJournal {
  petState: PetState;
  ledger: PetLedger;
  events: GrowthEvent[];
  persistPetState: boolean;
  createdAt: number;
}

let petMutationQueue: Promise<void> = Promise.resolve();

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

export function settleCompletedSessionXp(now: Date = new Date()): Promise<XpSettlementResult> {
  return runPetStateMutation(() => settleCompletedSessionXpWithinMutation(now));
}

export function runPetStateMutation<T>(operationFactory: () => Promise<T>): Promise<T> {
  const operation = petMutationQueue.then(operationFactory);
  petMutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function settleCompletedSessionXpWithinMutation(now: Date = new Date()): Promise<XpSettlementResult> {
  await recoverSettlementJournal();
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

  const needsMigration = storedPetState === undefined || storedPetState.version !== 2;
  if (needsMigration) {
    events.push(createGrowthEvent("migration", eventTs, { text: "성장 시스템이 새로워졌어요." }));
  }

  const persistPetState = awardedXp > 0 || normalized.stage !== petState.stage || needsMigration;
  const persistLedger = newlySettled.length > 0 || newlySettledEarly.length > 0 || ledgerValue === undefined;
  const nextLedger: PetLedger = {
    settledSessionIds: Array.from(settled).slice(-MAX_SETTLED_SESSION_IDS),
    settledEarlySessionIds: Array.from(settledEarly).slice(-MAX_SETTLED_SESSION_IDS),
    updatedAt: now.getTime()
  };

  if (persistPetState || persistLedger || events.length > 0) {
    const journal: PetSettlementJournal = {
      petState,
      ledger: nextLedger,
      events,
      persistPetState,
      createdAt: now.getTime()
    };
    await setTyped<PetSettlementJournal>("local", PET_SETTLEMENT_JOURNAL_KEY, journal);
    await applySettlementJournal(journal);
  }

  return {
    awardedXp,
    settledSessionIds: newlySettled,
    events,
    petState
  };
}

async function recoverSettlementJournal(): Promise<void> {
  const journal = await getTyped<PetSettlementJournal>("local", PET_SETTLEMENT_JOURNAL_KEY);
  if (!journal) {
    return;
  }

  await applySettlementJournal(journal);
}

async function applySettlementJournal(journal: PetSettlementJournal): Promise<void> {
  if (journal.persistPetState) {
    const current = await getTyped("sync", STORAGE_KEYS.sync.petState);
    const petState = mergeSettlementPetProgress(current, journal.petState);
    await setTyped("sync", STORAGE_KEYS.sync.petState, petState);
  }

  if (journal.events.length > 0) {
    await appendGrowthEvents(journal.events, true);
  }

  const currentLedger = await getTyped<PetLedger>("local", PET_LEDGER_KEY);
  await setTyped<PetLedger>("local", PET_LEDGER_KEY, mergeSettlementLedger(currentLedger, journal.ledger));
  await chrome.storage.local.remove(PET_SETTLEMENT_JOURNAL_KEY);
}

function mergeSettlementPetProgress(currentValue: PetState | undefined, targetValue: PetState): PetState {
  const target = normalizePetState(targetValue);
  if (!currentValue) {
    return target;
  }

  const current = normalizePetState(currentValue);
  const badges = Array.from(new Set([
    ...current.badges,
    ...target.badges,
    ...Object.keys(current.badgeAwards),
    ...Object.keys(target.badgeAwards)
  ]));
  const badgeAwards = Object.fromEntries(badges.map((badge) => [
    badge,
    current.badgeAwards[badge] ?? target.badgeAwards[badge] ?? { earnedAt: 0 }
  ]));

  return normalizePetState({
    ...current,
    name: current.name ?? target.name,
    xp: Math.max(current.xp, target.xp),
    totalFocusMinutes: Math.max(current.totalFocusMinutes, target.totalFocusMinutes),
    stage: Math.max(current.stage, target.stage) as PetState["stage"],
    badges,
    badgeAwards
  });
}

function mergeSettlementLedger(current: PetLedger | undefined, target: PetLedger): PetLedger {
  return {
    settledSessionIds: Array.from(new Set([
      ...(current?.settledSessionIds ?? []),
      ...target.settledSessionIds
    ])).slice(-MAX_SETTLED_SESSION_IDS),
    settledEarlySessionIds: Array.from(new Set([
      ...(current?.settledEarlySessionIds ?? []),
      ...(target.settledEarlySessionIds ?? [])
    ])).slice(-MAX_SETTLED_SESSION_IDS),
    updatedAt: Math.max(current?.updatedAt ?? 0, target.updatedAt)
  };
}
