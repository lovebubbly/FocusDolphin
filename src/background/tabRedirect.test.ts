import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBlockedTabRedirectUrl,
  redirectOpenBlockedTabs,
  redirectTabIfBlocked
} from "./tabRedirect";
import type { Session, SiteList, TempAllow } from "../shared/types";

const now = 1_000;
const blockedPageUrl = "chrome-extension://focuswhale/src/pages/blocked/index.html";
const session: Session = {
  id: "session",
  source: "manual",
  listId: "default-blocklist",
  intensity: "medium",
  startedAt: now,
  endsAt: now + 60_000,
  status: "active",
  snoozeCount: 0,
  nextSnoozeDelayMin: 15
};
const siteList: SiteList = {
  id: "default-blocklist",
  name: "기본 차단 목록",
  mode: "blocklist",
  domains: ["youtube.com", "instagram.com", "x.com", "twitter.com"]
};

describe("getBlockedTabRedirectUrl", () => {
  it("redirects x.com tabs during medium or hard sessions", () => {
    expect(redirectFor("https://x.com/home")).toBe(`${blockedPageUrl}#https://x.com/home`);
  });

  it("preserves the path for twitter aliases without retaining query data", () => {
    expect(redirectFor("https://mobile.twitter.com/home?tab=latest")).toBe(
      `${blockedPageUrl}#https://mobile.twitter.com/home`
    );
  });

  it("does not redirect soft sessions because the content overlay handles them", () => {
    expect(redirectFor("https://x.com/home", { session: { ...session, intensity: "soft" } })).toBeNull();
  });

  it("honors temporary allows for x.com aliases", () => {
    expect(redirectFor("https://x.com/home", {
      tempAllows: [{ sessionId: session.id, domain: "twitter.com", until: now + 1 }]
    })).toBeNull();
  });

  it("ignores non-http urls and unlisted domains", () => {
    expect(redirectFor("chrome://extensions")).toBeNull();
    expect(redirectFor("https://example.com")).toBeNull();
  });
});

describe("tab redirect races", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a failed tab enumeration as best-effort work", async () => {
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockRejectedValue(new Error("browser is closing")) }
    });

    await expect(redirectOpenBlockedTabs(now)).resolves.toBeUndefined();
  });

  it("does not reject when a matching tab closes before the update", async () => {
    const update = vi.fn().mockRejectedValue(new Error("No tab with id: 7"));
    const localValues: Record<string, unknown> = {
      activeSession: session,
      tempAllows: []
    };
    const syncValues: Record<string, unknown> = {
      siteLists: [siteList]
    };
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://focuswhale/${path}`
      },
      storage: {
        local: { get: async (key: string) => ({ [key]: localValues[key] }) },
        sync: { get: async (key: string) => ({ [key]: syncValues[key] }) }
      },
      tabs: { update }
    });

    await expect(redirectTabIfBlocked(7, "https://x.com/home", now)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(7, { url: `${blockedPageUrl}#https://x.com/home` });
  });
});

function redirectFor(
  pageUrl: string,
  overrides: Partial<{ session: Session | null; siteList: SiteList; tempAllows: TempAllow[] }> = {}
): string | null {
  return getBlockedTabRedirectUrl(pageUrl, {
    session: overrides.session === undefined ? session : overrides.session,
    siteList: overrides.siteList ?? siteList,
    tempAllows: overrides.tempAllows ?? [],
    now,
    blockedPageUrl
  });
}
