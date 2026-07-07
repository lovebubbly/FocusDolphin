import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../shared/storage";
import type { Session } from "../shared/types";
import { type AlarmClient, type EventPublisher, SessionManager, nextSnoozeDelay } from "./session";
import type { DynamicRuleClient } from "./rules";

type Store = Record<string, unknown>;

function makeArea(store: Store) {
  return {
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    set: vi.fn(async (items: Store) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete store[key];
    })
  };
}

describe("snooze delay", () => {
  let localStore: Store;
  let syncStore: Store;
  let manager: SessionManager;
  let alarms: AlarmClient;

  beforeEach(() => {
    localStore = {};
    syncStore = {};

    vi.stubGlobal("chrome", {
      storage: {
        sync: makeArea(syncStore),
        local: makeArea(localStore)
      }
    });

    const dnrClient: DynamicRuleClient = { updateDynamicRules: vi.fn(async () => undefined) };
    alarms = {
      create: vi.fn(async () => undefined),
      clear: vi.fn(async () => true)
    };
    const publisher: EventPublisher = { publishSessionCompleted: vi.fn(async () => undefined) };
    manager = new SessionManager(dnrClient, alarms, publisher);
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
    }, new Set());

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
    }, new Set());

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
