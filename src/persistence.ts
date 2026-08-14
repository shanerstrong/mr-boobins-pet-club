import AsyncStorage from "@react-native-async-storage/async-storage";
import { migratePetState, type PetState } from "./simulation";
export const PET_STORAGE_KEY = "mr-boobins-pet-club/v0/pet";
export interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export type LoadPetResult =
  | { kind: "missing" }
  | { kind: "loaded"; pet: PetState }
  | { kind: "invalid" }
  | { kind: "unavailable" };
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
