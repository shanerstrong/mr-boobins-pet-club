import { describe, expect, it } from "vitest";
import {
  AUDIO_PREFERENCES_KEY,
  CARE_GUIDE_PROGRESS_KEY,
  DEFAULT_CARE_GUIDE_PROGRESS,
  DEFAULT_TRAINING_PROGRESS,
  PET_STORAGE_KEY,
  TRAINING_PROGRESS_KEY,
  completeTrainingCommand,
  loadAudioPreferences,
  loadCareGuideProgress,
  loadPet,
  loadTrainingProgress,
  saveAudioPreferences,
  saveCareGuideProgress,
  savePet,
  saveTrainingProgress,
  type StorageLike,
} from "./persistence";
import { createNewPet } from "./simulation";

const memory = (): StorageLike & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
};

describe("V6 pet persistence", () => {
  it("migrates a strict V5 save and round-trips V6 theme and nickname", async () => {
    const store = memory();
    const current = createNewPet(2);
    const { adoptionCompleted, roomTheme, version, ...rest } = current;
    await store.setItem(
      PET_STORAGE_KEY,
      JSON.stringify({
        ...rest,
        version: 5,
        introCompleted: true,
        backgroundId: "yard",
      }),
    );
    await expect(loadPet(store)).resolves.toMatchObject({
      kind: "loaded",
      pet: {
        version: 6,
        adoptionCompleted: true,
        roomTheme: "garden",
      },
    });
    const saved = {
      ...current,
      name: "Snoopy",
      adoptionCompleted: true,
      roomTheme: "blue" as const,
    };
    await savePet(saved, store);
    await expect(loadPet(store)).resolves.toEqual({ kind: "loaded", pet: saved });
    expect(adoptionCompleted).toBe(false);
    expect(roomTheme).toBe("cozy");
    expect(version).toBe(6);
  });

  it("retains malformed and schema-invalid raw pet data without overwrite", async () => {
    const store = memory();
    for (const raw of [
      "{bad",
      JSON.stringify({ ...createNewPet(4), roomTheme: "space" }),
      JSON.stringify({ ...createNewPet(4), name: "" }),
    ]) {
      store.values.set(PET_STORAGE_KEY, raw);
      await expect(loadPet(store)).resolves.toEqual({ kind: "invalid" });
      expect(store.values.get(PET_STORAGE_KEY)).toBe(raw);
    }
  });

  it("reports unavailable pet storage and save rejection", async () => {
    const bad: StorageLike = {
      async getItem() {
        throw new Error("no storage");
      },
      async setItem() {
        throw new Error("no storage");
      },
    };
    await expect(loadPet(bad)).resolves.toEqual({ kind: "unavailable" });
    await expect(savePet(createNewPet(), bad)).rejects.toThrow("no storage");
  });
});

describe("remembered audio preferences", () => {
  it("distinguishes missing preferences and round-trips strict values", async () => {
    const store = memory();
    await expect(loadAudioPreferences(store)).resolves.toEqual({ kind: "missing" });
    const preferences = { version: 1 as const, sfxEnabled: true, musicEnabled: false };
    await saveAudioPreferences(preferences, store);
    await expect(loadAudioPreferences(store)).resolves.toEqual({
      kind: "loaded",
      preferences,
    });
  });

  it("reports malformed or schema-invalid preferences without changing raw data", async () => {
    const store = memory();
    for (const raw of [
      "{bad",
      JSON.stringify({ version: 1, sfxEnabled: true, musicEnabled: false, extra: true }),
      JSON.stringify({ version: 1, sfxEnabled: "yes", musicEnabled: false }),
    ]) {
      store.values.set(AUDIO_PREFERENCES_KEY, raw);
      await expect(loadAudioPreferences(store)).resolves.toEqual({ kind: "invalid" });
      expect(store.values.get(AUDIO_PREFERENCES_KEY)).toBe(raw);
    }
  });

  it("reports preference load and save failures for session-only UX", async () => {
    const bad: StorageLike = {
      async getItem() {
        throw new Error("preferences unavailable");
      },
      async setItem() {
        throw new Error("preferences unavailable");
      },
    };
    await expect(loadAudioPreferences(bad)).resolves.toEqual({ kind: "unavailable" });
    await expect(
      saveAudioPreferences(
        { version: 1, sfxEnabled: true, musicEnabled: true },
        bad,
      ),
    ).rejects.toThrow("preferences unavailable");
  });

  it("rejects non-strict preference objects before writing", async () => {
    const store = memory();
    await expect(
      saveAudioPreferences(
        { version: 1, sfxEnabled: true, musicEnabled: false, extra: true } as never,
        store,
      ),
    ).rejects.toThrow("Invalid audio preferences");
    expect(store.values.has(AUDIO_PREFERENCES_KEY)).toBe(false);
  });
});

