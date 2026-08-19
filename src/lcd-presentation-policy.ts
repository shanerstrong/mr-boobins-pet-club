import type {
  PetPresentationActivity,
  PetPresentationModel,
} from "./pet-presentation-model";

export type LcdJackPose =
  | "stand"
  | "curl"
  | "eat"
  | "play"
  | "wash"
  | "train"
  | "reward"
  | "droop"
  | "medicine"
  | "rest";

export type LcdActivityTreatment = Readonly<{
  pose: LcdJackPose;
  label: string;
  icon: string;
  pattern: string;
  frameCount: 2 | 3;
}>;

export const LCD_ACTIVITY_TREATMENTS: Readonly<
  Record<PetPresentationActivity, LcdActivityTreatment>
> = Object.freeze({
  idle: Object.freeze({
    pose: "stand",
    label: "READY TO CARE",
    icon: "○",
    pattern: "···",
    frameCount: 2,
  }),
  sleep: Object.freeze({
    pose: "curl",
    label: "SLEEPING",
    icon: "Zz",
    pattern: "— · —",
    frameCount: 2,
  }),
  feed: Object.freeze({
    pose: "eat",
    label: "SNACK TIME",
    icon: "◆",
    pattern: "◆ · ◆",
    frameCount: 3,
  }),
  play: Object.freeze({
    pose: "play",
    label: "PLAY TIME",
    icon: "◎",
    pattern: "· ◎ ·",
    frameCount: 3,
  }),
  clean: Object.freeze({
    pose: "wash",
    label: "CLEANING",
    icon: "✦",
    pattern: "│ ✦ │",
    frameCount: 3,
  }),
  training: Object.freeze({
    pose: "train",
    label: "TRAINING",
    icon: "↑",
    pattern: "· ↑ ·",
    frameCount: 2,
  }),
  reward: Object.freeze({
    pose: "reward",
    label: "GOOD JOB",
    icon: "★",
    pattern: "★ · ★",
    frameCount: 3,
  }),
  dirty: Object.freeze({
    pose: "droop",
    label: "NEEDS CLEAN",
    icon: "≋",
    pattern: "≋ · ≋",
    frameCount: 2,
  }),
  tired: Object.freeze({
    pose: "droop",
    label: "NEEDS REST",
    icon: "–",
    pattern: "— — —",
    frameCount: 2,
  }),
  "health-warning": Object.freeze({
    pose: "droop",
    label: "HEALTH ALERT",
    icon: "!",
    pattern: "/// ! ///",
    frameCount: 2,
  }),
  "attention-warning": Object.freeze({
    pose: "droop",
    label: "PLAY TOGETHER",
    icon: "!",
    pattern: "/// ! ///",
    frameCount: 2,
  }),
  medicine: Object.freeze({
    pose: "medicine",
    label: "MEDICINE HELPED",
    icon: "+",
    pattern: "+ · +",
    frameCount: 3,
  }),
  death: Object.freeze({
    pose: "rest",
    label: "STORY ENDED",
    icon: "◇",
    pattern: "— ◇ —",
    frameCount: 2,
  }),
});

export function resolveLcdFrameIndex({
  activity,
  reducedMotion,
  tick,
}: {
  activity: PetPresentationActivity;
  reducedMotion: boolean;
  tick: number;
}) {
  const frameCount = LCD_ACTIVITY_TREATMENTS[activity].frameCount;
  if (reducedMotion) return frameCount - 1;
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  return safeTick % frameCount;
}

export function getLcdSemanticLabel(model: PetPresentationModel) {
  const treatment = LCD_ACTIVITY_TREATMENTS[model.activity];
  const warningCopy = model.warnings.length
    ? ` Alerts: ${model.warnings.join(", ")}.`
    : "";
  return `${model.name} on the Quiet Care Monitor. ${treatment.label}. Health status ${model.healthBand.label}. ${model.recommendation.message}${warningCopy}`;
}

export function getLcdStatusTreatment(model: PetPresentationModel) {
  const warning = model.healthBand.id !== "great";
  return Object.freeze({
    warning,
    icon: warning ? "!" : "✓",
    pattern: warning ? "///" : "···",
    label: model.healthBand.label.toUpperCase(),
  });
}
