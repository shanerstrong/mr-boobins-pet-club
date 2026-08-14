export const DEFAULT_CLOCK_MULTIPLIER = 12;
export const MAX_ELAPSED_REAL_MS = 24 * 60 * 60 * 1000;
export const PUPPY_GROWTH_MINUTES = 24 * 60;
export const AUTO_SLEEP_ENERGY = 12;
export const AUTO_WAKE_ENERGY = 78;

export type NeedKey = "hunger" | "happiness" | "energy" | "hygiene";
export type CareAction = "feed" | "play" | "rest" | "clean";
export type Needs = Record<NeedKey, number>;
export type LifeStage = "puppy" | "adult";

export interface PetState {
  version: 2;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  needs: Needs;
  ageVirtualMinutes: number;
  isSleeping: boolean;
}
type V1Pet = Omit<PetState, "version" | "ageVirtualMinutes" | "isSleeping"> & {
  version: 1;
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
  rest: {},
  clean: { hygiene: 35, happiness: 5 },
};
const needKeys: NeedKey[] = ["hunger", "happiness", "energy", "hygiene"];
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const exactKeys = (value: object, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

export function createNewPet(now = Date.now()): PetState {
  return {
    version: 2,
    id: "jack-provisional",
    name: "Jack",
    createdAt: now,
    lastUpdatedAt: now,
    needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 88 },
    ageVirtualMinutes: 0,
    isSleeping: false,
  };
}
export function getLifeStage(
  pet: Pick<PetState, "ageVirtualMinutes">,
): LifeStage {
  return pet.ageVirtualMinutes >= PUPPY_GROWTH_MINUTES ? "adult" : "puppy";
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
  )
    return pet;
  const virtualMinutes =
    (Math.min(now - pet.lastUpdatedAt, MAX_ELAPSED_REAL_MS) / 60_000) *
    multiplier;
  let sleeping = pet.isSleeping || pet.needs.energy <= AUTO_SLEEP_ENERGY;
  const needs: Needs = { ...pet.needs };
  for (const key of needKeys)
    needs[key] = clamp(
      needs[key] -
        (sleeping && key === "energy"
          ? -0.72
          : sleeping
            ? decay[key] * 0.42
            : decay[key]) *
          virtualMinutes,
    );
  if (sleeping && needs.energy >= AUTO_WAKE_ENERGY) sleeping = false;
  if (!sleeping && needs.energy <= AUTO_SLEEP_ENERGY) sleeping = true;
  return {
    ...pet,
    lastUpdatedAt: now,
    needs,
    ageVirtualMinutes: pet.ageVirtualMinutes + virtualMinutes,
    isSleeping: sleeping,
  };
}

export function careForPet(
  pet: PetState,
  action: CareAction,
  now: number,
  multiplier = DEFAULT_CLOCK_MULTIPLIER,
): PetState {
  const current = advancePet(pet, now, multiplier);
  const needs = { ...current.needs };
  for (const [key, amount] of Object.entries(effects[action]) as [
    NeedKey,
    number,
  ][])
    needs[key] = clamp(needs[key] + amount);
  return {
    ...current,
    needs,
    isSleeping: action === "rest" ? true : false,
    lastUpdatedAt: now,
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
      "isSleeping",
    ]) &&
    (value as PetState).version === 2 &&
    Number.isFinite((value as PetState).ageVirtualMinutes) &&
    (value as PetState).ageVirtualMinutes >= 0 &&
    typeof (value as PetState).isSleeping === "boolean"
  );
}
export function migratePetState(value: unknown): PetState | null {
  if (isPetState(value)) return value;
  if (
    !validBase(value) ||
    !exactKeys(value, [
      "version",
      "id",
      "name",
      "createdAt",
      "lastUpdatedAt",
      "needs",
    ]) ||
    (value as V1Pet).version !== 1
  )
    return null;
  const pet = value as V1Pet;
  return { ...pet, version: 2, ageVirtualMinutes: 0, isSleeping: false };
}
