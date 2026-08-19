import { describe, expect, it } from "vitest";
import { createNewPet, startSleep } from "./simulation";
import {
  getHealthBand,
  getMedicineAvailability,
  getStatusRecommendation,
  healthBandLabels,
  resolveHealthPlayerIntent,
} from "./pet-care-policy";

const adopted = () => ({ ...createNewPet(0), adoptionCompleted: true });

describe("App-used health, status, and medicine intents", () => {
  it.each([
    [100, "great", "Great"],
    [80, "great", "Great"],
    [79, "needs-care", "Needs Care"],
    [50, "needs-care", "Needs Care"],
    [49, "unwell", "Unwell"],
    [1, "unwell", "Unwell"],
    [0, "very-unwell", "Very Unwell"],
  ] as const)("maps health %s to %s", (health, band, label) => {
    expect(getHealthBand(health)).toBe(band);
    expect(healthBandLabels[band]).toBe(label);
  });

  it("uses the exact approved recommendation priority", () => {
    const base = adopted();
    const cases = [
      [{ health: 49, hunger: 0, hygiene: 0, attention: 0, energy: 0, happiness: 0 }, "medicine"],
      [{ health: 50, hunger: 20, hygiene: 0, attention: 0, energy: 0, happiness: 0 }, "feed"],
      [{ health: 50, hunger: 21, hygiene: 35, attention: 0, energy: 0, happiness: 0 }, "clean"],
      [{ health: 50, hunger: 21, hygiene: 36, attention: 35, energy: 0, happiness: 0 }, "play"],
      [{ health: 50, hunger: 21, hygiene: 36, attention: 36, energy: 25, happiness: 0 }, "rest"],
      [{ health: 50, hunger: 21, hygiene: 36, attention: 36, energy: 26, happiness: 30 }, "play"],
      [{ health: 50, hunger: 21, hygiene: 36, attention: 36, energy: 26, happiness: 31 }, "well"],
    ] as const;
    for (const [needs, expected] of cases) {
      expect(getStatusRecommendation({ ...base, needs }).intent).toBe(expected);
    }
  });

  it("keeps Status read-only", () => {
    const pet = adopted();
    const result = resolveHealthPlayerIntent({ pet, intent: "status", now: 60_000 });
    expect(result).toEqual({ pet, allowed: true, reason: null, mutated: false });
  });

  it("gives +25 medicine only below 80 and caps at 100", () => {
    for (const [health, expected] of [[0, 25], [49, 74], [79, 100]] as const) {
      const pet = { ...adopted(), needs: { ...adopted().needs, health } };
      const result = resolveHealthPlayerIntent({ pet, intent: "medicine", now: 0 });
      expect(result).toMatchObject({ allowed: true, mutated: true, reason: null });
      expect(result.pet.needs.health).toBe(expected);
    }
    const healthy = { ...adopted(), needs: { ...adopted().needs, health: 80 } };
    expect(resolveHealthPlayerIntent({ pet: healthy, intent: "medicine", now: 0 })).toMatchObject({
      allowed: false,
      mutated: false,
      reason: "healthy",
    });
  });

  it("blocks medicine while dead, sleeping, locked, or unreachable", () => {
    const low = { ...adopted(), needs: { ...adopted().needs, health: 40 } };
    const dead = {
      ...low,
      isDead: true,
      starvationVirtualMinutes: 120,
      sleepUntilVirtualMinutes: null,
    };
    expect(getMedicineAvailability({ pet: dead, careLocked: false, careReachable: true }).reason).toBe("dead");
    expect(getMedicineAvailability({ pet: startSleep(low, 1, 0), careLocked: false, careReachable: true }).reason).toBe("sleeping");
    expect(getMedicineAvailability({ pet: low, careLocked: true, careReachable: true }).reason).toBe("care-locked");
    expect(getMedicineAvailability({ pet: low, careLocked: false, careReachable: false }).reason).toBe("care-unreachable");
  });
});
