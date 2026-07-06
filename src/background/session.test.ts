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
    const alarms: AlarmClient = {
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
});
