import { describe, expect, it } from "vitest";
import {
  AUTO_SLEEP_ENERGY,
  DEFAULT_CLOCK_MULTIPLIER,
  MAX_ELAPSED_REAL_MS,
  PUPPY_GROWTH_MINUTES,
  advancePet,
  careForPet,
  createNewPet,
  getLifeStage,
  isPetState,
  switchClockRate,
} from "./simulation";
describe("V0.2 simulation", () => {
  it("decays at explicit rates and switches without a discontinuity", () => {
    const pet = createNewPet(0);
    const at60 = advancePet(pet, 60_000, 60);
    expect(at60.needs.hunger).toBeLessThan(pet.needs.hunger);
    const changed = switchClockRate(at60, 61_000, 60, 3600);
    expect(changed.pet.ageVirtualMinutes).toBeGreaterThan(
      at60.ageVirtualMinutes,
    );
    expect(changed.rate).toBe(3600);
  });
  it("safely handles rollback and large jumps", () => {
    const pet = createNewPet(1_000);
    expect(advancePet(pet, 999, 3600)).toEqual(pet);
    expect(advancePet(pet, 1_000 + MAX_ELAPSED_REAL_MS * 10, 12).needs).toEqual(
      advancePet(pet, 1_000 + MAX_ELAPSED_REAL_MS, 12).needs,
    );
  });
  it("sleeps, recovers energy, wakes, and rests on demand", () => {
    const tired = {
      ...createNewPet(0),
      needs: { ...createNewPet(0).needs, energy: AUTO_SLEEP_ENERGY },
    };
    const sleeping = advancePet(tired, 60_000, 60);
    expect(sleeping.isSleeping).toBe(true);
    expect(sleeping.needs.energy).toBeGreaterThan(tired.needs.energy);
    const awake = advancePet(sleeping, 10 * 60_000, 60);
    expect(awake.isSleeping).toBe(false);
    expect(careForPet(awake, "rest", 11 * 60_000, 60).isSleeping).toBe(true);
  });
  it("grows exactly at 24 accumulated pet hours", () => {
    const pet = {
      ...createNewPet(0),
      ageVirtualMinutes: PUPPY_GROWTH_MINUTES - 1,
    };
    expect(getLifeStage(pet)).toBe("puppy");
    expect(
      getLifeStage({ ...pet, ageVirtualMinutes: PUPPY_GROWTH_MINUTES }),
    ).toBe("adult");
  });
  it("strictly validates V2 schema", () => {
    const pet = createNewPet(0);
    expect(isPetState(pet)).toBe(true);
    expect(isPetState({ ...pet, extra: true })).toBe(false);
    expect(isPetState({ ...pet, createdAt: 1 })).toBe(false);
  });
  it("keeps the default rate explicit", () => {
    expect(DEFAULT_CLOCK_MULTIPLIER).toBe(12);
  });
  it("accumulates fractional one-second ticks at each supported early rate", () => {
    for (const rate of [1, 12, 60]) {
      let pet = createNewPet(0);
      for (let second = 1; second <= 10; second += 1)
        pet = advancePet(pet, second * 1_000, rate);
      expect(pet.ageVirtualMinutes).toBeCloseTo(rate / 6, 8);
      expect(pet.needs.hunger).toBeLessThan(createNewPet(0).needs.hunger);
    }
  });
  it("accumulates sleeping recovery over sequential one-second ticks", () => {
    let pet = {
      ...createNewPet(0),
      needs: { ...createNewPet(0).needs, energy: AUTO_SLEEP_ENERGY },
    };
    for (let second = 1; second <= 10; second += 1)
      pet = advancePet(pet, second * 1_000, 60);
    expect(pet.needs.energy).toBeGreaterThan(AUTO_SLEEP_ENERGY);
  });
  it("switches with exact old-rate continuity", () => {
    const pet = createNewPet(0);
    const changed = switchClockRate(pet, 1_000, 12, 60);
    expect(changed.pet.ageVirtualMinutes).toBeCloseTo(0.2, 8);
    expect(
      advancePet(changed.pet, 2_000, changed.rate).ageVirtualMinutes,
    ).toBeCloseTo(1.2, 8);
  });
});
