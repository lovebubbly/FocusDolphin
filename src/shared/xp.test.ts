import { describe, expect, it } from "vitest";
import { stageForXp, xpForSession } from "./xp";

describe("xpForSession", () => {
  it("calculates rounded XP by intensity", () => {
    expect(xpForSession(25, "soft")).toBe(25);
    expect(xpForSession(25, "medium")).toBe(30);
    expect(xpForSession(25, "hard")).toBe(38);
  });

  it("does not return negative XP", () => {
    expect(xpForSession(-10, "hard")).toBe(0);
  });
});

describe("stageForXp", () => {
  it("handles stage boundaries", () => {
    expect(stageForXp(0)).toBe(0);
    expect(stageForXp(299)).toBe(0);
    expect(stageForXp(300)).toBe(1);
    expect(stageForXp(1_499)).toBe(1);
    expect(stageForXp(1_500)).toBe(2);
    expect(stageForXp(4_999)).toBe(2);
    expect(stageForXp(5_000)).toBe(3);
    expect(stageForXp(11_999)).toBe(3);
    expect(stageForXp(12_000)).toBe(4);
  });
});
