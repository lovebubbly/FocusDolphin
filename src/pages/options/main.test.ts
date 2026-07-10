import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../shared/types";
import {
  loadState,
  lockedOptionsCountdownText,
  modalFocusWrapIndex,
  nextOptionsView,
  requestHistoryAccess,
  requestHistoryAnalysis,
  weeklyBarHeight
} from "./main";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("options keyboard and display helpers", () => {
  it("takes the initial dashboard snapshot after overdue-session reconciliation", async () => {
    const calls: string[] = [];
    const completedSession: Session = {
      id: "late-session",
      source: "manual",
      listId: "default-blocklist",
      intensity: "medium",
      startedAt: 0,
      endsAt: 25 * 60_000,
      status: "completed",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };
    const syncStore: Record<string, unknown> = {
      settings: { softOverlaySeconds: 10, focusHours: { startHHMM: "09:00", endHHMM: "12:00" } },
      siteLists: [{ id: "default-blocklist", name: "기본", mode: "blocklist", domains: ["x.com"] }],
      schedules: [],
      petState: {
        version: 2,
        stage: 0,
        xp: 30,
        totalFocusMinutes: 25,
        streak: { days: 1, state: "active", freezes: 0 },
        streakDays: 1,
        streakFreezes: 0,
        lastActiveDate: "2026-07-10",
        badges: [],
        badgeAwards: {}
      }
    };
    const localStore: Record<string, unknown> = { activeSession: { ...completedSession, status: "active" } };
    const makeArea = (store: Record<string, unknown>, area: string) => ({
      get: vi.fn(async (key: string | string[] | null) => {
        calls.push(`${area}.get:${key === null ? "all" : String(key)}`);
        if (key === null) {
          return { ...store };
        }
        if (Array.isArray(key)) {
          return Object.fromEntries(key.map((entry) => [entry, store[entry]]));
        }
        return { [key]: store[key] };
      }),
      set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, items)),
      remove: vi.fn(async () => undefined)
    });
    const sendMessage = vi.fn(async (message: { type: string }) => {
      calls.push(`runtime:${message.type}`);
      localStore.activeSession = null;
      localStore.sessionLog = [completedSession];
      localStore["dailyStats:2026-07-10"] = {
        date: "2026-07-10",
        focusMinutes: 25,
        blockedAttempts: 0,
        overrides: 0,
        domainVisits: {}
      };
      return { ok: true, state: { activeSession: null, pendingEmergency: null } };
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: { sync: makeArea(syncStore, "sync"), local: makeArea(localStore, "local") }
    });

    const state = await loadState();

    expect(calls.indexOf("runtime:GET_STATE")).toBeLessThan(calls.indexOf("local.get:all"));
    expect(state.activeSession).toBeNull();
    expect(state.sessionLog).toEqual([completedSession]);
    expect(state.dailyStats).toEqual([expect.objectContaining({ date: "2026-07-10", focusMinutes: 25 })]);
  });

  it("follows the tablist arrow, Home, and End navigation pattern", () => {
    expect(nextOptionsView("insights", "ArrowRight")).toBe("lists");
    expect(nextOptionsView("insights", "ArrowLeft")).toBe("growth");
    expect(nextOptionsView("automation", "Home")).toBe("insights");
    expect(nextOptionsView("lists", "End")).toBe("growth");
    expect(nextOptionsView("lists", "Enter")).toBeNull();
  });

  it("wraps modal focus without letting Tab escape the dialog", () => {
    expect(modalFocusWrapIndex(2, 3, false)).toBe(0);
    expect(modalFocusWrapIndex(0, 3, true)).toBe(2);
    expect(modalFocusWrapIndex(-1, 3, false)).toBe(0);
    expect(modalFocusWrapIndex(-1, 3, true)).toBe(2);
    expect(modalFocusWrapIndex(1, 3, false)).toBeNull();
    expect(modalFocusWrapIndex(0, 0, false)).toBeNull();
  });

  it("formats a changing locked-session deadline", () => {
    const session: Session = {
      id: "locked",
      source: "manual",
      listId: "default",
      intensity: "hard",
      startedAt: 0,
      endsAt: 65_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };

    expect(lockedOptionsCountdownText(session, 0)).toBe("1:05");
    expect(lockedOptionsCountdownText(session, 5_000)).toBe("1:00");
  });

  it("renders a true zero bar while keeping small positive values visible", () => {
    expect(weeklyBarHeight(0, 60)).toBe("0%");
    expect(weeklyBarHeight(1, 60)).toBe("6%");
    expect(weeklyBarHeight(60, 60)).toBe("100%");
  });

  it("requests history only when local recommendation analysis is invoked", async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal("chrome", { permissions: { request } });

    await expect(requestHistoryAccess()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ permissions: ["history"] });
  });

  it("delegates recommendation analysis to the background", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(requestHistoryAnalysis()).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledWith({ type: "ANALYZE_HISTORY" });
  });
});
