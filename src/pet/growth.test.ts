import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CELEBRATION_ACK_PREFIX,
  GROWTH_EVENT_PREFIX,
  PENDING_CELEBRATION_PREFIX,
  appendGrowthEvents,
  acknowledgeCelebrations,
  createGrowthEvent,
  crossedHalfWay,
  describeGrowthEvent,
  drainPendingCelebrations,
  growthProgress,
  readPendingCelebrations,
  readGrowthLog
} from "./growth";

type Store = Record<string, unknown>;

function makeArea(store: Store, afterSet?: (items: Store) => void) {
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
      afterSet?.(items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key];
      }
    })
  };
}

describe("growth event inbox", () => {
  let store: Store;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("chrome", { storage: { local: makeArea(store) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and acknowledges a celebration exactly once", async () => {
    const event = createGrowthEvent("session_completed", 100, { sessionId: "s1", minutes: 25, xpDelta: 30 });

    await appendGrowthEvents([event]);
    expect(store[`${GROWTH_EVENT_PREFIX}${event.id}`]).toEqual(event);
    expect(store[`${PENDING_CELEBRATION_PREFIX}${event.id}`]).toEqual(event);

    await expect(drainPendingCelebrations()).resolves.toEqual([event]);
    await expect(drainPendingCelebrations()).resolves.toEqual([]);
    expect(store[`${CELEBRATION_ACK_PREFIX}${event.id}`]).toBe(100);
    await expect(readGrowthLog()).resolves.toEqual([event]);
  });

  it("keeps a celebration pending until the UI explicitly acknowledges it", async () => {
    const event = createGrowthEvent("badge_earned", 150, { badgeId: "first-session" });
    await appendGrowthEvents([event]);

    await expect(readPendingCelebrations()).resolves.toEqual([event]);
    await expect(readPendingCelebrations()).resolves.toEqual([event]);

    await acknowledgeCelebrations([event.id]);
    await expect(readPendingCelebrations()).resolves.toEqual([]);
  });

  it("does not erase a new celebration appended while another drain is acknowledged", async () => {
    const first = createGrowthEvent("session_completed", 100, { sessionId: "s1", minutes: 25, xpDelta: 30 });
    const second = createGrowthEvent("session_completed", 200, { sessionId: "s2", minutes: 50, xpDelta: 60 });
    store[`${PENDING_CELEBRATION_PREFIX}${first.id}`] = first;
    let injected = false;
    vi.stubGlobal("chrome", {
      storage: {
        local: makeArea(store, (items) => {
          if (!injected && Object.keys(items).some((key) => key.startsWith(CELEBRATION_ACK_PREFIX))) {
            injected = true;
            store[`${PENDING_CELEBRATION_PREFIX}${second.id}`] = second;
          }
        })
      }
    });

    await expect(drainPendingCelebrations()).resolves.toEqual([first]);
    await expect(drainPendingCelebrations()).resolves.toEqual([second]);
  });

  it("deduplicates acknowledgement keys before enforcing the retention cap", async () => {
    for (let index = 0; index < 500; index += 1) {
      store[`${CELEBRATION_ACK_PREFIX}${index}`] = index;
    }

    await acknowledgeCelebrations(["499"]);

    const acknowledgementKeys = Object.keys(store).filter((key) => key.startsWith(CELEBRATION_ACK_PREFIX));
    expect(acknowledgementKeys).toHaveLength(500);
    expect(store[`${CELEBRATION_ACK_PREFIX}0`]).toBe(0);
    expect(store[`${CELEBRATION_ACK_PREFIX}499`]).toBeTypeOf("number");
  });
});

describe("growth presentation", () => {
  it("uses localized intensity labels in durable completion copy", () => {
    expect(describeGrowthEvent("session_completed", {
      minutes: 25,
      xpDelta: 37,
      intensity: "hard"
    })).toContain("25분 × 완전 차단");
  });

  it("never offers a lower next stage for a non-regressing legacy stage", () => {
    expect(growthProgress(1_000, 4)).toMatchObject({
      currentStageName: "별고래",
      nextStageName: null,
      percentToNext: 100,
      remainingXp: 0
    });
    expect(growthProgress(200, 2)).toMatchObject({
      currentStageName: "어린 고래",
      nextStageName: "푸른 고래",
      percentToNext: 0,
      remainingXp: 1_800
    });
    expect(crossedHalfWay(1_000, 4_000, 4)).toBe(false);
  });
});
