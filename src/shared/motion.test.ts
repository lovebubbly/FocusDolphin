import { describe, expect, it, vi } from "vitest";
import { playMotion, shouldAnimateSurface } from "./motion";

describe("surface motion policy", () => {
  it("animates only when the semantic surface changes", () => {
    expect(shouldAnimateSurface(undefined, "idle", false)).toBe(true);
    expect(shouldAnimateSurface("idle", "idle", false)).toBe(false);
    expect(shouldAnimateSurface("idle", "active:session-1", false)).toBe(true);
  });

  it("keeps every semantic transition still in reduced-motion mode", () => {
    expect(shouldAnimateSurface("idle", "active:session-1", true)).toBe(false);
  });

  it("never calls the compositor when motion is reduced or unavailable", () => {
    const animate = vi.fn((
      _keyframes: Keyframe[] | PropertyIndexedKeyframes,
      _options?: number | KeyframeAnimationOptions
    ) => ({}) as Animation);
    const element = { animate } as unknown as Element;

    expect(playMotion(element, "surface", true)).toBeNull();
    expect(animate).not.toHaveBeenCalled();
    expect(playMotion({} as Element, "surface", false)).toBeNull();
  });

  it("uses transform-and-opacity keyframes for available surfaces", () => {
    const animation = {} as Animation;
    const animate = vi.fn((
      _keyframes: Keyframe[] | PropertyIndexedKeyframes,
      _options?: number | KeyframeAnimationOptions
    ) => animation);
    const element = { animate } as unknown as Element;

    expect(playMotion(element, "hero", false)).toBe(animation);
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0]?.[0]).toEqual([
      { opacity: 0, transform: "translateY(6px) scale(0.985)" },
      { opacity: 1, transform: "translateY(0) scale(1)" }
    ]);
  });
});
