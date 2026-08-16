import AsyncStorage from "@react-native-async-storage/async-storage";
import { migratePetState, type PetState } from "./simulation";
import {
  TRAINING_CELEBRATIONS,
  type TrainingCelebration,
  type TrainingCommand,
} from "./training-policy";

export const PET_STORAGE_KEY = "mr-boobins-pet-club/v0/pet";
export const AUDIO_PREFERENCES_KEY = "mr-boobins-pet-club/v0/audio-preferences";
export const TRAINING_PROGRESS_KEY = "mr-boobins-pet-club/v1/training";
export const CARE_GUIDE_PROGRESS_KEY = "mr-boobins-pet-club/v1/care-guide";

export interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type LoadPetResult =
  | { kind: "missing" }
  | { kind: "loaded"; pet: PetState }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export interface AudioPreferences {
  version: 1;
  sfxEnabled: boolean;
  musicEnabled: boolean;
}

export type LoadAudioPreferencesResult =
  | { kind: "missing" }
  | { kind: "loaded"; preferences: AudioPreferences }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  version: 1,
  sfxEnabled: false,
  musicEnabled: false,
};

export interface TrainingProgress {
  version: 1;
  learned: {
    sit: boolean;
    paw: boolean;
    up: boolean;
  };
  celebrationCursor: 0 | 1 | 2;
}

export type LoadTrainingProgressResult =
  | { kind: "missing" }
  | { kind: "loaded"; progress: TrainingProgress }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export const DEFAULT_TRAINING_PROGRESS: TrainingProgress = {
  version: 1,
  learned: { sit: false, paw: false, up: false },
  celebrationCursor: 0,
};

export interface CareGuideProgress {
  version: 1;
  firstCareCompleted: boolean;
}

export type LoadCareGuideProgressResult =
  | { kind: "missing" }
  | { kind: "loaded"; progress: CareGuideProgress }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export const DEFAULT_CARE_GUIDE_PROGRESS: CareGuideProgress = {
  version: 1,
  firstCareCompleted: false,
};

function isAudioPreferences(value: unknown): value is AudioPreferences {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 3 &&
    record.version === 1 &&
    typeof record.sfxEnabled === "boolean" &&
    typeof record.musicEnabled === "boolean"
  );
}

function isTrainingProgress(value: unknown): value is TrainingProgress {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 3 ||
    record.version !== 1 ||
    !Number.isInteger(record.celebrationCursor) ||
    ![0, 1, 2].includes(record.celebrationCursor as number) ||
    !record.learned ||
    typeof record.learned !== "object"
  ) {
    return false;
  }
  const learned = record.learned as Record<string, unknown>;
  return (
    Object.keys(learned).length === 3 &&
    typeof learned.sit === "boolean" &&
    typeof learned.paw === "boolean" &&
    typeof learned.up === "boolean"
  );
}

function isCareGuideProgress(value: unknown): value is CareGuideProgress {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    record.version === 1 &&
    typeof record.firstCareCompleted === "boolean"
  );
}

export async function loadPet(
  storage: StorageLike = AsyncStorage,
): Promise<LoadPetResult> {
  try {
    const raw = await storage.getItem(PET_STORAGE_KEY);
    if (raw === null) return { kind: "missing" };
    try {
      const pet = migratePetState(JSON.parse(raw) as unknown);
      return pet ? { kind: "loaded", pet } : { kind: "invalid" };
    } catch {
      return { kind: "invalid" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}
export function savePet(pet: PetState, storage: StorageLike = AsyncStorage) {
  return storage.setItem(PET_STORAGE_KEY, JSON.stringify(pet));
}

export async function loadAudioPreferences(
  storage: StorageLike = AsyncStorage,
): Promise<LoadAudioPreferencesResult> {
  try {
    const raw = await storage.getItem(AUDIO_PREFERENCES_KEY);
    if (raw === null) return { kind: "missing" };
    try {
      const preferences = JSON.parse(raw) as unknown;
      return isAudioPreferences(preferences)
        ? { kind: "loaded", preferences }
        : { kind: "invalid" };
    } catch {
      return { kind: "invalid" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

export function saveAudioPreferences(
  preferences: AudioPreferences,
  storage: StorageLike = AsyncStorage,
) {
  if (!isAudioPreferences(preferences)) {
    return Promise.reject(new Error("Invalid audio preferences"));
  }
  return storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
}

export async function loadTrainingProgress(
  storage: StorageLike = AsyncStorage,
): Promise<LoadTrainingProgressResult> {
  try {
    const raw = await storage.getItem(TRAINING_PROGRESS_KEY);
    if (raw === null) return { kind: "missing" };
    try {
      const progress = JSON.parse(raw) as unknown;
      return isTrainingProgress(progress)
        ? { kind: "loaded", progress }
        : { kind: "invalid" };
    } catch {
      return { kind: "invalid" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

export function saveTrainingProgress(
  progress: TrainingProgress,
  storage: StorageLike = AsyncStorage,
) {
  if (!isTrainingProgress(progress)) {
    return Promise.reject(new Error("Invalid training progress"));
  }
  return storage.setItem(TRAINING_PROGRESS_KEY, JSON.stringify(progress));
}

export async function loadCareGuideProgress(
  storage: StorageLike = AsyncStorage,
): Promise<LoadCareGuideProgressResult> {
  try {
    const raw = await storage.getItem(CARE_GUIDE_PROGRESS_KEY);
    if (raw === null) return { kind: "missing" };
    try {
      const progress = JSON.parse(raw) as unknown;
      return isCareGuideProgress(progress)
        ? { kind: "loaded", progress }
        : { kind: "invalid" };
    } catch {
      return { kind: "invalid" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

export function saveCareGuideProgress(
  progress: CareGuideProgress,
  storage: StorageLike = AsyncStorage,
) {
  if (!isCareGuideProgress(progress)) {
    return Promise.reject(new Error("Invalid care guide progress"));
  }
  return storage.setItem(CARE_GUIDE_PROGRESS_KEY, JSON.stringify(progress));
}

export function completeTrainingCommand(
  progress: TrainingProgress,
  command: TrainingCommand,
): { progress: TrainingProgress; celebration: TrainingCelebration } {
  const celebration = TRAINING_CELEBRATIONS[progress.celebrationCursor];
  return {
    celebration,
    progress: {
      ...progress,
      learned: { ...progress.learned, [command]: true },
      celebrationCursor: ((progress.celebrationCursor + 1) % 3) as 0 | 1 | 2,
    },
  };
}
