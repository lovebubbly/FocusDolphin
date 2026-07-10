import { describe, expect, it, vi } from "vitest";
import type { SiteList, TempAllow } from "../shared/types";
import {
  SESSION_RULE_IDS,
  SESSION_RULE_CAPACITY,
  TEMP_ALLOW_RULE_IDS,
  TEMP_ALLOW_RULE_CAPACITY,
  applySessionRules,
  compileRules,
  compileTempAllowRules,
  domainMatches,
  sanitizeHttpReturnUrl
} from "./rules";

describe("compileRules", () => {
  const blockedPageUrl = "chrome-extension://focuswhale/src/pages/blocked/index.html";

  it("creates blocklist redirect rules for medium and hard sessions", () => {
    const list: SiteList = {
      id: "work",
      name: "Work",
      mode: "blocklist",
      domains: ["Example.com", "https://news.example/path"]
    };

    expect(compileRules(list, "soft")).toEqual([]);

    const rules = compileRules(list, "medium", blockedPageUrl);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      id: 1,
      priority: 10,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: `${blockedPageUrl}#\\1://\\2\\3` }
      },
      condition: {
        regexFilter: "^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?example\\.com\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$",
        resourceTypes: ["main_frame"]
      }
    });
    expect(rules[1]?.condition.regexFilter).toBe("^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?news\\.example\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$");
  });

  it("creates allowlist catch-all redirect plus high-priority allow rules", () => {
    const list: SiteList = {
      id: "allowed",
      name: "Allowed",
      mode: "allowlist",
      domains: ["docs.example", "mail.example"]
    };

    const rules = compileRules(list, "hard", blockedPageUrl);

    expect(rules).toHaveLength(3);
    expect(rules[0]).toMatchObject({
      id: 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: `${blockedPageUrl}#\\1://\\2\\3` }
      },
      condition: {
        regexFilter: "^(https?)://(?:[^/?#@]*@)?([^/?#@]+)(/[^?#]*)?(?:[?#].*)?$",
        resourceTypes: ["main_frame"]
      }
    });
    expect(rules.slice(1).map((rule) => rule.action.type)).toEqual(["allow", "allow"]);
    expect(rules.slice(1).map((rule) => rule.priority)).toEqual([100, 100]);
    expect(new RegExp(rules[1]?.condition.regexFilter ?? "").test("https://docs.example./path")).toBe(true);
  });

  it("expands X and Twitter aliases into domain-anchored DNR filters", () => {
    const list: SiteList = {
      id: "work",
      name: "Work",
      mode: "blocklist",
      domains: ["x.com", "twitter.com"]
    };

    const rules = compileRules(list, "medium", blockedPageUrl);

    expect(rules).toHaveLength(2);
    expect(rules[0]?.condition.regexFilter).toBe("^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?x\\.com\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$");
    expect(rules[1]?.condition.regexFilter).toBe("^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?twitter\\.com\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$");
    expect(rules[0]?.action.redirect).toEqual({ regexSubstitution: `${blockedPageUrl}#\\1://\\2\\3` });
    expect(rules[1]?.action.redirect).toEqual({ regexSubstitution: `${blockedPageUrl}#\\1://\\2\\3` });
  });

  it("matches X and Twitter aliases for soft overlay decisions", () => {
    expect(domainMatches("mobile.twitter.com", "x.com")).toBe(true);
    expect(domainMatches("www.x.com", "twitter.com")).toBe(true);
    expect(domainMatches("x.com", "https://x.com:443/path")).toBe(true);
    expect(domainMatches("x.com.", "x.com:8443")).toBe(true);
    expect(domainMatches("notx.com", "x.com")).toBe(false);
  });

  it("strips credentials, query strings, and fragments from return URLs", () => {
    expect(sanitizeHttpReturnUrl("https://user:secret@x.com/path?token=1#private")).toBe("https://x.com/path");
    expect(sanitizeHttpReturnUrl("javascript:alert(1)")).toBeNull();
  });

  it("captures only the sanitized authority when a blocked URL contains userinfo", () => {
    const blocklistRule = compileRules(
      { id: "work", name: "Work", mode: "blocklist", domains: ["x.com"] },
      "hard",
      blockedPageUrl
    )[0];
    const allowlistRule = compileRules(
      { id: "allowed", name: "Allowed", mode: "allowlist", domains: [] },
      "hard",
      blockedPageUrl
    )[0];

    expect(capturedReturnUrl(blocklistRule, "https://user:secret@x.com/home?token=1#private"))
      .toBe("https://x.com/home");
    expect(capturedReturnUrl(allowlistRule, "https://user:secret@example.com:8443/path?token=1#private"))
      .toBe("https://example.com:8443/path");
    expect(capturedReturnUrl(blocklistRule, "https://x.com./home"))
      .toBe("https://x.com./home");
  });

  it("reserves regex capacity for temporary allows before touching DNR", () => {
    const oversizedList: SiteList = {
      id: "oversized",
      name: "Oversized",
      mode: "blocklist",
      domains: Array.from({ length: SESSION_RULE_CAPACITY + 1 }, (_, index) => `d${index}.example`)
    };
    const oversizedAllows: TempAllow[] = Array.from(
      { length: TEMP_ALLOW_RULE_CAPACITY + 1 },
      (_, index) => ({ sessionId: "session", domain: `a${index}.example`, until: 2_000 })
    );

    expect(() => compileRules(oversizedList, "hard", blockedPageUrl)).toThrow("Too many domains");
    expect(() => compileTempAllowRules(oversizedAllows, 1_000)).toThrow("Too many temporary allow domains");
    expect(SESSION_RULE_CAPACITY + TEMP_ALLOW_RULE_CAPACITY).toBe(1_000);
    expect(SESSION_RULE_IDS.at(-1)).toBe(999);
    expect(TEMP_ALLOW_RULE_IDS.at(-1)).toBe(1_999);
  });
});

