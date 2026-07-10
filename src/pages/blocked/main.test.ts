import { describe, expect, it } from "vitest";
import type { Session } from "../../shared/types";
import {
  blockedPagePresentation,
  originalHttpUrlFromHash,
  shouldPreserveTemporaryAllowView,
  shouldRefreshBlockedPage,
  tempAllowFailureMarkup,
  temporaryAllowCountdown
} from "./main";

describe("blocked page runtime updates", () => {
  it("refreshes for active-session and emergency changes only in local storage", () => {
    const activeChange = { activeSession: { oldValue: null, newValue: { id: "session" } } };
    const emergencyChange = { pendingEmergency: { oldValue: null, newValue: { dueAt: 123 } } };

    expect(shouldRefreshBlockedPage(activeChange, "local")).toBe(true);
    expect(shouldRefreshBlockedPage(emergencyChange, "local")).toBe(true);
    expect(shouldRefreshBlockedPage(activeChange, "sync")).toBe(false);
    expect(shouldRefreshBlockedPage({ unrelated: { newValue: true } }, "local")).toBe(false);
  });
});

describe("blocked page state guards", () => {
  it("does not present a GET_STATE failure as an ended session", () => {
    expect(blockedPagePresentation(null, false)).toEqual({
      heading: "세션 상태를 확인하지 못했습니다",
      remaining: "확인 필요"
    });
    expect(blockedPagePresentation(null, true)).toEqual({
      heading: "집중 세션이 종료되었습니다",
      remaining: "세션 없음"
    });
  });

  it("preserves a temporary-allow action only for the same active medium session", () => {
    const session = mediumSession("same-session");

    expect(shouldPreserveTemporaryAllowView("same-session", session)).toBe(true);
    expect(shouldPreserveTemporaryAllowView("other-session", session)).toBe(false);
    expect(shouldPreserveTemporaryAllowView("same-session", { ...session, intensity: "hard" })).toBe(false);
    expect(shouldPreserveTemporaryAllowView("same-session", { ...session, status: "completed" })).toBe(false);
    expect(shouldPreserveTemporaryAllowView("same-session", null)).toBe(false);
  });

  it("keeps failed temporary allows recoverable", () => {
    const markup = tempAllowFailureMarkup();

    expect(markup).toContain('id="retry-allow-button"');
    expect(markup).toContain("다시 시도");
    expect(markup).toContain('id="back-button"');
    expect(markup).toContain("집중으로 돌아가기");
  });
});

describe("temporary allow countdown", () => {
  it("derives time from the deadline and announces only availability", () => {
    const availableAt = 30_000;

    expect(temporaryAllowCountdown(availableAt, 0)).toEqual({
      available: false,
      visualText: "0:30",
      announcement: ""
    });
    expect(temporaryAllowCountdown(availableAt, 25_500)).toEqual({
      available: false,
      visualText: "0:05",
      announcement: ""
    });
    expect(temporaryAllowCountdown(availableAt, 30_000)).toEqual({
      available: true,
      visualText: "5분 임시 허용",
      announcement: "이제 5분 임시 허용을 요청할 수 있습니다."
    });
  });
});

describe("blocked page return target", () => {
  it("preserves the HTTP(S) path while removing sensitive URL parameters", () => {
    expect(originalHttpUrlFromHash("#https://x.com/some/path?query=1")).toBe(
      "https://x.com/some/path"
    );
    expect(originalHttpUrlFromHash("#https://user:secret@example.com/docs#token")).toBe(
      "https://example.com/docs"
    );
  });

  it("rejects non-web and malformed return targets", () => {
    expect(originalHttpUrlFromHash("#javascript:alert(1)")).toBeNull();
    expect(originalHttpUrlFromHash("#not a url")).toBeNull();
  });
});

function mediumSession(id: string): Session {
  return {
    id,
    source: "manual",
    listId: "default",
    intensity: "medium",
    startedAt: 0,
    endsAt: 60_000,
    status: "active",
    snoozeCount: 0,
    nextSnoozeDelayMin: 15
  };
}
