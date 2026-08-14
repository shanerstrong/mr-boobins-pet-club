export const CLOCK_MULTIPLIER = 12;
export const MAX_ELAPSED_REAL_MS = 24 * 60 * 60 * 1000;

export type NeedKey = 'hunger' | 'happiness' | 'energy' | 'hygiene';
export type CareAction = 'feed' | 'play' | 'rest' | 'clean';

export type Needs = Record<NeedKey, number>;

export interface PetState {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  needs: Needs;
}

const decayPerVirtualMinute: Needs = {
  hunger: 0.32,
  happiness: 0.16,
  energy: 0.2,
  hygiene: 0.12,
};

const actionEffects: Record<CareAction, Partial<Needs>> = {
  feed: { hunger: 28, happiness: 3 },
  play: { happiness: 24, energy: -12, hunger: -6, hygiene: -3 },
  rest: { energy: 32, hunger: -2 },
  clean: { hygiene: 35, happiness: 5 },
};

const clampNeed = (value: number) => Math.round(Math.max(0, Math.min(100, value)));

export function createNewPet(now = Date.now()): PetState {
  return {
    version: 1,
    id: 'jack-provisional',
    name: 'Jack',
    createdAt: now,
    lastUpdatedAt: now,
    needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 88 },
  };
}

/** Advances from persisted wall time without allowing a backward clock or an unbounded catch-up. */
export function advancePet(pet: PetState, now: number): PetState {
  if (!Number.isFinite(now) || now <= pet.lastUpdatedAt) return pet;

  const elapsedRealMs = Math.min(now - pet.lastUpdatedAt, MAX_ELAPSED_REAL_MS);
  const virtualMinutes = (elapsedRealMs / 60_000) * CLOCK_MULTIPLIER;
  const needs = Object.fromEntries(
    (Object.keys(pet.needs) as NeedKey[]).map((need) => [
      need,
      clampNeed(pet.needs[need] - decayPerVirtualMinute[need] * virtualMinutes),
    ]),
  ) as Needs;

  // Mark the real observation time even when catch-up is capped, so a large jump cannot drain Jack forever.
  return { ...pet, lastUpdatedAt: now, needs };
}

export function careForPet(pet: PetState, action: CareAction, now: number): PetState {
  const current = advancePet(pet, now);
  const effect = actionEffects[action];
  const needs = { ...current.needs };

  for (const [need, amount] of Object.entries(effect) as [NeedKey, number][]) {
    needs[need] = clampNeed(needs[need] + amount);
  }

  return { ...current, lastUpdatedAt: now, needs };
}

export function isPetState(value: unknown): value is PetState {
  if (!value || typeof value !== 'object') return false;
  const pet = value as Partial<PetState>;
  if (
    pet.version !== 1 ||
    typeof pet.id !== 'string' ||
    typeof pet.name !== 'string' ||
    typeof pet.createdAt !== 'number' ||
    !Number.isFinite(pet.createdAt) ||
    typeof pet.lastUpdatedAt !== 'number' ||
    !Number.isFinite(pet.lastUpdatedAt) ||
    !pet.needs
  ) {
    return false;
  }

  const needs = pet.needs;
  if (!needs) return false;

  const expectedNeedKeys = Object.keys(decayPerVirtualMinute) as NeedKey[];
  const actualNeedKeys = Object.keys(needs);
  return (
    pet.createdAt <= pet.lastUpdatedAt &&
    actualNeedKeys.length === expectedNeedKeys.length &&
    expectedNeedKeys.every(
      (need) => Object.hasOwn(needs, need) && Number.isFinite(needs[need]) && needs[need] >= 0 && needs[need] <= 100,
    )
  );
}
