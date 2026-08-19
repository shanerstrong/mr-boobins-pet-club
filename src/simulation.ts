export const DEFAULT_CLOCK_MULTIPLIER = 1;
export const MAX_ELAPSED_REAL_MS = 24 * 60 * 60 * 1000;
export const MAX_OFFLINE_PET_MINUTES = 4 * 60;
export const GROWTH_STEP_MINUTES = 5 * 60;
export const MAX_GROWTH_MEALS = 4;
export const GROWTH_MEAL_HUNGER_THRESHOLD = 90;
export const STARVATION_DEATH_MINUTES = 120;
export const BOOP_COOLDOWN_MS = 1200;
export const CLEANING_DURATION_MS = 1500;
export const VIRTUAL_DAY_START_MINUTES = 8 * 60;
export const ATTENTION_DECAY_AWAKE_PER_MINUTE = 0.1;
export const ATTENTION_DECAY_SLEEPING_PER_MINUTE = 0.04;
export const PLAY_ATTENTION_EFFECT = 28;
export const MEDICINE_HEALTH_THRESHOLD = 80;
export const MEDICINE_HEALTH_EFFECT = 25;
export const NEGLECT_THRESHOLD = 20;

export type LegacyNeedKey = "hunger" | "happiness" | "energy" | "hygiene";
export type NeedKey = LegacyNeedKey | "health" | "attention";
export type CareAction = "feed" | "play" | "clean";
export type LegacyNeeds = Record<LegacyNeedKey, number>;
export type Needs = Record<NeedKey, number>;
export type RoomTheme = "cozy" | "blue" | "garden";
export type Daypart = "morning" | "day" | "dusk" | "night";
export type HygieneAppearance = "clear" | "dust" | "mud" | "stink";
export type CleaningPhase = "water" | "washout" | "shake" | "sparkle";
export type BoopKind = "whine" | "grumble" | "sneeze" | "huff" | "bark";
export type GrowthStage =
  | "baby"
  | "little-puppy"
  | "puppy"
  | "young-dog"
  | "adult";

export interface PetState {
  version: 7;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  wellbeingLastUpdatedAt: number;
  needs: Needs;
  ageVirtualMinutes: number;
  adoptionCompleted: boolean;
  sleepUntilVirtualMinutes: number | null;
  growthMeals: number;
  growthMealReady: boolean;
  roomTheme: RoomTheme;
  starvationVirtualMinutes: number;
  isDead: boolean;
}

type LegacyBasePet = Pick<PetState, "id" | "name" | "createdAt" | "lastUpdatedAt"> & {
  needs: LegacyNeeds;
};
type V1Pet = LegacyBasePet & { version: 1 };
type V2Pet = LegacyBasePet & {
  version: 2;
  ageVirtualMinutes: number;
  isSleeping: boolean;
};
type V3Pet = LegacyBasePet & {
  version: 3;
  ageVirtualMinutes: number;
  introCompleted: boolean;
  sleepUntilVirtualMinutes: number | null;
};
type V4Pet = Omit<V3Pet, "version"> & {
  version: 4;
  growthMeals: number;
  growthMealReady: boolean;
};
export type LegacyBackgroundId = "sunny" | "night" | "yard";
type V5Pet = Omit<V4Pet, "version"> & {
  version: 5;
  backgroundId: LegacyBackgroundId;
  starvationVirtualMinutes: number;
  isDead: boolean;
};
type V6Pet = Omit<V5Pet, "version" | "introCompleted" | "backgroundId"> & {
  version: 6;
  adoptionCompleted: boolean;
  roomTheme: RoomTheme;
};

export type VirtualClock = {
  day: number;
  daypart: Daypart;
  hours24: number;
  minutes: number;
  label: string;
};

export type BoopReaction = {
  kind: BoopKind;
  message: string;
};

