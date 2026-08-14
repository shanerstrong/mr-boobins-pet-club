import { describe, expect, it } from 'vitest';

import { CLOCK_MULTIPLIER, MAX_ELAPSED_REAL_MS, advancePet, careForPet, createNewPet, isPetState } from './simulation';

describe('pet simulation', () => {
  it('decays needs on the accelerated clock', () => {
    const pet = createNewPet(0);
    const later = advancePet(pet, 5 * 60_000);

    expect(CLOCK_MULTIPLIER).toBe(12);
    expect(later.needs.hunger).toBeLessThan(pet.needs.hunger);
    expect(later.needs.energy).toBeLessThan(pet.needs.energy);
    expect(later.lastUpdatedAt).toBe(5 * 60_000);
  });

  it('applies care effects after elapsed time', () => {
    const pet = createNewPet(0);
    const fed = careForPet(pet, 'feed', 60_000);
    const played = careForPet(fed, 'play', 60_000);

    expect(fed.needs.hunger).toBeGreaterThan(pet.needs.hunger);
    expect(played.needs.happiness).toBeGreaterThan(fed.needs.happiness);
    expect(played.needs.energy).toBeLessThan(fed.needs.energy);
  });

  it('ignores a backward clock and caps a huge gap safely', () => {
    const pet = createNewPet(1_000);
    expect(advancePet(pet, 999)).toEqual(pet);

    const jumped = advancePet(pet, 1_000 + MAX_ELAPSED_REAL_MS * 10);
    const capped = advancePet(pet, 1_000 + MAX_ELAPSED_REAL_MS);
    expect(jumped.needs).toEqual(capped.needs);
    expect(jumped.lastUpdatedAt).toBe(1_000 + MAX_ELAPSED_REAL_MS * 10);
  });

  it('rejects unexpected needs and invalid timestamp order', () => {
    const pet = createNewPet(1_000);
    expect(isPetState({ ...pet, needs: { ...pet.needs, health: 100 } })).toBe(false);
    expect(isPetState({ ...pet, createdAt: 1_001 })).toBe(false);
  });
});
