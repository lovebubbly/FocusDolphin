import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetState, Session } from "../shared/types";
import { PET_LEDGER_KEY, settleCompletedSessionXp } from "./xpEngine";

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

function petState(overrides: Partial<PetState> = {}): PetState {
  return {
    stage: 0,
    xp: 0,
    streakDays: 0,
    streakFreezes: 0,
    lastActiveDate: "",
    badges: [],
    ...overrides
  };
}

function session(overrides: Partial<Session> = {}): Session {
  const startedAt = Date.parse("2026-07-06T09:00:00+09:00");

  return {
    id: "session-1",
    source: "manual",
    listId: "list-1",
    intensity: "medium",
    startedAt,
    endsAt: startedAt + 25 * 60_000,
    status: "completed",
    snoozeCount: 0,
    nextSnoozeDelayMin: 5,
    ...overrides
  };
}

describe("settleCompletedSessionXp", () => {
  let syncStore: Store;
  let localStore: Store;

  beforeEach(() => {
    syncStore = {
      petState: petState()
    };
    localStore = {
      sessionLog: []
    };

    vi.stubGlobal("chrome", {
      storage: {
        sync: makeArea(syncStore),
        local: makeArea(localStore)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("settles a completed session only once", async () => {
    localStore.sessionLog = [session()];

    const first = await settleCompletedSessionXp(new Date("2026-07-06T10:00:00+09:00"));
    const second = await settleCompletedSessionXp(new Date("2026-07-06T10:01:00+09:00"));

    expect(first.awardedXp).toBe(30);
    expect(first.settledSessionIds).toEqual(["session-1"]);
    expect(second.awardedXp).toBe(0);
    expect(second.settledSessionIds).toEqual([]);
    expect(syncStore.petState).toMatchObject({ xp: 30, stage: 0 });
    expect(localStore[PET_LEDGER_KEY]).toMatchObject({ settledSessionIds: ["session-1"] });
  });

  it("keeps aborted and interrupted sessions penalty-free", async () => {
    syncStore.petState = petState({ xp: 100 });
    localStore.sessionLog = [
      session({ id: "aborted", status: "aborted", intensity: "hard" }),
      session({ id: "interrupted", status: "interrupted", intensity: "hard" })
    ];

    const result = await settleCompletedSessionXp();

    expect(result.awardedXp).toBe(0);
    expect(result.petState.xp).toBe(100);
  });

  it("links XP settlement to stageForXp thresholds", async () => {
    syncStore.petState = petState({ xp: 290 });
    localStore.sessionLog = [session({ intensity: "soft", endsAt: Date.parse("2026-07-06T09:10:00+09:00") })];

    const result = await settleCompletedSessionXp();

    expect(result.awardedXp).toBe(10);
    expect(result.petState).toMatchObject({ xp: 300, stage: 1 });
    expect(syncStore.petState).toMatchObject({ xp: 300, stage: 1 });
  });
});
