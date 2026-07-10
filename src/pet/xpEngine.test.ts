import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetState, Session } from "../shared/types";
import { normalizePetState } from "./defaultState";
import { PET_LEDGER_KEY, PET_SETTLEMENT_JOURNAL_KEY, settleCompletedSessionXp } from "./xpEngine";

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
    remove: vi.fn(async (key: string | string[]) => {
      for (const entry of Array.isArray(key) ? key : [key]) {
        delete store[entry];
      }
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
  let localArea: ReturnType<typeof makeArea>;

  beforeEach(() => {
    syncStore = {
      petState: petState()
    };
    localStore = {
      sessionLog: []
    };

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
    expect(Object.values(localStore)).toEqual(expect.arrayContaining([
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
    expect(Object.values(localStore)).toEqual(expect.arrayContaining([
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

  it("recovers a persisted settlement journal without awarding the session twice", async () => {
    const completed = session({ id: "journal-session" });
    const recoveredPet = petState({ xp: 30, totalFocusMinutes: 25 });
    localStore.sessionLog = [completed];
    localStore[PET_SETTLEMENT_JOURNAL_KEY] = {
      petState: recoveredPet,
      ledger: { settledSessionIds: [completed.id], settledEarlySessionIds: [], updatedAt: completed.endsAt },
      events: [],
      persistPetState: true,
      createdAt: completed.endsAt
    };

    const result = await settleCompletedSessionXp(new Date(completed.endsAt + 1_000));

    expect(result.awardedXp).toBe(0);
    expect(syncStore.petState).toMatchObject({ xp: 30, totalFocusMinutes: 25 });
    expect(localStore[PET_LEDGER_KEY]).toMatchObject({ settledSessionIds: [completed.id] });
    expect(localStore[PET_SETTLEMENT_JOURNAL_KEY]).toBeUndefined();
  });

  it("replays an older journal without reducing newer progress or forgetting settled sessions", async () => {
    const journalSession = session({ id: "journal-session" });
    const newerSession = session({ id: "newer-session", endsAt: journalSession.endsAt + 60_000 });
    const newerPet = petState({
      name: "Nova",
      xp: 900,
      stage: 3,
      totalFocusMinutes: 800,
      streak: { days: 12, state: "resting", restingSince: "2026-07-10", freezes: 2 },
      streakDays: 12,
      streakFreezes: 2,
      lastActiveDate: "2026-07-10",
      badges: ["journal-badge", "newer-badge"],
      badgeAwards: {
        "journal-badge": { earnedAt: 200 },
        "newer-badge": { earnedAt: 300 }
      }
    });
    syncStore.petState = newerPet;
    localStore.sessionLog = [journalSession, newerSession];
    localStore[PET_LEDGER_KEY] = {
      settledSessionIds: [journalSession.id, newerSession.id],
      settledEarlySessionIds: ["newer-early"],
      updatedAt: newerSession.endsAt
    };
    localStore[PET_SETTLEMENT_JOURNAL_KEY] = {
      petState: petState({
        name: "Miro",
        xp: 30,
        totalFocusMinutes: 25,
        streak: { days: 1, state: "active", freezes: 0 },
        streakDays: 1,
        lastActiveDate: "2026-07-06",
        badges: ["journal-badge"],
        badgeAwards: { "journal-badge": { earnedAt: 100 } }
      }),
      ledger: {
        settledSessionIds: [journalSession.id],
        settledEarlySessionIds: ["journal-early"],
        updatedAt: journalSession.endsAt
      },
      events: [],
      persistPetState: true,
      createdAt: journalSession.endsAt
    };

    const result = await settleCompletedSessionXp(new Date(newerSession.endsAt + 1_000));

    expect(result.awardedXp).toBe(0);
    expect(result.settledSessionIds).toEqual([]);
    expect(syncStore.petState).toEqual(newerPet);
    expect(localStore[PET_LEDGER_KEY]).toEqual({
      settledSessionIds: [journalSession.id, newerSession.id],
      settledEarlySessionIds: ["newer-early", "journal-early"],
      updatedAt: newerSession.endsAt
    });
    expect(localStore[PET_SETTLEMENT_JOURNAL_KEY]).toBeUndefined();
  });

  it("recovers a fault between sync XP and local ledger writes exactly once", async () => {
    localStore.sessionLog = [session({ id: "cross-area-fault" })];
    let failGrowthWrite = true;
    localArea.set.mockImplementation(async (items: Store) => {
      if (failGrowthWrite && Object.keys(items).some((key) => key.startsWith("growthEvent:"))) {
        failGrowthWrite = false;
        throw new Error("growth storage unavailable");
      }
      Object.assign(localStore, items);
    });
    const now = new Date("2026-07-06T10:00:00+09:00");

    await expect(settleCompletedSessionXp(now)).rejects.toThrow("growth storage unavailable");
    expect(syncStore.petState).toMatchObject({ xp: 30, totalFocusMinutes: 25 });
    expect(localStore[PET_SETTLEMENT_JOURNAL_KEY]).toBeDefined();

    const recovered = await settleCompletedSessionXp(now);

    expect(recovered.awardedXp).toBe(0);
    expect(syncStore.petState).toMatchObject({ xp: 30, totalFocusMinutes: 25 });
    expect(localStore[PET_LEDGER_KEY]).toMatchObject({ settledSessionIds: ["cross-area-fault"] });
    expect(localStore[PET_SETTLEMENT_JOURNAL_KEY]).toBeUndefined();
    const completionEvents = Object.entries(localStore)
      .filter(([key]) => key.startsWith("growthEvent:session_completed"));
    expect(completionEvents).toHaveLength(1);
  });
});
