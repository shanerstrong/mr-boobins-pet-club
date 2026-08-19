import type { DogEmote, TrainingVisualAction } from "./pixel-dog";
import {
  getHealthBand,
  getMedicineAvailability,
  getStatusRecommendation,
  healthBandLabels,
  type HealthBand,
  type HealthIntentBlockReason,
  type StatusRecommendationIntent,
} from "./pet-care-policy";
import {
  getGrowthStage,
  getHygieneAppearance,
  getVirtualClock,
  isSleeping,
  type CleaningPhase,
  type Daypart,
  type GrowthStage,
  type HygieneAppearance,
  type NeedKey,
  type PetState,
  type RoomTheme,
} from "./simulation";

export const PRESENTATION_MODES = ["three-d", "color-pixel", "lcd"] as const;
export type PresentationMode = (typeof PRESENTATION_MODES)[number];

export const DEFAULT_PRESENTATION_MODE: PresentationMode = "three-d";
export const PRESENTATION_MODE_PERSISTED = false;
export const PRESENTATION_MODE_MIN_TARGET_PX = 44;

export const PRESENTATION_MODE_LABELS: Readonly<
  Record<PresentationMode, string>
> = Object.freeze({
  "three-d": "3D",
  "color-pixel": "Color Pixel",
  lcd: "LCD",
});

export type PresentationRendererKind = PresentationMode;

export const PET_PRESENTATION_NEED_ORDER = Object.freeze([
  "hunger",
  "happiness",
  "energy",
  "hygiene",
  "health",
  "attention",
] as const satisfies readonly NeedKey[]);

const needLabels: Readonly<Record<NeedKey, string>> = Object.freeze({
  hunger: "Hunger",
  happiness: "Happiness",
  energy: "Energy",
  hygiene: "Hygiene",
  health: "Health",
  attention: "Attention",
});

export type PetPresentationActivity =
  | "idle"
  | "sleep"
  | "feed"
  | "play"
  | "clean"
  | "training"
  | "reward"
  | "dirty"
  | "tired"
  | "health-warning"
  | "attention-warning"
  | "medicine"
  | "death";

export type PetPresentationWarning =
  | "health"
  | "attention"
  | "hunger"
  | "hygiene"
  | "energy";

export type PetPresentationNeed = Readonly<{
  key: NeedKey;
  label: string;
  shortLabel: string;
  value: number;
  warning: boolean;
}>;

export type PetPresentationModel = Readonly<{
  schemaVersion: 1;
  sourcePetVersion: 7;
  petId: string;
  name: string;
  stage: GrowthStage;
  roomTheme: RoomTheme;
  clock: Readonly<{
    day: number;
    daypart: Daypart;
    label: string;
  }>;
  needs: readonly PetPresentationNeed[];
  healthBand: Readonly<{
    id: HealthBand;
    label: string;
  }>;
  recommendation: Readonly<{
    intent: StatusRecommendationIntent;
    label: string;
    message: string;
  }>;
  medicine: Readonly<{
    available: boolean;
    reason: HealthIntentBlockReason;
    message: string;
  }>;
  warnings: readonly PetPresentationWarning[];
  activity: PetPresentationActivity;
  sleeping: boolean;
  dead: boolean;
  reducedMotion: boolean;
  hygieneAppearance: HygieneAppearance;
  visual: Readonly<{
    emote: DogEmote;
    cleaningPhase: CleaningPhase | null;
    trainingAction: TrainingVisualAction;
    trainingTreatVisible: boolean;
    tired: boolean;
    lowHappiness: boolean;
  }>;
}>;

export type PetPresentationInput = Readonly<{
  pet: PetState;
  emote: DogEmote;
  cleaningPhase: CleaningPhase | null;
  trainingAction: TrainingVisualAction;
  trainingTreatVisible: boolean;
  medicineFeedback: boolean;
  careLocked: boolean;
  careReachable: boolean;
  reducedMotion: boolean;
}>;

const rewardActions = new Set<TrainingVisualAction>([
  "eating",
  "happy-hop",
  "spin-wag",
  "goofy-shimmy",
]);

function resolveWarnings(pet: PetState): readonly PetPresentationWarning[] {
  const warnings: PetPresentationWarning[] = [];
  if (pet.needs.health < 50) warnings.push("health");
  if (pet.needs.attention <= 35) warnings.push("attention");
  if (pet.needs.hunger <= 20) warnings.push("hunger");
  if (pet.needs.hygiene <= 35) warnings.push("hygiene");
  if (pet.needs.energy <= 25) warnings.push("energy");
  return Object.freeze(warnings);
}

