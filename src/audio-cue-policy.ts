import {
  trainingCelebrationClips,
  trainingCommandClips,
  type TrainingCelebration,
  type TrainingCommand,
} from "./training-policy";
import animationManifest from "../assets/3d/jack/v2/animations/animation-event-manifest-v2.json";

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

export type TimelineMarker = {
  cue: AudioCueId;
  clip: string;
  marker: string;
};

type AnimationClip = {
  durationMs: number;
  markers: { name: string; timeMs: number }[];
};

export type ScheduledAudioCue = {
  cue: AudioCueId;
  timeMs: number;
};

export type AudioPhaseTimeline = {
  authoredDurationMs: number;
  cues: ScheduledAudioCue[];
};

export type TrainingAudioTimeline = {
  command: AudioPhaseTimeline;
  treatFlight: AudioPhaseTimeline;
  eating: AudioPhaseTimeline;
  celebration: AudioPhaseTimeline;
};

const animationClips = animationManifest.clips as Record<string, AnimationClip>;

export function resolveAudioMarker(marker: TimelineMarker) {
  const clip = animationClips[marker.clip];
  if (!clip) throw new Error(`Unknown audio animation clip: ${marker.clip}`);
  if (marker.marker === "start") {
    return { cue: marker.cue, timeMs: 0, clipDurationMs: clip.durationMs };
  }
  const match = clip.markers.find((candidate) => candidate.name === marker.marker);
  if (!match) {
    throw new Error(`Unknown audio animation marker: ${marker.clip}:${marker.marker}`);
  }
  return {
    cue: marker.cue,
    timeMs: match.timeMs,
    clipDurationMs: clip.durationMs,
  };
}

export function scaleAudioPhaseTimeline(
  timeline: AudioPhaseTimeline,
  actualDurationMs: number,
): AudioPhaseTimeline {
  if (!Number.isFinite(actualDurationMs) || actualDurationMs < 0) {
    throw new Error("Audio phase duration must be a finite non-negative number");
  }
  const scale = timeline.authoredDurationMs > 0
    ? actualDurationMs / timeline.authoredDurationMs
    : 0;
  return {
    authoredDurationMs: actualDurationMs,
    cues: timeline.cues.map((cue) => ({
      ...cue,
      timeMs: Math.round(cue.timeMs * scale),
    })),
  };
}

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

export function getTrainingAudioTimeline(
  command: TrainingCommand,
  celebration: TrainingCelebration,
): TrainingAudioTimeline {
  const plan = getTrainingAudioPlan(command, celebration);
  const commandSelected = resolveAudioMarker(plan.commandSelected);
  const commandSuccess = resolveAudioMarker(plan.commandSuccess);
  const treatToss = resolveAudioMarker(plan.treatToss);
  const treatCatch = resolveAudioMarker(plan.treatCatch);
  const treatCrunch = resolveAudioMarker(plan.treatCrunch);
  const celebrationAccent = resolveAudioMarker(plan.celebration);

  return {
    command: {
      authoredDurationMs: commandSuccess.clipDurationMs,
      cues: [
        { cue: commandSelected.cue, timeMs: commandSelected.timeMs },
        { cue: commandSuccess.cue, timeMs: commandSuccess.timeMs },
      ],
    },
    treatFlight: {
      authoredDurationMs: treatCatch.timeMs,
      cues: [
        { cue: treatToss.cue, timeMs: treatToss.timeMs },
        { cue: treatCatch.cue, timeMs: treatCatch.timeMs },
      ],
    },
    eating: {
      authoredDurationMs: treatCrunch.clipDurationMs,
      cues: [{ cue: treatCrunch.cue, timeMs: treatCrunch.timeMs }],
    },
    celebration: {
      authoredDurationMs: celebrationAccent.clipDurationMs,
      cues: [{ cue: celebrationAccent.cue, timeMs: celebrationAccent.timeMs }],
    },
  };
}

export const CARE_AUDIO_MARKERS = {
  feedCatch: { cue: "pet.treat-crunch", clip: "feed", marker: "food_contact" },
  cleanShake: { cue: "pet.wet-shake", clip: "clean_reaction", marker: "shake" },
} as const satisfies Record<string, TimelineMarker>;
