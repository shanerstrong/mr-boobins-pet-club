import {
  DEFAULT_CLOCK_MULTIPLIER,
  advancePet,
  giveMedicine,
  isSleeping,
  type PetState,
} from "./simulation";

export type HealthBand =
  | "great"
  | "needs-care"
  | "unwell"
  | "very-unwell";

export type HealthPlayerIntent = "status" | "medicine";

export type HealthIntentBlockReason =
  | null
  | "dead"
  | "sleeping"
  | "care-locked"
  | "care-unreachable"
  | "healthy";

export type StatusRecommendationIntent =
  | "medicine"
  | "feed"
  | "clean"
  | "play"
  | "rest"
  | "well";

export type StatusRecommendation = {
  intent: StatusRecommendationIntent;
  label: string;
  message: string;
};

export function getHealthBand(health: number): HealthBand {
  if (health >= 80) return "great";
  if (health >= 50) return "needs-care";
  if (health > 0) return "unwell";
  return "very-unwell";
}

export const healthBandLabels: Record<HealthBand, string> = {
  great: "Great",
  "needs-care": "Needs Care",
  unwell: "Unwell",
  "very-unwell": "Very Unwell",
};

export function getStatusRecommendation(pet: PetState): StatusRecommendation {
  if (pet.needs.health < 50) {
    return {
      intent: "medicine",
      label: "Medicine",
      message: "Jack feels unwell. Give medicine first.",
    };
  }
  if (pet.needs.hunger <= 20) {
    return { intent: "feed", label: "Feed", message: "Jack needs food first." };
  }
  if (pet.needs.hygiene <= 35) {
    return {
      intent: "clean",
      label: "Clean",
      message: "Jack needs a gentle clean.",
    };
  }
  if (pet.needs.attention <= 35) {
    return {
      intent: "play",
      label: "Play",
      message: "Jack needs your attention. Play together.",
    };
  }
  if (pet.needs.energy <= 25) {
    return { intent: "rest", label: "Rest", message: "Jack needs a rest." };
  }
  if (pet.needs.happiness <= 30) {
    return { intent: "play", label: "Play", message: "A little play would help." };
  }
  return { intent: "well", label: "All good", message: "Jack is doing well." };
}

export function getMedicineAvailability({
  pet,
  careLocked,
  careReachable,
}: {
  pet: PetState;
  careLocked: boolean;
  careReachable: boolean;
}): { available: boolean; reason: HealthIntentBlockReason; message: string } {
  if (pet.isDead) {
    return { available: false, reason: "dead", message: "Medicine cannot change Jack’s ended story." };
  }
  if (isSleeping(pet)) {
    return { available: false, reason: "sleeping", message: "Wake Jack before giving medicine." };
  }
  if (careLocked) {
    return { available: false, reason: "care-locked", message: "Finish the current care action first." };
  }
  if (!careReachable) {
    return { available: false, reason: "care-unreachable", message: "Return to Jack’s room before giving medicine." };
  }
  if (pet.needs.health >= 80) {
    return { available: false, reason: "healthy", message: "Jack does not need medicine right now." };
  }
  return { available: true, reason: null, message: "Medicine can help Jack feel better." };
}

export function resolveHealthPlayerIntent({
  pet,
  intent,
  now,
  careLocked = false,
  careReachable = true,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
}: {
  pet: PetState;
  intent: HealthPlayerIntent;
  now: number;
  careLocked?: boolean;
  careReachable?: boolean;
  multiplier?: number;
}): {
  pet: PetState;
  allowed: boolean;
  reason: HealthIntentBlockReason;
  mutated: boolean;
} {
  if (intent === "status") {
    return { pet, allowed: true, reason: null, mutated: false };
  }
  const current = advancePet(pet, now, multiplier);
  const availability = getMedicineAvailability({
    pet: current,
    careLocked,
    careReachable,
  });
  if (!availability.available) {
    return {
      pet: current,
      allowed: false,
      reason: availability.reason,
      mutated: false,
    };
  }
  return {
    pet: giveMedicine(current, now, multiplier),
    allowed: true,
    reason: null,
    mutated: true,
  };
}
