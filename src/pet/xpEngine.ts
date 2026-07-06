import { getTyped, setTyped, STORAGE_KEYS } from "../shared/storage";
import type { PetState, Session } from "../shared/types";
import { stageForXp, xpForSession } from "../shared/xp";
import { normalizePetState } from "./defaultState";

export const PET_LEDGER_KEY = "petLedger";

export interface PetLedger {
  settledSessionIds: string[];
  updatedAt: number;
}

export interface XpSettlementResult {
  awardedXp: number;
  settledSessionIds: string[];
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
  const newlySettled: string[] = [];
  let awardedXp = 0;

  for (const session of sessionLog) {
    if (session.status !== "completed" || settled.has(session.id)) {
      continue;
    }

    awardedXp += xpForSession(minutesForSession(session), session.intensity);
    settled.add(session.id);
    newlySettled.push(session.id);
  }

  const normalized = normalizePetState(storedPetState);
  const nextXp = normalized.xp + awardedXp;
  const petState: PetState = {
    ...normalized,
    xp: nextXp,
    stage: stageForXp(nextXp)
  };

  if (awardedXp > 0 || normalized.stage !== petState.stage || storedPetState === undefined) {
    await setTyped("sync", STORAGE_KEYS.sync.petState, petState);
  }

  if (newlySettled.length > 0 || ledgerValue === undefined) {
    await setTyped<PetLedger>("local", PET_LEDGER_KEY, {
      settledSessionIds: Array.from(settled),
      updatedAt: now.getTime()
    });
  }

  return {
    awardedXp,
    settledSessionIds: newlySettled,
    petState
  };
}
