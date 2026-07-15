import { describe, expect, it } from "vitest";
import { activeSoftAllows, grantSoftAllow, hasSoftAllow } from "./softAllow";

describe("soft overlay session allowances", () => {
  it("survives document navigation for the same session and hostname", () => {
    const ledger = grantSoftAllow({}, "session-1", "youtube.com", 20_000, 10_000);

    expect(hasSoftAllow(ledger, "session-1", "youtube.com", 15_000)).toBe(true);
    expect(hasSoftAllow(ledger, "session-1", "m.youtube.com", 15_000)).toBe(false);
    expect(hasSoftAllow(ledger, "session-2", "youtube.com", 15_000)).toBe(false);
  });

  it("drops expired and malformed entries", () => {
    expect(activeSoftAllows({
      expired: 9_999,
      active: 20_000,
      malformed: "later"
    }, 10_000)).toEqual({ active: 20_000 });
  });
});
