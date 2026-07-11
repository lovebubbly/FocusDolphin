import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../shared/types";
import {
  acknowledgePopupCelebrations,
  activeSessionClockSnapshot,
  activeSessionTimerValue,
  celebrationBatch,
  clearPopupCelebrations,
  coerceCustomDuration,
  dismissPopupCelebrations,
  fallbackRuntimeState,
  intensityLabel,
  localizedGrowthEventText,
  loadPopupModel,
  mergeCelebrationDismissal,
  mergePetNameSave,
  stepDuration,
  type PopupModel
} from "./main";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("popup celebration state", () => {
  it("clears dismissed celebrations before later selection rerenders", () => {
    const model = {
      celebrations: [{ id: "session-1" }]
    } as unknown as PopupModel;

    expect(clearPopupCelebrations(model).celebrations).toEqual([]);
  });

  it("waits for acknowledgement before clearing celebrations", async () => {
    const model = {
      celebrations: [{ id: "session-1" }],
      notice: "old notice"
    } as unknown as PopupModel;
    const acknowledge = vi.fn().mockResolvedValue(undefined);

    const next = await dismissPopupCelebrations(model, acknowledge);

    expect(acknowledge).toHaveBeenCalledWith(["session-1"]);
    expect(next.celebrations).toEqual([]);
    expect(next.celebrationAckError).toBeUndefined();
  });

  it("keeps celebrations recoverable when acknowledgement fails", async () => {
    const model = {
      celebrations: [{ id: "session-1" }]
    } as unknown as PopupModel;

    const next = await dismissPopupCelebrations(model, async () => {
      throw new Error("storage unavailable");
    }, "ko");

    expect(next.celebrations).toEqual(model.celebrations);
    expect(next.celebrationAckError).toContain("다시 시도");
  });

  it("routes acknowledgement through the background message boundary", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await acknowledgePopupCelebrations(["session-1", "stage-2"]);

    expect(sendMessage).toHaveBeenCalledWith({
      type: "ACK_CELEBRATIONS",
      payload: { eventIds: ["session-1", "stage-2"] }
    });
  });

  it("merges acknowledgement into the newest model without hiding a new session or celebration", () => {
    const current = {
      activeSession: { id: "new-active", status: "active" },
      celebrations: [{ id: "session-1" }, { id: "session-2" }]
    } as unknown as PopupModel;

    const merged = mergeCelebrationDismissal(current, ["session-1"]);

    expect(merged.activeSession).toBe(current.activeSession);
    expect(merged.celebrations).toEqual([{ id: "session-2" }]);
    expect(merged.celebrationAckError).toBeUndefined();
  });

  it("acknowledges only the completed-session milestones that were rendered", () => {
    const events = [
      { id: "s1-complete", type: "session_completed", sessionId: "s1", ts: 1 },
      { id: "s1-stage", type: "stage_up", sessionId: "s1", ts: 1 },
      { id: "s1-badge", type: "badge_earned", badgeId: "first-session", sessionId: "s1", ts: 1 },
      { id: "s1-half", type: "half_way", sessionId: "s1", ts: 1 },
      { id: "s1-freeze", type: "freeze_granted", sessionId: "s1", ts: 1 },
      { id: "s1-hard", type: "badge_earned", badgeId: "first-hard", sessionId: "s1", ts: 1 },
      { id: "s2-complete", type: "session_completed", sessionId: "s2", ts: 2 },
      { id: "global-badge", type: "badge_earned", ts: 2 }
    ] as unknown as PopupModel["celebrations"];

    const batch = celebrationBatch(events);
    expect(batch.map((event) => event.id)).toEqual([
      "s1-complete",
      "s1-stage",
      "s1-badge",
      "s1-half",
      "s1-freeze"
    ]);

    const remaining = mergeCelebrationDismissal(
      { celebrations: events } as unknown as PopupModel,
      batch.map((event) => event.id)
    ).celebrations;
    expect(remaining.map((event) => event.id)).toEqual([
      "s1-hard",
      "s2-complete",
      "global-badge"
    ]);
  });

  it("merges a saved pet name into the current popup model without dropping pending UI", () => {
    const model = {
      petState: { name: undefined },
      celebrations: [{ id: "stage-1" }],
      pendingEmergency: { sessionId: "hard", dueAt: 10_000 }
    } as unknown as PopupModel;
    const petState = { ...model.petState, name: "파도" };

    const merged = mergePetNameSave(model, petState);

    expect(merged.petState.name).toBe("파도");
    expect(merged.celebrations).toBe(model.celebrations);
    expect(merged.pendingEmergency).toBe(model.pendingEmergency);
  });
});

