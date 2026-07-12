import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTyped, normalizeSettings, setTyped, STORAGE_KEYS, subscribeTyped } from "./storage";

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

describe("storage helpers", () => {
  let syncStore: Store;
  let localStore: Store;
  let listeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: chrome.storage.AreaName) => void>;

  beforeEach(() => {
    syncStore = {};
    localStore = {};
    listeners = [];

    vi.stubGlobal("chrome", {
      storage: {
        sync: makeArea(syncStore),
        local: makeArea(localStore),
        onChanged: {
          addListener: vi.fn((listener) => listeners.push(listener)),
          removeListener: vi.fn((listener) => {
            listeners = listeners.filter((candidate) => candidate !== listener);
          })
        }
      }
    });
  });

  it("retains persisted storage keys across the public rename", () => {
    expect(STORAGE_KEYS.sync).toEqual({
      uiLocale: "uiLocale",
      settings: "settings",
      siteLists: "siteLists",
      schedules: "schedules",
      petState: "petState"
    });
    expect({
      activeSession: STORAGE_KEYS.local.activeSession,
      tempAllows: STORAGE_KEYS.local.tempAllows,
      sessionLog: STORAGE_KEYS.local.sessionLog,
      intentLog: STORAGE_KEYS.local.intentLog,
      dailyStats: STORAGE_KEYS.local.dailyStats("2026-07-12")
    }).toEqual({
      activeSession: "activeSession",
      tempAllows: "tempAllows",
      sessionLog: "sessionLog",
      intentLog: "intentLog",
      dailyStats: "dailyStats:2026-07-12"
    });
  });

  it("sets and gets typed sync values", async () => {
    await setTyped("sync", STORAGE_KEYS.sync.settings, { softOverlaySeconds: 10 });

    await expect(getTyped("sync", STORAGE_KEYS.sync.settings)).resolves.toEqual({
      softOverlaySeconds: 10
    });
  });

  it("stores the UI locale independently from session settings", async () => {
    await setTyped("sync", STORAGE_KEYS.sync.uiLocale, "en");

    await expect(getTyped("sync", STORAGE_KEYS.sync.uiLocale)).resolves.toBe("en");
    expect(syncStore.settings).toBeUndefined();
  });

  it("resolves missing or malformed settings to one shared product default", () => {
    expect(normalizeSettings(undefined)).toEqual({
      focusHours: { startHHMM: "09:00", endHHMM: "12:00" },
      softOverlaySeconds: 10
    });
    expect(normalizeSettings({
      softOverlaySeconds: 100,
      focusHours: { startHHMM: "12:00", endHHMM: "12:00" }
    })).toEqual({
      focusHours: { startHHMM: "12:00", endHHMM: "09:00" },
      softOverlaySeconds: 60
    });
  });

  it("supports dailyStats local keys", async () => {
    const key = STORAGE_KEYS.local.dailyStats("2026-07-06");

    await setTyped("local", key, {
      date: "2026-07-06",
      focusMinutes: 25,
      blockedAttempts: 2,
      overrides: 1,
      domainVisits: { "example.com": 3 }
    });

    await expect(getTyped("local", key)).resolves.toMatchObject({
      date: "2026-07-06",
      focusMinutes: 25
    });
  });

  it("subscribes to sync and local storage changes", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeTyped(onChange);

    listeners[0]?.(
      { settings: { oldValue: undefined, newValue: { softOverlaySeconds: 10 } } },
      "sync"
    );
    listeners[0]?.({ ignored: { newValue: true } }, "managed");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      [{ key: "settings", oldValue: undefined, newValue: { softOverlaySeconds: 10 } }],
      "sync"
    );

    unsubscribe();
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
  });
});