describe("compileTempAllowRules", () => {
  it("creates only active temporary allow rules in the 1000 range", () => {
    const tempAllows: TempAllow[] = [
      { sessionId: "session", domain: "example.com", until: 2_000 },
      { sessionId: "session", domain: "expired.example", until: 500 },
      { sessionId: "session", domain: "https://mail.example/path", until: 3_000 }
    ];

    const rules = compileTempAllowRules(tempAllows, 1_000);

    expect(rules).toHaveLength(2);
    expect(rules.map((rule) => rule.id)).toEqual([1000, 1001]);
    expect(rules.map((rule) => rule.priority)).toEqual([200, 200]);
    expect(rules.map((rule) => rule.condition.regexFilter)).toEqual([
      "^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?example\\.com\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$",
      "^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?mail\\.example\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$"
    ]);
    expect(new RegExp(rules[0]?.condition.regexFilter ?? "").test("https://example.com./path")).toBe(true);
  });

  it("uses a regex temporary allow rule for x.com to match the redirect rule shape", () => {
    const rules = compileTempAllowRules([{ sessionId: "session", domain: "x.com", until: 2_000 }], 1_000);

    expect(rules).toHaveLength(2);
    expect(rules[0]?.condition.regexFilter).toBe("^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?x\\.com\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$");
    expect(rules[1]?.condition.regexFilter).toBe("^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?twitter\\.com\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$");
  });
});

function capturedReturnUrl(rule: chrome.declarativeNetRequest.Rule, pageUrl: string): string | null {
  const regexFilter = rule.condition.regexFilter;
  if (!regexFilter) {
    return null;
  }

  const match = new RegExp(regexFilter).exec(pageUrl);
  return match ? `${match[1]}://${match[2]}${match[3] ?? ""}` : null;
}

describe("DNR rule client boundary", () => {
  it("applies session rules through the DynamicRuleClient interface", async () => {
    const updateDynamicRules = vi.fn(async () => undefined);
    const rules = compileRules(
      { id: "work", name: "Work", mode: "blocklist", domains: ["example.com"] },
      "medium",
      "chrome-extension://focuswhale/src/pages/blocked/index.html"
    );

    await applySessionRules({ updateDynamicRules }, rules);

    expect(updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: SESSION_RULE_IDS,
      addRules: rules
    });
    expect(TEMP_ALLOW_RULE_IDS[0]).toBe(1000);
  });
});