const decay: LegacyNeeds = {
  hunger: 0.32,
  happiness: 0.16,
  energy: 0.2,
  hygiene: 0.12,
};
const effects: Record<CareAction, Partial<Needs>> = {
  feed: { hunger: 28, happiness: 3 },
  play: {
    happiness: 24,
    energy: -12,
    hunger: -6,
    hygiene: -3,
    attention: PLAY_ATTENTION_EFFECT,
  },
  clean: { hygiene: 35, happiness: 5 },
};
const legacyNeedKeys: LegacyNeedKey[] = [
  "hunger",
  "happiness",
  "energy",
  "hygiene",
];
const needKeys: NeedKey[] = [...legacyNeedKeys, "health", "attention"];
const roomThemes: RoomTheme[] = ["cozy", "blue", "garden"];
const legacyBackgrounds: LegacyBackgroundId[] = ["sunny", "night", "yard"];
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const exactKeys = (value: object, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export function normalizeNickname(value: string) {
  return value.trim().slice(0, 12).trimEnd();
}

export function isValidNickname(value: string) {
  return value === value.trim() && value.length >= 1 && value.length <= 12;
}

function normalizeLegacyNickname(value: string) {
  return normalizeNickname(value) || "Jack";
}

function growthStepForAge(ageVirtualMinutes: number) {
  return Math.min(
    MAX_GROWTH_MEALS,
    Math.max(0, Math.floor(ageVirtualMinutes / GROWTH_STEP_MINUTES)),
  );
}

export function createNewPet(now = Date.now()): PetState {
  return {
    version: 7,
    id: "jack-provisional",
    name: "Jack",
    createdAt: now,
    lastUpdatedAt: now,
    wellbeingLastUpdatedAt: now,
    needs: {
      hunger: 84,
      happiness: 80,
      energy: 76,
      hygiene: 88,
      health: 100,
      attention: 80,
    },
    ageVirtualMinutes: 0,
    adoptionCompleted: false,
    sleepUntilVirtualMinutes: null,
    growthMeals: 0,
    growthMealReady: true,
    roomTheme: "cozy",
    starvationVirtualMinutes: 0,
    isDead: false,
  };
}

export function getGrowthStage(
  pet: Pick<PetState, "ageVirtualMinutes" | "growthMeals">,
): GrowthStage {
  const visibleStep = Math.min(
    growthStepForAge(pet.ageVirtualMinutes),
    pet.growthMeals,
  );
  return ["baby", "little-puppy", "puppy", "young-dog", "adult"][
    visibleStep
  ] as GrowthStage;
}

export function getVirtualClock(ageVirtualMinutes: number): VirtualClock {
  const safeAge = Number.isFinite(ageVirtualMinutes)
    ? Math.max(0, ageVirtualMinutes)
    : 0;
  const absoluteMinutes = VIRTUAL_DAY_START_MINUTES + Math.floor(safeAge);
  const minutesOfDay = absoluteMinutes % (24 * 60);
  const hours24 = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  const daypart: Daypart =
    hours24 >= 6 && hours24 < 10
      ? "morning"
      : hours24 >= 10 && hours24 < 17
        ? "day"
        : hours24 >= 17 && hours24 < 20
          ? "dusk"
          : "night";
  const hours12 = hours24 % 12 || 12;
  return {
    day: Math.floor(absoluteMinutes / (24 * 60)) + 1,
    daypart,
    hours24,
    minutes,
    label: `${hours12.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")} ${hours24 >= 12 ? "PM" : "AM"}`,
  };
}

export function getHygieneAppearance(hygiene: number): HygieneAppearance {
  if (hygiene < 15) return "stink";
  if (hygiene < 35) return "mud";
  if (hygiene < 60) return "dust";
  return "clear";
}

export function getCleaningPhase(elapsedMs: number): CleaningPhase | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= CLEANING_DURATION_MS) {
    return null;
  }
  if (elapsedMs < 400) return "water";
  if (elapsedMs < 800) return "washout";
  if (elapsedMs < 1150) return "shake";
  return "sparkle";
}

export function getBoopReaction(needs: Needs): BoopReaction {
  if (needs.hunger <= 20) {
    return { kind: "whine", message: "Jack gives a tiny hungry whine." };
  }
  if (needs.energy <= 25) {
    return { kind: "grumble", message: "Jack gives a sleepy little grumble." };
  }
  if (needs.hygiene <= 35) {
    return { kind: "sneeze", message: "Achoo! Jack sneezes and shakes." };
  }
  if (needs.happiness <= 30) {
    return { kind: "huff", message: "Jack gives a small, hopeful huff." };
  }
  return { kind: "bark", message: "BARK! Jack hops after the boop." };
}

export function isSleeping(
  pet: Pick<PetState, "sleepUntilVirtualMinutes" | "isDead">,
) {
  return !pet.isDead && pet.sleepUntilVirtualMinutes !== null;
}

