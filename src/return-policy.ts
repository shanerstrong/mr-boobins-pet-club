import type { NeedKey, PetState } from "./simulation";

export const RETURN_SUMMARY_MIN_REAL_MS = 5 * 60 * 1000;

const needCopy: Record<NeedKey, { label: string; action: string }> = {
  hunger: { label: "hunger", action: "Feed Jack first." },
  happiness: { label: "happiness", action: "A little play would help." },
  energy: { label: "energy", action: "Let Jack rest soon." },
  hygiene: { label: "hygiene", action: "A gentle clean would help." },
  health: { label: "health", action: "Check Status and give medicine if needed." },
  attention: { label: "attention", action: "Spend a little time playing together." },
};

const needPriority: NeedKey[] = [
  "health",
  "hunger",
  "hygiene",
  "attention",
  "energy",
  "happiness",
];

export function getLowestNeed(needs: PetState["needs"]): NeedKey {
  return needPriority.reduce((lowest, key) =>
    needs[key] < needs[lowest] ? key : lowest,
  );
}

/**
 * Builds a concise, action-oriented message for a returning player.
 * It is presentation-only and never changes pet state.
 */
export function getReturnSummary({
  before,
  after,
  elapsedRealMs,
}: {
  before: PetState;
  after: PetState;
  elapsedRealMs: number;
}): string | null {
  if (
    !before.adoptionCompleted ||
    !Number.isFinite(elapsedRealMs) ||
    elapsedRealMs < RETURN_SUMMARY_MIN_REAL_MS
  ) {
    return null;
  }

  if (after.isDead) return null;

  if (after.sleepUntilVirtualMinutes !== null) {
    return "Welcome back! Jack is still resting. You can let him sleep or wake him gently.";
  }

  const lowest = getLowestNeed(after.needs);
  const copy = needCopy[lowest];
  const value = Math.round(after.needs[lowest]);

  if (value <= 20) {
    return `Welcome back! Jack’s ${copy.label} is very low. ${copy.action}`;
  }
  if (value <= 45) {
    return `Welcome back! Jack could use some care: ${copy.label} is ${value}%. ${copy.action}`;
  }
  return `Welcome back! Jack is doing well. His lowest need is ${copy.label} at ${value}%.`;
}
