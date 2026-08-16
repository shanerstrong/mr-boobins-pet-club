import { describe, expect, it } from "vitest";
import clipManifest from "../assets/3d/jack/v2/animations/clip-manifest-v2.json";
import {
  isJack3DStageSupported,
  isLoopingJack3DClip,
  resolveJack3DClip,
  type Jack3DVisualState,
} from "./jack-3d-policy";

const idle: Jack3DVisualState = {
  cleaningPhase: null,
  dead: false,
  emote: null,
  hygieneAppearance: "clear",
  sleeping: false,
  tired: false,
  trainingAction: null,
  trainingTreatVisible: false,
};

describe("Jack 3D presentation policy", () => {
  it("maps every training action to its validated V2 clip", () => {
    expect(resolveJack3DClip({ ...idle, trainingAction: "sit" })).toBe("training_sit");
    expect(resolveJack3DClip({ ...idle, trainingAction: "paw" })).toBe("training_paw");
    expect(resolveJack3DClip({ ...idle, trainingAction: "up" })).toBe("training_up");
    expect(resolveJack3DClip({ ...idle, trainingAction: "eating" })).toBe("training_treat_eat");
    expect(resolveJack3DClip({ ...idle, trainingAction: "happy-hop" })).toBe("celebration_happy_hop");
    expect(resolveJack3DClip({ ...idle, trainingAction: "spin-wag" })).toBe("celebration_spin_wag");
    expect(resolveJack3DClip({ ...idle, trainingAction: "goofy-shimmy" })).toBe("celebration_goofy_shimmy");
  });

  it("gives treat contact and terminal states the correct priority", () => {
    expect(resolveJack3DClip({ ...idle, trainingAction: "sit", trainingTreatVisible: true })).toBe("training_treat_receive");
    expect(resolveJack3DClip({ ...idle, dead: true, sleeping: true, trainingAction: "paw" })).toBe("death_rest");
    expect(resolveJack3DClip({ ...idle, sleeping: true, trainingAction: "paw" })).toBe("sleep");
  });

  it("maps established care states without changing simulation policy", () => {
    expect(resolveJack3DClip({ ...idle, cleaningPhase: "shake" })).toBe("clean_reaction");
    expect(resolveJack3DClip({ ...idle, emote: "feeding" })).toBe("feed");
    expect(resolveJack3DClip({ ...idle, emote: "toy" })).toBe("play");
    expect(resolveJack3DClip({ ...idle, tired: true })).toBe("tired");
    expect(resolveJack3DClip({ ...idle, hygieneAppearance: "mud" })).toBe("dirty");
    expect(resolveJack3DClip({ ...idle, emote: "bark" })).toBe("tail_wag");
    expect(resolveJack3DClip(idle)).toBe("idle");
  });

  it("uses the validated Baby skin only for its contracted growth stages", () => {
    expect(isJack3DStageSupported("baby")).toBe(true);
    expect(isJack3DStageSupported("little-puppy")).toBe(true);
    expect(isJack3DStageSupported("puppy")).toBe(false);
    expect(isJack3DStageSupported("young-dog")).toBe(false);
    expect(isJack3DStageSupported("adult")).toBe(false);
  });

  it("loops only persistent poses", () => {
    expect(isLoopingJack3DClip("idle")).toBe(true);
    expect(isLoopingJack3DClip("sleep")).toBe(true);
    expect(isLoopingJack3DClip("tired")).toBe(true);
    expect(isLoopingJack3DClip("training_sit")).toBe(false);
  });

  it("resolves only clips present in the validated V2 package", () => {
    const available = new Set(clipManifest.clips.map((clip) => clip.name));
    const states: Jack3DVisualState[] = [
      idle,
      { ...idle, trainingAction: "sit" },
      { ...idle, trainingAction: "paw" },
      { ...idle, trainingAction: "up" },
      { ...idle, trainingAction: "eating" },
      { ...idle, trainingTreatVisible: true },
      { ...idle, trainingAction: "happy-hop" },
      { ...idle, trainingAction: "spin-wag" },
      { ...idle, trainingAction: "goofy-shimmy" },
      { ...idle, cleaningPhase: "water" },
      { ...idle, emote: "feeding" },
      { ...idle, emote: "toy" },
      { ...idle, tired: true },
      { ...idle, hygieneAppearance: "mud" },
      { ...idle, dead: true },
      { ...idle, sleeping: true },
    ];
    for (const state of states) {
      expect(available.has(resolveJack3DClip(state))).toBe(true);
    }
  });
});
