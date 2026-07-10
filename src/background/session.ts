import { STORAGE_KEYS, getTyped, setTyped } from "../shared/storage";
import type { EndSessionReason } from "../shared/messaging";
import type { DailyStats, Intensity, Session, SiteList, TempAllow } from "../shared/types";
import { settleCompletedSessionXp } from "../pet/xpEngine";
import {
  type DynamicRuleClient,
  applySessionRules,
  applyTempAllowRules,
  compileRules,
  compileTempAllowRules,
  domainMatches,
  normalizeDomain,
  shouldBlockDomain
} from "./rules";

export const SESSION_END_ALARM = "focuswhale:session-end";
export const EMERGENCY_END_ALARM = "focuswhale:emergency-end";
export const TEMP_ALLOW_ALARM_PREFIX = "focuswhale:temp-allow:";
export const SESSION_FINALIZATION_JOURNAL_KEY = "sessionFinalizationJournal";
export const SESSION_STATS_LEDGER_KEY = "sessionStatsLedger";
export const SESSION_LOCK_SNAPSHOT_KEY = "sessionLockSnapshot";
export const TEMP_ALLOW_MUTATION_JOURNAL_KEY = "tempAllowMutationJournal";
export const SCHEDULE_SUPPRESSION_KEY = "scheduleSuppression";
export const MAX_SESSION_LOG_ENTRIES = 5_000;
export const DAILY_STATS_RETENTION_DAYS = 400;

const PENDING_EMERGENCY_KEY = "pendingEmergency";
const EMERGENCY_USAGE_KEY = "emergencyUsage";
const EMERGENCY_DELAY_MINUTES = 5;
const EMERGENCY_WEEKLY_LIMIT = 1;
const BLOCKED_ATTEMPT_DEDUPE_MS = 2_000;
const TEMP_ALLOW_MINUTES = 5;
const MAX_INTENT_LOG_ENTRIES = 200;
const SESSION_LOCKED_SYNC_KEYS = [
  STORAGE_KEYS.sync.settings,
  STORAGE_KEYS.sync.siteLists,
  STORAGE_KEYS.sync.schedules
];

type FinalStatus = Exclude<Session["status"], "active">;
export type PendingEmergency = { sessionId: string; dueAt: number };
type EmergencyUsage = { weekKey: string; sessionIds: string[]; usedAt: number[] };
type LockedValue = { exists: boolean; value?: unknown };
type LockedSyncSnapshot = { sessionId: string; values: Record<string, LockedValue> };
type SessionFinalizationJournal = {
  session: Session;
  requestedStatus: FinalStatus;
  finalizedAt: number;
};
type SessionStatsLedger = {
  credits: Record<string, { date: string; focusMinutes: number; byDate?: Record<string, number> }>;
};
type IntentEntry = { at: number; domain: string; intent: string; sessionId?: string };
type TempAllowMutationJournal = {
  sessionId: string;
  domain: string;
  until: number;
  nextSession: Session;
  nextTempAllows: TempAllow[];
  nextIntentLog: IntentEntry[];
  statsKey: `dailyStats:${string}`;
  nextStats: DailyStats;
};
export type ScheduleSuppression = {
  scheduleId?: string;
  listId: string;
  windowEnd: number;
  sessionId: string;
};

export interface AlarmClient {
  create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void>;
  clear(name: string): Promise<boolean>;
}

export interface EventPublisher {
  publishSessionCompleted(session: Session): Promise<void>;
}

export interface SessionRewards {
  settleCompleted(): Promise<void>;
}

export class ChromeAlarmClient implements AlarmClient {
  async create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void> {
    await chrome.alarms.create(name, info);
  }

  async clear(name: string): Promise<boolean> {
    return chrome.alarms.clear(name);
  }
}

export class RuntimeEventPublisher implements EventPublisher {
  async publishSessionCompleted(session: Session): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type: "SESSION_COMPLETED", payload: { session } });
    } catch {
      // Popup/options listeners may be closed. The sessionLog remains the durable event record.
    }
  }
}

class PetSessionRewards implements SessionRewards {
  async settleCompleted(): Promise<void> {
    await settleCompletedSessionXp();
  }
}

export interface StartSessionInput {
  listId: string;
  intensity: Intensity;
  durationMinutes: number;
  source?: "manual" | "schedule";
  scheduleId?: string;
  scheduleWindowEnd?: number;
}

export class SessionManager {
  private mutationQueue: Promise<void> = Promise.resolve();
  private readonly recentBlockedAttempts = new Map<string, number>();

  constructor(
    private readonly dnrClient: DynamicRuleClient,
    private readonly alarms: AlarmClient = new ChromeAlarmClient(),
    private readonly publisher: EventPublisher = new RuntimeEventPublisher(),
    private readonly rewards: SessionRewards = new PetSessionRewards()
  ) {}

