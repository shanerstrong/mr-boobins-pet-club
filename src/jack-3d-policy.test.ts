import { describe, expect, it } from "vitest";
import clipManifest from "../assets/3d/jack/v2/animations/clip-manifest-v2.3.json";
import {
  JACK_3D_RUNTIME_PACKAGE,
  isJack3DStageSupported,
  isLoopingJack3DClip,
  resolveJack3DClip,
  shouldUseJack3DRuntime,
  shouldTreatJack3DContextLossAsFailure,
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
  it("identifies the complete V2.3 canine-motion runtime and transition blend", () => {
    expect(JACK_3D_RUNTIME_PACKAGE).toEqual({
      asset: "jack-baby-v2.3-all-clips.glb",
      blendSeconds: 0.22,
      clipCount: 28,
      id: "baby-v2.3",
      retargetedCanineClips: [
        "idle",
        "walk",
        "run",
        "tail_wag",
        "feed",
        "sleep",
        "wake",
        "play",
        "clean_reaction",
        "boop_comfortable",
        "boop_need_hunger",
        "boop_need_energy",
        "boop_need_hygiene",
        "boop_need_happiness",
        "boop_rejected",
        "tired",
        "dirty",
        "death_rest",
        "training_attention",
        "training_sit",
        "training_paw",
        "training_up",
        "training_treat_receive",
        "training_treat_eat",
        "celebration_happy_hop",
        "celebration_spin_wag",
        "celebration_goofy_shimmy",
        "training_return_idle",
      ],
    });
    expect(JACK_3D_RUNTIME_PACKAGE.blendSeconds).toBeGreaterThan(0);
    expect(JACK_3D_RUNTIME_PACKAGE.blendSeconds).toBeLessThan(0.3);
    expect(clipManifest.clips).toHaveLength(JACK_3D_RUNTIME_PACKAGE.clipCount);
  });

  it("maps every training action to its validated V2.3 clip", () => {
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

  it("uses the stable bed illustration for sleep and other established fallbacks", () => {
    expect(
      shouldUseJack3DRuntime({
        dead: false,
        modelAvailable: true,
        reduced: false,
        sleeping: false,
        stage: "baby",
        trainingModeOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldUseJack3DRuntime({
        dead: false,
        modelAvailable: true,
        reduced: false,
        sleeping: true,
        stage: "baby",
        trainingModeOpen: false,
      }),
    ).toBe(false);
    expect(
      shouldUseJack3DRuntime({
        dead: false,
        modelAvailable: true,
        reduced: true,
        sleeping: false,
        stage: "baby",
        trainingModeOpen: false,
      }),
    ).toBe(false);
    expect(
      shouldUseJack3DRuntime({
        dead: false,
        modelAvailable: false,
        reduced: false,
        sleeping: false,
        stage: "baby",
        trainingModeOpen: false,
      }),
    ).toBe(false);
    expect(
      shouldUseJack3DRuntime({
        dead: true,
        modelAvailable: true,
        reduced: false,
        sleeping: false,
        stage: "baby",
        trainingModeOpen: false,
      }),
    ).toBe(false);
    expect(
      shouldUseJack3DRuntime({
        dead: false,
        modelAvailable: true,
        reduced: false,
        sleeping: false,
        stage: "baby",
        trainingModeOpen: true,
      }),
    ).toBe(false);
  });

  it("does not turn an intentional sleep-fallback teardown into a permanent 3D failure", () => {
    expect(shouldTreatJack3DContextLossAsFailure(true)).toBe(true);
    expect(shouldTreatJack3DContextLossAsFailure(false)).toBe(false);
  });

  it("loops only persistent poses", () => {
    expect(isLoopingJack3DClip("idle")).toBe(true);
    expect(isLoopingJack3DClip("sleep")).toBe(true);
    expect(isLoopingJack3DClip("tired")).toBe(true);
    expect(isLoopingJack3DClip("training_sit")).toBe(false);
  });

  it("resolves only clips present in the validated V2.3 manifest", () => {
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
