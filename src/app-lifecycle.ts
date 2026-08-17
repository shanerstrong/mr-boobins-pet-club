import {
  DEFAULT_CLOCK_MULTIPLIER,
  advancePet,
  advancePetOffline,
  stampPetTimestamp,
  type PetState,
} from "./simulation";

export const MAX_CONTINUOUS_ACTIVE_TICK_MS = 5_000;

export type AppScreen = "title" | "hub" | "room" | "settings";

export type AppTimeState = {
  pet: PetState;
  screen: AppScreen;
  foreground: boolean;
  careReachable: boolean;
};

export type AppTimeCoordinatorState = Omit<AppTimeState, "pet"> & {
  pet: PetState | null;
};

export type AppTimeEvent =
  | { type: "TICK"; now: number; testMultiplier?: number }
  | { type: "NAVIGATE"; now: number; screen: AppScreen }
  | { type: "VISIBILITY"; now: number; foreground: boolean }
  | { type: "CARE_REACHABILITY"; now: number; reachable: boolean }
  | { type: "ADOPT_AND_ENTER_ROOM"; now: number };

function reconcileForeground(
  state: AppTimeState,
  now: number,
  testMultiplier = DEFAULT_CLOCK_MULTIPLIER,
): AppTimeState {
  if (!state.foreground) return state;

  if (state.screen !== "room" || !state.careReachable) {
    const pet = stampPetTimestamp(state.pet, now);
    return pet === state.pet ? state : { ...state, pet };
  }

  const elapsedRealMs = now - state.pet.lastUpdatedAt;
  const pet =
    Number.isFinite(elapsedRealMs) &&
    elapsedRealMs <= MAX_CONTINUOUS_ACTIVE_TICK_MS
      ? advancePet(state.pet, now, testMultiplier)
      : advancePetOffline(state.pet, now);
  return pet === state.pet ? state : { ...state, pet };
}

/**
 * Single authority for wall-clock/lifecycle boundaries in the application.
 * `testMultiplier` exists only as an injected test/QA seam; production callers
 * omit it and therefore always use the 1× player clock.
 */
export function applyAppTimeEvent(
  state: AppTimeState,
  event: AppTimeEvent,
): AppTimeState {
  switch (event.type) {
    case "TICK":
      return reconcileForeground(state, event.now, event.testMultiplier);
    case "NAVIGATE": {
      const settled = reconcileForeground(state, event.now);
      return settled.screen === event.screen
        ? settled
        : {
            ...settled,
            screen: event.screen,
            careReachable: event.screen === "room",
          };
    }
    case "ADOPT_AND_ENTER_ROOM": {
      const settled = reconcileForeground(state, event.now);
      const pet = settled.pet.adoptionCompleted
        ? settled.pet
        : { ...settled.pet, adoptionCompleted: true };
      return { ...settled, pet, screen: "room", careReachable: true };
    }
    case "CARE_REACHABILITY": {
      const settled = reconcileForeground(state, event.now);
      const careReachable =
        settled.screen === "room" && event.reachable;
      return settled.careReachable === careReachable
        ? settled
        : { ...settled, careReachable };
    }
    case "VISIBILITY": {
      if (event.foreground === state.foreground) {
        return event.foreground
          ? reconcileForeground(state, event.now)
          : state;
      }
      if (!event.foreground) {
        return {
          ...reconcileForeground(state, event.now),
          foreground: false,
        };
      }
      return {
        ...state,
        pet: advancePetOffline(state.pet, event.now),
        foreground: true,
      };
    }
  }
}

/**
 * Stateful lifecycle seam used by App and deterministic integration tests.
 * Visibility remains authoritative before pet hydration. A loaded save is
 * advanced immediately only when hydration completes in the foreground; if
 * hydration completes while backgrounded, its original timestamp is retained
 * so the next foreground transition consumes the absence exactly once.
 */
export function createAppTimeCoordinator(
  initial: Omit<AppTimeCoordinatorState, "pet">,
) {
  let state: AppTimeCoordinatorState = { ...initial, pet: null };

  const applyWithoutPet = (event: AppTimeEvent) => {
    switch (event.type) {
      case "VISIBILITY":
        state = { ...state, foreground: event.foreground };
        break;
      case "NAVIGATE":
        state = {
          ...state,
          screen: event.screen,
          careReachable: event.screen === "room",
        };
        break;
      case "CARE_REACHABILITY":
        state = {
          ...state,
          careReachable:
            state.screen === "room" && event.reachable,
        };
        break;
      case "TICK":
      case "ADOPT_AND_ENTER_ROOM":
        break;
    }
  };

  return {
    snapshot(): AppTimeCoordinatorState {
      return state;
    },
    replacePet(pet: PetState) {
      state = { ...state, pet };
      return state;
    },
    hydrateLoadedPet(pet: PetState, now: number) {
      const current = state.foreground
        ? advancePetOffline(pet, now)
        : pet;
      state = { ...state, pet: current };
      return state;
    },
    apply(event: AppTimeEvent) {
      if (!state.pet) {
        applyWithoutPet(event);
        return state;
      }
      state = applyAppTimeEvent(
        {
          pet: state.pet,
          screen: state.screen,
          foreground: state.foreground,
          careReachable: state.careReachable,
        },
        event,
      );
      return state;
    },
  };
}
