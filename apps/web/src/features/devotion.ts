export const DEVOTION_STEPS = ["pause", "read", "reflect", "pray", "act"] as const;

export type DevotionStep = (typeof DEVOTION_STEPS)[number];

export interface DevotionProgress {
  step: DevotionStep;
  index: number;
  total: number;
  done: boolean;
}

export function devotionProgress(step: DevotionStep): DevotionProgress {
  const index = DEVOTION_STEPS.indexOf(step);
  return {
    step,
    index: Math.max(0, index),
    total: DEVOTION_STEPS.length,
    done: index === DEVOTION_STEPS.length - 1,
  };
}

/** Advance to the next devotion step, or return null when already on the last. */
export function nextStep(current: DevotionStep): DevotionStep | null {
  const i = DEVOTION_STEPS.indexOf(current);
  if (i < 0 || i >= DEVOTION_STEPS.length - 1) return null;
  return DEVOTION_STEPS[i + 1] ?? null;
}
