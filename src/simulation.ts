export const DEFAULT_CLOCK_MULTIPLIER = 12;
export const MAX_ELAPSED_REAL_MS = 24 * 60 * 60 * 1000;
export const GROWTH_STEP_MINUTES = 5 * 60;

export type NeedKey = "hunger" | "happiness" | "energy" | "hygiene";
export type CareAction = "feed" | "play" | "clean";
export type Needs = Record<NeedKey, number>;
export type GrowthStage =
  | "baby"
  | "little-puppy"
  | "puppy"
  | "young-dog"
  | "adult";

export interface PetState {
  version: 3;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  needs: Needs;
  ageVirtualMinutes: number;
  introCompleted: boolean;
  sleepUntilVirtualMinutes: number | null;
}

type V1Pet = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  needs: Needs;
};
type V2Pet = {
  version: 2;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  needs: Needs;
  ageVirtualMinutes: number;
  isSleeping: boolean;
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
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const exactKeys = (value: object, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

export function createNewPet(now = Date.now()): PetState {
  return {
    version: 3,
    id: "jack-provisional",
    name: "Jack",
    createdAt: now,
    lastUpdatedAt: now,
    needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 88 },
    ageVirtualMinutes: 0,
    introCompleted: false,
    sleepUntilVirtualMinutes: null,
  };
}

export function getGrowthStage(
  pet: Pick<PetState, "ageVirtualMinutes">,
): GrowthStage {
  const step = Math.floor(pet.ageVirtualMinutes / GROWTH_STEP_MINUTES);
  return ["baby", "little-puppy", "puppy", "young-dog", "adult"][
    Math.min(4, Math.max(0, step))
  ] as GrowthStage;
}

export function isSleeping(pet: Pick<PetState, "sleepUntilVirtualMinutes">) {
  return pet.sleepUntilVirtualMinutes !== null;
}

function applyAwakeNeeds(needs: Needs, minutes: number): Needs {
  const next = { ...needs };
  for (const key of needKeys) next[key] = clamp(next[key] - decay[key] * minutes);
  return next;
}

function applySleepingNeeds(needs: Needs, minutes: number): Needs {
  const next = { ...needs };
  for (const key of needKeys) {
    const change = key === "energy" ? -0.72 : decay[key] * 0.42;
    next[key] = clamp(next[key] - change * minutes);
  }
  return next;
}

export function advancePet(
  pet: PetState,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(multiplier) ||
    multiplier <= 0 ||
    now <= pet.lastUpdatedAt
  ) {
    return pet;
  }

  const virtualMinutes =
    (Math.min(now - pet.lastUpdatedAt, MAX_ELAPSED_REAL_MS) / 60_000) *
    multiplier;
  const target = pet.sleepUntilVirtualMinutes;
  const sleepMinutes =
    target === null
      ? 0
      : Math.min(virtualMinutes, Math.max(0, target - pet.ageVirtualMinutes));
  const awakeMinutes = virtualMinutes - sleepMinutes;
  const needs = applyAwakeNeeds(
    applySleepingNeeds(pet.needs, sleepMinutes),
    awakeMinutes,
  );
  const ageVirtualMinutes = pet.ageVirtualMinutes + virtualMinutes;

  return {
    ...pet,
    lastUpdatedAt: now,
    needs,
    ageVirtualMinutes,
    sleepUntilVirtualMinutes:
      target !== null && ageVirtualMinutes >= target ? null : target,
  };
}

export function startSleep(
  pet: PetState,
  hours: number,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  const current = advancePet(pet, now, multiplier);
  if (!Number.isFinite(hours) || hours <= 0 || isSleeping(current)) return current;
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
  return { ...current, sleepUntilVirtualMinutes: null };
}

export function canCareForPet(
  pet: Pick<PetState, "sleepUntilVirtualMinutes">,
): boolean {
  return !isSleeping(pet);
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
  return { ...current, needs };
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
    needKeys.every(
      (key) =>
        typeof (value as Needs)[key] === "number" &&
        Number.isFinite((value as Needs)[key]) &&
        (value as Needs)[key] >= 0 &&
        (value as Needs)[key] <= 100,
    )
  );
}

function validBase(
  value: unknown,
): value is {
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  needs: Needs;
} {
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

export function isPetState(value: unknown): value is PetState {
  const sleepUntil =
    value && typeof value === "object"
      ? (value as Partial<PetState>).sleepUntilVirtualMinutes
      : undefined;
  return (
    validBase(value) &&
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
    (value as PetState).version === 3 &&
    Number.isFinite((value as PetState).ageVirtualMinutes) &&
    (value as PetState).ageVirtualMinutes >= 0 &&
    typeof (value as PetState).introCompleted === "boolean" &&
    (sleepUntil === null ||
      (typeof sleepUntil === "number" &&
        Number.isFinite(sleepUntil) &&
        sleepUntil >=
          (value as PetState).ageVirtualMinutes))
  );
}

export function migratePetState(value: unknown): PetState | null {
  if (isPetState(value)) return value;
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
    return {
      ...base,
      version: 3,
      introCompleted: false,
      sleepUntilVirtualMinutes: wasSleeping
        ? pet.ageVirtualMinutes + 2 * 60
        : null,
    };
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
    return {
      ...pet,
      version: 3,
      ageVirtualMinutes: 0,
      introCompleted: false,
      sleepUntilVirtualMinutes: null,
    };
  }
  return null;
}
