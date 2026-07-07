import { describe, expect, it } from "vitest";
import { stageForXp, xpForSession } from "./xp";

describe("xpForSession", () => {
  it("calculates floored XP by intensity", () => {
    expect(xpForSession(25, "soft")).toBe(25);
    expect(xpForSession(25, "medium")).toBe(30);
    expect(xpForSession(25, "hard")).toBe(37);
  });

  it("does not return negative XP", () => {
    expect(xpForSession(-10, "hard")).toBe(0);
  });
});

describe("stageForXp", () => {
  it("handles stage boundaries", () => {
    expect(stageForXp(0)).toBe(0);
    expect(stageForXp(99)).toBe(0);
    expect(stageForXp(100)).toBe(1);
    expect(stageForXp(599)).toBe(1);
    expect(stageForXp(600)).toBe(2);
    expect(stageForXp(1_999)).toBe(2);
    expect(stageForXp(2_000)).toBe(3);
    expect(stageForXp(5_999)).toBe(3);
    expect(stageForXp(6_000)).toBe(4);
  });
});