export function canCareForPet(
  pet: Pick<PetState, "sleepUntilVirtualMinutes" | "isDead">,
) {
  return !pet.isDead && !isSleeping(pet);
}

export function canBoop(
  pet: Pick<PetState, "sleepUntilVirtualMinutes" | "isDead">,
  now: number,
  cooldownUntil: number,
) {
  return canCareForPet(pet) && Number.isFinite(now) && now >= cooldownUntil;
}

type Phase = {
  needs: Needs;
  starvation: number;
  consumed: number;
  died: boolean;
};

function legacyDecayRate(key: LegacyNeedKey, sleeping: boolean) {
  return sleeping && key === "energy"
    ? -0.72
    : decay[key] * (sleeping ? 0.42 : 1);
}

function minutesBelowThreshold(
  value: number,
  decayPerMinute: number,
  minutes: number,
) {
  if (decayPerMinute <= 0 || minutes <= 0) return 0;
  const untilBelow =
    value < NEGLECT_THRESHOLD
      ? 0
      : (value - NEGLECT_THRESHOLD) / decayPerMinute;
  return Math.max(0, minutes - Math.max(0, untilBelow));
}

function applyNeedsDecay(
  needs: Needs,
  minutes: number,
  sleeping: boolean,
  wellbeingActive: boolean,
) {
  const next = { ...needs };
  for (const key of legacyNeedKeys) {
    next[key] = clamp(next[key] - legacyDecayRate(key, sleeping) * minutes);
  }
  if (!wellbeingActive) return next;

  const attentionRate = sleeping
    ? ATTENTION_DECAY_SLEEPING_PER_MINUTE
    : ATTENTION_DECAY_AWAKE_PER_MINUTE;
  const hungerNeglectMinutes = minutesBelowThreshold(
    needs.hunger,
    legacyDecayRate("hunger", sleeping),
    minutes,
  );
  const hygieneNeglectMinutes = minutesBelowThreshold(
    needs.hygiene,
    legacyDecayRate("hygiene", sleeping),
    minutes,
  );
  const attentionNeglectMinutes = minutesBelowThreshold(
    needs.attention,
    attentionRate,
    minutes,
  );
  next.attention = clamp(needs.attention - attentionRate * minutes);
  next.health = clamp(
    needs.health -
      hungerNeglectMinutes * 0.04 -
      hygieneNeglectMinutes * 0.03 -
      attentionNeglectMinutes * 0.02,
  );
  return next;
}

function applyPhase(
  needs: Needs,
  minutes: number,
  sleeping: boolean,
  starvation: number,
  wellbeingActive: boolean,
  activeStarvation: boolean,
): Phase {
  const hungerRate = decay.hunger * (sleeping ? 0.42 : 1);
  const timeBeforeZero =
    needs.hunger <= 0 ? 0 : Math.min(minutes, needs.hunger / hungerRate);
  const zeroMinutes = Math.max(0, minutes - timeBeforeZero);
  const dies =
    activeStarvation &&
    starvation + zeroMinutes >= STARVATION_DEATH_MINUTES - 1e-9;
  const consumed = dies
    ? timeBeforeZero + (STARVATION_DEATH_MINUTES - starvation)
    : minutes;
  const next = applyNeedsDecay(
    needs,
    consumed,
    sleeping,
    wellbeingActive,
  );

  return {
    needs: next,
    starvation: activeStarvation
      ? dies
        ? STARVATION_DEATH_MINUTES
        : starvation + zeroMinutes
      : starvation,
    consumed,
    died: dies,
  };
}

function advanceTimeline({
  needs,
  starvation,
  virtualMinutes,
  sleepingMinutes,
  wellbeingMinutes,
  activeStarvation,
}: {
  needs: Needs;
  starvation: number;
  virtualMinutes: number;
  sleepingMinutes: number;
  wellbeingMinutes: number;
  activeStarvation: boolean;
}) {
  const wellbeingStartsAt = Math.max(0, virtualMinutes - wellbeingMinutes);
  const boundaries = Array.from(
    new Set([0, sleepingMinutes, wellbeingStartsAt, virtualMinutes]),
  )
    .filter((value) => value >= 0 && value <= virtualMinutes)
    .sort((left, right) => left - right);
  let phase: Phase = { needs, starvation, consumed: 0, died: false };
  let consumed = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;
    const next = applyPhase(
      phase.needs,
      end - start,
      start < sleepingMinutes,
      phase.starvation,
      start >= wellbeingStartsAt,
      activeStarvation,
    );
    phase = next;
    consumed += next.consumed;
    if (next.died) break;
  }
  return { ...phase, consumed };
}