export function resolvePetPresentationActivity({
  pet,
  emote,
  cleaningPhase,
  trainingAction,
  trainingTreatVisible,
  medicineFeedback,
}: Pick<
  PetPresentationInput,
  | "pet"
  | "emote"
  | "cleaningPhase"
  | "trainingAction"
  | "trainingTreatVisible"
  | "medicineFeedback"
>): PetPresentationActivity {
  if (pet.isDead) return "death";
  if (isSleeping(pet)) return "sleep";
  if (cleaningPhase || emote === "cleaning") return "clean";
  if (medicineFeedback) return "medicine";
  if (trainingTreatVisible || rewardActions.has(trainingAction)) return "reward";
  if (trainingAction) return "training";
  if (emote === "feeding" || emote === "fed") return "feed";
  if (emote === "toy") return "play";
  if (pet.needs.health < 50) return "health-warning";
  if (pet.needs.attention <= 35) return "attention-warning";
  if (getHygieneAppearance(pet.needs.hygiene) !== "clear") return "dirty";
  if (pet.needs.energy <= 25 || emote === "yawn") return "tired";
  return "idle";
}

/**
 * Builds the sole read-only view model shared by every visual presenter.
 * It deliberately performs no advancement and keeps no writable PetState link.
 */
export function createPetPresentationModel(
  input: PetPresentationInput,
): PetPresentationModel {
  const { pet } = input;
  const clock = getVirtualClock(pet.ageVirtualMinutes);
  const healthBand = getHealthBand(pet.needs.health);
  const recommendation = getStatusRecommendation(pet);
  const medicine = getMedicineAvailability({
    pet,
    careLocked: input.careLocked,
    careReachable: input.careReachable,
  });
  const needs = PET_PRESENTATION_NEED_ORDER.map((key) =>
    Object.freeze({
      key,
      label: needLabels[key],
      shortLabel: needLabels[key].slice(0, 3).toUpperCase(),
      value: pet.needs[key],
      warning:
        (key === "health" && pet.needs.health < 50) ||
        (key === "attention" && pet.needs.attention <= 35) ||
        (key === "hunger" && pet.needs.hunger <= 20) ||
        (key === "hygiene" && pet.needs.hygiene <= 35) ||
        (key === "energy" && pet.needs.energy <= 25),
    }),
  );

  return Object.freeze({
    schemaVersion: 1,
    sourcePetVersion: 7,
    petId: pet.id,
    name: pet.name,
    stage: getGrowthStage(pet),
    roomTheme: pet.roomTheme,
    clock: Object.freeze({
      day: clock.day,
      daypart: clock.daypart,
      label: clock.label,
    }),
    needs: Object.freeze(needs),
    healthBand: Object.freeze({
      id: healthBand,
      label: healthBandLabels[healthBand],
    }),
    recommendation: Object.freeze({ ...recommendation }),
    medicine: Object.freeze({ ...medicine }),
    warnings: resolveWarnings(pet),
    activity: resolvePetPresentationActivity(input),
    sleeping: isSleeping(pet),
    dead: pet.isDead,
    reducedMotion: input.reducedMotion,
    hygieneAppearance: pet.isDead
      ? "clear"
      : getHygieneAppearance(pet.needs.hygiene),
    visual: Object.freeze({
      emote: input.emote,
      cleaningPhase: pet.isDead ? null : input.cleaningPhase,
      trainingAction: input.trainingAction,
      trainingTreatVisible: input.trainingTreatVisible,
      tired: !pet.isDead && pet.needs.energy <= 25,
      lowHappiness: !pet.isDead && pet.needs.happiness <= 30,
    }),
  });
}

export function resolvePresentationRenderer(
  mode: PresentationMode,
): PresentationRendererKind {
  return mode;
}

/**
 * Session-only mode selection. Exact input references are returned so callers
 * cannot accidentally treat presentation selection as a PetState transition.
 */
export function resolvePresentationModeSwitch(
  pet: PetState,
  model: PetPresentationModel,
  nextMode: PresentationMode,
) {
  return Object.freeze({
    mode: nextMode,
    pet,
    model,
    advanced: false as const,
    persisted: false as const,
  });
}
