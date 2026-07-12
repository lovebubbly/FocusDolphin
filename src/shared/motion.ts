export type MotionPreset = "surface" | "hero" | "success";

const MOTION_PRESETS: Record<MotionPreset, { keyframes: Keyframe[]; options: KeyframeAnimationOptions }> = {
  surface: {
    keyframes: [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    options: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
  },
  hero: {
    keyframes: [
      { opacity: 0, transform: "translateY(6px) scale(0.985)" },
      { opacity: 1, transform: "translateY(0) scale(1)" }
    ],
    options: { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
  },
  success: {
    keyframes: [
      { opacity: 0.35, transform: "scale(0.94)" },
      { opacity: 1, transform: "scale(1)" }
    ],
    options: { duration: 320, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "both" }
  }
};

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function shouldAnimateSurface(
  previousKey: string | undefined,
  nextKey: string,
  reducedMotion = prefersReducedMotion()
): boolean {
  return !reducedMotion && previousKey !== nextKey;
}

export function playMotion(
  element: Element | null | undefined,
  preset: MotionPreset,
  reducedMotion = prefersReducedMotion()
): Animation | null {
  if (!element || reducedMotion || typeof element.animate !== "function") {
    return null;
  }

  const motion = MOTION_PRESETS[preset];
  return element.animate(motion.keyframes, motion.options);
}