function growthMealReadyAfterTime(pet: PetState, needs: Needs) {
  return (
    pet.growthMealReady || needs.hunger <= GROWTH_MEAL_HUNGER_THRESHOLD
  );
}

export function advancePet(
  pet: PetState,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  if (
    pet.isDead ||
    !Number.isFinite(now) ||
    !Number.isFinite(multiplier) ||
    multiplier <= 0 ||
    now <= pet.lastUpdatedAt
  ) {
    return pet;
  }

  if (!pet.adoptionCompleted) {
    return stampPetTimestamp(pet, now);
  }

  const virtualMinutes =
    (Math.min(now - pet.lastUpdatedAt, MAX_ELAPSED_REAL_MS) / 60_000) *
    multiplier;
  const wellbeingMinutes =
    now > pet.wellbeingLastUpdatedAt
      ? (Math.min(
          now - pet.wellbeingLastUpdatedAt,
          MAX_ELAPSED_REAL_MS,
        ) /
          60_000) *
        multiplier
      : 0;
  const target = pet.sleepUntilVirtualMinutes;
  const intendedSleep =
    target === null
      ? 0
      : Math.min(
          virtualMinutes,
          Math.max(0, target - pet.ageVirtualMinutes),
        );
  const advanced = advanceTimeline({
    needs: pet.needs,
    starvation: pet.starvationVirtualMinutes,
    virtualMinutes,
    sleepingMinutes: intendedSleep,
    wellbeingMinutes: Math.min(virtualMinutes, wellbeingMinutes),
    activeStarvation: true,
  });
  const consumed = advanced.consumed;
  const ageVirtualMinutes = pet.ageVirtualMinutes + consumed;
  const isDead = advanced.died;

  return {
    ...pet,
    lastUpdatedAt: now,
    wellbeingLastUpdatedAt: Math.max(pet.wellbeingLastUpdatedAt, now),
    needs: advanced.needs,
    ageVirtualMinutes,
    starvationVirtualMinutes: advanced.starvation,
    isDead,
    growthMealReady: isDead
      ? pet.growthMealReady
      : growthMealReadyAfterTime(pet, advanced.needs),
    sleepUntilVirtualMinutes:
      isDead || (target !== null && ageVirtualMinutes >= target)
        ? null
        : target,
  };
}

/**
 * Moves a live adopted pet through a single fixed-rate absence. Offline time is
 * intentionally different from active care-room time: it is capped, stamps the
 * full observed clock, preserves starvation progress exactly, and cannot kill.
 */
export function advancePetOffline(pet: PetState, now: number): PetState {
  if (
    pet.isDead ||
    !Number.isFinite(now) ||
    now <= pet.lastUpdatedAt
  ) {
    return pet;
  }

  if (!pet.adoptionCompleted) {
    return stampPetTimestamp(pet, now);
  }

  const elapsedRealMs = now - pet.lastUpdatedAt;
  const virtualMinutes = Math.min(
    Number.isFinite(elapsedRealMs)
      ? elapsedRealMs / 60_000
      : MAX_OFFLINE_PET_MINUTES,
    MAX_OFFLINE_PET_MINUTES,
  );
  const wellbeingMinutes = Math.min(
    now > pet.wellbeingLastUpdatedAt
      ? (now - pet.wellbeingLastUpdatedAt) / 60_000
      : 0,
    MAX_OFFLINE_PET_MINUTES,
    virtualMinutes,
  );
  const target = pet.sleepUntilVirtualMinutes;
  const sleepingMinutes =
    target === null
      ? 0
      : Math.min(
          virtualMinutes,
          Math.max(0, target - pet.ageVirtualMinutes),
        );
  const advanced = advanceTimeline({
    needs: pet.needs,
    starvation: pet.starvationVirtualMinutes,
    virtualMinutes,
    sleepingMinutes,
    wellbeingMinutes,
    activeStarvation: false,
  });
  const needs = advanced.needs;
  const ageVirtualMinutes = pet.ageVirtualMinutes + virtualMinutes;

  return {
    ...pet,
    lastUpdatedAt: now,
    wellbeingLastUpdatedAt: Math.max(pet.wellbeingLastUpdatedAt, now),
    needs,
    ageVirtualMinutes,
    growthMealReady: growthMealReadyAfterTime(pet, needs),
    sleepUntilVirtualMinutes:
      target !== null && ageVirtualMinutes >= target ? null : target,
    starvationVirtualMinutes: pet.starvationVirtualMinutes,
    isDead: false,
  };
}

