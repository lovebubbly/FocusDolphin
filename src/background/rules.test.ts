import { describe, expect, it, vi } from "vitest";
import type { SiteList, TempAllow } from "../shared/types";
import {
  SESSION_RULE_IDS,
  TEMP_ALLOW_RULE_IDS,
  applySessionRules,
  compileRules,
  compileTempAllowRules,
  domainMatches
} from "./rules";

describe("compileRules", () => {
  it("creates blocklist redirect rules for medium and hard sessions", () => {
    const list: SiteList = {
      id: "work",
      name: "Work",
      mode: "blocklist",
      domains: ["Example.com", "https://news.example/path"]
    };

    expect(compileRules(list, "soft")).toEqual([]);

    const rules = compileRules(list, "medium");

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      id: 1,
      priority: 10,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/src/pages/blocked/index.html?d=example.com" }
      },
      condition: {
        urlFilter: "||example.com^",
        resourceTypes: ["main_frame"]
      }
    });
    expect(rules[1]?.condition.urlFilter).toBe("||news.example^");
  });

  it("creates allowlist catch-all redirect plus high-priority allow rules", () => {
    const list: SiteList = {
      id: "allowed",
      name: "Allowed",
      mode: "allowlist",
      domains: ["docs.example", "mail.example"]
    };

    const rules = compileRules(list, "hard");

    expect(rules).toHaveLength(3);
    expect(rules[0]).toMatchObject({
      id: 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/src/pages/blocked/index.html" }
      },
      condition: {
        urlFilter: "*",
        resourceTypes: ["main_frame"]
      }
    });
    expect(rules.slice(1).map((rule) => rule.action.type)).toEqual(["allow", "allow"]);
    expect(rules.slice(1).map((rule) => rule.priority)).toEqual([100, 100]);
  });

  it("expands X and Twitter aliases into domain-anchored DNR filters", () => {
    const list: SiteList = {
      id: "work",
      name: "Work",
      mode: "blocklist",
      domains: ["x.com", "twitter.com"]
    };

    const rules = compileRules(list, "medium");

    expect(rules).toHaveLength(2);
    expect(rules[0]?.condition.regexFilter).toBe("^https?://([^/?#]+\\.)?x\\.com(:[0-9]+)?([/?#]|$)");
    expect(rules[1]?.condition.urlFilter).toBe("||twitter.com^");
    expect(rules[0]?.action.redirect).toEqual({ extensionPath: "/src/pages/blocked/index.html?d=x.com" });
    expect(rules[1]?.action.redirect).toEqual({ extensionPath: "/src/pages/blocked/index.html?d=x.com" });
  });

  it("matches X and Twitter aliases for soft overlay decisions", () => {
    expect(domainMatches("mobile.twitter.com", "x.com")).toBe(true);
    expect(domainMatches("www.x.com", "twitter.com")).toBe(true);
    expect(domainMatches("notx.com", "x.com")).toBe(false);
  });
});

describe("compileTempAllowRules", () => {
  it("creates only active temporary allow rules in the 1000 range", () => {
    const tempAllows: TempAllow[] = [
      { domain: "example.com", until: 2_000 },
      { domain: "expired.example", until: 500 },
      { domain: "https://mail.example/path", until: 3_000 }
    ];

    const rules = compileTempAllowRules(tempAllows, 1_000);

    expect(rules).toHaveLength(2);
    expect(rules.map((rule) => rule.id)).toEqual([1000, 1001]);
    expect(rules.map((rule) => rule.priority)).toEqual([200, 200]);
    expect(rules.map((rule) => rule.condition.urlFilter)).toEqual(["||example.com^", "||mail.example^"]);
  });

  it("uses a regex temporary allow rule for x.com to match the redirect rule shape", () => {
    const rules = compileTempAllowRules([{ domain: "x.com", until: 2_000 }], 1_000);

    expect(rules).toHaveLength(2);
    expect(rules[0]?.condition.regexFilter).toBe("^https?://([^/?#]+\\.)?x\\.com(:[0-9]+)?([/?#]|$)");
    expect(rules[1]?.condition.urlFilter).toBe("||twitter.com^");
  });
});

describe("DNR rule client boundary", () => {
  it("applies session rules through the DynamicRuleClient interface", async () => {
    const updateDynamicRules = vi.fn(async () => undefined);
    const rules = compileRules(
      { id: "work", name: "Work", mode: "blocklist", domains: ["example.com"] },
      "medium"
    );

    await applySessionRules({ updateDynamicRules }, rules);

    expect(updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: SESSION_RULE_IDS,
      addRules: rules
    });
    expect(TEMP_ALLOW_RULE_IDS[0]).toBe(1000);
  });
});
