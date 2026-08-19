import { describe, expect, it, vi } from "vitest";
import { getMedicineAvailability, getStatusRecommendation } from "./pet-care-policy";
import * as persistence from "./persistence";
import * as simulation from "./simulation";
import {
  createPetPresentationModel,
  DEFAULT_PRESENTATION_MODE,
  PET_PRESENTATION_NEED_ORDER,
  PRESENTATION_MODE_MIN_TARGET_PX,
  PRESENTATION_MODE_PERSISTED,
  resolvePetPresentationActivity,
  resolvePresentationModeSwitch,
  resolvePresentationRenderer,
  type PetPresentationInput,
} from "./pet-presentation-model";
import {
  createNewPet,
  startSleep,
  type PetState,
} from "./simulation";

const basePet = (): PetState => ({
  ...createNewPet(0),
  adoptionCompleted: true,
});

function input(
  pet: PetState = basePet(),
  overrides: Partial<PetPresentationInput> = {},
): PetPresentationInput {
  return {
    pet,
    emote: null,
    cleaningPhase: null,
    trainingAction: null,
    trainingTreatVisible: false,
    medicineFeedback: false,
    careLocked: false,
    careReachable: true,
    reducedMotion: false,
    ...overrides,
  };
}

describe("shared pet presentation model", () => {
  it("defaults to 3D, resolves every mode explicitly, and never aliases color pixel to 3D", () => {
    expect(DEFAULT_PRESENTATION_MODE).toBe("three-d");
    expect(resolvePresentationRenderer("three-d")).toBe("three-d");
    expect(resolvePresentationRenderer("color-pixel")).toBe("color-pixel");
    expect(resolvePresentationRenderer("lcd")).toBe("lcd");
    expect(PRESENTATION_MODE_PERSISTED).toBe(false);
    expect(PRESENTATION_MODE_MIN_TARGET_PX).toBeGreaterThanOrEqual(44);
  });

  it("deep-freezes one exact six-need V7 view in stable presenter order", () => {
    const pet = basePet();
    const model = createPetPresentationModel(input(pet));
    expect(model.sourcePetVersion).toBe(7);
    expect(model.needs.map((need) => need.key)).toEqual(
      PET_PRESENTATION_NEED_ORDER,
    );
    expect(model.needs.map((need) => need.value)).toEqual([
      pet.needs.hunger,
      pet.needs.happiness,
      pet.needs.energy,
      pet.needs.hygiene,
      pet.needs.health,
      pet.needs.attention,
    ]);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.needs)).toBe(true);
    expect(model.needs.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(model.clock)).toBe(true);
    expect(Object.isFrozen(model.healthBand)).toBe(true);
    expect(Object.isFrozen(model.recommendation)).toBe(true);
    expect(Object.isFrozen(model.medicine)).toBe(true);
    expect(Object.isFrozen(model.visual)).toBe(true);
    expect(Object.isFrozen(model.warnings)).toBe(true);
  });

  it("keeps Status and Medicine results identical to the approved V7 care policy", () => {
    const pet = {
      ...basePet(),
      needs: { ...basePet().needs, health: 42, attention: 25 },
    };
    const model = createPetPresentationModel(input(pet));
    expect(model.recommendation).toEqual(getStatusRecommendation(pet));
    expect(model.medicine).toEqual(
      getMedicineAvailability({
        pet,
        careLocked: false,
        careReachable: true,
      }),
    );
    expect(model.warnings).toEqual(["health", "attention"]);
  });

  it("switches only the session presenter while returning exact state/model references", () => {
    const pet = basePet();
    const model = createPetPresentationModel(input(pet));
    const beforePet = JSON.stringify(pet);
    const beforeModel = JSON.stringify(model);
    const advance = vi.spyOn(simulation, "advancePet");
    const persist = vi.spyOn(persistence, "savePet");
    const switched = resolvePresentationModeSwitch(pet, model, "lcd");

    expect(switched).toEqual({
      mode: "lcd",
      pet,
      model,
      advanced: false,
      persisted: false,
    });
    expect(switched.pet).toBe(pet);
    expect(switched.model).toBe(model);
    expect(JSON.stringify(pet)).toBe(beforePet);
    expect(JSON.stringify(model)).toBe(beforeModel);
    expect(advance).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    advance.mockRestore();
    persist.mockRestore();
  });

  it.each([
    ["death", { pet: { ...basePet(), isDead: true } }],
    ["sleep", { pet: startSleep(basePet(), 1, 0) }],
    ["clean", { cleaningPhase: "water" }],
    ["medicine", { medicineFeedback: true }],
    ["reward", { trainingAction: "happy-hop" }],
    ["reward", { trainingTreatVisible: true }],
    ["training", { trainingAction: "paw" }],
    ["feed", { emote: "feeding" }],
    ["feed", { emote: "fed" }],
    ["play", { emote: "toy" }],
    [
      "health-warning",
      { pet: { ...basePet(), needs: { ...basePet().needs, health: 49 } } },
    ],
    [
      "attention-warning",
      { pet: { ...basePet(), needs: { ...basePet().needs, attention: 35 } } },
    ],
    [
      "dirty",
      { pet: { ...basePet(), needs: { ...basePet().needs, hygiene: 34 } } },
    ],
    [
      "tired",
      { pet: { ...basePet(), needs: { ...basePet().needs, energy: 25 } } },
    ],
    ["idle", {}],
  ] as const)("maps %s semantic activity deterministically", (expected, overrides) => {
    const merged = input(
      "pet" in overrides && overrides.pet ? overrides.pet : basePet(),
      overrides as Partial<PetPresentationInput>,
    );
    expect(resolvePetPresentationActivity(merged)).toBe(expected);
    expect(createPetPresentationModel(merged).activity).toBe(expected);
  });

  it("uses terminal, sleep, and active feedback precedence over simultaneous warnings", () => {
    const warningNeeds = {
      ...basePet().needs,
      health: 0,
      attention: 0,
      hygiene: 0,
      energy: 0,
    };
    expect(
      createPetPresentationModel(
        input({ ...basePet(), needs: warningNeeds, isDead: true }, { emote: "toy" }),
      ).activity,
    ).toBe("death");
    expect(
      createPetPresentationModel(
        input(startSleep({ ...basePet(), needs: warningNeeds }, 1, 0), {
          medicineFeedback: true,
        }),
      ).activity,
    ).toBe("sleep");
    expect(
      createPetPresentationModel(
        input({ ...basePet(), needs: warningNeeds }, { medicineFeedback: true }),
      ).activity,
    ).toBe("medicine");
  });
});
