import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../shared/storage";
import type { Session, SiteList, TempAllow } from "../shared/types";
import { reconcilePetGamification } from "../pet/reconcile";
import {
  type AlarmClient,
  type EventPublisher,
  SESSION_FINALIZATION_JOURNAL_KEY,
  SESSION_LOCK_SNAPSHOT_KEY,
  SESSION_STATS_LEDGER_KEY,
  SCHEDULE_SUPPRESSION_KEY,
  TEMP_ALLOW_ALARM_PREFIX,
  TEMP_ALLOW_MUTATION_JOURNAL_KEY,
  type ScheduleSuppression,
  type SessionRewards,
  SessionManager,
  nextSnoozeDelay,
  splitFocusMinutesByLocalDate
} from "./session";
import { TEMP_ALLOW_RULE_IDS, type DynamicRuleClient } from "./rules";

type Store = Record<string, unknown>;
const EMERGENCY_USAGE_KEY = "emergencyUsage";

function makeArea(store: Store) {
  return {
    get: vi.fn(async (key: string | string[] | null) => {
      if (key === null) {
        return { ...store };
      }
      if (Array.isArray(key)) {
        return Object.fromEntries(key.map((entry) => [entry, store[entry]]));
      }
      return { [key]: store[key] };
    }),
    set: vi.fn(async (items: Store) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (key: string | string[]) => {
      for (const entry of Array.isArray(key) ? key : [key]) {
        delete store[entry];
      }
    }),
    clear: vi.fn(async () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    })
  };
}

