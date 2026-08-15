import {
  advancePet,
  canCareForPet,
  isSleeping,
  type CareAction,
  type PetState,
} from "./simulation";

export type PetInteraction = CareAction | "sleep" | "wake" | "boop";
export type InteractionBlockReason =
  | "dead"
  | "sleeping"
  | "awake"
  | "cleaning"
  | "cooldown"
  | null;

export type InteractionResolution = {
  pet: PetState;
  allowed: boolean;
  reason: InteractionBlockReason;
};

export function resolvePetInteraction({
  pet,
  interaction,
  now,
  multiplier,
  careLocked = false,
  cooldownUntil = 0,
}: {
  pet: PetState;
  interaction: PetInteraction;
  now: number;
  multiplier: number;
  careLocked?: boolean;
  cooldownUntil?: number;
}): InteractionResolution {
  const current = advancePet(pet, now, multiplier);
  if (current.isDead) return { pet: current, allowed: false, reason: "dead" };
  if (careLocked) return { pet: current, allowed: false, reason: "cleaning" };

  const sleeping = isSleeping(current);
  if (interaction === "wake") {
    return sleeping
      ? { pet: current, allowed: true, reason: null }
      : { pet: current, allowed: false, reason: "awake" };
  }
  if (sleeping) return { pet: current, allowed: false, reason: "sleeping" };
  if (interaction === "boop" && now < cooldownUntil) {
    return { pet: current, allowed: false, reason: "cooldown" };
  }
  return {
    pet: current,
    allowed: interaction === "boop" || interaction === "sleep" || canCareForPet(current),
    reason: null,
  };
}

export function getBoopAvailability(
  pet: PetState,
  now: number,
  cooldownUntil: number,
  careLocked: boolean,
) {
  if (pet.isDead) return { available: false, reason: "Jack's story ended." };
  if (careLocked) return { available: false, reason: "Boop is unavailable during cleaning." };
  if (isSleeping(pet)) return { available: false, reason: "Boop is unavailable while Jack sleeps." };
  if (now < cooldownUntil) return { available: false, reason: "Boop is cooling down." };
  return { available: true, reason: "Boop is ready." };
}

export function getTerminalUiPolicy(pet: Pick<PetState, "isDead">) {
  return pet.isDead
    ? {
        terminal: true,
        terminalMessage: "Oh no — Jack’s story ended.",
        settingsDisabled: true,
        mutableControlsDisabled: true,
        suppressDecorations: true,
      }
    : {
        terminal: false,
        terminalMessage: null,
        settingsDisabled: false,
        mutableControlsDisabled: false,
        suppressDecorations: false,
      };
}

type TimerHandle = ReturnType<typeof setTimeout>;

export function createInteractionScheduler() {
  let generation = 0;
  const timers = new Set<TimerHandle>();

  const cancelTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };

  return {
    begin() {
      cancelTimers();
      generation += 1;
      return generation;
    },
    schedule(token: number, delay: number, callback: () => void) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (token === generation) callback();
      }, delay);
      timers.add(timer);
      return timer;
    },
    cancel() {
      cancelTimers();
      generation += 1;
    },
    isCurrent(token: number) {
      return token === generation;
    },
  };
}

export type MessageOpacityController = {
  stopAnimation: () => void;
  setValue: (value: number) => void;
};

export type ResettableAnimation = {
  stopAnimation: () => void;
  setValue: (value: number) => void;
};

export function resetTransientAnimations(
  animations: ResettableAnimation[],
) {
  for (const animation of animations) {
    animation.stopAnimation();
    animation.setValue(0);
  }
}

export function restoreMessagePresentation(
  timer: TimerHandle | null,
  opacity: MessageOpacityController,
) {
  if (timer) clearTimeout(timer);
  opacity.stopAnimation();
  opacity.setValue(1);
  return null;
}
