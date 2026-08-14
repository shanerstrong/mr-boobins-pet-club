import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLOCK_MULTIPLIER,
  GROWTH_STEP_MINUTES,
  MAX_ELAPSED_REAL_MS,
  advancePet,
  canCareForPet,
  careForPet,
  createNewPet,
  getGrowthStage,
  isPetState,
  isSleeping,
  migratePetState,
  startSleep,
  switchClockRate,
  wakePet,
} from "./simulation";

describe("V0.3 simulation", () => {
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

  it("accumulates fractional one-second ticks at each early rate", () => {
    for (const rate of [1, 12, 60]) {
      let pet = createNewPet(0);
      for (let second = 1; second <= 10; second += 1) {
        pet = advancePet(pet, second * 1_000, rate);
      }
      expect(pet.ageVirtualMinutes).toBeCloseTo(rate / 6, 8);
      expect(pet.needs.hunger).toBeLessThan(createNewPet(0).needs.hunger);
    }
  });

  it("switches with exact old-rate continuity", () => {
    const pet = createNewPet(0);
    const changed = switchClockRate(pet, 1_000, 12, 60);
    expect(changed.pet.ageVirtualMinutes).toBeCloseTo(0.2, 8);
    expect(
      advancePet(changed.pet, 2_000, changed.rate).ageVirtualMinutes,
    ).toBeCloseTo(1.2, 8);
  });

  it("uses five exact growth tiers from baby through adult", () => {
    const pet = createNewPet(0);
    const expectations = [
      [0, "baby"],
      [GROWTH_STEP_MINUTES - 0.01, "baby"],
      [GROWTH_STEP_MINUTES, "little-puppy"],
      [GROWTH_STEP_MINUTES * 2 - 0.01, "little-puppy"],
      [GROWTH_STEP_MINUTES * 2, "puppy"],
      [GROWTH_STEP_MINUTES * 3 - 0.01, "puppy"],
      [GROWTH_STEP_MINUTES * 3, "young-dog"],
      [GROWTH_STEP_MINUTES * 4 - 0.01, "young-dog"],
      [GROWTH_STEP_MINUTES * 4, "adult"],
    ] as const;
    for (const [ageVirtualMinutes, stage] of expectations) {
      expect(getGrowthStage({ ...pet, ageVirtualMinutes })).toBe(stage);
    }
  });

  it("starts a timed sleep, restores energy, and wakes exactly at target", () => {
    const pet = {
      ...createNewPet(0),
      needs: { ...createNewPet(0).needs, energy: 20 },
    };
    const sleeping = startSleep(pet, 2, 0, 60);
    expect(isSleeping(sleeping)).toBe(true);
    expect(sleeping.sleepUntilVirtualMinutes).toBe(120);
    const midway = advancePet(sleeping, 60_000, 60);
    expect(midway.needs.energy).toBeGreaterThan(pet.needs.energy);
    expect(isSleeping(midway)).toBe(true);
    const awake = advancePet(midway, 120_000, 60);
    expect(isSleeping(awake)).toBe(false);
    expect(awake.sleepUntilVirtualMinutes).toBeNull();
  });

  it("honors every nap choice at its exact virtual-age target", () => {
    for (const hours of [1, 2, 4, 8]) {
      const sleeping = startSleep(createNewPet(0), hours, 0, 60);
      expect(sleeping.sleepUntilVirtualMinutes).toBe(hours * 60);
      const awake = advancePet(sleeping, hours * 60_000, 60);
      expect(awake.ageVirtualMinutes).toBe(hours * 60);
      expect(isSleeping(awake)).toBe(false);
    }
  });

  it("allows hydration to recognize a nap that finished while closed", () => {
    const persistedSleepingPet = startSleep(createNewPet(0), 1, 0, 60);
    const hydratedPet = advancePet(persistedSleepingPet, 60_000, 60);
    expect(isSleeping(persistedSleepingPet)).toBe(true);
    expect(isSleeping(hydratedPet)).toBe(false);
  });

  it("splits a large offline jump between sleep recovery and awake decay", () => {
    const pet = {
      ...createNewPet(0),
      needs: { ...createNewPet(0).needs, energy: 20 },
    };
    const sleeping = startSleep(pet, 2, 0, 60);
    const afterJump = advancePet(sleeping, 180_000, 60);
    expect(afterJump.ageVirtualMinutes).toBe(180);
    expect(afterJump.needs.energy).toBe(88);
    expect(isSleeping(afterJump)).toBe(false);
  });

  it("accumulates sleeping recovery over sequential one-second ticks", () => {
    for (const rate of [1, 12, 60]) {
      let pet = startSleep(
        {
          ...createNewPet(0),
          needs: { ...createNewPet(0).needs, energy: 20 },
        },
        8,
        0,
        rate,
      );
      for (let second = 1; second <= 10; second += 1) {
        pet = advancePet(pet, second * 1_000, rate);
      }
      expect(pet.needs.energy).toBeGreaterThan(20);
      expect(isSleeping(pet)).toBe(true);
    }
  });

  it("blocks care while asleep and permits a forced wake", () => {
    const pet = startSleep(createNewPet(0), 4, 0, 60);
    expect(canCareForPet(pet)).toBe(false);
    expect(careForPet(pet, "feed", 0, 60)).toEqual(pet);
    const awake = wakePet(pet, 0, 60);
    expect(isSleeping(awake)).toBe(false);
    expect(careForPet(awake, "feed", 0, 60).needs.hunger).toBeGreaterThan(
      awake.needs.hunger,
    );
  });

  it("does not auto-sleep at low energy", () => {
    const tired = {
      ...createNewPet(0),
      needs: { ...createNewPet(0).needs, energy: 1 },
    };
    expect(isSleeping(advancePet(tired, 60_000, 60))).toBe(false);
  });

  it("migrates V2 safely and validates strict V3 schema", () => {
    const current = createNewPet(2);
    const { introCompleted, sleepUntilVirtualMinutes, ...v2Base } = current;
    const v2 = { ...v2Base, version: 2 as const, isSleeping: true };
    const migrated = migratePetState(v2);
    expect(migrated).toMatchObject({
      version: 3,
      ageVirtualMinutes: current.ageVirtualMinutes,
      introCompleted: false,
      sleepUntilVirtualMinutes: 120,
    });
    expect(isPetState(migrated)).toBe(true);
    expect(isPetState({ ...current, extra: true })).toBe(false);
    expect(isPetState({ ...current, introCompleted: "yes" })).toBe(false);
    expect(isPetState({ ...current, sleepUntilVirtualMinutes: -1 })).toBe(false);
  });

  it("keeps the default rate explicit", () => {
    expect(DEFAULT_CLOCK_MULTIPLIER).toBe(12);
  });

  it("creates a reset-ready Baby Jack state", () => {
    const pet = createNewPet(123);
    expect(pet).toMatchObject({
      version: 3,
      createdAt: 123,
      lastUpdatedAt: 123,
      ageVirtualMinutes: 0,
      introCompleted: false,
      sleepUntilVirtualMinutes: null,
    });
  });
});