/** Stamps a forward wall clock without replaying unreachable/pre-adoption time. */
export function stampPetTimestamp(pet: PetState, now: number): PetState {
  if (
    pet.isDead ||
    !Number.isFinite(now) ||
    now <= pet.lastUpdatedAt
  ) {
    return pet;
  }
  return {
    ...pet,
    lastUpdatedAt: now,
    wellbeingLastUpdatedAt: Math.max(pet.wellbeingLastUpdatedAt, now),
  };
}

export function startSleep(
  pet: PetState,
  hours: number,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  const current = advancePet(pet, now, multiplier);
  if (
    current.isDead ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    isSleeping(current)
  ) {
    return current;
  }
  return {
    ...current,
    sleepUntilVirtualMinutes: current.ageVirtualMinutes + hours * 60,
  };
}

export function wakePet(
  pet: PetState,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  const current = advancePet(pet, now, multiplier);
  return current.isDead
    ? current
    : { ...current, sleepUntilVirtualMinutes: null };
}

export function careForPet(
  pet: PetState,
  action: CareAction,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  const current = advancePet(pet, now, multiplier);
  if (!canCareForPet(current)) return current;
  const needs = { ...current.needs };
  for (const [key, amount] of Object.entries(effects[action]) as [
    NeedKey,
    number,
  ][]) {
    needs[key] = clamp(needs[key] + amount);
  }
  const earnsGrowthMeal =
    action === "feed" &&
    current.growthMealReady &&
    current.needs.hunger <= GROWTH_MEAL_HUNGER_THRESHOLD &&
    current.growthMeals < MAX_GROWTH_MEALS;
  return {
    ...current,
    needs,
    starvationVirtualMinutes:
      action === "feed" ? 0 : current.starvationVirtualMinutes,
    growthMeals: current.growthMeals + (earnsGrowthMeal ? 1 : 0),
    growthMealReady: earnsGrowthMeal ? false : current.growthMealReady,
  };
}

export function giveMedicine(
  pet: PetState,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  const current = advancePet(pet, now, multiplier);
  if (
    !canCareForPet(current) ||
    current.needs.health >= MEDICINE_HEALTH_THRESHOLD
  ) {
    return current;
  }
  return {
    ...current,
    needs: {
      ...current.needs,
      health: clamp(current.needs.health + MEDICINE_HEALTH_EFFECT),
    },
  };
}

export function switchClockRate(
  pet: PetState,
  now: number,
  oldRate: number,
  newRate: number,
) {
  return { pet: advancePet(pet, now, oldRate), rate: newRate };
}

function validNeedRecord<Key extends string>(
  value: unknown,
  keys: Key[],
): value is Record<Key, number> {
  return (
    !!value &&
    typeof value === "object" &&
    exactKeys(value, keys) &&
    keys.every((key) => {
      const need = (value as Record<Key, number>)[key];
      return (
        typeof need === "number" &&
        Number.isFinite(need) &&
        need >= 0 &&
        need <= 100
      );
    })
  );
}

function validLegacyNeeds(value: unknown): value is LegacyNeeds {
  return validNeedRecord(value, legacyNeedKeys);
}

function validNeeds(value: unknown): value is Needs {
  return validNeedRecord(value, needKeys);
}

function validLegacyBase(value: unknown): value is LegacyBasePet {
  if (!value || typeof value !== "object") return false;
  const pet = value as Record<string, unknown>;
  return (
    typeof pet.id === "string" &&
    typeof pet.name === "string" &&
    typeof pet.createdAt === "number" &&
    Number.isFinite(pet.createdAt) &&
    typeof pet.lastUpdatedAt === "number" &&
    Number.isFinite(pet.lastUpdatedAt) &&
    pet.createdAt <= pet.lastUpdatedAt &&
    validLegacyNeeds(pet.needs)
  );
}

