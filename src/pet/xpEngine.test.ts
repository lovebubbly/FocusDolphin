import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetState, Session } from "../shared/types";
import { normalizePetState } from "./defaultState";
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
  return normalizePetState({
    stage: 0,
    xp: 0,
    streakDays: 0,
    streakFreezes: 0,
    lastActiveDate: "",
    badges: [],
    ...overrides
  });
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
    syncStore.petState = petState({ xp: 590 });
    localStore.sessionLog = [session({ intensity: "soft", endsAt: Date.parse("2026-07-06T09:10:00+09:00") })];

    const result = await settleCompletedSessionXp();

    expect(result.awardedXp).toBe(10);
    expect(result.petState).toMatchObject({ xp: 600, stage: 2 });
    expect(result.events.some((event) => event.type === "stage_up")).toBe(true);
    expect(syncStore.petState).toMatchObject({ xp: 600, stage: 2 });
  });

  it("records growth ledger and pending celebration events", async () => {
    syncStore.petState = petState({ xp: 40 });
    localStore.sessionLog = [session({ id: "half", intensity: "soft", endsAt: Date.parse("2026-07-06T09:20:00+09:00") })];

    const result = await settleCompletedSessionXp(new Date("2026-07-06T09:30:00+09:00"));

    expect(result.events.map((event) => event.type)).toContain("session_completed");
    expect(result.events.map((event) => event.type)).toContain("half_way");
    expect(localStore.growthLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "session_completed",
        xpDelta: 20,
        xpBefore: 40,
        xpAfter: 60,
        progressBefore: 40,
        progressAfter: 60
      }),
      expect.objectContaining({ type: "half_way" })
    ]));
    expect(localStore.pendingCelebrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "session_completed" }),
      expect.objectContaining({ type: "half_way" })
    ]));
  });

  it("does not lower an already higher stored stage during settlement", async () => {
    syncStore.petState = petState({ stage: 4, xp: 1_000 });
    localStore.sessionLog = [session({ id: "keep-stage", intensity: "soft" })];

    const result = await settleCompletedSessionXp();

    expect(result.petState.stage).toBe(4);
    expect(syncStore.petState).toMatchObject({ stage: 4 });
  });
});