  async getActiveSession(): Promise<Session | null> {
    return (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  }

  getState(now = Date.now()): Promise<{ activeSession: Session | null; pendingEmergency: PendingEmergency | null }> {
    return this.runMutation(() => this.getStateWithinMutation(now));
  }

  startSession(input: StartSessionInput, now = Date.now()): Promise<Session> {
    return this.runMutation(() => this.startSessionWithinMutation(input, now));
  }

  upgradeIntensity(intensity: Intensity, now = Date.now()): Promise<Session> {
    return this.runMutation(() => this.upgradeIntensityWithinMutation(intensity, now));
  }

  endSession(reason: EndSessionReason, now = Date.now()): Promise<Session | null> {
    return this.runMutation(() => this.endSessionWithinMutation(reason, now));
  }

  completeDueSession(now = Date.now()): Promise<Session | null> {
    return this.runMutation(() => this.completeDueSessionWithinMutation(now));
  }

  completeEmergencyIfDue(now = Date.now()): Promise<Session | null> {
    return this.runMutation(() => this.completeEmergencyIfDueWithinMutation(now));
  }

  registerSnooze(now = Date.now()): Promise<number> {
    return this.runMutation(() => this.registerSnoozeWithinMutation(now));
  }

  requestTempAllow(
    input: { domain: string; intent: string; sessionId: string },
    now = Date.now()
  ): Promise<{ nextSnoozeDelayMin: number; until: number }> {
    return this.runMutation(() => this.requestTempAllowWithinMutation(input, now));
  }

  recordBlockedAttempt(domain: string, now = Date.now(), sourceKey = "unknown"): Promise<void> {
    return this.runMutation(() => this.recordBlockedAttemptWithinMutation(domain, now, sourceKey));
  }

  clearLocalData(now = Date.now()): Promise<void> {
    return this.runMutation(() => this.clearLocalDataWithinMutation(now));
  }

  syncTempAllowRules(now = Date.now()): Promise<void> {
    return this.runMutation(() => this.syncTempAllowRulesWithinMutation(now));
  }

  reconcile(now = Date.now()): Promise<void> {
    return this.runMutation(() => this.reconcileWithinMutation(now));
  }

  finalizeScheduleSession(now = Date.now()): Promise<Session | null> {
    return this.runMutation(() => this.finalizeScheduleSessionWithinMutation(now));
  }

  rejectLockedSettingChanges(
    changes: Record<string, chrome.storage.StorageChange>,
    revertingValues: Map<string, unknown>
  ): Promise<void> {
    return this.runMutation(() => this.rejectLockedSettingChangesWithinMutation(changes, revertingValues));
  }

  private runMutation<T>(operationFactory: () => Promise<T>): Promise<T> {
    const operation = this.mutationQueue.then(operationFactory);
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async getStateWithinMutation(
    now: number
  ): Promise<{ activeSession: Session | null; pendingEmergency: PendingEmergency | null }> {
    await this.recoverFinalization(now);
    let activeSession = await this.getActiveSession();
    let pendingEmergency = await this.getPendingEmergency();

    if (pendingEmergency && pendingEmergency.sessionId !== activeSession?.id) {
      await this.clearPendingEmergency();
      pendingEmergency = null;
    }

    if (activeSession?.status === "active" && activeSession.endsAt <= now) {
      await this.finalizeActiveSessionWithinMutation("completed", now);
      activeSession = null;
      pendingEmergency = null;
    } else if (activeSession && activeSession.status !== "active") {
      await this.finalizeActiveSessionWithinMutation(activeSession.status, now);
      activeSession = null;
      pendingEmergency = null;
    } else if (activeSession && pendingEmergency?.sessionId === activeSession.id) {
      if (pendingEmergency.dueAt <= now) {
        await this.finalizeActiveSessionWithinMutation("aborted", now);
        activeSession = null;
        pendingEmergency = null;
      } else {
        await this.alarms.create(EMERGENCY_END_ALARM, { when: pendingEmergency.dueAt });
      }
    }

    return { activeSession, pendingEmergency };
  }

  private async startSessionWithinMutation(input: StartSessionInput, now: number): Promise<Session> {
    await this.recoverFinalization(now);
    const existingSession = await this.getActiveSession();
    if (existingSession?.status === "active" && existingSession.endsAt <= now) {
      await this.finalizeActiveSessionWithinMutation("completed", now);
    } else if (existingSession && existingSession.status !== "active") {
      await this.finalizeActiveSessionWithinMutation(existingSession.status, now);
    } else if (isRunning(existingSession, now)) {
      throw new Error("A session is already running. Use the intensity upgrade action instead.");
    }

    const siteList = await this.requireSiteList(input.listId);
    const scheduledEnd = input.source === "schedule"
      && typeof input.scheduleWindowEnd === "number"
      && Number.isFinite(input.scheduleWindowEnd)
      && input.scheduleWindowEnd > now
      ? input.scheduleWindowEnd
      : null;
    const requestedEndsAt = scheduledEnd ?? now + Math.max(1, input.durationMinutes) * 60_000;
    const session: Session = {
      id: createSessionId(now),
      source: input.source ?? "manual",
      listId: input.listId,
      scheduleId: input.source === "schedule" ? input.scheduleId : undefined,
      scheduleWindowEnd: scheduledEnd ?? undefined,
      intensity: input.intensity,
      startedAt: now,
      endsAt: requestedEndsAt,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };

    await this.activateSession(session, siteList, now, null);
    return session;
  }

  private async upgradeIntensityWithinMutation(intensity: Intensity, now: number): Promise<Session> {
    await this.recoverFinalization(now);
    const activeSession = await this.getActiveSession();
    if (activeSession?.status === "active" && activeSession.endsAt <= now) {
      await this.finalizeActiveSessionWithinMutation("completed", now);
      throw new Error("No active session is available for an intensity upgrade.");
    }
    if (activeSession && activeSession.status !== "active") {
      await this.finalizeActiveSessionWithinMutation(activeSession.status, now);
      throw new Error("No active session is available for an intensity upgrade.");
    }
    if (!isRunning(activeSession, now)) {
      throw new Error("No active session is available for an intensity upgrade.");
    }

    if (intensityRank(intensity) < intensityRank(activeSession.intensity)) {
      throw new Error("Running sessions can only raise intensity.");
    }
    if (intensity === activeSession.intensity) {
      return activeSession;
    }

    const siteList = await this.requireSiteList(activeSession.listId);
    const upgradedSession: Session = { ...activeSession, intensity };
    await this.activateSession(upgradedSession, siteList, now, activeSession);
    return upgradedSession;
  }

  private async endSessionWithinMutation(reason: EndSessionReason, now: number): Promise<Session | null> {
    await this.recoverFinalization(now);
    const activeSession = await this.getActiveSession();
    if (!activeSession) {
      return null;
    }

    if (activeSession.status === "active" && activeSession.endsAt <= now) {
      return this.finalizeActiveSessionWithinMutation("completed", now);
    }
    if (reason === "emergency") {
      return this.requestEmergencyEnd(now);
    }
    if (reason === "completed") {
      throw new Error("A session can only complete after its natural deadline.");
    }
    throw new Error("Immediate session termination is unavailable. Use the supported emergency flow.");
  }

  private async completeDueSessionWithinMutation(now: number): Promise<Session | null> {
    await this.recoverFinalization(now);
    const activeSession = await this.getActiveSession();
    return activeSession?.status === "active" && activeSession.endsAt <= now
      ? this.finalizeActiveSessionWithinMutation("completed", now)
      : null;
  }

  private async completeEmergencyIfDueWithinMutation(now: number): Promise<Session | null> {
    await this.recoverFinalization(now);
    const pending = await this.getPendingEmergency();
    if (!pending || pending.dueAt > now) {
      return null;
    }

    const activeSession = await this.getActiveSession();
    if (!activeSession || activeSession.id !== pending.sessionId) {
      await this.clearPendingEmergency();
      return null;
    }

    return this.finalizeActiveSessionWithinMutation("aborted", now);
  }

  private async registerSnoozeWithinMutation(now: number): Promise<number> {
    await this.recoverFinalization(now);
    const activeSession = await this.getActiveSession();
    if (!isRunning(activeSession, now)) {
      throw new Error("No active session is available for snooze.");
    }

    const nextSnoozeDelayMin = nextSnoozeDelay(activeSession.nextSnoozeDelayMin);
    await setTyped("local", STORAGE_KEYS.local.activeSession, {
      ...activeSession,
      snoozeCount: activeSession.snoozeCount + 1,
      nextSnoozeDelayMin
    });

    return nextSnoozeDelayMin;
  }

  private async requestTempAllowWithinMutation(
    input: { domain: string; intent: string; sessionId: string },
    now: number
  ): Promise<{ nextSnoozeDelayMin: number; until: number }> {
    await this.recoverFinalization(now);
    const normalizedDomain = normalizeDomain(input.domain);
    const normalizedIntent = input.intent.trim();
    if (!normalizedDomain) {
      throw new Error("A valid domain is required for temporary allow.");
    }
    if (!normalizedIntent || normalizedIntent.length > 140) {
      throw new Error("Temporary allow requires an intent of 1 to 140 characters.");
    }

    const activeSession = await this.getActiveSession();
    if (
      !isRunning(activeSession, now)
      || activeSession.id !== input.sessionId
      || activeSession.intensity !== "medium"
    ) {
      throw new Error("Temporary allow requires the matching active medium session.");
    }

    const siteList = await this.requireSiteList(activeSession.listId);
    if (!shouldBlockDomain(normalizedDomain, siteList)) {
      throw new Error("The requested domain is not blocked by the active session.");
    }

    const storedTempAllows = (await getTyped("local", STORAGE_KEYS.local.tempAllows)) ?? [];
    const activeTempAllows = storedTempAllows.filter((entry) => (
      entry.sessionId === activeSession.id && entry.until > now
    ));
    const existing = activeTempAllows.find((entry) => domainMatches(normalizedDomain, entry.domain));
    if (existing) {
      return { nextSnoozeDelayMin: activeSession.nextSnoozeDelayMin, until: existing.until };
    }

    const until = now + TEMP_ALLOW_MINUTES * 60_000;
    const nextTempAllows = [
      ...activeTempAllows.filter((entry) => normalizeDomain(entry.domain) !== normalizedDomain),
      { domain: normalizedDomain, until, sessionId: activeSession.id }
    ];
    const nextSnoozeDelayMin = nextSnoozeDelay(activeSession.nextSnoozeDelayMin);
    const nextSession: Session = {
      ...activeSession,
      snoozeCount: activeSession.snoozeCount + 1,
      nextSnoozeDelayMin
    };
    const intentLog = (await getTyped("local", STORAGE_KEYS.local.intentLog)) ?? [];
    const nextIntentLog = [
      ...intentLog,
      { at: now, domain: normalizedDomain, intent: normalizedIntent, sessionId: activeSession.id }
    ].slice(-MAX_INTENT_LOG_ENTRIES);
    const date = localDateKey(now);
    const statsKey = STORAGE_KEYS.local.dailyStats(date);
    const existingStats = await getTyped("local", statsKey);
    const nextStats: DailyStats = {
      date,
      focusMinutes: existingStats?.focusMinutes ?? 0,
      blockedAttempts: existingStats?.blockedAttempts ?? 0,
      overrides: (existingStats?.overrides ?? 0) + 1,
      domainVisits: existingStats?.domainVisits ?? {}
    };
    const journal: TempAllowMutationJournal = {
      sessionId: activeSession.id,
      domain: normalizedDomain,
      until,
      nextSession,
      nextTempAllows,
      nextIntentLog,
      statsKey,
      nextStats
    };

    await setTyped("local", TEMP_ALLOW_MUTATION_JOURNAL_KEY, journal);
    await this.resumeTempAllowMutation(journal, now);
    return { nextSnoozeDelayMin, until };
  }

  private async recordBlockedAttemptWithinMutation(domain: string, now: number, sourceKey: string): Promise<void> {
    await this.recoverFinalization(now);
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      throw new Error("A valid domain is required for blocked-attempt analytics.");
    }

    const activeSession = await this.getActiveSession();
    if (!isRunning(activeSession, now) || activeSession.intensity === "soft") {
      throw new Error("Blocked-attempt analytics require an active blocking session.");
    }

    const [siteList, tempAllows] = await Promise.all([
      this.requireSiteList(activeSession.listId),
      getTyped("local", STORAGE_KEYS.local.tempAllows)
    ]);
    if (!shouldBlockDomain(normalizedDomain, siteList)) {
      throw new Error("The requested domain is not blocked by the active session.");
    }
    if ((tempAllows ?? []).some((entry) => (
      entry.sessionId === activeSession.id
      && entry.until > now
      && domainMatches(normalizedDomain, entry.domain)
    ))) {
      throw new Error("The requested domain currently has a temporary allow.");
    }

    const dedupeKey = `${activeSession.id}:${sourceKey}:${normalizedDomain}`;
    const previousAttemptAt = this.recentBlockedAttempts.get(dedupeKey);
    if (previousAttemptAt !== undefined && now - previousAttemptAt < BLOCKED_ATTEMPT_DEDUPE_MS) {
      return;
    }
    for (const [key, attemptedAt] of this.recentBlockedAttempts) {
      if (now - attemptedAt >= BLOCKED_ATTEMPT_DEDUPE_MS) {
        this.recentBlockedAttempts.delete(key);
      }
    }
    this.recentBlockedAttempts.set(dedupeKey, now);

    const date = localDateKey(now);
    const key = STORAGE_KEYS.local.dailyStats(date);
    const existing = await getTyped("local", key);
    const nextStats: DailyStats = {
      date,
      focusMinutes: existing?.focusMinutes ?? 0,
      blockedAttempts: (existing?.blockedAttempts ?? 0) + 1,
      overrides: existing?.overrides ?? 0,
      domainVisits: {
        ...(existing?.domainVisits ?? {}),
        [normalizedDomain]: (existing?.domainVisits?.[normalizedDomain] ?? 0) + 1
      }
    };

    await setTyped("local", key, nextStats);
    await pruneDailyStats(now);
  }

  private async syncTempAllowRulesWithinMutation(now: number): Promise<void> {
    const [activeSession, storedTempAllows] = await Promise.all([
      this.getActiveSession(),
      getTyped("local", STORAGE_KEYS.local.tempAllows)
    ]);
    const activeTempAllows = (storedTempAllows ?? [])
      .map((entry) => ({
        domain: normalizeDomain(entry.domain),
        until: entry.until,
        sessionId: entry.sessionId
      }))
      .filter((entry): entry is TempAllow => Boolean(
        isRunning(activeSession, now)
        && activeSession.intensity === "medium"
        && entry.sessionId === activeSession.id
        && entry.domain
        && entry.until > now
      ));

    await applyTempAllowRules(this.dnrClient, compileTempAllowRules(activeTempAllows, now));
    await setTyped("local", STORAGE_KEYS.local.tempAllows, activeTempAllows);

    const activeDomains = new Set(activeTempAllows.map((entry) => entry.domain));
    await Promise.all([
      ...activeTempAllows.map((entry) => this.alarms.create(tempAllowAlarmName(entry.domain), { when: entry.until })),
      ...(storedTempAllows ?? [])
        .map((entry) => normalizeDomain(entry.domain))
        .filter((domain) => domain && !activeDomains.has(domain))
        .map((domain) => this.alarms.clear(tempAllowAlarmName(domain)))
    ]);
  }

  private async clearLocalDataWithinMutation(now: number): Promise<void> {
    await this.recoverFinalization(now);
    let activeSession = await this.getActiveSession();
    if (activeSession?.status === "active" && activeSession.endsAt <= now) {
      await this.finalizeActiveSessionWithinMutation("completed", now);
      activeSession = null;
    } else if (activeSession && activeSession.status !== "active") {
      await this.finalizeActiveSessionWithinMutation(activeSession.status, now);
      activeSession = null;
    }
    if (isRunning(activeSession, now)) {
      throw new Error("활성 세션이 끝난 뒤 로컬 기록을 지울 수 있습니다.");
    }

    await this.clearTempAllows();
    await this.clearSessionRules();
    await this.alarms.clear(SESSION_END_ALARM);
    await this.alarms.clear(EMERGENCY_END_ALARM);

    const localSnapshot = await chrome.storage.local.get(null);
    const emergencyUsage = localSnapshot[EMERGENCY_USAGE_KEY] as EmergencyUsage | undefined;
    const scheduleSuppression = localSnapshot[SCHEDULE_SUPPRESSION_KEY] as ScheduleSuppression | undefined;
    const retainScheduleSuppression = typeof scheduleSuppression?.windowEnd === "number"
      && scheduleSuppression.windowEnd > now;
    const keysToRemove = Object.keys(localSnapshot).filter((key) => (
      !(key === EMERGENCY_USAGE_KEY && emergencyUsage?.weekKey === localWeekKey(now))
      && !(key === SCHEDULE_SUPPRESSION_KEY && retainScheduleSuppression)
    ));
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    this.recentBlockedAttempts.clear();
  }

  private async reconcileWithinMutation(now: number): Promise<void> {
    await this.recoverFinalization(now);

    let pendingEmergency = await this.getPendingEmergency();
    const activeSession = await this.getActiveSession();

    if (pendingEmergency && pendingEmergency.sessionId !== activeSession?.id) {
      await this.clearPendingEmergency();
      pendingEmergency = null;
    }

    if (activeSession?.status === "active" && activeSession.endsAt <= now) {
      await this.finalizeActiveSessionWithinMutation("completed", now);
      return;
    }
    if (activeSession && activeSession.status !== "active") {
      await this.finalizeActiveSessionWithinMutation(activeSession.status, now);
      return;
    }

    if (isRunning(activeSession, now)) {
      if (pendingEmergency?.sessionId === activeSession.id && pendingEmergency.dueAt <= now) {
        await this.finalizeActiveSessionWithinMutation("aborted", now);
        return;
      }

      await this.syncTempAllowRulesWithinMutation(now);
      await this.ensureLockedSettings(activeSession);
      const siteList = await this.requireSiteList(activeSession.listId);
      await applySessionRules(this.dnrClient, compileRules(siteList, activeSession.intensity));
      await this.alarms.create(SESSION_END_ALARM, { when: activeSession.endsAt });

      if (pendingEmergency?.sessionId === activeSession.id) {
        await this.alarms.create(EMERGENCY_END_ALARM, { when: pendingEmergency.dueAt });
      }
      return;
    }

    await this.syncTempAllowRulesWithinMutation(now);
    await this.clearSessionRules();
  }

  private async finalizeScheduleSessionWithinMutation(now: number): Promise<Session | null> {
    await this.recoverFinalization(now);
    const activeSession = await this.getActiveSession();
    if (activeSession?.source !== "schedule") {
      return null;
    }

    return this.finalizeActiveSessionWithinMutation("completed", now);
  }

  private async rejectLockedSettingChangesWithinMutation(
    changes: Record<string, chrome.storage.StorageChange>,
    revertingValues: Map<string, unknown>
  ): Promise<void> {
    const activeSession = await this.getActiveSession();
    if (!isRunning(activeSession)) {
      revertingValues.clear();
      return;
    }

    const snapshot = await this.getLockSnapshot();

    for (const key of SESSION_LOCKED_SYNC_KEYS) {
      const change = changes[key];
      if (!change) {
        continue;
      }

      const snapshotValue = snapshot?.sessionId === activeSession.id ? snapshot.values[key] : undefined;
      const expectedValue = revertingValues.has(key)
        ? revertingValues.get(key)
        : snapshotValue ? (snapshotValue.exists ? snapshotValue.value : undefined) : change.oldValue;
      if (storageValuesEqual(change.newValue, expectedValue)) {
        revertingValues.delete(key);
        continue;
      }

      revertingValues.set(key, expectedValue);
      await restoreSyncValueWithRetry(key, expectedValue);
    }
  }

  private async requestEmergencyEnd(now: number): Promise<Session | null> {
    const activeSession = await this.getActiveSession();
    if (!isRunning(activeSession, now) || activeSession.intensity !== "hard") {
      throw new Error("Emergency end is only available during an active hard session.");
    }

    const pending = await this.getPendingEmergency();
    if (pending?.sessionId === activeSession.id) {
      return pending.dueAt <= now
        ? this.finalizeActiveSessionWithinMutation("aborted", now)
        : activeSession;
    }

    const usage = await this.getEmergencyUsage(now);
    if (!usage.sessionIds.includes(activeSession.id) && usage.sessionIds.length >= EMERGENCY_WEEKLY_LIMIT) {
      throw new Error("이번 주 비상 종료 요청은 이미 사용했습니다.");
    }

    const dueAt = now + EMERGENCY_DELAY_MINUTES * 60_000;
    const previousPending = await this.getPendingEmergency();
    try {
      await chrome.storage.local.set({
        [PENDING_EMERGENCY_KEY]: { sessionId: activeSession.id, dueAt } satisfies PendingEmergency,
        [EMERGENCY_USAGE_KEY]: {
          weekKey: usage.weekKey,
          sessionIds: Array.from(new Set([...usage.sessionIds, activeSession.id])),
          usedAt: usage.sessionIds.includes(activeSession.id) ? usage.usedAt : [...usage.usedAt, now]
        } satisfies EmergencyUsage
      });
      await createAlarmWithRetry(this.alarms, EMERGENCY_END_ALARM, { when: dueAt });
    } catch (error) {
      await this.alarms.clear(EMERGENCY_END_ALARM).catch(() => false);
      await chrome.storage.local.set({
        [PENDING_EMERGENCY_KEY]: previousPending,
        [EMERGENCY_USAGE_KEY]: usage
      }).catch(() => undefined);
      throw error;
    }
    return activeSession;
  }

  private async activateSession(
    session: Session,
    siteList: SiteList,
    now: number,
    previousSession: Session | null
  ): Promise<void> {
    const nextRules = compileRules(siteList, session.intensity);
    const storedTempAllows = (await getTyped("local", STORAGE_KEYS.local.tempAllows)) ?? [];
    const previousTempAllows = previousSession?.intensity === "medium"
      ? storedTempAllows.filter((entry) => entry.sessionId === previousSession.id && entry.until > now)
      : [];
    const nextTempAllows = session.intensity === "medium"
      ? storedTempAllows.filter((entry) => entry.sessionId === session.id && entry.until > now)
      : [];
    const previousSnapshot = await this.getLockSnapshot();
    const lockSnapshot = previousSnapshot && previousSession && previousSnapshot.sessionId === previousSession.id
      ? { ...previousSnapshot, sessionId: session.id }
      : await this.captureLockedSettings(session.id);
    let previousRules: chrome.declarativeNetRequest.Rule[] = [];
    if (previousSession) {
      const previousList = previousSession.listId === siteList.id
        ? siteList
        : await this.requireSiteList(previousSession.listId);
      previousRules = compileRules(previousList, previousSession.intensity);
    }

    let rulesTouched = false;
    let tempRulesTouched = false;
    let alarmTouched = false;
    try {
      rulesTouched = true;
      await applySessionRules(this.dnrClient, nextRules);
      tempRulesTouched = true;
      await applyTempAllowRules(this.dnrClient, compileTempAllowRules(nextTempAllows, now));
      alarmTouched = true;
      await this.alarms.create(SESSION_END_ALARM, { when: session.endsAt });
      await chrome.storage.local.set({
        [STORAGE_KEYS.local.activeSession]: session,
        [SESSION_LOCK_SNAPSHOT_KEY]: lockSnapshot,
        [STORAGE_KEYS.local.tempAllows]: nextTempAllows
      });
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.local.activeSession]: previousSession,
          [SESSION_LOCK_SNAPSHOT_KEY]: previousSnapshot ?? null,
          [STORAGE_KEYS.local.tempAllows]: storedTempAllows
        });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (rulesTouched) {
        try {
          await applySessionRules(this.dnrClient, previousRules);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (tempRulesTouched) {
        try {
          await applyTempAllowRules(this.dnrClient, compileTempAllowRules(previousTempAllows, now));
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (alarmTouched) {
        try {
          if (previousSession) {
            await this.alarms.create(SESSION_END_ALARM, { when: previousSession.endsAt });
          } else {
            await this.alarms.clear(SESSION_END_ALARM);
          }
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }

      if (rollbackErrors.length > 0) {
        throw new Error(`Session activation failed and rollback was incomplete: ${errorMessage(error)}`, { cause: error });
      }
      throw error;
    }

    const nextDomains = new Set(nextTempAllows.map((entry) => normalizeDomain(entry.domain)));
    await Promise.allSettled([
      ...nextTempAllows.map((entry) => this.alarms.create(tempAllowAlarmName(entry.domain), { when: entry.until })),
      ...storedTempAllows
        .map((entry) => normalizeDomain(entry.domain))
        .filter((domain) => domain && !nextDomains.has(domain))
        .map((domain) => this.alarms.clear(tempAllowAlarmName(domain)))
    ]);
  }

  private async finalizeActiveSessionWithinMutation(status: FinalStatus, now: number): Promise<Session | null> {
    const existingJournal = await this.getFinalizationJournal();
    if (existingJournal) {
      return this.resumeFinalization(existingJournal, now);
    }

    const activeSession = await this.getActiveSession();
    if (!activeSession) {
      return null;
    }

    const journal: SessionFinalizationJournal = {
      session: activeSession,
      requestedStatus: activeSession.endsAt <= now ? "completed" : status,
      finalizedAt: now
    };
    await setTyped("local", SESSION_FINALIZATION_JOURNAL_KEY, journal);
    return this.resumeFinalization(journal, now);
  }

  private async recoverFinalization(now: number): Promise<Session | null> {
    await this.recoverTempAllowMutation(now);
    const journal = await this.getFinalizationJournal();
    return journal ? this.resumeFinalization(journal, now) : null;
  }

  private async recoverTempAllowMutation(now: number): Promise<void> {
    const journal = await this.getTempAllowMutationJournal();
    if (journal) {
      await this.rollbackUncommittedTempAllow(journal, now);
      await chrome.storage.local.remove(TEMP_ALLOW_MUTATION_JOURNAL_KEY);
    }
  }

  private async resumeTempAllowMutation(journal: TempAllowMutationJournal, now: number): Promise<void> {
    const activeSession = await this.getActiveSession();
    const requestStillValid = isRunning(activeSession, now)
      && activeSession.id === journal.sessionId
      && activeSession.intensity === "medium"
      && journal.until > now;
    if (!requestStillValid) {
      await this.alarms.clear(tempAllowAlarmName(journal.domain));
      await this.syncTempAllowRulesWithinMutation(now);
      await chrome.storage.local.remove(TEMP_ALLOW_MUTATION_JOURNAL_KEY);
      return;
    }

    const siteList = await this.requireSiteList(activeSession.listId);
    if (!shouldBlockDomain(journal.domain, siteList)) {
      await this.alarms.clear(tempAllowAlarmName(journal.domain));
      await this.syncTempAllowRulesWithinMutation(now);
      await chrome.storage.local.remove(TEMP_ALLOW_MUTATION_JOURNAL_KEY);
      return;
    }

    try {
      await this.alarms.create(tempAllowAlarmName(journal.domain), { when: journal.until });
      await applyTempAllowRules(this.dnrClient, compileTempAllowRules(journal.nextTempAllows, now));
      await chrome.storage.local.set({
        [STORAGE_KEYS.local.activeSession]: journal.nextSession,
        [STORAGE_KEYS.local.tempAllows]: journal.nextTempAllows,
        [STORAGE_KEYS.local.intentLog]: journal.nextIntentLog,
        [journal.statsKey]: journal.nextStats
      });
    } catch (error) {
      try {
        await this.rollbackUncommittedTempAllow(journal, now);
        await chrome.storage.local.remove(TEMP_ALLOW_MUTATION_JOURNAL_KEY);
      } catch (rollbackError) {
        throw new Error(`Temporary allow failed and rollback was incomplete: ${errorMessage(error)}`, {
          cause: rollbackError
        });
      }
      throw error;
    }

    await chrome.storage.local.remove(TEMP_ALLOW_MUTATION_JOURNAL_KEY).catch(() => undefined);
    await pruneDailyStats(now).catch(() => undefined);
  }

  private async rollbackUncommittedTempAllow(journal: TempAllowMutationJournal, now: number): Promise<void> {
    const [activeSession, storedTempAllows] = await Promise.all([
      this.getActiveSession(),
      getTyped("local", STORAGE_KEYS.local.tempAllows)
    ]);
    const durableRules = (storedTempAllows ?? []).filter((entry) => (
      isRunning(activeSession, now)
      && activeSession.intensity === "medium"
      && entry.sessionId === activeSession.id
      && entry.until > now
    ));
    await applyTempAllowRulesWithRetry(this.dnrClient, compileTempAllowRules(durableRules, now));
    if (!durableRules.some((entry) => domainMatches(journal.domain, entry.domain))) {
      await this.alarms.clear(tempAllowAlarmName(journal.domain)).catch(() => false);
    }
  }

  private async resumeFinalization(
    journalValue: SessionFinalizationJournal,
    _now: number
  ): Promise<Session> {
    const journal = journalValue;
    const finalStatus = journal.requestedStatus;

    const finalizedSession: Session = { ...journal.session, status: finalStatus };
    await this.logSession(finalizedSession);
    if (finalizedSession.status === "completed") {
      await this.rewards.settleCompleted();
    }
    await addFocusMinutesOnce(finalizedSession, journal.finalizedAt);
    if (finalizedSession.source === "schedule" && finalizedSession.status !== "completed") {
      await setTyped<ScheduleSuppression>("local", SCHEDULE_SUPPRESSION_KEY, {
        scheduleId: finalizedSession.scheduleId,
        listId: finalizedSession.listId,
        windowEnd: finalizedSession.scheduleWindowEnd ?? finalizedSession.endsAt,
        sessionId: finalizedSession.id
      });
    }
    await this.clearActiveState(finalizedSession.id);
    await chrome.storage.local.remove(SESSION_FINALIZATION_JOURNAL_KEY);
    try {
      await this.publisher.publishSessionCompleted(finalizedSession);
    } catch {
      // Durable state is complete; transient UI listeners can recover from storage.
    }
    return finalizedSession;
  }

  private async clearActiveState(sessionId: string): Promise<void> {
    const [activeSession, pendingEmergency, lockSnapshot] = await Promise.all([
      this.getActiveSession(),
      this.getPendingEmergency(),
      this.getLockSnapshot()
    ]);
    if (activeSession && activeSession.id !== sessionId) {
      throw new Error("Refusing to clean up a newer active session.");
    }

    const updates: Record<string, unknown> = {
      [STORAGE_KEYS.local.activeSession]: null
    };
    if (!pendingEmergency || pendingEmergency.sessionId === sessionId) {
      updates[PENDING_EMERGENCY_KEY] = null;
    }
    if (!lockSnapshot || lockSnapshot.sessionId === sessionId) {
      updates[SESSION_LOCK_SNAPSHOT_KEY] = null;
    }
    await chrome.storage.local.set(updates);
    await this.alarms.clear(SESSION_END_ALARM);
    await this.alarms.clear(EMERGENCY_END_ALARM);
    await this.clearTempAllows();
    await this.clearSessionRules();
  }

  private async clearSessionRules(): Promise<void> {
    await applySessionRules(this.dnrClient, []);
  }

  private async clearTempAllows(): Promise<void> {
    const tempAllows = (await getTyped("local", STORAGE_KEYS.local.tempAllows)) ?? [];
    await applyTempAllowRules(this.dnrClient, []);
    await setTyped("local", STORAGE_KEYS.local.tempAllows, []);
    await Promise.all(tempAllows.map((entry) => this.alarms.clear(tempAllowAlarmName(normalizeDomain(entry.domain)))));
  }

  private async requireSiteList(listId: string): Promise<SiteList> {
    const siteLists = (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [];
    const siteList = siteLists.find((candidate) => candidate.id === listId);
    if (!siteList) {
      throw new Error(`Site list not found: ${listId}`);
    }

    return siteList;
  }

  async getPendingEmergency(): Promise<PendingEmergency | null> {
    return (await getTyped<PendingEmergency | null>("local", PENDING_EMERGENCY_KEY)) ?? null;
  }

  private async clearPendingEmergency(): Promise<void> {
    await setTyped("local", PENDING_EMERGENCY_KEY, null);
    await this.alarms.clear(EMERGENCY_END_ALARM);
  }

  private async getEmergencyUsage(now: number): Promise<EmergencyUsage> {
    const weekKey = localWeekKey(now);
    const usage = await getTyped<EmergencyUsage>("local", EMERGENCY_USAGE_KEY);
    if (usage?.weekKey === weekKey) {
      return {
        weekKey,
        sessionIds: Array.from(new Set(usage.sessionIds ?? [])),
        usedAt: usage.usedAt ?? []
      };
    }

    return {
      weekKey,
      sessionIds: [],
      usedAt: []
    };
  }

  private async getFinalizationJournal(): Promise<SessionFinalizationJournal | null> {
    return (await getTyped<SessionFinalizationJournal | null>("local", SESSION_FINALIZATION_JOURNAL_KEY)) ?? null;
  }

  private async getTempAllowMutationJournal(): Promise<TempAllowMutationJournal | null> {
    return (await getTyped<TempAllowMutationJournal | null>("local", TEMP_ALLOW_MUTATION_JOURNAL_KEY)) ?? null;
  }

  private async getLockSnapshot(): Promise<LockedSyncSnapshot | null> {
    return (await getTyped<LockedSyncSnapshot | null>("local", SESSION_LOCK_SNAPSHOT_KEY)) ?? null;
  }

  private async captureLockedSettings(sessionId: string): Promise<LockedSyncSnapshot> {
    const values = await chrome.storage.sync.get(SESSION_LOCKED_SYNC_KEYS);
    return {
      sessionId,
      values: Object.fromEntries(SESSION_LOCKED_SYNC_KEYS.map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(values, key) && values[key] !== undefined
          ? { exists: true, value: values[key] }
          : { exists: false }
      ]))
    };
  }

  private async ensureLockedSettings(session: Session): Promise<void> {
    let snapshot = await this.getLockSnapshot();
    if (snapshot?.sessionId !== session.id) {
      snapshot = await this.captureLockedSettings(session.id);
      await setTyped("local", SESSION_LOCK_SNAPSHOT_KEY, snapshot);
    }

    const current = await chrome.storage.sync.get(SESSION_LOCKED_SYNC_KEYS);
    for (const key of SESSION_LOCKED_SYNC_KEYS) {
      const expected = snapshot.values[key];
      const currentValue = current[key];
      if (!expected || storageValuesEqual(currentValue, expected.exists ? expected.value : undefined)) {
        continue;
      }
      await restoreSyncValueWithRetry(key, expected.exists ? expected.value : undefined);
    }
  }

  private async logSession(session: Session): Promise<void> {
    const sessionLog = (await getTyped("local", STORAGE_KEYS.local.sessionLog)) ?? [];
    const existingIndex = sessionLog.findIndex((entry) => entry.id === session.id);
    if (existingIndex < 0) {
      await setTyped(
        "local",
        STORAGE_KEYS.local.sessionLog,
        [...sessionLog, session].slice(-MAX_SESSION_LOG_ENTRIES)
      );
      return;
    }

    const existing = sessionLog[existingIndex];
    if (existing.status === "completed" || (session.status !== "completed" && existing.status !== "active")) {
      return;
    }

    const nextLog = [...sessionLog];
    nextLog[existingIndex] = session;
    await setTyped("local", STORAGE_KEYS.local.sessionLog, nextLog.slice(-MAX_SESSION_LOG_ENTRIES));
  }
}

export function nextSnoozeDelay(currentDelayMin: number): number {
  return Math.min(30, Math.max(15, currentDelayMin) * 2);
}

export function isRunning(session: Session | null | undefined, now = Date.now()): session is Session {
  return Boolean(session && session.status === "active" && session.endsAt > now);
}

function intensityRank(intensity: Intensity): number {
  return { soft: 0, medium: 1, hard: 2 }[intensity];
}

async function restoreSyncValue(key: string, value: unknown): Promise<void> {
  if (value === undefined) {
    await chrome.storage.sync.remove(key);
    return;
  }

  await chrome.storage.sync.set({ [key]: value });
}

async function restoreSyncValueWithRetry(key: string, value: unknown, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await restoreSyncValue(key, value);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function createAlarmWithRetry(
  alarms: AlarmClient,
  name: string,
  info: chrome.alarms.AlarmCreateInfo,
  attempts = 3
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await alarms.create(name, info);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function applyTempAllowRulesWithRetry(
  client: DynamicRuleClient,
  rules: chrome.declarativeNetRequest.Rule[],
  attempts = 3
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await applyTempAllowRules(client, rules);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function storageValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createSessionId(now: number): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `session-${now}-${random}`;
}

function tempAllowAlarmName(domain: string): string {
  return `${TEMP_ALLOW_ALARM_PREFIX}${domain}`;
}

async function addFocusMinutesOnce(session: Session, finalizedAt: number): Promise<void> {
  const ledgerValue = await getTyped<SessionStatsLedger>("local", SESSION_STATS_LEDGER_KEY);
  const ledger: SessionStatsLedger = ledgerValue ?? { credits: {} };
  const previousCredit = ledger.credits[session.id];
  const creditedEnd = session.status === "completed"
    ? session.endsAt
    : Math.min(finalizedAt, session.endsAt);
  const desiredByDate = splitFocusMinutesByLocalDate(session.startedAt, creditedEnd);
  const desiredMinutes = Object.values(desiredByDate).reduce((sum, minutes) => sum + minutes, 0);
  const previousByDate = previousCredit?.byDate
    ?? (previousCredit ? { [previousCredit.date]: previousCredit.focusMinutes } : {});
  const affectedDates = Array.from(new Set([...Object.keys(previousByDate), ...Object.keys(desiredByDate)]));
  const deltas = Object.fromEntries(affectedDates.map((date) => [
    date,
    (desiredByDate[date] ?? 0) - (previousByDate[date] ?? 0)
  ]));
  if (Object.values(deltas).every((delta) => delta === 0) && previousCredit) {
    return;
  }

  const keys = affectedDates.map((date) => STORAGE_KEYS.local.dailyStats(date));
  const snapshot = await chrome.storage.local.get(keys);
  const updates: Record<string, unknown> = {};
  for (const date of affectedDates) {
    const key = STORAGE_KEYS.local.dailyStats(date);
    const existingStats = snapshot[key] as DailyStats | undefined;
    updates[key] = {
      date,
      focusMinutes: Math.max(0, (existingStats?.focusMinutes ?? 0) + (deltas[date] ?? 0)),
      blockedAttempts: existingStats?.blockedAttempts ?? 0,
      overrides: existingStats?.overrides ?? 0,
      domainVisits: existingStats?.domainVisits ?? {}
    } satisfies DailyStats;
  }
  const firstDate = Object.keys(desiredByDate)[0] ?? localDateKey(session.startedAt);
  const nextLedger: SessionStatsLedger = {
    credits: Object.fromEntries(Object.entries({
      ...ledger.credits,
      [session.id]: { date: firstDate, focusMinutes: desiredMinutes, byDate: desiredByDate }
    }).slice(-MAX_SESSION_LOG_ENTRIES))
  };
  updates[SESSION_STATS_LEDGER_KEY] = nextLedger;
  await chrome.storage.local.set(updates);
  await pruneDailyStats(finalizedAt);
}

export function splitFocusMinutesByLocalDate(startedAt: number, endedAt: number): Record<string, number> {
  const totalMinutes = Math.max(0, Math.round((endedAt - startedAt) / 60_000));
  if (totalMinutes === 0 || endedAt <= startedAt) {
    return {};
  }

  const segments: Array<{ date: string; rawMinutes: number; minutes: number }> = [];
  let cursor = startedAt;
  while (cursor < endedAt) {
    const nextMidnight = new Date(cursor);
    nextMidnight.setHours(24, 0, 0, 0);
    const segmentEnd = Math.min(endedAt, nextMidnight.getTime());
    const rawMinutes = (segmentEnd - cursor) / 60_000;
    segments.push({ date: localDateKey(cursor), rawMinutes, minutes: Math.floor(rawMinutes) });
    cursor = segmentEnd;
  }

  let remainder = totalMinutes - segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const byFraction = [...segments].sort((left, right) => (
    (right.rawMinutes - right.minutes) - (left.rawMinutes - left.minutes)
  ));
  for (let index = 0; remainder > 0 && byFraction.length > 0; index += 1) {
    byFraction[index % byFraction.length].minutes += 1;
    remainder -= 1;
  }

  return Object.fromEntries(segments.filter((segment) => segment.minutes > 0).map((segment) => [segment.date, segment.minutes]));
}

async function pruneDailyStats(now: number): Promise<void> {
  const cutoff = localDateKey(now - DAILY_STATS_RETENTION_DAYS * 24 * 60 * 60_000);
  const snapshot = await chrome.storage.local.get(null);
  const staleKeys = Object.keys(snapshot).filter((key) => (
    key.startsWith("dailyStats:") && key.slice("dailyStats:".length) < cutoff
  ));
  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }
}

function localDateKey(now: number): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localWeekKey(now: number): string {
  const date = new Date(now);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diffToMonday);
  return localDateKey(date.getTime());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