function validCurrentBase(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const pet = value as Record<string, unknown>;
  return (
    typeof pet.id === "string" &&
    typeof pet.name === "string" &&
    typeof pet.createdAt === "number" &&
    Number.isFinite(pet.createdAt) &&
    typeof pet.lastUpdatedAt === "number" &&
    Number.isFinite(pet.lastUpdatedAt) &&
    pet.createdAt <= pet.lastUpdatedAt &&
    typeof pet.wellbeingLastUpdatedAt === "number" &&
    Number.isFinite(pet.wellbeingLastUpdatedAt) &&
    pet.wellbeingLastUpdatedAt >= pet.lastUpdatedAt &&
    validNeeds(pet.needs)
  );
}

function validAgeAndSleep(
  pet: Pick<PetState, "ageVirtualMinutes" | "sleepUntilVirtualMinutes">,
) {
  return (
    Number.isFinite(pet.ageVirtualMinutes) &&
    pet.ageVirtualMinutes >= 0 &&
    (pet.sleepUntilVirtualMinutes === null ||
      (Number.isFinite(pet.sleepUntilVirtualMinutes) &&
        pet.sleepUntilVirtualMinutes >= pet.ageVirtualMinutes))
  );
}

function validGrowth(
  pet: Pick<PetState, "growthMeals" | "growthMealReady">,
) {
  return (
    Number.isInteger(pet.growthMeals) &&
    pet.growthMeals >= 0 &&
    pet.growthMeals <= MAX_GROWTH_MEALS &&
    typeof pet.growthMealReady === "boolean"
  );
}

function validDeath(
  pet: Pick<PetState, "starvationVirtualMinutes" | "isDead" | "sleepUntilVirtualMinutes">,
) {
  return (
    Number.isFinite(pet.starvationVirtualMinutes) &&
    pet.starvationVirtualMinutes >= 0 &&
    pet.starvationVirtualMinutes <= STARVATION_DEATH_MINUTES &&
    typeof pet.isDead === "boolean" &&
    (pet.isDead
      ? pet.starvationVirtualMinutes === STARVATION_DEATH_MINUTES &&
        pet.sleepUntilVirtualMinutes === null
      : pet.starvationVirtualMinutes < STARVATION_DEATH_MINUTES)
  );
}

export function isPetState(value: unknown): value is PetState {
  if (!validCurrentBase(value) || !value || typeof value !== "object") return false;
  const pet = value as PetState;
  return (
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "wellbeingLastUpdatedAt",
      "needs",
      "ageVirtualMinutes",
      "adoptionCompleted",
      "sleepUntilVirtualMinutes",
      "growthMeals",
      "growthMealReady",
      "roomTheme",
      "starvationVirtualMinutes",
      "isDead",
    ]) &&
    pet.version === 7 &&
    isValidNickname(pet.name) &&
    validAgeAndSleep(pet) &&
    typeof pet.adoptionCompleted === "boolean" &&
    validGrowth(pet) &&
    roomThemes.includes(pet.roomTheme) &&
    validDeath(pet)
  );
}

function validV3(value: unknown): value is V3Pet {
  if (!validLegacyBase(value) || !value || typeof value !== "object") return false;
  const pet = value as V3Pet;
  return (
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
      "ageVirtualMinutes",
      "introCompleted",
      "sleepUntilVirtualMinutes",
    ]) &&
    pet.version === 3 &&
    validAgeAndSleep(pet as unknown as PetState) &&
    typeof pet.introCompleted === "boolean"
  );
}

function validV4(value: unknown): value is V4Pet {
  if (!validLegacyBase(value) || !value || typeof value !== "object") return false;
  const pet = value as V4Pet;
  return (
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
      "ageVirtualMinutes",
      "introCompleted",
      "sleepUntilVirtualMinutes",
      "growthMeals",
      "growthMealReady",
    ]) &&
    pet.version === 4 &&
    validAgeAndSleep(pet as unknown as PetState) &&
    typeof pet.introCompleted === "boolean" &&
    validGrowth(pet as unknown as PetState)
  );
}

function validV5(value: unknown): value is V5Pet {
  if (!validLegacyBase(value) || !value || typeof value !== "object") return false;
  const pet = value as V5Pet;
  return (
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
      "ageVirtualMinutes",
      "introCompleted",
      "sleepUntilVirtualMinutes",
      "growthMeals",
      "growthMealReady",
      "backgroundId",
      "starvationVirtualMinutes",
      "isDead",
    ]) &&
    pet.version === 5 &&
    validAgeAndSleep(pet as unknown as PetState) &&
    typeof pet.introCompleted === "boolean" &&
    validGrowth(pet as unknown as PetState) &&
    legacyBackgrounds.includes(pet.backgroundId) &&
    validDeath(pet as unknown as PetState)
  );
}

