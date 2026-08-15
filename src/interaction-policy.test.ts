import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInteractionScheduler,
  getBoopAvailability,
  getTerminalUiPolicy,
  resolvePetInteraction,
  resetTransientAnimations,
  restoreMessagePresentation,
  type PetInteraction,
} from "./interaction-policy";
import {
  BOOP_COOLDOWN_MS,
  STARVATION_DEATH_MINUTES,
  createNewPet,
  startSleep,
} from "./simulation";

afterEach(() => vi.useRealTimers());

describe("interaction-time policy", () => {
  it("gives death precedence over every care, sleep, wake, and Boop side effect", () => {
    const start = createNewPet(0);
    const crossing = {
      ...start,
      needs: { ...start.needs, hunger: 0 },
      starvationVirtualMinutes: STARVATION_DEATH_MINUTES - 1,
    };
    const actions: PetInteraction[] = ["feed", "play", "clean", "sleep", "wake", "boop"];
    for (const interaction of actions) {
      const result = resolvePetInteraction({
        pet: crossing,
        interaction,
        now: 1000,
        multiplier: 60,
      });
      expect(result).toMatchObject({ allowed: false, reason: "dead" });
      expect(result.pet.isDead).toBe(true);
    }
  });

  it("uses one Boop availability rule for sleep, cleaning, death, and cooldown", () => {
    const pet = createNewPet(0);
    expect(getBoopAvailability(pet, 1000, 0, false).available).toBe(true);
    expect(getBoopAvailability(pet, 1000, 1000 + BOOP_COOLDOWN_MS, false)).toMatchObject({
      available: false,
      reason: "Boop is cooling down.",
    });
    expect(getBoopAvailability(pet, 1000, 0, true).available).toBe(false);
    expect(getBoopAvailability(startSleep(pet, 1, 0), 1000, 0, false).available).toBe(false);
    expect(getBoopAvailability({ ...pet, isDead: true }, 1000, 0, false).available).toBe(false);
  });

  it("freezes terminal UI and suppresses mutable settings and decorations", () => {
    expect(getTerminalUiPolicy({ isDead: false }).terminal).toBe(false);
    expect(getTerminalUiPolicy({ isDead: true })).toEqual({
      terminal: true,
      terminalMessage: "Oh no — Jack’s story ended.",
      settingsDisabled: true,
      mutableControlsDisabled: true,
      suppressDecorations: true,
    });
  });
});

describe("interaction cancellation", () => {
  it("synchronously stops and zeros feed, zoom, and pulse before cleaning", () => {
    const calls: string[] = [];
    const animation = (name: string) => ({
      stopAnimation: () => calls.push(`${name}:stop`),
      setValue: (value: number) => calls.push(`${name}:set:${value}`),
    });
    resetTransientAnimations([
      animation("feed"),
      animation("zoom"),
      animation("pulse"),
    ]);
    expect(calls).toEqual([
      "feed:stop",
      "feed:set:0",
      "zoom:stop",
      "zoom:set:0",
      "pulse:stop",
      "pulse:set:0",
    ]);
  });

  it("prevents cleaning callbacks from mutating a restarted pet", () => {
    vi.useFakeTimers();
    const scheduler = createInteractionScheduler();
    const cleaningToken = scheduler.begin();
    const mutateNewPet = vi.fn();
    scheduler.schedule(cleaningToken, 1500, mutateNewPet);
    scheduler.cancel();
    vi.advanceTimersByTime(1500);
    expect(mutateNewPet).not.toHaveBeenCalled();
    expect(scheduler.isCurrent(cleaningToken)).toBe(false);
  });

  it("clears a faded action timer and restores message opacity before cleaning", () => {
    vi.useFakeTimers();
    const staleMessage = vi.fn();
    const timer = setTimeout(staleMessage, 1);
    const opacity = { stopAnimation: vi.fn(), setValue: vi.fn() };
    expect(restoreMessagePresentation(timer, opacity)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(staleMessage).not.toHaveBeenCalled();
    expect(opacity.stopAnimation).toHaveBeenCalledOnce();
    expect(opacity.setValue).toHaveBeenCalledWith(1);
  });
});
