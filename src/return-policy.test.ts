import { describe, expect, it } from "vitest";
import { createNewPet, type PetState } from "./simulation";
import {
  RETURN_SUMMARY_MIN_REAL_MS,
  getLowestNeed,
  getReturnSummary,
} from "./return-policy";

function adoptedPet(overrides: Partial<PetState> = {}): PetState {
  return {
    ...createNewPet(1_000),
    adoptionCompleted: true,
    ...overrides,
  };
}

describe("return policy", () => {
  it("uses a stable care priority when needs tie", () => {
    const pet = adoptedPet({
      needs: { hunger: 30, happiness: 30, energy: 30, hygiene: 30 },
    });
    expect(getLowestNeed(pet.needs)).toBe("hunger");
  });

  it("does not announce a return before adoption or after a brief reload", () => {
    const newPet = createNewPet(1_000);
    expect(
      getReturnSummary({
        before: newPet,
        after: newPet,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toBeNull();

    const adopted = adoptedPet();
    expect(
      getReturnSummary({
        before: adopted,
        after: adopted,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS - 1,
      }),
    ).toBeNull();
  });

  it("turns the lowest need into one clear next action", () => {
    const before = adoptedPet();
    const after = adoptedPet({
      needs: { hunger: 12, happiness: 70, energy: 68, hygiene: 72 },
    });
    expect(
      getReturnSummary({
        before,
        after,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toBe("Welcome back! Jack’s hunger is very low. Feed Jack first.");
  });

  it.each([
    {
      needs: { hunger: 70, happiness: 75, energy: 35, hygiene: 80 },
      expected: "Welcome back! Jack could use some care: energy is 35%. Let Jack rest soon.",
    },
    {
      needs: { hunger: 70, happiness: 75, energy: 80, hygiene: 34 },
      expected: "Welcome back! Jack could use some care: hygiene is 34%. A gentle clean would help.",
    },
    {
      needs: { hunger: 70, happiness: 33, energy: 80, hygiene: 75 },
      expected: "Welcome back! Jack could use some care: happiness is 33%. A little play would help.",
    },
  ])("summarizes a $expected return", ({ needs, expected }) => {
    const before = adoptedPet();
    const after = adoptedPet({ needs });
    expect(
      getReturnSummary({
        before,
        after,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toBe(expected);
  });

  it("reports a healthy return without manufacturing a reward", () => {
    const before = adoptedPet();
    const after = adoptedPet({
      needs: { hunger: 71, happiness: 74, energy: 76, hygiene: 80 },
    });
    expect(
      getReturnSummary({
        before,
        after,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toBe(
      "Welcome back! Jack is doing well. His lowest need is hunger at 71%.",
    );
  });

  it("announces an in-progress nap and terminal state explicitly", () => {
    const before = adoptedPet();
    const sleeping = adoptedPet({ sleepUntilVirtualMinutes: 60 });
    expect(
      getReturnSummary({
        before,
        after: sleeping,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toContain("still resting");

    const dead = adoptedPet({
      isDead: true,
      starvationVirtualMinutes: 120,
      sleepUntilVirtualMinutes: null,
    });
    expect(
      getReturnSummary({
        before,
        after: dead,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toBe("While you were away, Jack’s story ended.");

    expect(
      getReturnSummary({
        before: dead,
        after: dead,
        elapsedRealMs: RETURN_SUMMARY_MIN_REAL_MS,
      }),
    ).toBeNull();
  });
});
