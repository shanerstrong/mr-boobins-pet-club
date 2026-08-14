import { describe, expect, it } from 'vitest';

import { loadPet, savePet, type StorageLike } from './persistence';
import { createNewPet } from './simulation';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
}

describe('local save data', () => {
  it('round-trips a pet state and distinguishes a missing save', async () => {
    const storage = memoryStorage();
    const pet = createNewPet(123);
    await expect(loadPet(storage)).resolves.toEqual({ kind: 'missing' });

    await savePet(pet, storage);
    await expect(loadPet(storage)).resolves.toEqual({ kind: 'loaded', pet });
  });

  it('preserves malformed raw data for explicit recovery', async () => {
    const values = new Map<string, string>([['mr-boobins-pet-club/v0/pet', '{bad json']]);
    const storage: StorageLike = {
      async getItem(key) { return values.get(key) ?? null; },
      async setItem(key, value) { values.set(key, value); },
    };

    await expect(loadPet(storage)).resolves.toEqual({ kind: 'invalid' });
    expect(values.get('mr-boobins-pet-club/v0/pet')).toBe('{bad json');
  });

  it('reports unavailable reads and lets save failures reject to the caller', async () => {
    const failingStorage: StorageLike = {
      async getItem() { throw new Error('storage unavailable'); },
      async setItem() { throw new Error('storage unavailable'); },
    };

    await expect(loadPet(failingStorage)).resolves.toEqual({ kind: 'unavailable' });
    await expect(savePet(createNewPet(123), failingStorage)).rejects.toThrow('storage unavailable');
  });
});
