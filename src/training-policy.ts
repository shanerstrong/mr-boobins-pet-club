export type TrainingCommand = "sit" | "paw" | "up";
export type TrainingCelebration =
  | "happy-hop"
  | "spin-wag"
  | "goofy-shimmy";

export type TrainingPhase =
  | "closed"
  | "choosing"
  | "performing"
  | "awaiting-treat"
  | "treat-in-flight"
  | "eating"
  | "celebrating"
  | "result";

export type TrainingState = {
  phase: TrainingPhase;
  session: number;
  command: TrainingCommand | null;
  celebration: TrainingCelebration | null;
  treatClaimed: boolean;
};

export type TrainingEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SELECT_COMMAND"; command: TrainingCommand }
  | { type: "COMMAND_COMPLETE"; session: number; command: TrainingCommand }
  | { type: "GIVE_TREAT" }
  | { type: "TREAT_CONTACT"; session: number }
  | {
      type: "EAT_COMPLETE";
      session: number;
      celebration: TrainingCelebration;
    }
  | { type: "CELEBRATION_COMPLETE"; session: number }
  | { type: "SHOW_AGAIN" };

export const TRAINING_COMMANDS: TrainingCommand[] = ["sit", "paw", "up"];
export const TRAINING_CELEBRATIONS: TrainingCelebration[] = [
  "happy-hop",
  "spin-wag",
  "goofy-shimmy",
];

export const TRAINING_COMMAND_DURATION_MS: Record<TrainingCommand, number> = {
  sit: 1200,
  paw: 1600,
  up: 1600,
};

export const TRAINING_CELEBRATION_DURATION_MS: Record<
  TrainingCelebration,
  number
> = {
  "happy-hop": 1500,
  "spin-wag": 2000,
  "goofy-shimmy": 2200,
};

export const TRAINING_TREAT_CONTACT_MS = 600;
export const TRAINING_EAT_DURATION_MS = 1600;

export function getTrainingMotionDuration(
  reducedMotion: boolean,
  durationMs: number,
) {
  return reducedMotion ? 0 : durationMs;
}

export function getReducedCelebrationPose(
  celebration: TrainingCelebration,
): number {
  return celebration === "happy-hop" ? 0.28 : 0.25;
}

export const trainingCommandLabels: Record<TrainingCommand, string> = {
  sit: "Sit",
  paw: "Paw",
  up: "Up",
};

export const trainingCelebrationLabels: Record<TrainingCelebration, string> = {
  "happy-hop": "Happy Hop",
  "spin-wag": "Spin-and-Wag",
  "goofy-shimmy": "Goofy Shimmy",
};

export const trainingCommandClips: Record<TrainingCommand, string> = {
  sit: "training_sit",
  paw: "training_paw",
  up: "training_up",
};

export const trainingCelebrationClips: Record<TrainingCelebration, string> = {
  "happy-hop": "celebration_happy_hop",
  "spin-wag": "celebration_spin_wag",
  "goofy-shimmy": "celebration_goofy_shimmy",
};

export function createTrainingState(session = 0): TrainingState {
  return {
    phase: "closed",
    session,
    command: null,
    celebration: null,
    treatClaimed: false,
  };
}

function closeTraining(state: TrainingState): TrainingState {
  return createTrainingState(state.session + 1);
}

export function transitionTraining(
  state: TrainingState,
  event: TrainingEvent,
): TrainingState {
  if (event.type === "CLOSE") return closeTraining(state);

  if (event.type === "OPEN") {
    if (state.phase !== "closed") return state;
    return {
      phase: "choosing",
      session: state.session + 1,
      command: null,
      celebration: null,
      treatClaimed: false,
    };
  }

  if (event.type === "SELECT_COMMAND") {
    if (state.phase !== "choosing") return state;
    return {
      ...state,
      phase: "performing",
      command: event.command,
      celebration: null,
      treatClaimed: false,
    };
  }

  if (event.type === "COMMAND_COMPLETE") {
    if (
      state.phase !== "performing" ||
      state.session !== event.session ||
      state.command !== event.command
    ) {
      return state;
    }
    return { ...state, phase: "awaiting-treat" };
  }

  if (event.type === "GIVE_TREAT") {
    if (state.phase !== "awaiting-treat" || state.treatClaimed) return state;
    return { ...state, phase: "treat-in-flight", treatClaimed: true };
  }

  if (event.type === "TREAT_CONTACT") {
    if (
      state.phase !== "treat-in-flight" ||
      state.session !== event.session
    ) {
      return state;
    }
    return { ...state, phase: "eating" };
  }

  if (event.type === "EAT_COMPLETE") {
    if (state.phase !== "eating" || state.session !== event.session) {
      return state;
    }
    return {
      ...state,
      phase: "celebrating",
      celebration: event.celebration,
    };
  }

  if (event.type === "CELEBRATION_COMPLETE") {
    if (
      state.phase !== "celebrating" ||
      state.session !== event.session
    ) {
      return state;
    }
    return { ...state, phase: "result" };
  }

  if (event.type === "SHOW_AGAIN") {
    if (state.phase !== "result" || !state.celebration) return state;
    return { ...state, phase: "celebrating" };
  }

  return state;
}

export function getTrainingAnnouncement(state: TrainingState): string {
  const command = state.command ? trainingCommandLabels[state.command] : null;
  const celebration = state.celebration
    ? trainingCelebrationLabels[state.celebration]
    : null;
  switch (state.phase) {
    case "closed":
      return "";
    case "choosing":
      return "Choose Sit, Paw, or Up for Jack.";
    case "performing":
      return `Jack is learning ${command}.`;
    case "awaiting-treat":
      return `Jack did ${command}. Give him one treat.`;
    case "treat-in-flight":
      return "Treat on the way.";
    case "eating":
      return "Jack caught the treat. Crunch crunch!";
    case "celebrating":
      return `Jack is doing his ${celebration}.`;
    case "result":
      return `${celebration} complete. Show it again or finish training.`;
  }
}
