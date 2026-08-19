import { describe, expect, it } from "vitest";
import {
  BOOP_COOLDOWN_MS,
  CLEANING_DURATION_MS,
  DEFAULT_CLOCK_MULTIPLIER,
  ATTENTION_DECAY_AWAKE_PER_MINUTE,
  ATTENTION_DECAY_SLEEPING_PER_MINUTE,
  GROWTH_STEP_MINUTES,
  MAX_ELAPSED_REAL_MS,
  MAX_OFFLINE_PET_MINUTES,
  STARVATION_DEATH_MINUTES,
  advancePet,
  advancePetOffline,
  canBoop,
  canCareForPet,
  careForPet,
  createNewPet,
  getBoopReaction,
  getCleaningPhase,
  getGrowthStage,
  getHygieneAppearance,
  getVirtualClock,
  giveMedicine,
  isPetState,
  isSleeping,
  isValidNickname,
  migratePetState,
  normalizeNickname,
  startSleep,
  switchClockRate,
  wakePet,
  type LegacyNeeds,
  type Needs,
  type PetState,
} from "./simulation";

function adoptedPet(now = 0, overrides: Partial<PetState> = {}): PetState {
  return {
    ...createNewPet(now),
    adoptionCompleted: true,
    ...overrides,
  };
}

