import { describe, expect, it } from "vitest";
import {
  UP_CONTACT_SHADOW_STYLE,
  resolveSettledUpContactShadows,
} from "./up-contact-shadow-policy";

describe("settled Up contact-shadow policy", () => {
  it("appears only during the settled training_up reward-wait pose", () => {
    expect(resolveSettledUpContactShadows({ clip: "training_up", large: false, poseHeld: false, stage: "baby" })).toEqual([]);
    expect(resolveSettledUpContactShadows({ clip: "idle", large: false, poseHeld: true, stage: "baby" })).toEqual([]);
    expect(resolveSettledUpContactShadows({ clip: "training_up", large: false, poseHeld: true, stage: "baby" })).toHaveLength(2);
  });

  it("projects the diagnosed hind-paw contacts through the existing room transform", () => {
    const phone = resolveSettledUpContactShadows({ clip: "training_up", large: false, poseHeld: true, stage: "baby" });
    const desktop = resolveSettledUpContactShadows({ clip: "training_up", large: true, poseHeld: true, stage: "little-puppy" });

    expect(phone[0]).toEqual([
      0.531193582711174,
      0.002,
      0.23961509994192487,
    ]);
    expect(phone[1]).toEqual([
      0.06565142316485165,
      0.002,
      0.5162235506621967,
    ]);
    expect(desktop).toHaveLength(2);
    expect(desktop[0][1]).toBe(0.002);
    expect(desktop[1][1]).toBe(0.002);
  });

  it("keeps each contact shadow restrained and below the approved paw clearance", () => {
    expect(UP_CONTACT_SHADOW_STYLE.y).toBeGreaterThan(0);
    expect(UP_CONTACT_SHADOW_STYLE.y).toBeLessThan(0.005);
    expect(UP_CONTACT_SHADOW_STYLE.radius).toBeLessThanOrEqual(0.18);
    expect(UP_CONTACT_SHADOW_STYLE.opacity).toBeLessThanOrEqual(0.32);
    expect(UP_CONTACT_SHADOW_STYLE.scale[1]).toBeLessThan(0.5);
  });
});