describe("snooze delay", () => {
  let localStore: Store;
  let syncStore: Store;
  let manager: SessionManager;
  let alarms: AlarmClient;
  let dnrClient: DynamicRuleClient;
  let publisher: EventPublisher;
  let rewards: SessionRewards;
  let localArea: ReturnType<typeof makeArea>;
  let syncArea: ReturnType<typeof makeArea>;

  beforeEach(() => {
    localStore = {};
    syncStore = {};

    localArea = makeArea(localStore);
    syncArea = makeArea(syncStore);
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://focuswhale${path}`)
      },
      storage: {
        sync: syncArea,
        local: localArea
      }
    });

    dnrClient = { updateDynamicRules: vi.fn(async () => undefined) };
    alarms = {
      create: vi.fn(async () => undefined),
      clear: vi.fn(async () => true)
    };
    publisher = { publishSessionCompleted: vi.fn(async () => undefined) };
    rewards = { settleCompleted: vi.fn(async () => undefined) };
    manager = new SessionManager(dnrClient, alarms, publisher, rewards);
  });

  it("increases 15 minute snooze delay to the 30 minute cap", () => {
    expect(nextSnoozeDelay(15)).toBe(30);
    expect(nextSnoozeDelay(30)).toBe(30);
    expect(nextSnoozeDelay(1)).toBe(30);
  });

  it("persists snooze count and next delay on the active session", async () => {
    const session: Session = {
      id: "session-1",
      source: "manual",
      listId: "list-1",
      intensity: "medium",
      startedAt: 1_000,
      endsAt: 100_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };
    localStore[STORAGE_KEYS.local.activeSession] = session;

    await expect(manager.registerSnooze(2_000)).resolves.toBe(30);

    expect(localStore[STORAGE_KEYS.local.activeSession]).toMatchObject({
      snoozeCount: 1,
      nextSnoozeDelayMin: 30
    });
  });

  it("grants a request-style temporary allow from the matching active medium session", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("medium-request", now);
    const until = now + 5 * 60_000;
    localStore[STORAGE_KEYS.local.activeSession] = session;
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await expect(manager.requestTempAllow({
      domain: "HTTPS://X.COM/home",
      intent: "  release 확인  ",
      sessionId: session.id
    }, now)).resolves.toEqual({ nextSnoozeDelayMin: 30, until });

    expect(localStore[STORAGE_KEYS.local.activeSession]).toMatchObject({
      id: session.id,
      snoozeCount: 1,
      nextSnoozeDelayMin: 30
    });
    expect(localStore[STORAGE_KEYS.local.tempAllows]).toEqual([
      { domain: "x.com", until, sessionId: session.id }
    ]);
    expect(localStore[STORAGE_KEYS.local.intentLog]).toEqual([
      { at: now, domain: "x.com", intent: "release 확인", sessionId: session.id }
    ]);
    expect(localStore[STORAGE_KEYS.local.dailyStats("2026-07-06")]).toMatchObject({ overrides: 1 });
    expect(alarms.create).toHaveBeenCalledWith(`${TEMP_ALLOW_ALARM_PREFIX}x.com`, { when: until });
    expect(dnrClient.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: TEMP_ALLOW_RULE_IDS,
      addRules: expect.arrayContaining([
        expect.objectContaining({ id: 1000, priority: 200 }),
        expect.objectContaining({ id: 1001, priority: 200 })
      ])
    });
    expect(localStore[TEMP_ALLOW_MUTATION_JOURNAL_KEY]).toBeUndefined();
  });

  it("rolls back the allow rule and alarm when the temp-allow storage commit fails", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("medium-storage-failure", now);
    localStore[STORAGE_KEYS.local.activeSession] = session;
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    let rejectedCommit = false;
    localArea.set.mockImplementation(async (items: Store) => {
      const nextSession = items[STORAGE_KEYS.local.activeSession] as Session | undefined;
      if (!rejectedCommit && nextSession?.snoozeCount === 1 && STORAGE_KEYS.local.tempAllows in items) {
        rejectedCommit = true;
        throw new Error("temp allow commit failed");
      }
      Object.assign(localStore, items);
    });

    await expect(manager.requestTempAllow({
      domain: "x.com",
      intent: "업무 확인",
      sessionId: session.id
    }, now)).rejects.toThrow("temp allow commit failed");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toEqual(session);
    expect(localStore[STORAGE_KEYS.local.tempAllows]).toBeUndefined();
    expect(localStore[STORAGE_KEYS.local.intentLog]).toBeUndefined();
    expect(localStore[TEMP_ALLOW_MUTATION_JOURNAL_KEY]).toBeUndefined();
    expect(dnrClient.updateDynamicRules).toHaveBeenLastCalledWith({
      removeRuleIds: TEMP_ALLOW_RULE_IDS,
      addRules: []
    });
    expect(alarms.clear).toHaveBeenCalledWith(`${TEMP_ALLOW_ALARM_PREFIX}x.com`);
  });

  it("cancels an interrupted temp-allow journal instead of granting it on recovery", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("medium-interrupted", now);
    const until = now + 5 * 60_000;
    localStore[STORAGE_KEYS.local.activeSession] = session;
    localStore[TEMP_ALLOW_MUTATION_JOURNAL_KEY] = {
      sessionId: session.id,
      domain: "x.com",
      until,
      nextSession: { ...session, snoozeCount: 1, nextSnoozeDelayMin: 30 },
      nextTempAllows: [{ domain: "x.com", until, sessionId: session.id }],
      nextIntentLog: [{ at: now, domain: "x.com", intent: "업무 확인", sessionId: session.id }],
      statsKey: STORAGE_KEYS.local.dailyStats("2026-07-06"),
      nextStats: {
        date: "2026-07-06",
        focusMinutes: 0,
        blockedAttempts: 0,
        overrides: 1,
        domainVisits: {}
      }
    };

    await manager.getState(now);

    expect(localStore[STORAGE_KEYS.local.activeSession]).toEqual(session);
    expect(localStore[STORAGE_KEYS.local.tempAllows]).toBeUndefined();
    expect(localStore[TEMP_ALLOW_MUTATION_JOURNAL_KEY]).toBeUndefined();
    expect(dnrClient.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: TEMP_ALLOW_RULE_IDS,
      addRules: []
    });
    expect(alarms.clear).toHaveBeenCalledWith(`${TEMP_ALLOW_ALARM_PREFIX}x.com`);
  });

  it("rejects a temporary allow request carrying a stale session ID", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("current-session", now);
    localStore[STORAGE_KEYS.local.activeSession] = session;
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await expect(manager.requestTempAllow({
      domain: "x.com",
      intent: "release 확인",
      sessionId: "stale-session"
    }, now)).rejects.toThrow("matching active medium session");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toEqual(session);
    expect(localStore[STORAGE_KEYS.local.tempAllows]).toBeUndefined();
    expect(dnrClient.updateDynamicRules).not.toHaveBeenCalled();
  });

  it.each(["soft", "hard"] as const)(
    "rejects temporary allows during an active %s session",
    async (intensity) => {
      const now = Date.parse("2026-07-06T10:00:00+09:00");
      const session = { ...mediumSession(`${intensity}-session`, now), intensity } satisfies Session;
      localStore[STORAGE_KEYS.local.activeSession] = session;
      syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

      await expect(manager.requestTempAllow({
        domain: "x.com",
        intent: "release 확인",
        sessionId: session.id
      }, now)).rejects.toThrow("matching active medium session");

      expect(localStore[STORAGE_KEYS.local.tempAllows]).toBeUndefined();
      expect(dnrClient.updateDynamicRules).not.toHaveBeenCalled();
    }
  );

  it("rejects a temporary allow for a domain outside the active block rule", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("medium-unblocked", now);
    localStore[STORAGE_KEYS.local.activeSession] = session;
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await expect(manager.requestTempAllow({
      domain: "example.com",
      intent: "release 확인",
      sessionId: session.id
    }, now)).rejects.toThrow("not blocked");

    expect(localStore[STORAGE_KEYS.local.tempAllows]).toBeUndefined();
    expect(dnrClient.updateDynamicRules).not.toHaveBeenCalled();
  });

  it("serializes blocked attempts without overwriting session statistics", async () => {
    localStore["dailyStats:2026-07-06"] = {
      date: "2026-07-06",
      focusMinutes: 25,
      blockedAttempts: 1,
      overrides: 2,
      domainVisits: { "youtube.com": 1 }
    };
    const now = new Date("2026-07-06T12:00:00+09:00").getTime();
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("blocked-session", now);
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await Promise.all([
      manager.recordBlockedAttempt("X.com", now, "tab:1"),
      manager.recordBlockedAttempt("x.com", now, "tab:2")
    ]);

    expect(localStore["dailyStats:2026-07-06"]).toEqual({
      date: "2026-07-06",
      focusMinutes: 25,
      blockedAttempts: 3,
      overrides: 2,
      domainVisits: { "youtube.com": 1, "x.com": 2 }
    });
  });

  it("rejects blocked-attempt analytics without a matching active rule", async () => {
    const now = new Date("2026-07-06T12:00:00+09:00").getTime();
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await expect(manager.recordBlockedAttempt("x.com", now, "tab:1")).rejects.toThrow(
      "active blocking session"
    );

    localStore[STORAGE_KEYS.local.activeSession] = hardSession("blocked-session", now);
    await expect(manager.recordBlockedAttempt("example.com", now, "tab:1")).rejects.toThrow(
      "not blocked"
    );
    expect(localStore["dailyStats:2026-07-06"]).toBeUndefined();
  });

  it("deduplicates rapid blocked-page reloads from the same tab", async () => {
    const now = new Date("2026-07-06T12:00:00+09:00").getTime();
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("blocked-session", now);
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await manager.recordBlockedAttempt("x.com", now, "tab:1");
    await manager.recordBlockedAttempt("x.com", now + 500, "tab:1");
    await manager.recordBlockedAttempt("x.com", now + 2_001, "tab:1");

    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({
      blockedAttempts: 2,
      domainVisits: { "x.com": 2 }
    });
  });

  it("clears local activity only when no session is active", async () => {
    const now = new Date("2026-07-06T12:00:00+09:00").getTime();
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("active", now);
    localStore[STORAGE_KEYS.local.intentLog] = [{ at: now, domain: "x.com", intent: "work" }];

    await expect(manager.clearLocalData(now)).rejects.toThrow("활성 세션이 끝난 뒤");
    expect(localStore[STORAGE_KEYS.local.intentLog]).toHaveLength(1);

    localStore[STORAGE_KEYS.local.activeSession] = null;
    await manager.clearLocalData(now);

    expect(localStore).toEqual({});
    expect(dnrClient.updateDynamicRules).toHaveBeenCalled();
  });

  it("preserves current-week emergency usage and active schedule suppression while clearing activity", async () => {
    const now = Date.parse("2026-07-08T12:00:00+09:00");
    const emergencyUsage = {
      weekKey: "2026-07-06",
      sessionIds: ["hard-session"],
      usedAt: [now - 60_000]
    };
    const scheduleSuppression = {
      scheduleId: "weekday-focus",
      listId: "list-1",
      windowEnd: now + 30 * 60_000,
      sessionId: "scheduled-session"
    } satisfies ScheduleSuppression;
    const tempAllow = {
      domain: "x.com",
      until: now + 5 * 60_000,
      sessionId: "old-medium"
    } satisfies TempAllow;

    Object.assign(localStore, {
      [STORAGE_KEYS.local.activeSession]: null,
      [STORAGE_KEYS.local.tempAllows]: [tempAllow],
      [STORAGE_KEYS.local.sessionLog]: [completedCandidate("completed", now - 1)],
      [STORAGE_KEYS.local.intentLog]: [{ at: now - 10_000, domain: "x.com", intent: "work" }],
      [STORAGE_KEYS.local.dailyStats("2026-07-08")]: {
        date: "2026-07-08",
        focusMinutes: 25,
        blockedAttempts: 2,
        overrides: 1,
        domainVisits: { "x.com": 2 }
      },
      recommendations: [{ domain: "x.com", visits: 10 }],
      "growthEvent:completed": { id: "completed" },
      [SESSION_STATS_LEDGER_KEY]: { credits: { completed: { date: "2026-07-08", focusMinutes: 25 } } },
      [TEMP_ALLOW_MUTATION_JOURNAL_KEY]: { sessionId: "old-medium" },
      [EMERGENCY_USAGE_KEY]: emergencyUsage,
      [SCHEDULE_SUPPRESSION_KEY]: scheduleSuppression
    });

    await manager.clearLocalData(now);

    const removedKeys = localArea.remove.mock.calls.at(-1)?.[0];
    expect(removedKeys).toEqual(expect.arrayContaining([
      STORAGE_KEYS.local.activeSession,
      STORAGE_KEYS.local.tempAllows,
      STORAGE_KEYS.local.sessionLog,
      STORAGE_KEYS.local.intentLog,
      STORAGE_KEYS.local.dailyStats("2026-07-08"),
      "recommendations",
      "growthEvent:completed",
      SESSION_STATS_LEDGER_KEY
    ]));
    expect(localArea.remove).toHaveBeenCalledWith(TEMP_ALLOW_MUTATION_JOURNAL_KEY);
    expect(removedKeys).not.toContain(EMERGENCY_USAGE_KEY);
    expect(removedKeys).not.toContain(SCHEDULE_SUPPRESSION_KEY);
    expect(localStore).toEqual({
      [EMERGENCY_USAGE_KEY]: emergencyUsage,
      [SCHEDULE_SUPPRESSION_KEY]: scheduleSuppression
    });
    expect(alarms.clear).toHaveBeenCalledWith(`${TEMP_ALLOW_ALARM_PREFIX}x.com`);
  });

  it("drops an expired schedule suppression during local activity clearing", async () => {
    const now = Date.parse("2026-07-08T12:00:00+09:00");
    const emergencyUsage = {
      weekKey: "2026-07-06",
      sessionIds: ["hard-session"],
      usedAt: [now - 60_000]
    };
    localStore[STORAGE_KEYS.local.intentLog] = [{ at: now - 10_000, domain: "x.com", intent: "work" }];
    localStore[EMERGENCY_USAGE_KEY] = emergencyUsage;
    localStore[SCHEDULE_SUPPRESSION_KEY] = {
      scheduleId: "finished-window",
      listId: "list-1",
      windowEnd: now,
      sessionId: "scheduled-session"
    } satisfies ScheduleSuppression;

    await manager.clearLocalData(now);

    expect(localStore).toEqual({ [EMERGENCY_USAGE_KEY]: emergencyUsage });
    expect(localStore).not.toHaveProperty(SCHEDULE_SUPPRESSION_KEY);
  });

  it("drops emergency usage from a prior local week", async () => {
    const now = Date.parse("2026-07-13T12:00:00+09:00");
    localStore[STORAGE_KEYS.local.intentLog] = [{ at: now - 10_000, domain: "x.com", intent: "work" }];
    localStore[EMERGENCY_USAGE_KEY] = {
      weekKey: "2026-07-06",
      sessionIds: ["last-week-session"],
      usedAt: [now - 24 * 60 * 60_000]
    };

    await manager.clearLocalData(now);

    expect(localStore).toEqual({});
    const removedKeys = localArea.remove.mock.calls.at(-1)?.[0];
    expect(removedKeys).toContain(EMERGENCY_USAGE_KEY);
  });

  it("never includes commitment keys when local activity removal fails", async () => {
    const now = Date.parse("2026-07-08T12:00:00+09:00");
    const emergencyUsage = {
      weekKey: "2026-07-06",
      sessionIds: ["hard-session"],
      usedAt: [now - 60_000]
    };
    const scheduleSuppression = {
      scheduleId: "weekday-focus",
      listId: "list-1",
      windowEnd: now + 30 * 60_000,
      sessionId: "scheduled-session"
    } satisfies ScheduleSuppression;
    localStore[STORAGE_KEYS.local.intentLog] = [{ at: now - 10_000, domain: "x.com", intent: "work" }];
    localStore[EMERGENCY_USAGE_KEY] = emergencyUsage;
    localStore[SCHEDULE_SUPPRESSION_KEY] = scheduleSuppression;
    localArea.remove.mockRejectedValueOnce(new Error("storage removal failed"));

    await expect(manager.clearLocalData(now)).rejects.toThrow("storage removal failed");

    const attemptedKeys = localArea.remove.mock.calls.at(-1)?.[0];
    expect(attemptedKeys).toEqual(expect.arrayContaining([STORAGE_KEYS.local.intentLog, STORAGE_KEYS.local.tempAllows]));
    expect(attemptedKeys).not.toContain(EMERGENCY_USAGE_KEY);
    expect(attemptedKeys).not.toContain(SCHEDULE_SUPPRESSION_KEY);
    expect(localStore[EMERGENCY_USAGE_KEY]).toEqual(emergencyUsage);
    expect(localStore[SCHEDULE_SUPPRESSION_KEY]).toEqual(scheduleSuppression);
  });

  it("finalizes an expired active session before clearing local activity", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = completedCandidate("expired-clear", now - 1);
    localStore[STORAGE_KEYS.local.intentLog] = [{ at: now - 10_000, domain: "x.com", intent: "work" }];

    await manager.clearLocalData(now);

    expect(rewards.settleCompleted).toHaveBeenCalledTimes(1);
    expect(publisher.publishSessionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "expired-clear", status: "completed" })
    );
    expect(vi.mocked(publisher.publishSessionCompleted).mock.invocationCallOrder[0])
      .toBeLessThan(localArea.remove.mock.invocationCallOrder.at(-1) ?? 0);
    expect(localStore).toEqual({});
  });

  it("reverts sync option changes while any session is active", async () => {
    localStore[STORAGE_KEYS.local.activeSession] = {
      id: "session-1",
      source: "manual",
      listId: "list-1",
      intensity: "medium",
      startedAt: Date.now() - 1_000,
      endsAt: Date.now() + 60_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    } satisfies Session;

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.settings]: {
        oldValue: { softOverlaySeconds: 10 },
        newValue: { softOverlaySeconds: 3 }
      },
      [STORAGE_KEYS.sync.siteLists]: {
        oldValue: [{ id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] }],
        newValue: []
      },
      [STORAGE_KEYS.sync.schedules]: {
        oldValue: [{ id: "schedule-1", enabled: true }],
        newValue: []
      }
    }, new Map());

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.sync.settings]: { softOverlaySeconds: 10 }
    });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.sync.siteLists]: [{ id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] }]
    });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.sync.schedules]: [{ id: "schedule-1", enabled: true }]
    });
  });

  it("keeps rollback markers through unrelated sync events", async () => {
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-lock", Date.now());
    const revertingValues = new Map<string, unknown>();
    const original = [{ id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] }];

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.siteLists]: { oldValue: original, newValue: [] }
    }, revertingValues);
    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.petState]: { oldValue: { xp: 0 }, newValue: { xp: 10 } }
    }, revertingValues);

    expect(revertingValues.has(STORAGE_KEYS.sync.siteLists)).toBe(true);

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.siteLists]: { oldValue: [], newValue: original }
    }, revertingValues);

    expect(revertingValues.has(STORAGE_KEYS.sync.siteLists)).toBe(false);
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
  });

  it("keeps the canonical value across queued writes to the same locked key", async () => {
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-lock", Date.now());
    const revertingValues = new Map<string, unknown>();
    const canonical = [{ id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] }];
    const firstUnauthorized = [{ ...canonical[0], domains: [] }];
    const secondUnauthorized = [{ ...canonical[0], domains: ["example.com"] }];

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.siteLists]: { oldValue: canonical, newValue: firstUnauthorized }
    }, revertingValues);
    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.siteLists]: { oldValue: firstUnauthorized, newValue: secondUnauthorized }
    }, revertingValues);

    expect(revertingValues.get(STORAGE_KEYS.sync.siteLists)).toEqual(canonical);
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith({
      [STORAGE_KEYS.sync.siteLists]: canonical
    });

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.siteLists]: { oldValue: secondUnauthorized, newValue: canonical }
    }, revertingValues);
    expect(revertingValues.has(STORAGE_KEYS.sync.siteLists)).toBe(false);
  });

  it("allows sync option changes after the session ends", async () => {
    localStore[STORAGE_KEYS.local.activeSession] = {
      id: "session-1",
      source: "manual",
      listId: "list-1",
      intensity: "medium",
      startedAt: Date.now() - 120_000,
      endsAt: Date.now() - 60_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    } satisfies Session;

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.siteLists]: {
        oldValue: [{ id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] }],
        newValue: []
      }
    }, new Map());

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  });

  it("requires hard emergency ends to stay within one request per local week", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-1", now);

    await expect(manager.endSession("emergency", now)).resolves.toMatchObject({ id: "hard-1" });
    await expect(manager.endSession("emergency", now + 60_000)).resolves.toMatchObject({ id: "hard-1" });

    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-2", now + 24 * 60 * 60_000);

    await expect(manager.endSession("emergency", now + 24 * 60 * 60_000)).rejects.toThrow("이번 주 비상 종료 요청은 이미 사용했습니다.");
    expect(localStore.emergencyUsage).toMatchObject({
      weekKey: "2026-07-06",
      sessionIds: ["hard-1"]
    });
    expect(alarms.create).toHaveBeenCalledTimes(1);
  });

  it("resets hard emergency allowance on the next local week", async () => {
    const firstWeek = Date.parse("2026-07-12T10:00:00+09:00");
    const nextWeek = Date.parse("2026-07-13T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-1", firstWeek);

    await manager.endSession("emergency", firstWeek);
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-2", nextWeek);
    localStore.pendingEmergency = null;

    await expect(manager.endSession("emergency", nextWeek)).resolves.toMatchObject({ id: "hard-2" });
    expect(localStore.emergencyUsage).toMatchObject({
      weekKey: "2026-07-13",
      sessionIds: ["hard-2"]
    });
  });

  it("finalizes an overdue pending emergency instead of rearming it", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-due", now);
    await manager.endSession("emergency", now);

    await expect(manager.endSession("emergency", now + 5 * 60_000)).resolves.toMatchObject({
      id: "hard-due",
      status: "aborted"
    });
    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeNull();
    expect(alarms.create).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale emergency request abort a newer session", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("new-session", now);
    localStore.pendingEmergency = { sessionId: "old-session", dueAt: now };

    await expect(manager.completeEmergencyIfDue(now)).resolves.toBeNull();
    expect(localStore[STORAGE_KEYS.local.activeSession]).toMatchObject({ id: "new-session" });
    expect(localStore.pendingEmergency).toBeNull();
  });

  it("counts a naturally completed session even when the emergency deadline fires too", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = {
      ...hardSession("natural-wins", now),
      endsAt: now
    } satisfies Session;
    localStore[STORAGE_KEYS.local.sessionLog] = [];
    localStore.pendingEmergency = { sessionId: "natural-wins", dueAt: now };

    await expect(manager.completeEmergencyIfDue(now)).resolves.toMatchObject({
      id: "natural-wins",
      status: "completed"
    });
    expect(localStore[STORAGE_KEYS.local.sessionLog]).toEqual([
      expect.objectContaining({ id: "natural-wins", status: "completed" })
    ]);
  });

  it("finalizes a missed natural deadline once across concurrent recovery paths", async () => {
    const endsAt = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = {
      id: "natural-end",
      source: "manual",
      listId: "list-1",
      intensity: "medium",
      startedAt: endsAt - 25 * 60_000,
      endsAt,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    } satisfies Session;
    localStore[STORAGE_KEYS.local.sessionLog] = [];

    await Promise.all([
      manager.completeDueSession(endsAt + 1_000),
      manager.reconcile(endsAt + 1_000)
    ]);

    expect(localStore[STORAGE_KEYS.local.sessionLog]).toEqual([
      expect.objectContaining({ id: "natural-end", status: "completed" })
    ]);
    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeNull();
    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({ focusMinutes: 25 });
  });

  it("compiles a new session before touching DNR, alarms, or active storage", async () => {
    syncStore[STORAGE_KEYS.sync.siteLists] = [{
      ...focusList(),
      domains: Array.from({ length: 1_000 }, (_, index) => `site-${index}.example.com`)
    } satisfies SiteList];

    await expect(manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 25
    }, 10_000)).rejects.toThrow("Too many domains");

    expect(dnrClient.updateDynamicRules).not.toHaveBeenCalled();
    expect(alarms.create).not.toHaveBeenCalled();
    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeUndefined();
  });

  it("rolls back activation when applying DNR rules fails", async () => {
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    vi.mocked(dnrClient.updateDynamicRules).mockRejectedValueOnce(new Error("DNR unavailable"));

    await expect(manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 25
    }, 10_000)).rejects.toThrow("DNR unavailable");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeNull();
    expect(dnrClient.updateDynamicRules).toHaveBeenLastCalledWith(expect.objectContaining({ addRules: [] }));
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it("restores empty rules and clears the alarm when alarm creation fails", async () => {
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    vi.mocked(alarms.create).mockRejectedValueOnce(new Error("alarm unavailable"));

    await expect(manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 25
    }, 10_000)).rejects.toThrow("alarm unavailable");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeNull();
    expect(dnrClient.updateDynamicRules).toHaveBeenLastCalledWith(expect.objectContaining({ addRules: [] }));
    expect(alarms.clear).toHaveBeenCalledWith("focuswhale:session-end");
  });

  it("rolls back browser effects when active-session storage commit fails", async () => {
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    let rejectCommit = true;
    localArea.set.mockImplementation(async (items: Store) => {
      const active = items[STORAGE_KEYS.local.activeSession] as Session | null | undefined;
      if (rejectCommit && active?.status === "active") {
        rejectCommit = false;
        throw new Error("storage commit failed");
      }
      Object.assign(localStore, items);
    });

    await expect(manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 25
    }, 10_000)).rejects.toThrow("storage commit failed");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeNull();
    expect(localStore[SESSION_LOCK_SNAPSHOT_KEY]).toBeNull();
    expect(dnrClient.updateDynamicRules).toHaveBeenLastCalledWith(expect.objectContaining({ addRules: [] }));
    expect(alarms.clear).toHaveBeenCalledWith("focuswhale:session-end");
  });

  it("upgrades only intensity while preserving the exact session deadline", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    const started = await manager.startSession({
      listId: "list-1",
      intensity: "soft",
      durationMinutes: 25
    }, now);

    const upgraded = await manager.upgradeIntensity("hard", now + 61_234);

    expect(upgraded).toMatchObject({ intensity: "hard", endsAt: started.endsAt });
    expect(localStore[STORAGE_KEYS.local.activeSession]).toMatchObject({
      intensity: "hard",
      endsAt: started.endsAt
    });
  });

  it("preserves the exact schedule window end instead of rounded duration", async () => {
    const now = Date.parse("2026-07-06T09:00:00.123+09:00");
    const exactEnd = Date.parse("2026-07-06T10:30:00.000+09:00");
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    const started = await manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 90,
      source: "schedule",
      scheduleId: "weekday",
      scheduleWindowEnd: exactEnd
    }, now);

    expect(started).toMatchObject({
      scheduleId: "weekday",
      scheduleWindowEnd: exactEnd,
      endsAt: exactEnd
    });
  });

  it("clears medium temporary allows when intensity is upgraded to hard", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("medium-upgrade", now);
    const tempAllow = {
      domain: "x.com",
      until: now + 5 * 60_000,
      sessionId: session.id
    } satisfies TempAllow;
    localStore[STORAGE_KEYS.local.activeSession] = session;
    localStore[STORAGE_KEYS.local.tempAllows] = [tempAllow];
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];

    await expect(manager.upgradeIntensity("hard", now + 1_000)).resolves.toMatchObject({
      id: session.id,
      intensity: "hard",
      endsAt: session.endsAt
    });

    expect(localStore[STORAGE_KEYS.local.tempAllows]).toEqual([]);
    expect(dnrClient.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: TEMP_ALLOW_RULE_IDS,
      addRules: []
    });
    expect(alarms.clear).toHaveBeenCalledWith(`${TEMP_ALLOW_ALARM_PREFIX}x.com`);
  });

  it("preserves expired temporary allows when DNR cleanup fails so expiry can retry", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const session = mediumSession("medium-expiry", now);
    const expiredAllow = {
      domain: "x.com",
      until: now - 1,
      sessionId: session.id
    } satisfies TempAllow;
    localStore[STORAGE_KEYS.local.activeSession] = session;
    localStore[STORAGE_KEYS.local.tempAllows] = [expiredAllow];
    vi.mocked(dnrClient.updateDynamicRules).mockRejectedValueOnce(new Error("DNR expiry cleanup failed"));

    await expect(manager.syncTempAllowRules(now)).rejects.toThrow("DNR expiry cleanup failed");
    expect(localStore[STORAGE_KEYS.local.tempAllows]).toEqual([expiredAllow]);

    await expect(manager.syncTempAllowRules(now + 1)).resolves.toBeUndefined();
    expect(localStore[STORAGE_KEYS.local.tempAllows]).toEqual([]);
    expect(alarms.clear).toHaveBeenCalledWith(`${TEMP_ALLOW_ALARM_PREFIX}x.com`);
  });

  it("restores the original session and deadline when an intensity upgrade cannot arm its alarm", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    const started = await manager.startSession({
      listId: "list-1",
      intensity: "soft",
      durationMinutes: 25
    }, now);
    vi.mocked(alarms.create).mockClear();
    vi.mocked(dnrClient.updateDynamicRules).mockClear();
    vi.mocked(alarms.create).mockRejectedValueOnce(new Error("upgrade alarm unavailable"));

    await expect(manager.upgradeIntensity("hard", now + 60_000)).rejects.toThrow("upgrade alarm unavailable");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toEqual(started);
    expect(alarms.create).toHaveBeenLastCalledWith("focuswhale:session-end", { when: started.endsAt });
    expect(dnrClient.updateDynamicRules).toHaveBeenLastCalledWith(expect.objectContaining({ addRules: [] }));
  });

  it("rejects START_SESSION as an implicit upgrade and leaves the deadline unchanged", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    const started = await manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 25
    }, now);

    await expect(manager.startSession({
      listId: "list-1",
      intensity: "hard",
      durationMinutes: 25
    }, now + 60_000)).rejects.toThrow("already running");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toEqual(started);
  });

  it("rejects forged early completion and immediate abort requests", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("protected", now);

    await expect(manager.endSession("completed", now)).rejects.toThrow("natural deadline");
    await expect(manager.endSession("aborted", now)).rejects.toThrow("Immediate session termination");

    expect(localStore[STORAGE_KEYS.local.activeSession]).toMatchObject({ id: "protected" });
    expect(localStore[STORAGE_KEYS.local.sessionLog]).toBeUndefined();
  });

  it("reconciles an expired session before GET_STATE returns", async () => {
    const endsAt = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = completedCandidate("expired-get-state", endsAt);

    await expect(manager.getState(endsAt + 1)).resolves.toEqual({
      activeSession: null,
      pendingEmergency: null
    });

    expect(localStore[STORAGE_KEYS.local.sessionLog]).toEqual([
      expect.objectContaining({ id: "expired-get-state", status: "completed" })
    ]);
    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({ focusMinutes: 25 });
    expect(rewards.settleCompleted).toHaveBeenCalledTimes(1);
  });

  it("keeps completion-unlocked badges associated through finalization and later reconciliation", async () => {
    const endsAt = Date.parse("2026-07-06T10:00:00+09:00");
    const session = { ...completedCandidate("hard-milestones", endsAt), intensity: "hard" } satisfies Session;
    localStore[STORAGE_KEYS.local.activeSession] = session;
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    const managerWithRealRewards = new SessionManager(dnrClient, alarms, publisher);

    await managerWithRealRewards.getState(endsAt + 1);
    await reconcilePetGamification();

    const badgeEvents = Object.values(localStore).filter((value): value is {
      type: string;
      badgeId: string;
      sessionId?: string;
    } => Boolean(value && typeof value === "object" && (value as { type?: string }).type === "badge_earned"));
    expect(badgeEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ badgeId: "first-session", sessionId: session.id }),
      expect.objectContaining({ badgeId: "first-hard", sessionId: session.id })
    ]));
    expect(
      badgeEvents
        .filter((event) => event.badgeId === "first-session" || event.badgeId === "first-hard")
        .every((event) => event.sessionId === session.id)
    ).toBe(true);
  });

  it("attributes a cross-midnight session to each local calendar day exactly once", async () => {
    const startedAt = Date.parse("2026-07-06T23:50:30+09:00");
    const endsAt = Date.parse("2026-07-07T00:20:30+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = {
      ...completedCandidate("cross-midnight", endsAt),
      startedAt,
      endsAt
    };

    await manager.completeDueSession(endsAt + 1);
    await manager.getState(endsAt + 2);

    expect(splitFocusMinutesByLocalDate(startedAt, endsAt)).toEqual({
      "2026-07-06": 10,
      "2026-07-07": 20
    });
    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({ focusMinutes: 10 });
    expect(localStore["dailyStats:2026-07-07"]).toMatchObject({ focusMinutes: 20 });
    expect(localStore[SESSION_STATS_LEDGER_KEY]).toMatchObject({
      credits: { "cross-midnight": { focusMinutes: 30, byDate: { "2026-07-06": 10, "2026-07-07": 20 } } }
    });
  });

  it("recovers failed cleanup without duplicating the log or daily focus minutes", async () => {
    const endsAt = Date.parse("2026-07-06T10:00:00+09:00");
    localStore[STORAGE_KEYS.local.activeSession] = completedCandidate("cleanup-retry", endsAt);
    let rejectSessionRuleClear = true;
    vi.mocked(dnrClient.updateDynamicRules).mockImplementation(async (options) => {
      if (rejectSessionRuleClear && options.removeRuleIds?.includes(1) && options.addRules?.length === 0) {
        rejectSessionRuleClear = false;
        throw new Error("DNR cleanup failed");
      }
    });

    await expect(manager.completeDueSession(endsAt + 1)).rejects.toThrow("DNR cleanup failed");
    expect(localStore[SESSION_FINALIZATION_JOURNAL_KEY]).toBeDefined();
    expect(localStore[STORAGE_KEYS.local.activeSession]).toBeNull();

    await expect(manager.getState(endsAt + 2)).resolves.toEqual({
      activeSession: null,
      pendingEmergency: null
    });

    expect(localStore[SESSION_FINALIZATION_JOURNAL_KEY]).toBeUndefined();
    expect(localStore[STORAGE_KEYS.local.sessionLog]).toEqual([
      expect.objectContaining({ id: "cleanup-retry", status: "completed" })
    ]);
    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({ focusMinutes: 25 });
    expect(localStore[SESSION_STATS_LEDGER_KEY]).toMatchObject({
      credits: { "cleanup-retry": { focusMinutes: 25 } }
    });
    expect(publisher.publishSessionCompleted).toHaveBeenCalledTimes(1);
  });

  it("keeps an aborted finalization journal aborted when recovery crosses the natural deadline", async () => {
    const dueAt = Date.parse("2026-07-06T10:05:00+09:00");
    const session: Session = {
      ...hardSession("natural-promotion", dueAt - 5 * 60_000),
      startedAt: dueAt - 5 * 60_000,
      endsAt: dueAt + 5 * 60_000
    };
    localStore[STORAGE_KEYS.local.activeSession] = session;
    localStore.pendingEmergency = { sessionId: session.id, dueAt };
    let rejectSessionRuleClear = true;
    vi.mocked(dnrClient.updateDynamicRules).mockImplementation(async (options) => {
      if (rejectSessionRuleClear && options.removeRuleIds?.includes(1) && options.addRules?.length === 0) {
        rejectSessionRuleClear = false;
        throw new Error("cleanup paused");
      }
    });

    await expect(manager.completeEmergencyIfDue(dueAt)).rejects.toThrow("cleanup paused");
    expect(localStore[SESSION_FINALIZATION_JOURNAL_KEY]).toMatchObject({
      requestedStatus: "aborted",
      session: expect.objectContaining({ id: session.id })
    });
    expect(localStore[STORAGE_KEYS.local.sessionLog]).toEqual([
      expect.objectContaining({ id: session.id, status: "aborted" })
    ]);
    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({ focusMinutes: 5 });

    await manager.getState(session.endsAt + 1);

    expect(localStore[STORAGE_KEYS.local.sessionLog]).toEqual([
      expect.objectContaining({ id: session.id, status: "aborted" })
    ]);
    expect(localStore["dailyStats:2026-07-06"]).toMatchObject({ focusMinutes: 5 });
    expect(rewards.settleCompleted).not.toHaveBeenCalled();
  });

  it("retries a failed locked-setting rollback before returning", async () => {
    const now = Date.now();
    localStore[STORAGE_KEYS.local.activeSession] = hardSession("hard-lock", now);
    const original = { softOverlaySeconds: 10 };
    syncStore[STORAGE_KEYS.sync.settings] = { softOverlaySeconds: 3 };
    let attempts = 0;
    syncArea.set.mockImplementation(async (items: Store) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("sync temporarily unavailable");
      }
      Object.assign(syncStore, items);
    });

    await manager.rejectLockedSettingChanges({
      [STORAGE_KEYS.sync.settings]: {
        oldValue: original,
        newValue: { softOverlaySeconds: 3 }
      }
    }, new Map());

    expect(attempts).toBe(2);
    expect(syncStore[STORAGE_KEYS.sync.settings]).toEqual(original);
  });

  it("uses the durable lock snapshot to repair settings after a worker restart", async () => {
    const now = Date.parse("2026-07-06T10:00:00+09:00");
    const original = { softOverlaySeconds: 10 };
    syncStore[STORAGE_KEYS.sync.settings] = original;
    syncStore[STORAGE_KEYS.sync.siteLists] = [focusList()];
    syncStore[STORAGE_KEYS.sync.schedules] = [];
    const session = await manager.startSession({
      listId: "list-1",
      intensity: "medium",
      durationMinutes: 25
    }, now);
    syncStore[STORAGE_KEYS.sync.settings] = { softOverlaySeconds: 3 };

    manager = new SessionManager(dnrClient, alarms, publisher, rewards);
    await manager.reconcile(now + 1);

    expect(localStore[SESSION_LOCK_SNAPSHOT_KEY]).toMatchObject({ sessionId: session.id });
    expect(syncStore[STORAGE_KEYS.sync.settings]).toEqual(original);
  });
});

function hardSession(id: string, now: number): Session {
  return {
    id,
    source: "manual",
    listId: "list-1",
    intensity: "hard",
    startedAt: now - 60_000,
    endsAt: now + 60 * 60_000,
    status: "active",
    snoozeCount: 0,
    nextSnoozeDelayMin: 15
  };
}

function mediumSession(id: string, now: number): Session {
  return { ...hardSession(id, now), intensity: "medium" };
}

function focusList(): SiteList {
  return { id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] };
}

function completedCandidate(id: string, endsAt: number): Session {
  return {
    id,
    source: "manual",
    listId: "list-1",
    intensity: "medium",
    startedAt: endsAt - 25 * 60_000,
    endsAt,
    status: "active",
    snoozeCount: 0,
    nextSnoozeDelayMin: 15
  };
}