describe("V7 health, attention, and legacy simulation", () => {
  it("creates a strict reset-ready New Baby Jack at 8:00 AM", () => {
    const pet = createNewPet(123);
    expect(pet).toMatchObject({
      version: 7,
      wellbeingLastUpdatedAt: 123,
      needs: expect.objectContaining({ health: 100, attention: 80 }),
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
      const pet = advancePet(adoptedPet(0), 1000, rate);
      expect(pet.ageVirtualMinutes).toBeCloseTo(rate / 60, 8);
      expect(pet.needs.hunger).toBeLessThan(adoptedPet(0).needs.hunger);
    }
  });

  it("keeps old-rate continuity when switching clocks", () => {
    const changed = switchClockRate(adoptedPet(0), 1000, 12, 60);
    expect(changed.pet.ageVirtualMinutes).toBeCloseTo(0.2, 8);
    expect(advancePet(changed.pet, 2000, changed.rate).ageVirtualMinutes).toBeCloseTo(1.2, 8);
  });

  it("handles rollback and large jumps safely", () => {
    const pet = adoptedPet(1000);
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
    const base: Needs = {
      hunger: 100,
      energy: 100,
      hygiene: 100,
      happiness: 100,
      health: 100,
      attention: 100,
    };
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
    const start = adoptedPet(0);
    const hungry = { ...start, needs: { ...start.needs, hunger: 90 } };
    const first = careForPet(hungry, "feed", 0, 3600);
    expect(careForPet(first, "feed", 0, 3600).growthMeals).toBe(1);
    const rearmed = advancePet(first, 1000, 3600);
    expect(rearmed.growthMealReady).toBe(true);
    expect(careForPet(rearmed, "feed", 1000, 3600).growthMeals).toBe(2);
  });

  it("never grows a no-feed pet and freezes on death", () => {
    const start = adoptedPet(0);
    const hungry = { ...start, needs: { ...start.needs, hunger: 0 }, growthMeals: 0 };
    const dead = advancePet(hungry, 20 * 60 * 60 * 1000, 60);
    expect(dead.isDead).toBe(true);
    expect(getGrowthStage(dead)).toBe("baby");
    expect(advancePet(dead, 30 * 60 * 60 * 1000, 3600)).toEqual(dead);
  });

  it("kills Jack exactly at 120 zero-hunger pet minutes", () => {
    const start = adoptedPet(0);
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
    const start = adoptedPet(0);
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
      const asleep = startSleep(adoptedPet(0), hours, 0, 60);
      expect(asleep.sleepUntilVirtualMinutes).toBe(hours * 60);
      expect(isSleeping(advancePet(asleep, hours * 60_000, 60))).toBe(false);
    }
    const asleep = startSleep(adoptedPet(0), 4, 0, 60);
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

  it("decays attention at the exact awake and sleeping rates and restores 28 with Play", () => {
    const awake = advancePet(adoptedPet(0), 60 * 60_000);
    expect(ATTENTION_DECAY_AWAKE_PER_MINUTE).toBe(0.1);
    expect(awake.needs.attention).toBeCloseTo(74, 8);

    const sleeping = startSleep(adoptedPet(0), 2, 0);
    const afterSleepHour = advancePet(sleeping, 60 * 60_000);
    expect(ATTENTION_DECAY_SLEEPING_PER_MINUTE).toBe(0.04);
    expect(afterSleepHour.needs.attention).toBeCloseTo(77.6, 8);

    const lonely = adoptedPet(0, {
      needs: { ...createNewPet(0).needs, attention: 30 },
    });
    expect(careForPet(lonely, "play", 0).needs.attention).toBe(58);
    expect(careForPet(adoptedPet(0), "play", 0).needs.attention).toBe(100);
  });

  it("applies exact additive neglect health decay only for time below 20", () => {
    const neglected = adoptedPet(0, {
      needs: {
        ...createNewPet(0).needs,
        hunger: 19,
        hygiene: 19,
        attention: 19,
        health: 100,
      },
    });
    const afterTenMinutes = advancePet(neglected, 10 * 60_000);
    expect(afterTenMinutes.needs.health).toBeCloseTo(99.1, 8);

    const crossing = adoptedPet(0, {
      needs: {
        ...createNewPet(0).needs,
        hunger: 20.32,
        health: 90,
      },
    });
    const afterTwoMinutes = advancePet(crossing, 2 * 60_000);
    expect(afterTwoMinutes.needs.health).toBeCloseTo(89.96, 8);

    const caredFor = advancePet(adoptedPet(0), 60 * 60_000);
    expect(caredFor.needs.health).toBe(100);
  });

  it("uses bounded medicine without cost, resurrection, or a new death cause", () => {
    const unwell = adoptedPet(0, {
      needs: { ...createNewPet(0).needs, health: 49 },
      starvationVirtualMinutes: 17,
    });
    const treated = giveMedicine(unwell, 0);
    expect(treated.needs.health).toBe(74);
    expect(treated.starvationVirtualMinutes).toBe(17);
    expect(treated.ageVirtualMinutes).toBe(0);
    expect(giveMedicine({ ...unwell, needs: { ...unwell.needs, health: 79 } }, 0).needs.health).toBe(100);
    expect(giveMedicine({ ...unwell, needs: { ...unwell.needs, health: 80 } }, 0).needs.health).toBe(80);

    const zeroHealth = advancePet(
      { ...unwell, needs: { ...unwell.needs, health: 0 } },
      60_000,
    );
    expect(zeroHealth.isDead).toBe(false);
    const dead = {
      ...unwell,
      needs: { ...unwell.needs, health: 0 },
      starvationVirtualMinutes: STARVATION_DEATH_MINUTES,
      isDead: true,
    };
    expect(giveMedicine(dead, 60_000)).toEqual(dead);
  });

  it("caps offline attention and health change at four pet hours without offline death", () => {
    const neglected = adoptedPet(0, {
      needs: {
        ...createNewPet(0).needs,
        hunger: 0,
        hygiene: 0,
        attention: 0,
        health: 60,
      },
      starvationVirtualMinutes: 119,
    });
    const atCap = advancePetOffline(neglected, 4 * 60 * 60_000);
    const aboveCap = advancePetOffline(neglected, 40 * 60 * 60_000);
    expect(aboveCap.needs).toEqual(atCap.needs);
    expect(atCap.needs.health).toBeCloseTo(38.4, 8);
    expect(atCap.needs.attention).toBe(0);
    expect(atCap.starvationVirtualMinutes).toBe(119);
    expect(atCap.isDead).toBe(false);
  });

  it("preserves all six needs across backward clocks and freezes them after starvation death", () => {
    const pet = adoptedPet(10_000, {
      needs: {
        ...createNewPet(0).needs,
        health: 37,
        attention: 22,
      },
    });
    expect(advancePet(pet, 9_999)).toEqual(pet);
    const dead = advancePet(
      {
        ...pet,
        lastUpdatedAt: 10_000,
        wellbeingLastUpdatedAt: 10_000,
        needs: { ...pet.needs, hunger: 0 },
        starvationVirtualMinutes: 119,
      },
      70_000,
    );
    expect(dead.isDead).toBe(true);
    expect(advancePet(dead, Number.MAX_SAFE_INTEGER)).toEqual(dead);
  });

  it("migrates strict V1 through V6 into safe V7 state without retroactive wellbeing decay", () => {
    const base = createNewPet(0);
    const legacyNeeds: LegacyNeeds = {
      hunger: base.needs.hunger,
      happiness: base.needs.happiness,
      energy: base.needs.energy,
      hygiene: base.needs.hygiene,
    };
    const common = {
      id: base.id,
      name: base.name,
      createdAt: 0,
      lastUpdatedAt: 0,
      needs: legacyNeeds,
    };
    const v1 = { version: 1 as const, ...common };
    const v2 = { version: 2 as const, ...common, ageVirtualMinutes: 50, isSleeping: false };
    const v3 = { version: 3 as const, ...common, ageVirtualMinutes: 900, introCompleted: true, sleepUntilVirtualMinutes: null };
    const v4 = { ...v3, version: 4 as const, growthMeals: 3, growthMealReady: false };
    const v5 = {
      ...v4,
      version: 5 as const,
      backgroundId: "sunny" as const,
      starvationVirtualMinutes: 0,
      isDead: false,
    };
    const { introCompleted, backgroundId, ...v5Rest } = v5;
    const v6 = {
      ...v5Rest,
      version: 6 as const,
      adoptionCompleted: introCompleted,
      roomTheme: "cozy" as const,
    };
    const upgradeAt = 4 * 60 * 60_000;
    for (const old of [v1, v2, v3, v4, v5, v6]) {
      const migrated = migratePetState(old, upgradeAt);
      expect(migrated?.version).toBe(7);
      expect(migrated?.roomTheme).toBe("cozy");
      expect(migrated?.isDead).toBe(false);
      expect(migrated?.needs.health).toBe(100);
      expect(migrated?.needs.attention).toBe(80);
      expect(migrated?.wellbeingLastUpdatedAt).toBe(upgradeAt);
      const caughtUp = advancePetOffline(migrated!, upgradeAt);
      expect(caughtUp.needs.health).toBe(100);
      expect(caughtUp.needs.attention).toBe(80);
      expect(caughtUp.ageVirtualMinutes).toBeGreaterThanOrEqual(
        migrated!.ageVirtualMinutes,
      );
      expect(caughtUp.lastUpdatedAt).toBe(upgradeAt);
    }
    expect(migratePetState(v4, 10_000)?.growthMeals).toBe(3);
    expect(migratePetState(v3, 10_000)?.adoptionCompleted).toBe(true);
  });

  it("migrates each strict V5 background and intro field to V7", () => {
    const base = createNewPet(0);
    const {
      adoptionCompleted,
      roomTheme,
      version,
      wellbeingLastUpdatedAt: _wellbeingLastUpdatedAt,
      needs,
      ...rest
    } = base;
    const { health: _health, attention: _attention, ...legacyNeeds } = needs;
    const mapping = [
      ["sunny", "cozy"],
      ["night", "blue"],
      ["yard", "garden"],
    ] as const;
    for (const [backgroundId, expectedTheme] of mapping) {
      const v5 = {
        ...rest,
        needs: legacyNeeds,
        version: 5,
        introCompleted: true,
        backgroundId,
      };
      expect(migratePetState(v5)).toMatchObject({
        version: 7,
        adoptionCompleted: true,
        roomTheme: expectedTheme,
      });
    }
    expect(adoptionCompleted).toBe(false);
    expect(roomTheme).toBe("cozy");
    expect(version).toBe(7);
  });

  it("validates strict six-need V7 schema and persisted themes", () => {
    const pet = createNewPet(0);
    expect(isPetState({ ...pet, roomTheme: "garden" })).toBe(true);
    expect(isPetState({ ...pet, extra: true })).toBe(false);
    expect(isPetState({ ...pet, roomTheme: "space" })).toBe(false);
    expect(isPetState({ ...pet, name: "" })).toBe(false);
    expect(isPetState({ ...pet, isDead: true })).toBe(false);
    expect(isPetState({ ...pet, starvationVirtualMinutes: 120 })).toBe(false);
    const { health: _health, ...fiveNeeds } = pet.needs;
    expect(isPetState({ ...pet, needs: fiveNeeds })).toBe(false);
    expect(isPetState({ ...pet, version: 6 })).toBe(false);
  });

  it("rejects parseable legacy data that is not strict", () => {
    const base = createNewPet(0);
    const {
      adoptionCompleted,
      roomTheme,
      version,
      wellbeingLastUpdatedAt: _wellbeingLastUpdatedAt,
      needs,
      ...rest
    } = base;
    const { health: _health, attention: _attention, ...legacyNeeds } = needs;
    expect(
      migratePetState({
        ...rest,
        needs: legacyNeeds,
        version: 5,
        introCompleted: adoptionCompleted,
        backgroundId: "sunny",
        extra: true,
      }),
    ).toBeNull();
    expect(roomTheme).toBe("cozy");
    expect(version).toBe(7);
  });

  it("retains the explicit default rate", () => {
    expect(DEFAULT_CLOCK_MULTIPLIER).toBe(1);
  });

  it("stamps pre-adoption time without replaying need decay or age", () => {
    const pet = createNewPet(1_000);
    const stamped = advancePet(pet, 24 * 60 * 60_000, 3_600);
    expect(stamped).toEqual({
      ...pet,
      lastUpdatedAt: 24 * 60 * 60_000,
      wellbeingLastUpdatedAt: 24 * 60 * 60_000,
    });
  });

  it.each([
    [4 * 60 * 60_000 - 1, MAX_OFFLINE_PET_MINUTES - 1 / 60_000],
    [4 * 60 * 60_000, MAX_OFFLINE_PET_MINUTES],
    [40 * 60 * 60_000, MAX_OFFLINE_PET_MINUTES],
  ])("caps fixed-rate offline time for %i ms at %f pet minutes", (now, expected) => {
    const next = advancePetOffline(adoptedPet(), now);
    expect(next.ageVirtualMinutes).toBeCloseTo(expected, 8);
    expect(next.lastUpdatedAt).toBe(now);
  });

  it("stamps full now so one absence cannot be consumed repeatedly", () => {
    const now = 40 * 60 * 60_000;
    const first = advancePetOffline(adoptedPet(), now);
    expect(first.ageVirtualMinutes).toBe(MAX_OFFLINE_PET_MINUTES);
    expect(advancePetOffline(first, now)).toEqual(first);
    expect(advancePetOffline(first, now + 60_000).ageVirtualMinutes).toBe(
      MAX_OFFLINE_PET_MINUTES + 1,
    );
  });

  it.each([0, 0.5, 119])(
    "preserves %s starvation minutes and prevents death while offline",
    (starvationVirtualMinutes) => {
      const pet = adoptedPet(0, {
        needs: { ...createNewPet(0).needs, hunger: 0 },
        starvationVirtualMinutes,
      });
      const next = advancePetOffline(pet, 4 * 60 * 60_000);
      expect(next.needs.hunger).toBe(0);
      expect(next.starvationVirtualMinutes).toBe(starvationVirtualMinutes);
      expect(next.isDead).toBe(false);
    },
  );

  it("lets hunger cross zero offline without starting starvation", () => {
    const pet = adoptedPet(0, {
      needs: { ...createNewPet(0).needs, hunger: 0.01 },
      starvationVirtualMinutes: 0.5,
    });
    const next = advancePetOffline(pet, 60_000);
    expect(next.needs.hunger).toBe(0);
    expect(next.starvationVirtualMinutes).toBe(0.5);
    expect(next.isDead).toBe(false);
  });

  it("leaves already-dead saves frozen offline", () => {
    const dead = adoptedPet(0, {
      isDead: true,
      starvationVirtualMinutes: STARVATION_DEATH_MINUTES,
      sleepUntilVirtualMinutes: null,
    });
    expect(advancePetOffline(dead, Number.MAX_VALUE)).toEqual(dead);
  });
});
