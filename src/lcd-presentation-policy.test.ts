import { describe, expect, it } from "vitest";
import { createNewPet } from "./simulation";
import {
  getLcdSemanticLabel,
  getLcdStatusTreatment,
  LCD_ACTIVITY_TREATMENTS,
  resolveLcdFrameIndex,
} from "./lcd-presentation-policy";
import {
  createPetPresentationModel,
  type PetPresentationActivity,
} from "./pet-presentation-model";

const activities: PetPresentationActivity[] = [
  "idle",
  "sleep",
  "feed",
  "play",
  "clean",
  "training",
  "reward",
  "dirty",
  "tired",
  "health-warning",
  "attention-warning",
  "medicine",
  "death",
];

function model(health = 100) {
  const pet = {
    ...createNewPet(0),
    adoptionCompleted: true,
    needs: { ...createNewPet(0).needs, health },
  };
  return createPetPresentationModel({
    pet,
    emote: null,
    cleaningPhase: null,
    trainingAction: null,
    trainingTreatVisible: false,
    medicineFeedback: false,
    careLocked: false,
    careReachable: true,
    reducedMotion: false,
  });
}

describe("Quiet Care Monitor LCD policy", () => {
  it("assigns every required semantic state a two- or three-frame treatment", () => {
    expect(Object.keys(LCD_ACTIVITY_TREATMENTS).sort()).toEqual(
      [...activities].sort(),
    );
    activities.forEach((activity) => {
      const treatment = LCD_ACTIVITY_TREATMENTS[activity];
      expect([2, 3]).toContain(treatment.frameCount);
      expect(treatment.label.length).toBeGreaterThan(0);
      expect(treatment.icon.length).toBeGreaterThan(0);
      expect(treatment.pattern.length).toBeGreaterThan(0);
    });
  });

  it("cycles only discrete frames and pins reduced motion to a meaningful end frame", () => {
    activities.forEach((activity) => {
      const count = LCD_ACTIVITY_TREATMENTS[activity].frameCount;
      expect(
        resolveLcdFrameIndex({ activity, reducedMotion: false, tick: count }),
      ).toBe(0);
      expect(
        resolveLcdFrameIndex({ activity, reducedMotion: true, tick: 0 }),
      ).toBe(count - 1);
      expect(
        resolveLcdFrameIndex({ activity, reducedMotion: true, tick: 999 }),
      ).toBe(count - 1);
    });
  });

  it("uses explicit icon, text, and pattern semantics rather than warning color alone", () => {
    const needsCare = getLcdStatusTreatment(model(65));
    expect(needsCare).toEqual({
      warning: true,
      icon: "!",
      pattern: "///",
      label: "NEEDS CARE",
    });

    const unwell = model(42);
    const treatment = getLcdStatusTreatment(unwell);
    expect(treatment).toEqual({
      warning: true,
      icon: "!",
      pattern: "///",
      label: "UNWELL",
    });
    const label = getLcdSemanticLabel(unwell);
    expect(label).toContain("Health status Unwell");
    expect(label).toContain("Give medicine first");
    expect(label).toContain("Alerts: health");
  });
});
