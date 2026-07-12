import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../shared/types";
import {
  formatOptionsDate,
  formatOptionsNumber,
  formatScheduleTrigger,
  formatOptionsWeekDate,
  hasHistoryAccess,
  historyPermissionRowState,
  loadState,
  localizeOptionsRuntimeError,
  lockedOptionsCountdownText,
  modalFocusWrapIndex,
  nextOptionsView,
  persistedSiteListName,
  requestHistoryAccess,
  requestHistoryAnalysis,
  requestOnboardingReplay,
  stageSailingText,
  weeklyBarHeight
} from "./main";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("options keyboard and display helpers", () => {
  it("uses the correct Korean particle for each pet stage", () => {
    expect(stageSailingText("갓 태어난 돌고래", "ko")).toBe("갓 태어난 돌고래와 항해 중");
    expect(stageSailingText("아기 돌고래", "ko")).toBe("아기 돌고래와 항해 중");
    expect(stageSailingText("Newborn dolphin", "en")).toBe("Sailing with Newborn dolphin");
  });

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
    expect(nextOptionsView("review", "ArrowRight")).toBe("rules");
    expect(nextOptionsView("review", "ArrowLeft")).toBe("rules");
    expect(nextOptionsView("rules", "Home")).toBe("review");
    expect(nextOptionsView("review", "End")).toBe("rules");
    expect(nextOptionsView("rules", "Enter")).toBeNull();
    expect(nextOptionsView("preferences", "ArrowRight")).toBeNull();
  });

  it("derives compact rule names from stored schedule fields", () => {
    expect(formatScheduleTrigger({
      days: [1, 2, 3, 4, 5],
      startHHMM: "09:00",
      endHHMM: "12:00"
    }, "en")).toBe("Mon–Fri · 09:00–12:00");
    expect(formatScheduleTrigger({
      days: [0, 6],
      startHHMM: "10:00",
      endHHMM: "11:00"
    }, "ko")).toBe("토–일 · 10:00–11:00");
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

  it("formats dates and numbers with the selected UI locale", () => {
    const timestamp = Date.UTC(2026, 6, 11, 9, 30);
    expect(formatOptionsDate(timestamp, "ko")).toBe(new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp)));
    expect(formatOptionsDate(timestamp, "en")).toBe(new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp)));
    expect(formatOptionsDate(timestamp, "ko")).not.toBe(formatOptionsDate(timestamp, "en"));
    expect(formatOptionsWeekDate("2026-07-06", "ko")).not.toBe(formatOptionsWeekDate("2026-07-06", "en"));
    expect(formatOptionsWeekDate("not-a-date", "en")).toBe("not-a-date");
    expect(formatOptionsNumber(12_345, "en")).toBe("12,345");
  });

  it("preserves canonical defaults while leaving user-owned names untouched", () => {
    const defaultList = { id: "default-blocklist", name: "기본 차단 목록" };
    expect(persistedSiteListName(defaultList, "Default blocklist", "en")).toBe("기본 차단 목록");
    expect(persistedSiteListName(defaultList, "Deep work", "en")).toBe("Deep work");
    expect(persistedSiteListName({ id: "custom", name: "내 목록" }, "내 목록", "en")).toBe("내 목록");
    expect(persistedSiteListName({ id: "custom", name: "내 목록" }, "   ", "en")).toBe("List");
  });

  it("maps background configuration errors without leaking the source language", () => {
    const raw = "집중 세션 중에는 설정을 변경할 수 없습니다.";
    expect(localizeOptionsRuntimeError(raw, "Fallback", "en")).toBe(
      "Settings cannot be changed during a focus session."
    );
    expect(localizeOptionsRuntimeError(raw, "Fallback", "ko")).toBe(
      "집중 세션 중에는 설정을 변경할 수 없습니다."
    );
    expect(localizeOptionsRuntimeError("internal detail", "Safe fallback", "en")).toBe("Safe fallback");
    expect(localizeOptionsRuntimeError(
      "이 목록을 사용하는 자동 시작이 2개 있습니다. 먼저 자동 시작을 변경하거나 삭제해 주세요.",
      "Fallback",
      "en"
    )).toBe("2 schedules use this list. Change or delete them first.");

    const normalRuntimeErrors = [
      "가벼운 안내 대기 시간은 3초에서 60초 사이여야 합니다.",
      "집중 시간대의 시작과 종료를 올바르게 선택해 주세요.",
      "같은 차단 목록이 이미 존재합니다.",
      "변경할 차단 목록을 찾지 못했습니다. 화면을 새로고침해 주세요.",
      "삭제할 차단 목록을 찾지 못했습니다. 화면을 새로고침해 주세요.",
      "차단 목록은 하나 이상 필요합니다. 새 목록을 추가한 뒤 삭제해 주세요.",
      "같은 자동 시작이 이미 존재합니다.",
      "변경할 자동 시작을 찾지 못했습니다. 화면을 새로고침해 주세요.",
      "삭제할 자동 시작을 찾지 못했습니다. 화면을 새로고침해 주세요.",
      "차단 목록에 추가할 도메인을 확인하지 못했습니다.",
      "차단 목록 ID가 필요합니다.",
      "차단 목록 모드를 확인해 주세요.",
      "자동 시작 ID가 필요합니다.",
      "자동 시작에 사용할 차단 목록을 찾지 못했습니다.",
      "자동 시작의 시작과 종료 시간을 올바르게 선택해 주세요.",
      "자동 시작 요일을 하나 이상 선택해 주세요.",
      "자동 시작의 차단 방식을 확인해 주세요.",
      "방문 기록 권한을 허용해야 로컬 추천 분석을 시작할 수 있습니다.",
      "로컬 기록이 지워져 방문 기록 분석 결과를 저장하지 않았습니다.",
      "활성 세션이 끝난 뒤 로컬 기록을 지울 수 있습니다.",
      raw,
      "Too many domains for the reserved session DNR rule range.",
      "Too many temporary allow domains for the reserved DNR rule range."
    ];
    for (const runtimeError of normalRuntimeErrors) {
      const localized = localizeOptionsRuntimeError(runtimeError, "Fallback", "en");
      expect(localized).not.toBe("Fallback");
      expect(localized).not.toMatch(/[가-힣]/u);
      expect(localized).not.toBe(runtimeError);
    }
  });

  it("requests history only when local recommendation analysis is invoked", async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal("chrome", { permissions: { request } });

    await expect(requestHistoryAccess()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ permissions: ["history"] });
  });

  it("derives truthful history permission controls without requesting access", async () => {
    const contains = vi.fn(async () => false);
    const request = vi.fn(async () => true);
    vi.stubGlobal("chrome", { permissions: { contains, request } });

    await expect(hasHistoryAccess()).resolves.toBe(false);
    expect(contains).toHaveBeenCalledWith({ permissions: ["history"] });
    expect(request).not.toHaveBeenCalled();
    expect(historyPermissionRowState(false, false, false)).toEqual({
      statusKey: "historyPermissionNotGranted",
      analyzeDisabled: false,
      revokeDisabled: true
    });
    expect(historyPermissionRowState(true, false, false)).toEqual({
      statusKey: "historyPermissionGranted",
      analyzeDisabled: false,
      revokeDisabled: false
    });
    expect(historyPermissionRowState(true, true, false)).toEqual({
      statusKey: "historyPermissionGranted",
      analyzeDisabled: true,
      revokeDisabled: true
    });
  });

  it("delegates recommendation analysis to the background", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(requestHistoryAnalysis()).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledWith({ type: "ANALYZE_HISTORY" });
  });

  it("opens onboarding replay with the explicit replay flag", async () => {
    const create = vi.fn(async () => ({ id: 42 }));
    vi.stubGlobal("chrome", {
      runtime: { getURL: (path: string) => `chrome-extension://focuswhale/${path}` },
      tabs: { create }
    });

    await requestOnboardingReplay();

    expect(create).toHaveBeenCalledWith({
      url: "chrome-extension://focuswhale/src/pages/onboarding/index.html?replay=1"
    });
  });
});
