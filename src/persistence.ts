import AsyncStorage from "@react-native-async-storage/async-storage";
import { migratePetState, type PetState } from "./simulation";

export const PET_STORAGE_KEY = "mr-boobins-pet-club/v0/pet";
export const AUDIO_PREFERENCES_KEY = "mr-boobins-pet-club/v0/audio-preferences";

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