describe("local Training Mode progress", () => {
  it("distinguishes missing progress and round-trips learned commands", async () => {
    const store = memory();
    await expect(loadTrainingProgress(store)).resolves.toEqual({ kind: "missing" });
    const progress = {
      version: 1 as const,
      learned: { sit: true, paw: false, up: true },
      celebrationCursor: 2 as const,
    };
    await saveTrainingProgress(progress, store);
    await expect(loadTrainingProgress(store)).resolves.toEqual({
      kind: "loaded",
      progress,
    });
  });

  it("retains malformed and schema-invalid training data", async () => {
    const store = memory();
    for (const raw of [
      "{bad",
      JSON.stringify({ ...DEFAULT_TRAINING_PROGRESS, celebrationCursor: 4 }),
      JSON.stringify({
        ...DEFAULT_TRAINING_PROGRESS,
        learned: { sit: true, paw: false, up: false, rollOver: true },
      }),
    ]) {
      store.values.set(TRAINING_PROGRESS_KEY, raw);
      await expect(loadTrainingProgress(store)).resolves.toEqual({ kind: "invalid" });
      expect(store.values.get(TRAINING_PROGRESS_KEY)).toBe(raw);
    }
  });

  it("reports unavailable storage and rejects invalid progress before writing", async () => {
    const bad: StorageLike = {
      async getItem() {
        throw new Error("training unavailable");
      },
      async setItem() {
        throw new Error("training unavailable");
      },
    };
    await expect(loadTrainingProgress(bad)).resolves.toEqual({ kind: "unavailable" });
    await expect(saveTrainingProgress(DEFAULT_TRAINING_PROGRESS, bad)).rejects.toThrow(
      "training unavailable",
    );

    const store = memory();
    await expect(
      saveTrainingProgress(
        { ...DEFAULT_TRAINING_PROGRESS, celebrationCursor: 9 } as never,
        store,
      ),
    ).rejects.toThrow("Invalid training progress");
    expect(store.values.has(TRAINING_PROGRESS_KEY)).toBe(false);
  });

  it("marks commands learned and rotates celebrations without pressure counters", () => {
    const sit = completeTrainingCommand(DEFAULT_TRAINING_PROGRESS, "sit");
    const paw = completeTrainingCommand(sit.progress, "paw");
    const up = completeTrainingCommand(paw.progress, "up");
    const sitAgain = completeTrainingCommand(up.progress, "sit");

    expect([sit.celebration, paw.celebration, up.celebration]).toEqual([
      "happy-hop",
      "spin-wag",
      "goofy-shimmy",
    ]);
    expect(sitAgain.celebration).toBe("happy-hop");
    expect(sitAgain.progress.learned).toEqual({ sit: true, paw: true, up: true });
    expect(Object.keys(sitAgain.progress).sort()).toEqual([
      "celebrationCursor",
      "learned",
      "version",
    ]);
  });
});

describe("first-care guide progress", () => {
  it("distinguishes missing progress and round-trips completion", async () => {
    const store = memory();
    await expect(loadCareGuideProgress(store)).resolves.toEqual({ kind: "missing" });
    const progress = { version: 1 as const, firstCareCompleted: true };
    await saveCareGuideProgress(progress, store);
    await expect(loadCareGuideProgress(store)).resolves.toEqual({
      kind: "loaded",
      progress,
    });
  });

  it("retains malformed or non-strict care-guide data", async () => {
    const store = memory();
    for (const raw of [
      "{bad",
      JSON.stringify({ ...DEFAULT_CARE_GUIDE_PROGRESS, extra: true }),
      JSON.stringify({ version: 1, firstCareCompleted: "yes" }),
    ]) {
      store.values.set(CARE_GUIDE_PROGRESS_KEY, raw);
      await expect(loadCareGuideProgress(store)).resolves.toEqual({ kind: "invalid" });
      expect(store.values.get(CARE_GUIDE_PROGRESS_KEY)).toBe(raw);
    }
  });

  it("reports unavailable storage and rejects invalid progress before writing", async () => {
    const bad: StorageLike = {
      async getItem() {
        throw new Error("care guide unavailable");
      },
      async setItem() {
        throw new Error("care guide unavailable");
      },
    };
    await expect(loadCareGuideProgress(bad)).resolves.toEqual({ kind: "unavailable" });
    await expect(saveCareGuideProgress(DEFAULT_CARE_GUIDE_PROGRESS, bad)).rejects.toThrow(
      "care guide unavailable",
    );

    const store = memory();
    await expect(
      saveCareGuideProgress(
        { ...DEFAULT_CARE_GUIDE_PROGRESS, firstCareCompleted: "yes" } as never,
        store,
      ),
    ).rejects.toThrow("Invalid care guide progress");
    expect(store.values.has(CARE_GUIDE_PROGRESS_KEY)).toBe(false);
  });
});
