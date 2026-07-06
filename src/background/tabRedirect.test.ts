import { describe, expect, it } from "vitest";
import { getBlockedTabRedirectUrl } from "./tabRedirect";
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
    expect(redirectFor("https://x.com/home")).toBe(`${blockedPageUrl}?d=x.com`);
  });

  it("redirects twitter aliases to the current host name", () => {
    expect(redirectFor("https://mobile.twitter.com/home")).toBe(`${blockedPageUrl}?d=mobile.twitter.com`);
  });

  it("does not redirect soft sessions because the content overlay handles them", () => {
    expect(redirectFor("https://x.com/home", { session: { ...session, intensity: "soft" } })).toBeNull();
  });

  it("honors temporary allows for x.com aliases", () => {
    expect(redirectFor("https://x.com/home", { tempAllows: [{ domain: "twitter.com", until: now + 1 }] })).toBeNull();
  });

  it("ignores non-http urls and unlisted domains", () => {
    expect(redirectFor("chrome://extensions")).toBeNull();
    expect(redirectFor("https://example.com")).toBeNull();
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
