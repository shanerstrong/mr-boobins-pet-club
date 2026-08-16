import {
  trainingCelebrationClips,
  trainingCommandClips,
  type TrainingCelebration,
  type TrainingCommand,
} from "./training-policy";

export const AUDIO_ASSET_IDS = [
  "jack.happy-bark",
  "jack.alert-bark",
  "jack.gentle-whine",
  "jack.calm-pant",
  "jack.excited-pant",
  "jack.sniff",
  "jack.sneeze",
  "jack.yawn",
  "jack.sleep-breathing",
  "jack.eating",
  "jack.drinking",
  "jack.treat-crunch",
  "jack.paw-steps",
  "jack.collar-jingle",
  "jack.wet-shake",
  "jack.toy-squeak",
  "jack.huff",
  "jack.sleepy-grumble",
  "training.success-chime",
  "training.treat-toss",
  "training.treat-catch",
  "training.celebration-accent",
  "ui.command-selected",
  "ui.tap",
  "ui.open",
  "ui.close",
  "ui.confirm",
  "music.cozy",
  "music.play",
  "music.sleep",
] as const;

export type AudioAssetId = (typeof AUDIO_ASSET_IDS)[number];

export const AUDIO_CUE_IDS = [
  "pet.happy-bark",
  "pet.alert-bark",
  "pet.gentle-whine",
  "pet.calm-pant",
  "pet.excited-pant",
  "pet.sniff",
  "pet.sneeze",
  "pet.yawn",
  "pet.sleep-breathing",
  "pet.eating",
  "pet.drinking",
  "pet.treat-crunch",
  "pet.paw-steps",
  "pet.collar-jingle",
  "pet.wet-shake",
  "pet.toy-squeak",
  "pet.huff",
  "pet.sleepy-grumble",
  "training.command-selected",
  "training.success",
  "training.treat-toss",
  "training.treat-catch",
  "training.treat-crunch",
  "training.celebration",
  "ui.tap",
  "ui.open",
  "ui.close",
  "ui.confirm",
  "music.cozy",
  "music.play",
  "music.sleep",
] as const;

export type AudioCueId = (typeof AUDIO_CUE_IDS)[number];

export const AUDIO_CUE_ASSETS: Record<AudioCueId, AudioAssetId> = {
  "pet.happy-bark": "jack.happy-bark",
  "pet.alert-bark": "jack.alert-bark",
  "pet.gentle-whine": "jack.gentle-whine",
  "pet.calm-pant": "jack.calm-pant",
  "pet.excited-pant": "jack.excited-pant",
  "pet.sniff": "jack.sniff",
  "pet.sneeze": "jack.sneeze",
  "pet.yawn": "jack.yawn",
  "pet.sleep-breathing": "jack.sleep-breathing",
  "pet.eating": "jack.eating",
  "pet.drinking": "jack.drinking",
  "pet.treat-crunch": "jack.treat-crunch",
  "pet.paw-steps": "jack.paw-steps",
  "pet.collar-jingle": "jack.collar-jingle",
  "pet.wet-shake": "jack.wet-shake",
  "pet.toy-squeak": "jack.toy-squeak",
  "pet.huff": "jack.huff",
  "pet.sleepy-grumble": "jack.sleepy-grumble",
  "training.command-selected": "ui.command-selected",
  "training.success": "training.success-chime",
  "training.treat-toss": "training.treat-toss",
  "training.treat-catch": "training.treat-catch",
  "training.treat-crunch": "jack.treat-crunch",
  "training.celebration": "training.celebration-accent",
  "ui.tap": "ui.tap",
  "ui.open": "ui.open",
  "ui.close": "ui.close",
  "ui.confirm": "ui.confirm",
  "music.cozy": "music.cozy",
  "music.play": "music.play",
  "music.sleep": "music.sleep",
};

type TimelineMarker = {
  cue: AudioCueId;
  clip: string;
  marker: string;
};

export type TrainingAudioPlan = {
  commandSelected: TimelineMarker;
  commandSuccess: TimelineMarker;
  treatToss: TimelineMarker;
  treatCatch: TimelineMarker;
  treatCrunch: TimelineMarker;
  celebration: TimelineMarker;
};

const celebrationAccentMarkers: Record<TrainingCelebration, string> = {
  "happy-hop": "hop_takeoff",
  "spin-wag": "quarter_turn",
  "goofy-shimmy": "shimmy_left",
};

export function getTrainingAudioPlan(
  command: TrainingCommand,
  celebration: TrainingCelebration,
): TrainingAudioPlan {
  return {
    commandSelected: {
      cue: "training.command-selected",
      clip: "training_attention",
      marker: "attention_locked",
    },
    commandSuccess: {
      cue: "training.success",
      clip: trainingCommandClips[command],
      marker: "complete",
    },
    treatToss: {
      cue: "training.treat-toss",
      clip: "training_treat_receive",
      marker: "start",
    },
    treatCatch: {
      cue: "training.treat-catch",
      clip: "training_treat_receive",
      marker: "treat_contact",
    },
    treatCrunch: {
      cue: "training.treat-crunch",
      clip: "training_treat_eat",
      marker: "chew_1",
    },
    celebration: {
      cue: "training.celebration",
      clip: trainingCelebrationClips[celebration],
      marker: celebrationAccentMarkers[celebration],
    },
  };
}

export const CARE_AUDIO_MARKERS = {
  feedCatch: { cue: "pet.treat-crunch", clip: "feed", marker: "food_contact" },
  cleanShake: { cue: "pet.wet-shake", clip: "clean_reaction", marker: "shake" },
} as const satisfies Record<string, TimelineMarker>;
