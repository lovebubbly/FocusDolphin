import { STORAGE_KEYS, getTyped, setTyped } from "../shared/storage";
import type { EndSessionReason } from "../shared/messaging";
import type { DailyStats, Intensity, Session, SiteList } from "../shared/types";
import {
  type DynamicRuleClient,
  applySessionRules,
  applyTempAllowRules,
  compileRules,
  compileTempAllowRules,
  normalizeDomain
} from "./rules";

export const SESSION_END_ALARM = "focuswhale:session-end";
export const EMERGENCY_END_ALARM = "focuswhale:emergency-end";
export const TEMP_ALLOW_ALARM_PREFIX = "focuswhale:temp-allow:";

const PENDING_EMERGENCY_KEY = "pendingEmergency";
const EMERGENCY_DELAY_MINUTES = 5;

type ActiveStatus = Session["status"];
type PendingEmergency = { sessionId: string; dueAt: number };

export interface AlarmClient {
  create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void>;
  clear(name: string): Promise<boolean>;
}

export interface EventPublisher {
  publishSessionCompleted(session: Session): Promise<void>;
}

export class ChromeAlarmClient implements AlarmClient {
  async create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void> {
    chrome.alarms.create(name, info);
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

export interface StartSessionInput {
  listId: string;
  intensity: Intensity;
  durationMinutes: number;
  source?: "manual" | "schedule";
}

export class SessionManager {
  constructor(
    private readonly dnrClient: DynamicRuleClient,
    private readonly alarms: AlarmClient = new ChromeAlarmClient(),
    private readonly publisher: EventPublisher = new RuntimeEventPublisher()
  ) {}

  async getActiveSession(): Promise<Session | null> {
    return (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  }

  async startSession(input: StartSessionInput, now = Date.now()): Promise<Session> {
    const siteList = await this.requireSiteList(input.listId);
    const activeSession = await this.getActiveSession();
    const requestedEndsAt = now + Math.max(1, input.durationMinutes) * 60_000;

    if (isRunning(activeSession, now)) {
      if (intensityRank(input.intensity) < intensityRank(activeSession.intensity)) {
        throw new Error("Running sessions can only keep or raise intensity.");
      }

      const raisedSession: Session = {
        ...activeSession,
        listId: input.listId,
        intensity: input.intensity,
        endsAt: Math.max(activeSession.endsAt, requestedEndsAt)
      };

      await this.persistAndApplySession(raisedSession, siteList, now);
      return raisedSession;
    }

    const session: Session = {
      id: createSessionId(now),
      source: input.source ?? "manual",
      listId: input.listId,
      intensity: input.intensity,
      startedAt: now,
      endsAt: requestedEndsAt,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };

    await this.persistAndApplySession(session, siteList, now);
    return session;
  }

  async endSession(reason: EndSessionReason, now = Date.now()): Promise<Session | null> {
    if (reason === "emergency") {
      return this.requestEmergencyEnd(now);
    }

    return this.finalizeActiveSession(reason === "completed" ? "completed" : "aborted", now);
  }

  async completeDueSession(now = Date.now()): Promise<Session | null> {
    const activeSession = await this.getActiveSession();
    if (activeSession?.status === "active" && activeSession.endsAt <= now) {
      return this.finalizeActiveSession("completed", now);
    }

    return null;
  }

  async completeEmergencyIfDue(now = Date.now()): Promise<Session | null> {
    const pending = await this.getPendingEmergency();
    if (!pending || pending.dueAt > now) {
      return null;
    }

    return this.finalizeActiveSession("aborted", now);
  }

  async registerSnooze(now = Date.now()): Promise<number> {
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

  async addTempAllow(domain: string, minutes: number, now = Date.now()): Promise<void> {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      throw new Error("A valid domain is required for temporary allow.");
    }

    const until = now + Math.max(1, minutes) * 60_000;
    const tempAllows = ((await getTyped("local", STORAGE_KEYS.local.tempAllows)) ?? [])
      .filter((entry) => normalizeDomain(entry.domain) !== normalizedDomain && entry.until > now);

    tempAllows.push({ domain: normalizedDomain, until });
    await setTyped("local", STORAGE_KEYS.local.tempAllows, tempAllows);
    await this.syncTempAllowRules(now);
    await this.alarms.create(tempAllowAlarmName(normalizedDomain), { when: until });
    await incrementDailyStats(now, { overrides: 1 });
  }

  async syncTempAllowRules(now = Date.now()): Promise<void> {
    const activeTempAllows = ((await getTyped("local", STORAGE_KEYS.local.tempAllows)) ?? [])
      .map((entry) => ({ domain: normalizeDomain(entry.domain), until: entry.until }))
      .filter((entry) => entry.domain && entry.until > now);

    await setTyped("local", STORAGE_KEYS.local.tempAllows, activeTempAllows);
    await applyTempAllowRules(this.dnrClient, compileTempAllowRules(activeTempAllows, now));

    await Promise.all(
      activeTempAllows.map((entry) => this.alarms.create(tempAllowAlarmName(entry.domain), { when: entry.until }))
    );
  }

  async reconcile(now = Date.now()): Promise<void> {
    await this.syncTempAllowRules(now);

    const pendingEmergency = await this.getPendingEmergency();
    const activeSession = await this.getActiveSession();

    if (activeSession?.status === "active" && activeSession.endsAt <= now) {
      if (!(await this.hasLoggedSession(activeSession.id))) {
        await this.logSession({ ...activeSession, status: "interrupted" });
      }

      await this.clearActiveState();
      return;
    }

    if (isRunning(activeSession, now)) {
      const siteList = await this.requireSiteList(activeSession.listId);
      await this.persistAndApplySession(activeSession, siteList, now);

      if (pendingEmergency?.sessionId === activeSession.id) {
        if (pendingEmergency.dueAt <= now) {
          await this.finalizeActiveSession("aborted", now);
        } else {
          await this.alarms.create(EMERGENCY_END_ALARM, { when: pendingEmergency.dueAt });
        }
      }
      return;
    }

    await this.clearSessionRules();
  }

  async finalizeScheduleSession(now = Date.now()): Promise<Session | null> {
    const activeSession = await this.getActiveSession();
    if (activeSession?.source !== "schedule") {
      return null;
    }

    return this.finalizeActiveSession("completed", now);
  }

  async rejectLockedSettingChanges(
    changes: Record<string, chrome.storage.StorageChange>,
    revertingKeys: Set<string>
  ): Promise<void> {
    const activeSession = await this.getActiveSession();
    if (!isRunning(activeSession) || activeSession.intensity !== "hard") {
      return;
    }

    for (const key of [STORAGE_KEYS.sync.siteLists, STORAGE_KEYS.sync.schedules]) {
      const change = changes[key];
      if (!change || revertingKeys.has(key)) {
        revertingKeys.delete(key);
        continue;
      }

      revertingKeys.add(key);
      if (change.oldValue === undefined) {
        await chrome.storage.sync.remove(key);
      } else {
        await chrome.storage.sync.set({ [key]: change.oldValue });
      }
    }
  }

  private async requestEmergencyEnd(now: number): Promise<Session | null> {
    const activeSession = await this.getActiveSession();
    if (!isRunning(activeSession, now) || activeSession.intensity !== "hard") {
      return activeSession;
    }

    const dueAt = now + EMERGENCY_DELAY_MINUTES * 60_000;
    await setTyped("local", PENDING_EMERGENCY_KEY, { sessionId: activeSession.id, dueAt });
    await this.alarms.create(EMERGENCY_END_ALARM, { when: dueAt });
    return activeSession;
  }

  private async persistAndApplySession(session: Session, siteList: SiteList, now: number): Promise<void> {
    await setTyped("local", STORAGE_KEYS.local.activeSession, session);
    await applySessionRules(this.dnrClient, compileRules(siteList, session.intensity));
    await this.syncTempAllowRules(now);
    await this.alarms.create(SESSION_END_ALARM, { when: session.endsAt });
  }

  private async finalizeActiveSession(status: ActiveStatus, now: number): Promise<Session | null> {
    const activeSession = await this.getActiveSession();
    if (!activeSession) {
      await this.clearActiveState();
      return null;
    }

    const finalizedSession: Session = { ...activeSession, status };
    await this.logSession(finalizedSession);
    await addFocusMinutes(activeSession, now);
    await this.clearActiveState();
    await this.publisher.publishSessionCompleted(finalizedSession);
    return finalizedSession;
  }

  private async clearActiveState(): Promise<void> {
    await setTyped("local", STORAGE_KEYS.local.activeSession, null);
    await setTyped("local", PENDING_EMERGENCY_KEY, null);
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
    await Promise.all(tempAllows.map((entry) => this.alarms.clear(tempAllowAlarmName(normalizeDomain(entry.domain)))));
    await setTyped("local", STORAGE_KEYS.local.tempAllows, []);
    await applyTempAllowRules(this.dnrClient, []);
  }

  private async requireSiteList(listId: string): Promise<SiteList> {
    const siteLists = (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [];
    const siteList = siteLists.find((candidate) => candidate.id === listId);
    if (!siteList) {
      throw new Error(`Site list not found: ${listId}`);
    }

    return siteList;
  }

  private async getPendingEmergency(): Promise<PendingEmergency | null> {
    return (await getTyped<PendingEmergency | null>("local", PENDING_EMERGENCY_KEY)) ?? null;
  }

  private async hasLoggedSession(sessionId: string): Promise<boolean> {
    const sessionLog = (await getTyped("local", STORAGE_KEYS.local.sessionLog)) ?? [];
    return sessionLog.some((session) => session.id === sessionId && session.status !== "active");
  }

  private async logSession(session: Session): Promise<void> {
    const sessionLog = (await getTyped("local", STORAGE_KEYS.local.sessionLog)) ?? [];
    if (sessionLog.some((entry) => entry.id === session.id && entry.status !== "active")) {
      return;
    }

    await setTyped("local", STORAGE_KEYS.local.sessionLog, [...sessionLog, session]);
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

function createSessionId(now: number): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `session-${now}-${random}`;
}

function tempAllowAlarmName(domain: string): string {
  return `${TEMP_ALLOW_ALARM_PREFIX}${domain}`;
}

async function addFocusMinutes(session: Session, now: number): Promise<void> {
  const focusMinutes = Math.max(0, Math.round((Math.min(now, session.endsAt) - session.startedAt) / 60_000));
  await incrementDailyStats(session.startedAt, { focusMinutes });
}

async function incrementDailyStats(
  now: number,
  patch: Partial<Pick<DailyStats, "blockedAttempts" | "focusMinutes" | "overrides">>
): Promise<void> {
  const date = localDateKey(now);
  const key = STORAGE_KEYS.local.dailyStats(date);
  const existing = await getTyped("local", key);
  const nextStats: DailyStats = {
    date,
    focusMinutes: (existing?.focusMinutes ?? 0) + (patch.focusMinutes ?? 0),
    blockedAttempts: (existing?.blockedAttempts ?? 0) + (patch.blockedAttempts ?? 0),
    overrides: (existing?.overrides ?? 0) + (patch.overrides ?? 0),
    domainVisits: existing?.domainVisits ?? {}
  };

  await setTyped("local", key, nextStats);
}

function localDateKey(now: number): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
