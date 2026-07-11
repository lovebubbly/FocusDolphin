import { getTyped, setTyped, STORAGE_KEYS } from "../shared/storage";
import type { PetState } from "../shared/types";
import { awardBadges } from "./badges";
import { normalizePetState } from "./defaultState";
import { appendGrowthEvents, createGrowthEvent, DEFAULT_PET_NAME, type GrowthEvent } from "./growth";
import { reconcileStreakFromSessions, type StreakRecoveryState } from "./streak";
import {
  runPetStateMutation,
  settleCompletedSessionXpWithinMutation
} from "./xpEngine";

export const STREAK_LEDGER_KEY = "petStreakLedger";
export const PET_RECONCILIATION_JOURNAL_KEY = "petReconciliationJournal";

interface PetReconciliationJournal {
  petState: PetState;
  streakRecovery: StreakRecoveryState;
  events: GrowthEvent[];
  createdAt: number;
}

export interface PetReconciliationResult {
  petState: PetState;
  awardedXp: number;
  streakStatus: "active" | "resting" | "fresh";
}

export function reconcilePetGamification(now: Date = new Date()): Promise<PetReconciliationResult> {
  return runPetStateMutation(async () => {
    await recoverPetReconciliationJournal();
    const settlement = await settleCompletedSessionXpWithinMutation(now);
    const [siteLists = [], sessionLog = [], streakLedgerValue] = await Promise.all([
      getTyped("sync", STORAGE_KEYS.sync.siteLists),
      getTyped("local", STORAGE_KEYS.local.sessionLog),
      getTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY)
    ]);
    const streakResult = reconcileStreakFromSessions(settlement.petState, sessionLog, {
      now,
      recovery: streakLedgerValue
    });
    const beforeBadges = new Set(streakResult.state.badges);
    const petState = normalizePetState(awardBadges(streakResult.state, sessionLog, siteLists, {
      comebackEligible: streakResult.streakRestored,
      now: now.getTime()
    }));
    const growthEvents = streakGrowthEvents(
      streakResult,
      beforeBadges,
      petState,
      now.getTime(),
      streakLedgerValue?.previousStreakDays
    );

    const journal: PetReconciliationJournal = {
      petState,
      streakRecovery: streakResult.recovery,
      events: growthEvents,
      createdAt: now.getTime()
    };
    await setTyped("local", PET_RECONCILIATION_JOURNAL_KEY, journal);
    const appliedPetState = await applyPetReconciliationJournal(journal);

    return {
      petState: appliedPetState,
      awardedXp: settlement.awardedXp,
      streakStatus: streakResult.status
    };
  });
}

export function savePetName(rawName: string): Promise<PetState> {
  return runPetStateMutation(async () => {
    await recoverPetReconciliationJournal();
    const current = normalizePetState(await getTyped("sync", STORAGE_KEYS.sync.petState));
    const name = rawName.trim().slice(0, 24) || DEFAULT_PET_NAME;
    const petState = normalizePetState({ ...current, name });
    await setTyped("sync", STORAGE_KEYS.sync.petState, petState);
    return petState;
  });
}

async function recoverPetReconciliationJournal(): Promise<void> {
  const journal = await getTyped<PetReconciliationJournal>("local", PET_RECONCILIATION_JOURNAL_KEY);
  if (journal) {
    await applyPetReconciliationJournal(journal);
  }
}

async function applyPetReconciliationJournal(journal: PetReconciliationJournal): Promise<PetState> {
  const [currentValue, currentRecovery] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.petState),
    getTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY)
  ]);
  const current = normalizePetState(currentValue);
  const streakRecovery = mergeStreakRecovery(currentRecovery, journal.streakRecovery);
  const petState = mergeMonotonicPetProgress(
    current,
    journal.petState,
    currentRecovery,
    journal.streakRecovery
  );
  await setTyped("sync", STORAGE_KEYS.sync.petState, petState);
  await appendGrowthEvents(journal.events, true);
  await setTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY, streakRecovery);
  await chrome.storage.local.remove(PET_RECONCILIATION_JOURNAL_KEY);
  return petState;
}

function mergeMonotonicPetProgress(
  current: PetState,
  targetValue: PetState,
  currentRecovery?: StreakRecoveryState,
  targetRecovery?: StreakRecoveryState
): PetState {
  const target = normalizePetState(targetValue);
  const badges = Array.from(new Set([...current.badges, ...target.badges]));
  const badgeAwards = Object.fromEntries(badges.map((badge) => {
    const currentAward = current.badgeAwards[badge];
    const targetAward = target.badgeAwards[badge];
    if (!currentAward) {
      return [badge, targetAward];
    }
    if (!targetAward) {
      return [badge, currentAward];
    }
    return [badge, { earnedAt: Math.min(currentAward.earnedAt, targetAward.earnedAt) }];
  }));
  const currentThrough = currentRecovery?.processedThroughDate ?? current.lastActiveDate;
  const targetThrough = targetRecovery?.processedThroughDate ?? target.lastActiveDate;
  const streakSource = currentThrough > targetThrough ? current : target;

  return normalizePetState({
    ...target,
    name: current.name || target.name,
    xp: Math.max(current.xp, target.xp),
    totalFocusMinutes: Math.max(current.totalFocusMinutes, target.totalFocusMinutes),
    stage: Math.max(current.stage, target.stage) as PetState["stage"],
    streak: { ...streakSource.streak },
    streakDays: streakSource.streakDays,
    streakFreezes: streakSource.streakFreezes,
    lastActiveDate: streakSource.lastActiveDate,
    badges,
    badgeAwards
  });
}

function mergeStreakRecovery(
  current: StreakRecoveryState | undefined,
  target: StreakRecoveryState
): StreakRecoveryState {
  if (!current) {
    return target;
  }

  return (current.processedThroughDate ?? "") > (target.processedThroughDate ?? "")
    ? current
    : target;
}

function streakGrowthEvents(
  streakResult: ReturnType<typeof reconcileStreakFromSessions>,
  beforeBadges: Set<string>,
  petState: PetState,
  now: number,
  previousStreakDays?: number
): GrowthEvent[] {
  const events: GrowthEvent[] = [];
  if (streakResult.freezeAwarded) {
    events.push(createGrowthEvent("freeze_granted", now, {}));
  }
  if (streakResult.freezeConsumed) {
    events.push(createGrowthEvent("freeze_used", now, {}));
  }
  if (streakResult.restStarted) {
    events.push(createGrowthEvent("streak_rest", now, { streakFrom: streakResult.recovery.previousStreakDays }));
  }
  if (streakResult.streakRestored) {
    events.push(createGrowthEvent("streak_restored", now, {
      streakFrom: previousStreakDays,
      streakTo: petState.streakDays
    }));
  }
  if (streakResult.freshStarted) {
    events.push(createGrowthEvent("streak_fresh_start", now, {}));
  }
  for (const badge of petState.badges) {
    if (!beforeBadges.has(badge)) {
      events.push(createGrowthEvent("badge_earned", petState.badgeAwards[badge]?.earnedAt ?? now, { badgeId: badge }));
    }
  }
  return events;
}
