import { describe, expect, it } from "vitest";
import {
  BOOP_COOLDOWN_MS,
  CLEANING_DURATION_MS,
  DEFAULT_CLOCK_MULTIPLIER,
  GROWTH_STEP_MINUTES,
  MAX_ELAPSED_REAL_MS,
  STARVATION_DEATH_MINUTES,
  advancePet,
  canBoop,
  canCareForPet,
  careForPet,
  createNewPet,
  getBoopReaction,
  getCleaningPhase,
  getGrowthStage,
  getHygieneAppearance,
  getVirtualClock,
  isPetState,
  isSleeping,
  isValidNickname,
  migratePetState,
  normalizeNickname,
  startSleep,
  switchClockRate,
  wakePet,
  type Needs,
} from "./simulation";

describe("V0.5 V6 simulation", () => {
  it("creates a strict reset-ready New Baby Jack at 8:00 AM", () => {
    const pet = createNewPet(123);
    expect(pet).toMatchObject({
      version: 6,
      ageVirtualMinutes: 0,
      roomTheme: "cozy",
      starvationVirtualMinutes: 0,
      isDead: false,
      adoptionCompleted: false,
      name: "Jack",
    });
    expect(getVirtualClock(pet.ageVirtualMinutes)).toMatchObject({
      day: 1,
      label: "08:00 AM",
      daypart: "morning",
    });
    expect(isPetState(pet)).toBe(true);
  });

  it("trims nicknames, limits them to 12 characters, and rejects blanks", () => {
    expect(normalizeNickname("  Snoopy Jack Junior  ")).toBe("Snoopy Jack");
    expect(normalizeNickname("   ")).toBe("");
    expect(isValidNickname("Jack")).toBe(true);
    expect(isValidNickname(" Jack ")).toBe(false);
    expect(isValidNickname("1234567890123")).toBe(false);
  });

  it("derives exact daylight boundaries and wraps midnight", () => {
    expect(getVirtualClock(119).daypart).toBe("morning");
    expect(getVirtualClock(120)).toMatchObject({ label: "10:00 AM", daypart: "day" });
    expect(getVirtualClock(539).daypart).toBe("day");
    expect(getVirtualClock(540)).toMatchObject({ label: "05:00 PM", daypart: "dusk" });
    expect(getVirtualClock(719).daypart).toBe("dusk");
    expect(getVirtualClock(720)).toMatchObject({ label: "08:00 PM", daypart: "night" });
    expect(getVirtualClock(960)).toMatchObject({ day: 2, label: "12:00 AM", daypart: "night" });
    expect(getVirtualClock(1320)).toMatchObject({ day: 2, label: "06:00 AM", daypart: "morning" });
  });

  it("suggests night through derived time without forcing sleep", () => {
    const nighttime = { ...createNewPet(0), ageVirtualMinutes: 720 };
    expect(getVirtualClock(nighttime.ageVirtualMinutes).daypart).toBe("night");
    expect(isSleeping(nighttime)).toBe(false);
    expect(nighttime.sleepUntilVirtualMinutes).toBeNull();
  });

  it("decays fractional one-second ticks at accelerated rates", () => {
    for (const rate of [1, 12, 60, 3600]) {
      const pet = advancePet(createNewPet(0), 1000, rate);
      expect(pet.ageVirtualMinutes).toBeCloseTo(rate / 60, 8);
      expect(pet.needs.hunger).toBeLessThan(createNewPet(0).needs.hunger);
    }
  });

  it("keeps old-rate continuity when switching clocks", () => {
    const changed = switchClockRate(createNewPet(0), 1000, 12, 60);
    expect(changed.pet.ageVirtualMinutes).toBeCloseTo(0.2, 8);
    expect(advancePet(changed.pet, 2000, changed.rate).ageVirtualMinutes).toBeCloseTo(1.2, 8);
  });

  it("handles rollback and large jumps safely", () => {
    const pet = createNewPet(1000);
    expect(advancePet(pet, 999, 3600)).toEqual(pet);
    expect(advancePet(pet, 1000 + MAX_ELAPSED_REAL_MS * 10, 12).needs).toEqual(
      advancePet(pet, 1000 + MAX_ELAPSED_REAL_MS, 12).needs,
    );
  });

  it("maps hygiene to clear, dust, mud, and stink at exact thresholds", () => {
    expect(getHygieneAppearance(60)).toBe("clear");
    expect(getHygieneAppearance(59.99)).toBe("dust");
    expect(getHygieneAppearance(35)).toBe("dust");
    expect(getHygieneAppearance(34.99)).toBe("mud");
    expect(getHygieneAppearance(15)).toBe("mud");
    expect(getHygieneAppearance(14.99)).toBe("stink");
  });

  it("runs the complete 1.5 second cleaning phase contract", () => {
    expect(getCleaningPhase(-1)).toBeNull();
    expect(getCleaningPhase(0)).toBe("water");
    expect(getCleaningPhase(399)).toBe("water");
    expect(getCleaningPhase(400)).toBe("washout");
    expect(getCleaningPhase(799)).toBe("washout");
    expect(getCleaningPhase(800)).toBe("shake");
    expect(getCleaningPhase(1149)).toBe("shake");
    expect(getCleaningPhase(1150)).toBe("sparkle");
    expect(getCleaningPhase(CLEANING_DURATION_MS - 1)).toBe("sparkle");
    expect(getCleaningPhase(CLEANING_DURATION_MS)).toBeNull();
  });

  it("uses exact Boop priority without mutating needs", () => {
    const base: Needs = { hunger: 100, energy: 100, hygiene: 100, happiness: 100 };
    const cases: [Needs, string][] = [
      [{ ...base, hunger: 20, energy: 0, hygiene: 0, happiness: 0 }, "whine"],
      [{ ...base, hunger: 21, energy: 25, hygiene: 0, happiness: 0 }, "grumble"],
      [{ ...base, energy: 26, hygiene: 35, happiness: 0 }, "sneeze"],
      [{ ...base, hygiene: 36, happiness: 30 }, "huff"],
      [base, "bark"],
    ];
    for (const [needs, kind] of cases) {
      const before = structuredClone(needs);
      expect(getBoopReaction(needs).kind).toBe(kind);
      expect(needs).toEqual(before);
    }
    expect(cases.filter(([needs]) => getBoopReaction(needs).kind === "bark")).toHaveLength(1);
  });

  it("blocks Boop while sleeping, dead, or cooling down", () => {
    const pet = createNewPet(0);
    expect(canBoop(pet, 1000, 1000)).toBe(true);
    expect(canBoop(pet, 999, 1000)).toBe(false);
    expect(canBoop(startSleep(pet, 1, 0), 2000, 0)).toBe(false);
    expect(canBoop({ ...pet, isDead: true }, 2000, 0)).toBe(false);
    expect(BOOP_COOLDOWN_MS).toBe(1200);
  });

  it("requires both meal credits and age at exact growth boundaries", () => {
    const pet = createNewPet(0);
    expect(getGrowthStage({ ...pet, ageVirtualMinutes: GROWTH_STEP_MINUTES, growthMeals: 0 })).toBe("baby");
    expect(getGrowthStage({ ...pet, ageVirtualMinutes: GROWTH_STEP_MINUTES - 0.01, growthMeals: 1 })).toBe("baby");
    expect(getGrowthStage({ ...pet, ageVirtualMinutes: GROWTH_STEP_MINUTES, growthMeals: 1 })).toBe("little-puppy");
  });

  it("does not farm feeds and re-arms after a hunger cycle", () => {
    const start = createNewPet(0);
    const hungry = { ...start, needs: { ...start.needs, hunger: 90 } };
    const first = careForPet(hungry, "feed", 0, 3600);
    expect(careForPet(first, "feed", 0, 3600).growthMeals).toBe(1);
    const rearmed = advancePet(first, 1000, 3600);
    expect(rearmed.growthMealReady).toBe(true);
    expect(careForPet(rearmed, "feed", 1000, 3600).growthMeals).toBe(2);
  });

  it("never grows a no-feed pet and freezes on death", () => {
    const start = createNewPet(0);
    const hungry = { ...start, needs: { ...start.needs, hunger: 0 }, growthMeals: 0 };
    const dead = advancePet(hungry, 20 * 60 * 60 * 1000, 60);
    expect(dead.isDead).toBe(true);
    expect(getGrowthStage(dead)).toBe("baby");
    expect(advancePet(dead, 30 * 60 * 60 * 1000, 3600)).toEqual(dead);
  });

  it("kills Jack exactly at 120 zero-hunger pet minutes", () => {
    const start = createNewPet(0);
    const pet = {
      ...start,
      needs: { ...start.needs, hunger: 0 },
      starvationVirtualMinutes: STARVATION_DEATH_MINUTES - 1,
    };
    expect(advancePet(pet, 900, 60).isDead).toBe(false);
    const dead = advancePet(pet, 1000, 60);
    expect(dead.isDead).toBe(true);
    expect(dead.starvationVirtualMinutes).toBe(STARVATION_DEATH_MINUTES);
  });

  it("feeding before death clears starvation progress", () => {
    const start = createNewPet(0);
    const pet = {
      ...start,
      needs: { ...start.needs, hunger: 0 },
      starvationVirtualMinutes: 119,
    };
    const fed = careForPet(pet, "feed", 0, 60);
    expect(fed.starvationVirtualMinutes).toBe(0);
    expect(fed.isDead).toBe(false);
  });

  it("supports timed naps, automatic wake, and forced wake", () => {
    for (const hours of [1, 2, 4, 8]) {
      const asleep = startSleep(createNewPet(0), hours, 0, 60);
      expect(asleep.sleepUntilVirtualMinutes).toBe(hours * 60);
      expect(isSleeping(advancePet(asleep, hours * 60_000, 60))).toBe(false);
    }
    const asleep = startSleep(createNewPet(0), 4, 0, 60);
    expect(canCareForPet(asleep)).toBe(false);
    expect(isSleeping(wakePet(asleep, 0))).toBe(false);
  });

  it("keeps sleep and care disabled after death", () => {
    const dead = {
      ...createNewPet(0),
      isDead: true,
      starvationVirtualMinutes: 120,
      sleepUntilVirtualMinutes: null,
    };
    expect(canCareForPet(dead)).toBe(false);
    expect(careForPet(dead, "feed", 1000)).toEqual(dead);
    expect(startSleep(dead, 2, 1000)).toEqual(dead);
    expect(wakePet(dead, 1000)).toEqual(dead);
  });

  it("migrates strict V1 through V4 into safe V6 state", () => {
    const base = createNewPet(0);
    const common = {
      id: base.id,
      name: base.name,
      createdAt: 0,
      lastUpdatedAt: 0,
      needs: base.needs,
    };
    const v1 = { version: 1 as const, ...common };
    const v2 = { version: 2 as const, ...common, ageVirtualMinutes: 50, isSleeping: false };
    const v3 = { version: 3 as const, ...common, ageVirtualMinutes: 900, introCompleted: true, sleepUntilVirtualMinutes: null };
    const v4 = { ...v3, version: 4 as const, growthMeals: 3, growthMealReady: false };
    for (const old of [v1, v2, v3, v4]) {
      const migrated = migratePetState(old);
      expect(migrated?.version).toBe(6);
      expect(migrated?.roomTheme).toBe("cozy");
      expect(migrated?.isDead).toBe(false);
    }
    expect(migratePetState(v4)?.growthMeals).toBe(3);
    expect(migratePetState(v3)?.adoptionCompleted).toBe(true);
  });

  it("migrates each strict V5 background and intro field to V6", () => {
    const base = createNewPet(0);
    const { adoptionCompleted, roomTheme, version, ...rest } = base;
    const mapping = [
      ["sunny", "cozy"],
      ["night", "blue"],
      ["yard", "garden"],
    ] as const;
    for (const [backgroundId, expectedTheme] of mapping) {
      const v5 = {
        ...rest,
        version: 5,
        introCompleted: true,
        backgroundId,
      };
      expect(migratePetState(v5)).toMatchObject({
        version: 6,
        adoptionCompleted: true,
        roomTheme: expectedTheme,
      });
    }
    expect(adoptionCompleted).toBe(false);
    expect(roomTheme).toBe("cozy");
    expect(version).toBe(6);
  });

  it("validates strict V6 schema and persisted themes", () => {
    const pet = createNewPet(0);
    expect(isPetState({ ...pet, roomTheme: "garden" })).toBe(true);
    expect(isPetState({ ...pet, extra: true })).toBe(false);
    expect(isPetState({ ...pet, roomTheme: "space" })).toBe(false);
    expect(isPetState({ ...pet, name: "" })).toBe(false);
    expect(isPetState({ ...pet, isDead: true })).toBe(false);
    expect(isPetState({ ...pet, starvationVirtualMinutes: 120 })).toBe(false);
  });

  it("rejects parseable legacy data that is not strict", () => {
    const base = createNewPet(0);
    const { adoptionCompleted, roomTheme, version, ...rest } = base;
    expect(
      migratePetState({
        ...rest,
        version: 5,
        introCompleted: adoptionCompleted,
        backgroundId: "sunny",
        extra: true,
      }),
    ).toBeNull();
    expect(roomTheme).toBe("cozy");
    expect(version).toBe(6);
  });

  it("retains the explicit default rate", () => {
    expect(DEFAULT_CLOCK_MULTIPLIER).toBe(12);
  });
});