function validV6(value: unknown): value is V6Pet {
  if (!validLegacyBase(value) || !value || typeof value !== "object") return false;
  const pet = value as V6Pet;
  return (
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
      "ageVirtualMinutes",
      "adoptionCompleted",
      "sleepUntilVirtualMinutes",
      "growthMeals",
      "growthMealReady",
      "roomTheme",
      "starvationVirtualMinutes",
      "isDead",
    ]) &&
    pet.version === 6 &&
    isValidNickname(pet.name) &&
    validAgeAndSleep(pet as unknown as PetState) &&
    typeof pet.adoptionCompleted === "boolean" &&
    validGrowth(pet as unknown as PetState) &&
    roomThemes.includes(pet.roomTheme) &&
    validDeath(pet as unknown as PetState)
  );
}

function migrateV3(pet: V3Pet): V4Pet {
  return {
    ...pet,
    name: normalizeLegacyNickname(pet.name),
    version: 4,
    growthMeals: growthStepForAge(pet.ageVirtualMinutes),
    growthMealReady: pet.needs.hunger <= GROWTH_MEAL_HUNGER_THRESHOLD,
  };
}

function migrateV4(pet: V4Pet): V5Pet {
  return {
    ...pet,
    name: normalizeLegacyNickname(pet.name),
    version: 5,
    backgroundId: "sunny",
    starvationVirtualMinutes: 0,
    isDead: false,
  };
}

function migrateV5(pet: V5Pet): V6Pet {
  const { introCompleted, backgroundId, ...rest } = pet;
  const theme: Record<LegacyBackgroundId, RoomTheme> = {
    sunny: "cozy",
    night: "blue",
    yard: "garden",
  };
  return {
    ...rest,
    name: normalizeLegacyNickname(pet.name),
    version: 6,
    adoptionCompleted: introCompleted,
    roomTheme: theme[backgroundId],
  };
}

function migrateV6(pet: V6Pet, migratedAt: number): PetState {
  return {
    ...pet,
    version: 7,
    wellbeingLastUpdatedAt: Math.max(pet.lastUpdatedAt, migratedAt),
    needs: {
      ...pet.needs,
      health: 100,
      attention: 80,
    },
  };
}

export function migratePetState(
  value: unknown,
  migratedAt = Date.now(),
): PetState | null {
  if (!Number.isFinite(migratedAt)) return null;
  if (isPetState(value)) return value;
  if (validV6(value)) return migrateV6(value, migratedAt);
  if (validV5(value)) return migrateV6(migrateV5(value), migratedAt);
  if (validV4(value)) return migrateV6(migrateV5(migrateV4(value)), migratedAt);
  if (validV3(value)) {
    return migrateV6(migrateV5(migrateV4(migrateV3(value))), migratedAt);
  }
  if (!validLegacyBase(value) || !value || typeof value !== "object") return null;
  const version = (value as { version?: unknown }).version;

  if (
    version === 2 &&
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
      "ageVirtualMinutes",
      "isSleeping",
    ])
  ) {
    const pet = value as V2Pet;
    if (
      !Number.isFinite(pet.ageVirtualMinutes) ||
      pet.ageVirtualMinutes < 0 ||
      typeof pet.isSleeping !== "boolean"
    ) {
      return null;
    }
    const { isSleeping: wasSleeping, ...base } = pet;
    return migrateV6(
      migrateV5(
        migrateV4(
          migrateV3({
            ...base,
            version: 3,
            introCompleted: false,
            sleepUntilVirtualMinutes: wasSleeping
              ? pet.ageVirtualMinutes + 120
              : null,
          }),
        ),
      ),
      migratedAt,
    );
  }
  if (
    version === 1 &&
    exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
    ])
  ) {
    const pet = value as V1Pet;
    return migrateV6(
      migrateV5(
        migrateV4(
          migrateV3({
            ...pet,
            version: 3,
            ageVirtualMinutes: 0,
            introCompleted: false,
            sleepUntilVirtualMinutes: null,
          }),
        ),
      ),
      migratedAt,
    );
  }
  return null;
}
