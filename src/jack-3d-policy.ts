import type { DogEmote, TrainingVisualAction } from "./pixel-dog";
import type {
  CleaningPhase,
  GrowthStage,
  HygieneAppearance,
} from "./simulation";

export type Jack3DClipName =
  | "idle"
  | "tail_wag"
  | "feed"
  | "sleep"
  | "play"
  | "clean_reaction"
  | "tired"
  | "dirty"
  | "death_rest"
  | "training_sit"
  | "training_paw"
  | "training_up"
  | "training_treat_receive"
  | "training_treat_eat"
  | "celebration_happy_hop"
  | "celebration_spin_wag"
  | "celebration_goofy_shimmy";

export type Jack3DVisualState = {
  cleaningPhase: CleaningPhase | null;
  dead: boolean;
  emote: DogEmote;
  hygieneAppearance: HygieneAppearance;
  sleeping: boolean;
  tired: boolean;
  trainingAction: TrainingVisualAction;
  trainingTreatVisible: boolean;
};

const TRAINING_CLIP: Exclude<TrainingVisualAction, null | "eating"> extends infer T
  ? Record<Extract<T, string>, Jack3DClipName>
  : never = {
  sit: "training_sit",
  paw: "training_paw",
  up: "training_up",
  "happy-hop": "celebration_happy_hop",
  "spin-wag": "celebration_spin_wag",
  "goofy-shimmy": "celebration_goofy_shimmy",
};

export function isJack3DStageSupported(stage: GrowthStage): boolean {
  return stage === "baby" || stage === "little-puppy";
}

/** Pure presentation mapping; this never mutates pet or training state. */
export function resolveJack3DClip(state: Jack3DVisualState): Jack3DClipName {
  if (state.dead) return "death_rest";
  if (state.sleeping) return "sleep";
  if (state.trainingTreatVisible) return "training_treat_receive";
  if (state.trainingAction === "eating") return "training_treat_eat";
  if (state.trainingAction) return TRAINING_CLIP[state.trainingAction];
  if (state.cleaningPhase) return "clean_reaction";
  if (state.emote === "feeding" || state.emote === "fed") return "feed";
  if (state.emote === "toy") return "play";
  if (state.tired || state.emote === "yawn") return "tired";
  if (state.hygieneAppearance !== "clear") return "dirty";
  if (state.emote === "happy" || state.emote === "bark") return "tail_wag";
  return "idle";
}

export function isLoopingJack3DClip(clip: Jack3DClipName): boolean {
  return clip === "idle" || clip === "sleep" || clip === "tired";
}
