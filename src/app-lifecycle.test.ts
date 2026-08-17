import { describe, expect, it } from "vitest";
import {
  MAX_CONTINUOUS_ACTIVE_TICK_MS,
  applyAppTimeEvent,
  createAppTimeCoordinator,
  type AppTimeState,
} from "./app-lifecycle";
import {
  DEFAULT_CLOCK_MULTIPLIER,
  MAX_OFFLINE_PET_MINUTES,
  STARVATION_DEATH_MINUTES,
  careForPet,
  createNewPet,
  startSleep,
  type PetState,
} from "./simulation";

function adoptedPet(now = 0, overrides: Partial<PetState> = {}): PetState {
  return {
    ...createNewPet(now),
    adoptionCompleted: true,
    ...overrides,
  };
}

function appState(pet: PetState, overrides: Partial<AppTimeState> = {}): AppTimeState {
  return {
    pet,
    screen: "room",
    foreground: true,
    careReachable: true,
    ...overrides,
  };
}

describe("App Safe Return lifecycle", () => {
  it("uses a 1× player clock by default", () => {
    expect(DEFAULT_CLOCK_MULTIPLIER).toBe(1);
    const state = applyAppTimeEvent(appState(adoptedPet()), {
      type: "TICK",
      now: 60_000,
    });
    expect(state.pet.ageVirtualMinutes).toBe(1);
  });

  it("stamps but never decays or ages before adoption", () => {
    const pet = createNewPet(0);
    const title = applyAppTimeEvent(appState(pet, { screen: "title" }), {
      type: "TICK",
      now: 60 * 60_000,
    });
    const hub = applyAppTimeEvent({ ...title, screen: "hub" }, {
      type: "TICK",
      now: 2 * 60 * 60_000,
      testMultiplier: 3_600,
    });
    expect(hub.pet).toEqual({ ...pet, lastUpdatedAt: 2 * 60 * 60_000 });

    const adopted = applyAppTimeEvent(hub, {
      type: "ADOPT_AND_ENTER_ROOM",
      now: 2 * 60 * 60_000,
    });
    expect(adopted).toMatchObject({ screen: "room", pet: { adoptionCompleted: true } });
    expect(adopted.pet.needs).toEqual(pet.needs);
    expect(adopted.pet.ageVirtualMinutes).toBe(0);
  });

  it("allows active starvation only in the foreground care room", () => {
    const hungry = adoptedPet(0, {
      needs: { hunger: 0, happiness: 80, energy: 76, hygiene: 88 },
      starvationVirtualMinutes: 119,
    });
    for (const screen of ["title", "hub", "settings"] as const) {
      const next = applyAppTimeEvent(appState(hungry, { screen }), {
        type: "TICK",
        now: 60_000,
      });
      expect(next.pet.isDead).toBe(false);
      expect(next.pet.starvationVirtualMinutes).toBe(119);
    }
    let room = appState(hungry);
    for (let second = 1; second <= 60; second += 1) {
      room = applyAppTimeEvent(room, {
        type: "TICK",
        now: second * 1_000,
      });
    }
    expect(room.pet.isDead).toBe(true);
    expect(room.pet.starvationVirtualMinutes).toBe(STARVATION_DEATH_MINUTES);
  });

  it.each(["Sleep", "Training", "Restart", "careLocked"])(
    "pauses exact active-starvation time across the %s blocking boundary",
    () => {
      const hungry = adoptedPet(0, {
        needs: { hunger: 0, happiness: 80, energy: 76, hygiene: 88 },
        starvationVirtualMinutes: 119,
      });
      const blocked = applyAppTimeEvent(appState(hungry), {
        type: "CARE_REACHABILITY",
        now: 0,
        reachable: false,
      });
      const waited = applyAppTimeEvent(blocked, {
        type: "TICK",
        now: 60 * 60_000,
      });
      const repeatedBoundary = applyAppTimeEvent(waited, {
        type: "CARE_REACHABILITY",
        now: 2 * 60 * 60_000,
        reachable: false,
      });
      const reopened = applyAppTimeEvent(repeatedBoundary, {
        type: "CARE_REACHABILITY",
        now: 2 * 60 * 60_000,
        reachable: true,
      });
      expect(reopened.pet.isDead).toBe(false);
      expect(reopened.pet.starvationVirtualMinutes).toBe(119);
      expect(reopened.pet.lastUpdatedAt).toBe(2 * 60 * 60_000);

      let active = reopened;
      for (let second = 1; second <= 59; second += 1) {
        active = applyAppTimeEvent(active, {
          type: "TICK",
          now: 2 * 60 * 60_000 + second * 1_000,
        });
      }
      expect(active.pet.isDead).toBe(false);
      expect(
        applyAppTimeEvent(active, {
          type: "TICK",
          now: 2 * 60 * 60_000 + 60_000,
        }).pet.isDead,
      ).toBe(true);
    },
  );

  it("settles the reachable side of an access boundary before pausing", () => {
    const hungry = adoptedPet(0, {
      needs: { hunger: 0, happiness: 80, energy: 76, hygiene: 88 },
      starvationVirtualMinutes: 119,
    });
    let reachable = appState(hungry);
    for (let second = 1; second <= 58; second += 1) {
      reachable = applyAppTimeEvent(reachable, {
        type: "TICK",
        now: second * 1_000,
      });
    }
    const blockedAt59 = applyAppTimeEvent(reachable, {
      type: "CARE_REACHABILITY",
      now: 59_000,
      reachable: false,
    });
    expect(blockedAt59.pet.isDead).toBe(false);
    expect(blockedAt59.pet.starvationVirtualMinutes).toBeCloseTo(
      119 + 59 / 60,
      8,
    );
    const reopened = applyAppTimeEvent(blockedAt59, {
      type: "CARE_REACHABILITY",
      now: 60 * 60_000,
      reachable: true,
    });
    expect(reopened.pet.starvationVirtualMinutes).toBeCloseTo(
      119 + 59 / 60,
      8,
    );
    expect(
      applyAppTimeEvent(reopened, {
        type: "TICK",
        now: 60 * 60_000 + 1_000,
      }).pet.isDead,
    ).toBe(true);
  });

  it("settles foreground room time, pauses background ticks, and catches up once", () => {
    const start = appState(adoptedPet());
    const backgrounded = applyAppTimeEvent(start, {
      type: "VISIBILITY",
      now: 1_000,
      foreground: false,
    });
    expect(backgrounded.foreground).toBe(false);
    expect(backgrounded.pet.ageVirtualMinutes).toBeCloseTo(1 / 60, 8);

    const ignored = applyAppTimeEvent(backgrounded, {
      type: "TICK",
      now: 60 * 60_000,
      testMultiplier: 3_600,
    });
    expect(ignored).toEqual(backgrounded);

    const resumed = applyAppTimeEvent(ignored, {
      type: "VISIBILITY",
      now: 60 * 60_000,
      foreground: true,
    });
    const repeated = applyAppTimeEvent(resumed, {
      type: "VISIBILITY",
      now: 60 * 60_000,
      foreground: true,
    });
    expect(resumed.pet.lastUpdatedAt).toBe(60 * 60_000);
    expect(repeated).toEqual(resumed);
  });

  it("treats timer suspension and huge forward clock jumps as offline", () => {
    const hungry = adoptedPet(0, {
      needs: { hunger: 0, happiness: 80, energy: 76, hygiene: 88 },
      starvationVirtualMinutes: 119,
    });
    const suspended = applyAppTimeEvent(appState(hungry), {
      type: "TICK",
      now: MAX_CONTINUOUS_ACTIVE_TICK_MS + 1,
      testMultiplier: 3_600,
    });
    const huge = applyAppTimeEvent(appState(hungry), {
      type: "TICK",
      now: Number.MAX_VALUE,
      testMultiplier: 3_600,
    });
    for (const state of [suspended, huge]) {
      expect(state.pet.isDead).toBe(false);
      expect(state.pet.starvationVirtualMinutes).toBe(119);
    }
    expect(huge.pet.ageVirtualMinutes).toBe(MAX_OFFLINE_PET_MINUTES);
    expect(huge.pet.lastUpdatedAt).toBe(Number.MAX_VALUE);
  });

  it("handles backward and invalid lifecycle clocks without mutation", () => {
    const state = appState(adoptedPet(1_000));
    expect(applyAppTimeEvent(state, { type: "TICK", now: 999 })).toEqual(state);
    expect(applyAppTimeEvent(state, { type: "TICK", now: Number.NaN })).toEqual(state);
    expect(
      applyAppTimeEvent(
        { ...state, foreground: false },
        { type: "VISIBILITY", now: Number.POSITIVE_INFINITY, foreground: true },
      ).pet,
    ).toEqual(state.pet);
  });

  it("keeps offline results invariant to the injected QA multiplier", () => {
    const start = appState(adoptedPet(), { foreground: false });
    const resumed = applyAppTimeEvent(start, {
      type: "VISIBILITY",
      now: 4 * 60 * 60_000,
      foreground: true,
    });
    const suspended = applyAppTimeEvent(appState(adoptedPet()), {
      type: "TICK",
      now: 4 * 60 * 60_000,
      testMultiplier: 3_600,
    });
    expect(suspended.pet).toEqual(resumed.pet);
  });

  it("keeps an already-dead save frozen through every lifecycle event", () => {
    const dead = adoptedPet(0, {
      isDead: true,
      starvationVirtualMinutes: STARVATION_DEATH_MINUTES,
      sleepUntilVirtualMinutes: null,
    });
    const backgrounded = applyAppTimeEvent(appState(dead), {
      type: "VISIBILITY",
      now: 10_000,
      foreground: false,
    });
    const resumed = applyAppTimeEvent(backgrounded, {
      type: "VISIBILITY",
      now: 10 * 60 * 60_000,
      foreground: true,
    });
    expect(resumed.pet).toEqual(dead);
  });

  it("preserves active-care death and feed-before-threshold behavior", () => {
    const hungry = adoptedPet(0, {
      needs: { hunger: 0, happiness: 80, energy: 76, hygiene: 88 },
      starvationVirtualMinutes: 119,
    });
    let almost = appState(hungry);
    for (let second = 1; second <= 59; second += 1) {
      almost = applyAppTimeEvent(almost, {
        type: "TICK",
        now: second * 1_000,
      });
    }
    expect(almost.pet.isDead).toBe(false);
    const dead = applyAppTimeEvent(almost, {
      type: "TICK",
      now: 60_000,
    });
    expect(dead.pet.isDead).toBe(true);
    expect(careForPet(hungry, "feed", 0).starvationVirtualMinutes).toBe(0);
  });

  it("advances naps safely while away, including a partway wake", () => {
    const sleeping = startSleep(adoptedPet(), 2, 0);
    const entirelyAsleep = applyAppTimeEvent(
      appState(sleeping, { foreground: false }),
      { type: "VISIBILITY", now: 60 * 60_000, foreground: true },
    );
    expect(entirelyAsleep.pet.sleepUntilVirtualMinutes).toBe(120);
    expect(entirelyAsleep.pet.needs.energy).toBeGreaterThan(sleeping.needs.energy);

    const partwayAwake = applyAppTimeEvent(
      appState(sleeping, { foreground: false }),
      { type: "VISIBILITY", now: 3 * 60 * 60_000, foreground: true },
    );
    expect(partwayAwake.pet.sleepUntilVirtualMinutes).toBeNull();
    expect(partwayAwake.pet.ageVirtualMinutes).toBe(180);
  });

  it("retains background-before-hydration absence and consumes it once on resume", () => {
    const coordinator = createAppTimeCoordinator({
      screen: "title",
      foreground: true,
      careReachable: false,
    });
    coordinator.apply({
      type: "VISIBILITY",
      now: 1_000,
      foreground: false,
    });
    const saved = adoptedPet(0);
    const hydrated = coordinator.hydrateLoadedPet(saved, 2_000);
    expect(hydrated.pet).toEqual(saved);

    const resumedAt = 6 * 60_000;
    const resumed = coordinator.apply({
      type: "VISIBILITY",
      now: resumedAt,
      foreground: true,
    });
    expect(resumed.pet?.lastUpdatedAt).toBe(resumedAt);
    expect(resumed.pet?.ageVirtualMinutes).toBe(6);

    const repeated = coordinator.apply({
      type: "VISIBILITY",
      now: resumedAt,
      foreground: true,
    });
    expect(repeated).toEqual(resumed);
  });
});
