import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetState, Session, SiteList } from "../shared/types";
import { normalizePetState } from "./defaultState";
import {
  PET_RECONCILIATION_JOURNAL_KEY,
  STREAK_LEDGER_KEY,
  reconcilePetGamification,
  savePetName
} from "./reconcile";

type Store = Record<string, unknown>;

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
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key];
      }
    })
  };
}

describe("pet reconciliation", () => {
  let syncStore: Store;
  let localStore: Store;
  let localArea: ReturnType<typeof makeArea>;

  beforeEach(() => {
    const startedAt = Date.parse("2026-07-10T09:00:00+09:00");
    const session: Session = {
      id: "focus-1",
      source: "manual",
      listId: "list-1",
      intensity: "medium",
      startedAt,
      endsAt: startedAt + 25 * 60_000,
      status: "completed",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };
    const siteList: SiteList = { id: "list-1", name: "Focus", mode: "blocklist", domains: ["x.com"] };
    syncStore = {
      siteLists: [siteList],
      petState: normalizePetState({ name: "Lumi" } satisfies Partial<PetState>)
    };
    localStore = { sessionLog: [session] };
    localArea = makeArea(localStore);
    vi.stubGlobal("chrome", {
      storage: {
        sync: makeArea(syncStore),
        local: localArea
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("settles XP, streak, badges, and name through one serialized writer", async () => {
    const result = await reconcilePetGamification(new Date("2026-07-10T10:00:00+09:00"));

    expect(result).toMatchObject({ awardedXp: 30, streakStatus: "active" });
    expect(result.petState).toMatchObject({ name: "Lumi", xp: 30, streakDays: 1 });
    expect(result.petState.badges).toContain("first-session");
    expect(syncStore.petState).toEqual(result.petState);
  });

  it("updates only the name without lowering existing progress", async () => {
    syncStore.petState = normalizePetState({ name: "Lumi", xp: 700, totalFocusMinutes: 620 });

    const result = await savePetName("  Bora  ");

    expect(result).toMatchObject({ name: "Bora", xp: 700, totalFocusMinutes: 620, stage: 2 });
  });

  it("recovers a sync/local reconciliation fault without duplicating XP or growth events", async () => {
    let failStreakWrite = true;
    localArea.set.mockImplementation(async (items: Store) => {
      if (failStreakWrite && Object.prototype.hasOwnProperty.call(items, STREAK_LEDGER_KEY)) {
        failStreakWrite = false;
        throw new Error("local streak write failed");
      }
      Object.assign(localStore, items);
    });
    const now = new Date("2026-07-10T10:00:00+09:00");

    await expect(reconcilePetGamification(now)).rejects.toThrow("local streak write failed");
    expect(localStore[PET_RECONCILIATION_JOURNAL_KEY]).toBeDefined();
    expect(syncStore.petState).toMatchObject({ xp: 30, streakDays: 1 });

    const recovered = await reconcilePetGamification(now);

    expect(recovered.awardedXp).toBe(0);
    expect(recovered.petState).toMatchObject({ xp: 30, streakDays: 1 });
    expect(localStore[PET_RECONCILIATION_JOURNAL_KEY]).toBeUndefined();
    expect(localStore.petLedger).toMatchObject({ settledSessionIds: ["focus-1"] });
    const growthIds = Object.entries(localStore)
      .filter(([key]) => key.startsWith("growthEvent:"))
      .map(([, value]) => (value as { id: string }).id);
    expect(new Set(growthIds).size).toBe(growthIds.length);
  });

  it("does not let a stale reconciliation journal regress a newer synced streak", async () => {
    syncStore.petState = normalizePetState({
      name: "Lumi",
      xp: 700,
      totalFocusMinutes: 620,
      streak: { days: 5, state: "active", freezes: 2 },
      streakDays: 5,
      streakFreezes: 2,
      lastActiveDate: "2026-07-11"
    });
    localStore[STREAK_LEDGER_KEY] = {
      pending: false,
      previousStreakDays: 0,
      processedThroughDate: "2026-07-11"
    };
    localStore[PET_RECONCILIATION_JOURNAL_KEY] = {
      petState: normalizePetState({
        name: "Old",
        xp: 30,
        totalFocusMinutes: 25,
        streak: { days: 1, state: "resting", restingSince: "2026-07-10", freezes: 0 },
        streakDays: 1,
        streakFreezes: 0,
        lastActiveDate: "2026-07-10"
      }),
      streakRecovery: {
        pending: true,
        previousStreakDays: 1,
        missedDate: "2026-07-10",
        processedThroughDate: "2026-07-10"
      },
      events: [],
      createdAt: Date.parse("2026-07-10T10:00:00+09:00")
    };

    const result = await savePetName("Bora");

    expect(result).toMatchObject({
      name: "Bora",
      xp: 700,
      totalFocusMinutes: 620,
      streakDays: 5,
      streakFreezes: 2,
      lastActiveDate: "2026-07-11",
      streak: { days: 5, state: "active", freezes: 2 }
    });
    expect(localStore[STREAK_LEDGER_KEY]).toMatchObject({
      pending: false,
      processedThroughDate: "2026-07-11"
    });
    expect(localStore[PET_RECONCILIATION_JOURNAL_KEY]).toBeUndefined();
  });
});
