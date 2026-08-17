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

export type NeedKey = "hunger" | "happiness" | "energy" | "hygiene";
export type CareAction = "feed" | "play" | "clean";
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
  version: 6;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
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

type BasePet = Pick<PetState, "id" | "name" | "createdAt" | "lastUpdatedAt" | "needs">;
type V1Pet = BasePet & { version: 1 };
type V2Pet = BasePet & {
  version: 2;
  ageVirtualMinutes: number;
  isSleeping: boolean;
};
type V3Pet = BasePet & {
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

const decay: Needs = {
  hunger: 0.32,
  happiness: 0.16,
  energy: 0.2,
  hygiene: 0.12,
};
const effects: Record<CareAction, Partial<Needs>> = {
  feed: { hunger: 28, happiness: 3 },
  play: { happiness: 24, energy: -12, hunger: -6, hygiene: -3 },
  clean: { hygiene: 35, happiness: 5 },
};
const needKeys: NeedKey[] = ["hunger", "happiness", "energy", "hygiene"];
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
    version: 6,
    id: "jack-provisional",
    name: "Jack",
    createdAt: now,
    lastUpdatedAt: now,
    needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 88 },
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

function applyPhase(
  needs: Needs,
  minutes: number,
  sleeping: boolean,
  starvation: number,
): Phase {
  const hungerRate = decay.hunger * (sleeping ? 0.42 : 1);
  const timeBeforeZero =
    needs.hunger <= 0 ? 0 : Math.min(minutes, needs.hunger / hungerRate);
  const zeroMinutes = Math.max(0, minutes - timeBeforeZero);
  const dies =
    starvation + zeroMinutes >= STARVATION_DEATH_MINUTES - 1e-9;
  const consumed = dies
    ? timeBeforeZero + (STARVATION_DEATH_MINUTES - starvation)
    : minutes;
  const next = { ...needs };

  for (const key of needKeys) {
    const change =
      sleeping && key === "energy"
        ? -0.72
        : decay[key] * (sleeping ? 0.42 : 1);
    next[key] = clamp(next[key] - change * consumed);
  }

  return {
    needs: next,
    starvation: dies
      ? STARVATION_DEATH_MINUTES
      : starvation + zeroMinutes,
    consumed,
    died: dies,
  };
}

function applyDecayOnly(needs: Needs, minutes: number, sleeping: boolean): Needs {
  const next = { ...needs };
  for (const key of needKeys) {
    const change =
      sleeping && key === "energy"
        ? -0.72
        : decay[key] * (sleeping ? 0.42 : 1);
    next[key] = clamp(next[key] - change * minutes);
  }
  return next;
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
  const target = pet.sleepUntilVirtualMinutes;
  const intendedSleep =
    target === null
      ? 0
      : Math.min(
          virtualMinutes,
          Math.max(0, target - pet.ageVirtualMinutes),
        );
  const asleep = applyPhase(
    pet.needs,
    intendedSleep,
    true,
    pet.starvationVirtualMinutes,
  );
  const awake = asleep.died
    ? {
        needs: asleep.needs,
        starvation: asleep.starvation,
        consumed: 0,
        died: true,
      }
    : applyPhase(
        asleep.needs,
        virtualMinutes - intendedSleep,
        false,
        asleep.starvation,
      );
  const consumed = asleep.consumed + awake.consumed;
  const ageVirtualMinutes = pet.ageVirtualMinutes + consumed;
  const isDead = asleep.died || awake.died;

  return {
    ...pet,
    lastUpdatedAt: now,
    needs: awake.needs,
    ageVirtualMinutes,
    starvationVirtualMinutes: awake.starvation,
    isDead,
    growthMealReady: isDead
      ? pet.growthMealReady
      : growthMealReadyAfterTime(pet, awake.needs),
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
  const target = pet.sleepUntilVirtualMinutes;
  const sleepingMinutes =
    target === null
      ? 0
      : Math.min(
          virtualMinutes,
          Math.max(0, target - pet.ageVirtualMinutes),
        );
  const awakeMinutes = virtualMinutes - sleepingMinutes;
  const afterSleep = applyDecayOnly(pet.needs, sleepingMinutes, true);
  const needs = applyDecayOnly(afterSleep, awakeMinutes, false);
  const ageVirtualMinutes = pet.ageVirtualMinutes + virtualMinutes;

  return {
    ...pet,
    lastUpdatedAt: now,
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
  return { ...pet, lastUpdatedAt: now };
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

export function switchClockRate(
  pet: PetState,
  now: number,
  oldRate: number,
  newRate: number,
) {
  return { pet: advancePet(pet, now, oldRate), rate: newRate };
}

function validNeeds(value: unknown): value is Needs {
  return (
    !!value &&
    typeof value === "object" &&
    exactKeys(value, needKeys) &&
    needKeys.every((key) => {
      const need = (value as Needs)[key];
      return (
        typeof need === "number" &&
        Number.isFinite(need) &&
        need >= 0 &&
        need <= 100
      );
    })
  );
}

function validBase(value: unknown): value is BasePet {
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
  if (!validBase(value) || !value || typeof value !== "object") return false;
  const pet = value as PetState;
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
    validAgeAndSleep(pet) &&
    typeof pet.adoptionCompleted === "boolean" &&
    validGrowth(pet) &&
    roomThemes.includes(pet.roomTheme) &&
    validDeath(pet)
  );
}

function validV3(value: unknown): value is V3Pet {
  if (!validBase(value) || !value || typeof value !== "object") return false;
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
  if (!validBase(value) || !value || typeof value !== "object") return false;
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
  if (!validBase(value) || !value || typeof value !== "object") return false;
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

function migrateV5(pet: V5Pet): PetState {
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

export function migratePetState(value: unknown): PetState | null {
  if (isPetState(value)) return value;
  if (validV5(value)) return migrateV5(value);
  if (validV4(value)) return migrateV5(migrateV4(value));
  if (validV3(value)) return migrateV5(migrateV4(migrateV3(value)));
  if (!validBase(value) || !value || typeof value !== "object") return null;
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
    return migrateV5(
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
    return migrateV5(
      migrateV4(
        migrateV3({
          ...pet,
          version: 3,
          ageVirtualMinutes: 0,
          introCompleted: false,
          sleepUntilVirtualMinutes: null,
        }),
      ),
    );
  }
  return null;
}