describe("popup interaction helpers", () => {
  it("does not present expired or mismatched fallback storage as a live session", () => {
    const session: Session = {
      id: "expired",
      source: "manual",
      listId: "default",
      intensity: "hard",
      startedAt: 0,
      endsAt: 10_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };

    expect(fallbackRuntimeState(session, { sessionId: session.id, dueAt: 9_000 }, 10_001)).toEqual({
      activeSession: null,
      pendingEmergency: null
    });
    expect(fallbackRuntimeState(
      { ...session, endsAt: 20_000 },
      { sessionId: "other", dueAt: 15_000 },
      10_001
    )).toEqual({
      activeSession: { ...session, endsAt: 20_000 },
      pendingEmergency: null
    });
  });

  it("finalizes overdue runtime state before reconciling rewards and reading celebrations", async () => {
    const calls: string[] = [];
    const syncStore: Record<string, unknown> = {
      siteLists: [{ id: "default-blocklist", name: "기본", mode: "blocklist", domains: ["x.com"] }],
      petState: {
        version: 2,
        name: "미로",
        stage: 0,
        xp: 0,
        totalFocusMinutes: 0,
        streak: { days: 0, state: "fresh", freezes: 0 },
        streakDays: 0,
        streakFreezes: 0,
        lastActiveDate: "",
        badges: [],
        badgeAwards: {}
      }
    };
    const localStore: Record<string, unknown> = {};
    const makeArea = (store: Record<string, unknown>) => ({
      get: vi.fn(async (key: string | string[] | null) => {
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
    const completion = {
      id: "session_completed:late-session:100",
      ts: 100,
      type: "session_completed",
      sessionId: "late-session",
      xpDelta: 30,
      xpBefore: 0,
      xpAfter: 30,
      stageFrom: 0,
      stageTo: 0,
      minutes: 25,
      intensity: "medium",
      text: "25분 집중 완료"
    };
    const sendMessage = vi.fn(async (message: { type: string }) => {
      calls.push(message.type);
      if (message.type === "GET_STATE") {
        localStore[`pendingCelebration:${completion.id}`] = completion;
        localStore[`growthEvent:${completion.id}`] = completion;
        syncStore.petState = { ...(syncStore.petState as object), xp: 30, totalFocusMinutes: 25 };
        return { ok: true, state: { activeSession: null, pendingEmergency: null } };
      }
      return {
        ok: true,
        pet: { awardedXp: 30, petState: syncStore.petState, streakStatus: "active" }
      };
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: { sync: makeArea(syncStore), local: makeArea(localStore) }
    });

    const model = await loadPopupModel();

    expect(calls).toEqual(["GET_STATE", "RECONCILE_PET"]);
    expect(model.petState).toMatchObject({ xp: 30, totalFocusMinutes: 25 });
    expect(model.celebrations.map((event) => event.id)).toEqual([completion.id]);
    expect(model.growthLog.map((event) => event.id)).toEqual([completion.id]);
  });

  it("accepts multi-digit custom durations without resetting partial input", () => {
    expect(coerceCustomDuration("2", 25)).toBe(2);
    expect(coerceCustomDuration("25", 2)).toBe(25);
    expect(coerceCustomDuration("300", 25)).toBe(240);
    expect(coerceCustomDuration("", 25)).toBe(25);
  });

  it("keeps the Goal 8 duration stepper inside the supported 1-240 minute range", () => {
    expect(stepDuration(25, -1)).toBe(24);
    expect(stepDuration(25, 1)).toBe(26);
    expect(stepDuration(1, -1)).toBe(1);
    expect(stepDuration(240, 1)).toBe(240);
  });

  it("updates the active clock from a stable session snapshot", () => {
    const session: Session = {
      id: "active",
      source: "manual",
      listId: "default",
      intensity: "medium",
      startedAt: 1_000,
      endsAt: 61_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    };

    expect(activeSessionClockSnapshot(session, 31_000, "ko")).toEqual({
      remainingText: "남은 시간 0:30",
      progress: 50
    });
    expect(activeSessionClockSnapshot(session, 31_000, "en")).toEqual({
      remainingText: "Time left 0:30",
      progress: 50
    });
    expect(activeSessionTimerValue(session, 31_000)).toBe("0:30");
  });

  it("presents internal intensity values with clear Korean and English labels", () => {
    expect(["soft", "medium", "hard"].map((value) => intensityLabel(value as Session["intensity"], "ko"))).toEqual([
      "가벼운 안내",
      "확인 후 허용",
      "완전 차단"
    ]);
    expect(["soft", "medium", "hard"].map((value) => intensityLabel(value as Session["intensity"], "en"))).toEqual([
      "Gentle reminder",
      "Confirm to continue",
      "Full block"
    ]);
  });

  it("localizes persisted growth events from stable event fields", () => {
    const event = {
      id: "completed",
      ts: 1,
      type: "session_completed",
      minutes: 25,
      xpDelta: 30,
      intensity: "medium",
      text: "25분 집중 완료"
    } as const;

    expect(localizedGrowthEventText(event, "ko")).toBe("25분 집중 완료 · +30 XP (25분 × 확인 후 허용)");
    expect(localizedGrowthEventText(event, "en")).toBe("25 min focus complete · +30 XP (25 min × Confirm to continue)");
  });
});
