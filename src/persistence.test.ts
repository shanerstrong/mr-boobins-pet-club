import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_PREFERENCES_KEY,
  CARE_GUIDE_PROGRESS_KEY,
  CLEAN_COMPLETION_TRANSACTION_KEY,
  DEFAULT_CARE_GUIDE_PROGRESS,
  DEFAULT_TRAINING_PROGRESS,
  PET_STORAGE_KEY,
  TRAINING_PROGRESS_KEY,
  completeTrainingCommand,
  createPetGuidePersistenceAuthority,
  loadAudioPreferences,
  loadCareGuideProgress,
  loadPet,
  loadPetAndCareGuide,
  loadTrainingProgress,
  saveAudioPreferences,
  saveCareGuideProgress,
  saveCleanCompletion,
  saveExplicitResetPair,
  savePet,
  saveTrainingProgress,
  type StorageLike,
} from "./persistence";
import { commitSuccessfulClean } from "./day-one-ui";
import {
  careForPet,
  createNewPet,
  migratePetState,
  startSleep,
  wakePet,
  type PetState,
} from "./simulation";

const memory = (): StorageLike & {
  values: Map<string, string>;
  writes: string[];
} => {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
    values,
    writes,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      writes.push(key);
      values.set(key, value);
    },
  };
};

function asStrictV6(pet: PetState) {
  const {
    version: _version,
    wellbeingLastUpdatedAt: _wellbeingLastUpdatedAt,
    needs,
    ...rest
  } = pet;
  const { health: _health, attention: _attention, ...legacyNeeds } = needs;
  return { version: 6 as const, ...rest, needs: legacyNeeds };
}

const faultingMemory = (
  failureKey: string,
  failureOccurrence = 1,
): StorageLike & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  const writeCounts = new Map<string, number>();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      const count = (writeCounts.get(key) ?? 0) + 1;
      writeCounts.set(key, count);
      if (key === failureKey && count === failureOccurrence) {
        throw new Error(`interrupted at ${key}`);
      }
      values.set(key, value);
    },
  };
};

const deferredWriteMemory = (
  blockedKey: string,
  failure?: { key: string; occurrence: number },
): StorageLike & {
  values: Map<string, string>;
  writes: string[];
  blocked: Promise<void>;
  release: () => void;
} => {
  const values = new Map<string, string>();
  const writes: string[] = [];
  let releaseWrite: () => void = () => {};
  let reportBlocked: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    reportBlocked = resolve;
  });
  let hasBlocked = false;
  const writeCounts = new Map<string, number>();
  return {
    values,
    writes,
    blocked,
    release: releaseWrite,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      writes.push(key);
      const occurrence = (writeCounts.get(key) ?? 0) + 1;
      writeCounts.set(key, occurrence);
      if (key === blockedKey && !hasBlocked) {
        hasBlocked = true;
        reportBlocked();
        await gate;
      }
      if (key === failure?.key && occurrence === failure.occurrence) {
        throw new Error(`interrupted at ${key}`);
      }
      values.set(key, value);
    },
  };
};

const ambiguousInitialJournalMemory = (
  behavior:
    | "reject-before-write"
    | "write-then-reject"
    | "reject-with-mismatched-readback",
  readbackUnavailable = false,
): StorageLike & {
  values: Map<string, string>;
  writes: string[];
  restoreJournalReads: () => void;
} => {
  const values = new Map<string, string>();
  const writes: string[] = [];
  let initialJournalAttempt = true;
  let journalReadsUnavailable = readbackUnavailable;
  if (behavior === "reject-with-mismatched-readback") {
    values.set(CLEAN_COMPLETION_TRANSACTION_KEY, "{unrelated-journal");
  }
  return {
    values,
    writes,
    restoreJournalReads: () => {
      journalReadsUnavailable = false;
    },
    async getItem(key) {
      if (
        key === CLEAN_COMPLETION_TRANSACTION_KEY &&
        journalReadsUnavailable
      ) {
        throw new Error("journal read unavailable");
      }
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      writes.push(key);
      if (
        key === CLEAN_COMPLETION_TRANSACTION_KEY &&
        initialJournalAttempt
      ) {
        initialJournalAttempt = false;
        if (behavior === "write-then-reject") values.set(key, value);
        throw new Error("initial journal write rejected");
      }
      values.set(key, value);
    },
  };
};

function seedPreparedExplicitReset(
  values: Map<string, string>,
  resetPet: ReturnType<typeof createNewPet>,
  boundary: "before-before" | "after-before" | "after-after",
  beforePetRaw = "{bad-pet",
  beforeGuideRaw = "{bad-guide",
) {
  values.set(
    PET_STORAGE_KEY,
    boundary === "before-before"
      ? beforePetRaw
      : JSON.stringify(resetPet),
  );
  values.set(
    CARE_GUIDE_PROGRESS_KEY,
    boundary === "after-after"
      ? JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS)
      : beforeGuideRaw,
  );
  values.set(
    CLEAN_COMPLETION_TRANSACTION_KEY,
    JSON.stringify({
      version: 4,
      operation: "explicit-reset",
      status: "prepared",
      before: { petRaw: beforePetRaw, progressRaw: beforeGuideRaw },
      after: {
        pet: resetPet,
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      targetGeneration: {
        id: resetPet.id,
        createdAt: resetPet.createdAt,
      },
    }),
  );
}

describe("V7 pet persistence", () => {
  it("migrates a strict V5 save and round-trips V7 theme, wellbeing, and nickname", async () => {
    const store = memory();
    const current = createNewPet(2);
    const {
      adoptionCompleted,
      roomTheme,
      version,
      wellbeingLastUpdatedAt: _wellbeingLastUpdatedAt,
      needs,
      ...rest
    } = current;
    const { health: _health, attention: _attention, ...legacyNeeds } = needs;
    await store.setItem(
      PET_STORAGE_KEY,
      JSON.stringify({
        ...rest,
        needs: legacyNeeds,
        version: 5,
        introCompleted: true,
        backgroundId: "yard",
      }),
    );
    await expect(loadPet(store)).resolves.toMatchObject({
      kind: "loaded",
      pet: {
        version: 7,
        adoptionCompleted: true,
        roomTheme: "garden",
        needs: expect.objectContaining({ health: 100, attention: 80 }),
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
    expect(version).toBe(7);
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

  it("migrates embedded strict V6 pets in a prepared delayed-Clean journal", async () => {
    const store = memory();
    const before = { ...createNewPet(1_000), adoptionCompleted: true };
    const after = careForPet(
      { ...before, needs: { ...before.needs, hygiene: 20 } },
      "clean",
      1_000,
    );
    const beforeV6 = asStrictV6({
      ...before,
      needs: { ...before.needs, hygiene: 20 },
    });
    const afterV6 = asStrictV6(after);
    await store.setItem(PET_STORAGE_KEY, JSON.stringify(beforeV6));
    await store.setItem(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
    );
    await store.setItem(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      JSON.stringify({
        version: 2,
        status: "prepared",
        before: {
          pet: beforeV6,
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        after: {
          pet: afterV6,
          progress: { version: 1, firstCareCompleted: true },
        },
      }),
    );

    const loaded = await createPetGuidePersistenceAuthority(store).loadAndRecover();
    expect(loaded).toMatchObject({
      petResult: {
        kind: "loaded",
        pet: {
          version: 7,
          needs: { health: 100, attention: 80, hygiene: after.needs.hygiene },
        },
      },
      careGuideResult: {
        kind: "loaded",
        progress: { firstCareCompleted: true },
      },
      delayedCleanRecovery: "recovered",
    });
    const persistedPet = JSON.parse(store.values.get(PET_STORAGE_KEY) ?? "null") as PetState;
    expect(persistedPet.version).toBe(7);
    expect(persistedPet.needs).toMatchObject({ health: 100, attention: 80 });
    expect(
      JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY) ?? "null"),
    ).toMatchObject({
      status: "committed",
      after: { pet: { version: 7 } },
    });
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

describe("durable delayed-Clean completion", () => {
  const cleanFixture = () => {
    const before = {
      ...createNewPet(1_000),
      adoptionCompleted: true,
      needs: {
        ...createNewPet(1_000).needs,
        hygiene: 40,
      },
    };
    const completion = commitSuccessfulClean(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      2_000,
    );
    return { before, completion };
  };

  const seedLegacyPair = (
    store: { values: Map<string, string> },
    pet = cleanFixture().before,
    progress = DEFAULT_CARE_GUIDE_PROGRESS,
  ) => {
    store.values.set(PET_STORAGE_KEY, JSON.stringify(pet));
    store.values.set(CARE_GUIDE_PROGRESS_KEY, JSON.stringify(progress));
  };

  const seedPreparedClean = (
    values: Map<string, string>,
    before: PetState,
    completion: ReturnType<typeof commitSuccessfulClean>,
    boundary: "before-before" | "after-before" | "after-after",
  ) => {
    values.set(
      PET_STORAGE_KEY,
      JSON.stringify(
        boundary === "before-before" ? before : completion.pet,
      ),
    );
    values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(
        boundary === "after-after"
          ? completion.progress
          : DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    );
    values.set(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      JSON.stringify({
        version: 2,
        status: "prepared",
        before: { pet: before, progress: DEFAULT_CARE_GUIDE_PROGRESS },
        after: { pet: completion.pet, progress: completion.progress },
      }),
    );
  };

  it("writes a prepared journal before both legacy keys and reloads one committed pair", async () => {
    const store = memory();
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);

    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
    expect(store.writes).toEqual([
      CLEAN_COMPLETION_TRANSACTION_KEY,
      PET_STORAGE_KEY,
      CARE_GUIDE_PROGRESS_KEY,
      CLEAN_COMPLETION_TRANSACTION_KEY,
    ]);
    expect(
      JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
    ).toMatchObject({ version: 2, status: "committed" });
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: completion.pet },
      careGuideResult: { kind: "loaded", progress: completion.progress },
      cleanCompletionRecovery: "committed",
    });
  });

  it.each([
    ["pet", PET_STORAGE_KEY],
    ["guide", CARE_GUIDE_PROGRESS_KEY],
  ] as const)(
    "serializes an older pending %s save before Clean",
    async (kind, blockedKey) => {
      const store = deferredWriteMemory(blockedKey);
      const { before, completion } = cleanFixture();
      seedLegacyPair(store, before);
      const authority = createPetGuidePersistenceAuthority(store);
      const olderSave =
        kind === "pet"
          ? authority.savePet({ ...before, roomTheme: "blue" })
          : authority.saveGuide(DEFAULT_CARE_GUIDE_PROGRESS);
      const cleanSave = authority.saveClean(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
      );

      await store.blocked;
      expect(store.writes).toEqual([blockedKey]);
      store.release();
      await olderSave;
      await expect(cleanSave).resolves.toEqual({
        durability: { recoveryPending: false, interruptedAt: null },
        publishable: true,
      });
      expect(store.writes).toEqual([
        blockedKey,
        CLEAN_COMPLETION_TRANSACTION_KEY,
        PET_STORAGE_KEY,
        CARE_GUIDE_PROGRESS_KEY,
        CLEAN_COMPLETION_TRANSACTION_KEY,
      ]);
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: completion.pet },
        careGuideResult: { kind: "loaded", progress: completion.progress },
        cleanCompletionRecovery: "committed",
      });
    },
  );

  it.each([
    ["pet", PET_STORAGE_KEY],
    ["guide", CARE_GUIDE_PROGRESS_KEY],
    ["marker", CLEAN_COMPLETION_TRANSACTION_KEY],
  ] as const)(
    "keeps a stable V7 wellbeing anchor while recovering a V6 V2 journal after %s interruption and later-clock process loss",
    async (label, failureKey) => {
      const { before, completion } = cleanFixture();
      const beforeV6 = asStrictV6(before);
      const afterV6 = asStrictV6(completion.pet);
      const store = faultingMemory(failureKey, 1);
      store.values.set(PET_STORAGE_KEY, JSON.stringify(beforeV6));
      store.values.set(
        CARE_GUIDE_PROGRESS_KEY,
        JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
      );
      store.values.set(
        CLEAN_COMPLETION_TRANSACTION_KEY,
        JSON.stringify({
          version: 2,
          status: "prepared",
          before: {
            pet: beforeV6,
            progress: DEFAULT_CARE_GUIDE_PROGRESS,
          },
          after: { pet: afterV6, progress: completion.progress },
        }),
      );
      const firstMigrationAt = 100_000;
      const laterMigrationAt = 200_000;
      const now = vi.spyOn(Date, "now").mockReturnValue(firstMigrationAt);
      try {
        await expect(
          createPetGuidePersistenceAuthority(store).loadAndRecover(),
        ).resolves.toMatchObject({
          cleanCompletionRecovery: "prepared",
          delayedCleanRecovery: "pending",
        });

        now.mockReturnValue(laterMigrationAt);
        const stableAnchor =
          label === "pet" ? laterMigrationAt : firstMigrationAt;
        const expectedPet = migratePetState(afterV6, stableAnchor)!;
        await expect(
          createPetGuidePersistenceAuthority(store).loadAndRecover(),
        ).resolves.toMatchObject({
          petResult: { kind: "loaded", pet: expectedPet },
          careGuideResult: {
            kind: "loaded",
            progress: completion.progress,
          },
          cleanCompletionRecovery: "committed",
          delayedCleanRecovery: "recovered",
        });
        expect(JSON.parse(store.values.get(PET_STORAGE_KEY)!)).toEqual(
          expectedPet,
        );
        expect(
          JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
        ).toMatchObject({
          version: 2,
          status: "committed",
          after: {
            pet: {
              version: 7,
              wellbeingLastUpdatedAt: stableAnchor,
              needs: { health: 100, attention: 80 },
            },
          },
        });

        now.mockReturnValue(laterMigrationAt + 60_000);
        await expect(
          createPetGuidePersistenceAuthority(store).loadAndRecover(),
        ).resolves.toMatchObject({
          petResult: { kind: "loaded", pet: expectedPet },
          cleanCompletionRecovery: "committed",
        });
      } finally {
        now.mockRestore();
      }
    },
  );

  it("orders a later reset after pending Clean and suppresses Clean publication", async () => {
    const store = deferredWriteMemory(CLEAN_COMPLETION_TRANSACTION_KEY);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const authority = createPetGuidePersistenceAuthority(store);
    const cleanSave = authority.saveClean(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
    );
    await store.blocked;

    const resetPet = createNewPet(8_000);
    const resetSave = authority.supersedeWithPair(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
    );
    store.release();
    await expect(cleanSave).resolves.toEqual({
      durability: { recoveryPending: false, interruptedAt: null },
      publishable: false,
    });
    await resetSave;
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it.each([
    ["pet write", PET_STORAGE_KEY, 2, "pet"],
    ["guide write", CARE_GUIDE_PROGRESS_KEY, 2, "guide"],
    ["commit-marker write", CLEAN_COMPLETION_TRANSACTION_KEY, 4, "commit"],
  ] as const)(
    "rolls a background-cancellation pair forward after a superseding %s failure",
    async (_label, failureKey, failureOccurrence, interruptedAt) => {
      const store = deferredWriteMemory(CLEAN_COMPLETION_TRANSACTION_KEY, {
        key: failureKey,
        occurrence: failureOccurrence,
      });
      const { before, completion } = cleanFixture();
      seedLegacyPair(store, before);
      const authority = createPetGuidePersistenceAuthority(store);
      const cleanSave = authority.saveClean(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
      );
      await store.blocked;

      const cancellationSave = authority.supersedePendingCleanWithPair(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
      );
      expect(cancellationSave).not.toBeNull();
      store.release();
      await expect(cleanSave).resolves.toMatchObject({ publishable: false });
      await expect(cancellationSave).resolves.toEqual({
        recoveryPending: true,
        interruptedAt,
      });
      expect(
        JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
      ).toMatchObject({
        version: 3,
        operation: "supersede",
        status: "prepared",
      });

      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: before },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "prepared",
      });

      const retry = authority.retryPendingSupersession();
      expect(retry).not.toBeNull();
      await expect(retry).resolves.toEqual({
        recoveryPending: false,
        interruptedAt: null,
      });
      expect(authority.retryPendingSupersession()).toBeNull();
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: before },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "committed",
      });
    },
  );

  it.each([
    ["pet", PET_STORAGE_KEY],
    ["guide", CARE_GUIDE_PROGRESS_KEY],
    ["marker", CLEAN_COMPLETION_TRANSACTION_KEY],
  ] as const)(
    "keeps a stable V7 wellbeing anchor while recovering a V6 V4 journal after %s interruption and later-clock process loss",
    async (label, failureKey) => {
      const resetPet = createNewPet(35_150);
      const resetPetV6 = asStrictV6(resetPet);
      const beforePetRaw = "{bad-pet";
      const beforeGuideRaw = "{bad-guide";
      const store = faultingMemory(failureKey, 1);
      store.values.set(PET_STORAGE_KEY, beforePetRaw);
      store.values.set(CARE_GUIDE_PROGRESS_KEY, beforeGuideRaw);
      store.values.set(
        CLEAN_COMPLETION_TRANSACTION_KEY,
        JSON.stringify({
          version: 4,
          operation: "explicit-reset",
          status: "prepared",
          before: { petRaw: beforePetRaw, progressRaw: beforeGuideRaw },
          after: {
            pet: resetPetV6,
            progress: DEFAULT_CARE_GUIDE_PROGRESS,
          },
          targetGeneration: {
            id: resetPet.id,
            createdAt: resetPet.createdAt,
          },
        }),
      );
      const firstMigrationAt = 300_000;
      const laterMigrationAt = 400_000;
      const now = vi.spyOn(Date, "now").mockReturnValue(firstMigrationAt);
      try {
        await expect(
          createPetGuidePersistenceAuthority(store).loadAndRecover(),
        ).resolves.toMatchObject({
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "pending",
        });

        now.mockReturnValue(laterMigrationAt);
        const stableAnchor =
          label === "pet" ? laterMigrationAt : firstMigrationAt;
        const expectedPet = migratePetState(resetPetV6, stableAnchor)!;
        await expect(
          createPetGuidePersistenceAuthority(store).loadAndRecover(),
        ).resolves.toEqual({
          petResult: { kind: "loaded", pet: expectedPet },
          careGuideResult: {
            kind: "loaded",
            progress: DEFAULT_CARE_GUIDE_PROGRESS,
          },
          cleanCompletionRecovery: "committed",
          explicitResetRecovery: "recovered",
        });
        expect(JSON.parse(store.values.get(PET_STORAGE_KEY)!)).toEqual(
          expectedPet,
        );
        expect(
          JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
        ).toMatchObject({
          version: 4,
          operation: "explicit-reset",
          status: "committed",
          after: {
            pet: {
              version: 7,
              wellbeingLastUpdatedAt: stableAnchor,
              needs: { health: 100, attention: 80 },
            },
          },
        });

        now.mockReturnValue(laterMigrationAt + 60_000);
        await expect(
          createPetGuidePersistenceAuthority(store).loadAndRecover(),
        ).resolves.toMatchObject({
          petResult: { kind: "loaded", pet: expectedPet },
          cleanCompletionRecovery: "committed",
          explicitResetRecovery: "committed-residue",
        });
      } finally {
        now.mockRestore();
      }
    },
  );

  it.each([
    ["pet write", PET_STORAGE_KEY, 2, "pet"],
    ["guide write", CARE_GUIDE_PROGRESS_KEY, 2, "guide"],
    ["commit-marker write", CLEAN_COMPLETION_TRANSACTION_KEY, 4, "commit"],
  ] as const)(
    "rolls a new-generation Restart pair forward after a superseding %s failure",
    async (_label, failureKey, failureOccurrence, interruptedAt) => {
      const store = deferredWriteMemory(CLEAN_COMPLETION_TRANSACTION_KEY, {
        key: failureKey,
        occurrence: failureOccurrence,
      });
      const { before, completion } = cleanFixture();
      seedLegacyPair(store, before);
      const authority = createPetGuidePersistenceAuthority(store);
      const cleanSave = authority.saveClean(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
      );
      await store.blocked;

      const resetPet = createNewPet(9_000);
      const resetSave = authority.supersedeWithPair(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      );
      store.release();
      await expect(cleanSave).resolves.toMatchObject({ publishable: false });
      await expect(resetSave).resolves.toEqual({
        recoveryPending: true,
        interruptedAt,
      });
      expect(
        JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
      ).toMatchObject({
        version: 3,
        operation: "supersede",
        status: "prepared",
        after: { pet: resetPet, progress: DEFAULT_CARE_GUIDE_PROGRESS },
      });

      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: resetPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "prepared",
      });

      const retry = authority.retryPendingSupersession();
      expect(retry).not.toBeNull();
      await expect(retry).resolves.toEqual({
        recoveryPending: false,
        interruptedAt: null,
      });
      await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
        petResult: { kind: "loaded", pet: resetPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "committed",
      });
    },
  );

  it("retains and retries a superseding intent after its initial journal prepare fails", async () => {
    const store = deferredWriteMemory(CLEAN_COMPLETION_TRANSACTION_KEY, {
      key: CLEAN_COMPLETION_TRANSACTION_KEY,
      occurrence: 3,
    });
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const authority = createPetGuidePersistenceAuthority(store);
    const cleanSave = authority.saveClean(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
    );
    await store.blocked;
    const cancellationSave = authority.supersedePendingCleanWithPair(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
    );
    store.release();

    await expect(cleanSave).resolves.toMatchObject({ publishable: false });
    await expect(cancellationSave).rejects.toThrow("interrupted");
    await expect(authority.savePet(before)).rejects.toThrow(
      "Superseding pair persistence is pending",
    );
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: completion.pet },
      careGuideResult: { kind: "loaded", progress: completion.progress },
      cleanCompletionRecovery: "committed",
    });

    const retry = authority.retryPendingSupersession();
    expect(retry).not.toBeNull();
    await expect(retry).resolves.toEqual({
      recoveryPending: false,
      interruptedAt: null,
    });
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: before },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });

    const laterPet = { ...before, roomTheme: "blue" as const };
    await expect(authority.savePet(laterPet)).resolves.toBeUndefined();
    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: laterPet },
      cleanCompletionRecovery: "committed",
    });
  });

  it("retains and retries a new-generation Restart after its initial journal prepare fails", async () => {
    const store = deferredWriteMemory(CLEAN_COMPLETION_TRANSACTION_KEY, {
      key: CLEAN_COMPLETION_TRANSACTION_KEY,
      occurrence: 3,
    });
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const authority = createPetGuidePersistenceAuthority(store);
    const cleanSave = authority.saveClean(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
    );
    await store.blocked;
    const resetPet = createNewPet(12_000);
    const resetSave = authority.supersedeWithPair(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
    );
    store.release();

    await expect(cleanSave).resolves.toMatchObject({ publishable: false });
    await expect(resetSave).rejects.toThrow("interrupted");
    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: completion.pet },
      careGuideResult: { kind: "loaded", progress: completion.progress },
      cleanCompletionRecovery: "committed",
    });

    const retry = authority.retryPendingSupersession();
    expect(retry).not.toBeNull();
    await expect(retry).resolves.toEqual({
      recoveryPending: false,
      interruptedAt: null,
    });
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it.each([
    ["pet write", PET_STORAGE_KEY, 1, "pet"],
    ["guide write", CARE_GUIDE_PROGRESS_KEY, 1, "guide"],
    ["commit-marker write", CLEAN_COMPLETION_TRANSACTION_KEY, 2, "commit"],
  ] as const)(
    "recovers the exact pair after interruption at the %s boundary",
    async (_label, failureKey, failureOccurrence, interruptedAt) => {
      const store = faultingMemory(failureKey, failureOccurrence);
      const { before, completion } = cleanFixture();
      seedLegacyPair(store, before);

      await expect(
        saveCleanCompletion(
          before,
          DEFAULT_CARE_GUIDE_PROGRESS,
          completion.pet,
          completion.progress,
          store,
        ),
      ).resolves.toEqual({ recoveryPending: true, interruptedAt });
      const journal = JSON.parse(
        store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!,
      );
      expect(journal.status).toBe("prepared");
      if (interruptedAt === "pet") {
        expect(JSON.parse(store.values.get(PET_STORAGE_KEY)!)).toEqual(before);
        expect(
          JSON.parse(store.values.get(CARE_GUIDE_PROGRESS_KEY)!),
        ).toEqual(DEFAULT_CARE_GUIDE_PROGRESS);
      }
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: completion.pet },
        careGuideResult: { kind: "loaded", progress: completion.progress },
        cleanCompletionRecovery: "prepared",
      });
    },
  );

  it("makes no separate-key change when the initial journal write fails", async () => {
    const store = faultingMemory(CLEAN_COMPLETION_TRANSACTION_KEY, 1);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);

    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).rejects.toThrow("journal preparation was rejected and is absent");
    expect(store.values.has(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(false);
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: before },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "none",
    });
  });

  it("treats an exact V2 prepared-journal readback as durable after write-then-reject", async () => {
    const store = ambiguousInitialJournalMemory("write-then-reject");
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);

    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
    expect(store.writes).toEqual([
      CLEAN_COMPLETION_TRANSACTION_KEY,
      PET_STORAGE_KEY,
      CARE_GUIDE_PROGRESS_KEY,
      CLEAN_COMPLETION_TRANSACTION_KEY,
    ]);
    expect(
      JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
    ).toMatchObject({ version: 2, status: "committed" });
  });

  it("retains a V2 save barrier after unavailable initial readback and recovers the exact pair once", async () => {
    const store = ambiguousInitialJournalMemory(
      "write-then-reject",
      true,
    );
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const authority = createPetGuidePersistenceAuthority(store);

    await expect(
      authority.saveClean(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
      ),
    ).resolves.toMatchObject({
      durability: { recoveryPending: true, interruptedAt: "prepare" },
      publishable: false,
    });
    expect(authority.pendingCleanCompletionTarget()).toEqual({
      pet: completion.pet,
      progress: completion.progress,
    });
    expect(JSON.parse(store.values.get(PET_STORAGE_KEY)!)).toEqual(before);
    await expect(authority.savePet(before)).rejects.toThrow("persistence is pending");
    await expect(
      authority.saveGuide(DEFAULT_CARE_GUIDE_PROGRESS),
    ).rejects.toThrow("persistence is pending");
    await expect(
      authority.saveClean(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
      ),
    ).rejects.toThrow("persistence is pending");
    expect(
      authority.supersedePendingCleanWithPair(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).toBeNull();
    await expect(
      authority.supersedeWithPair(before, DEFAULT_CARE_GUIDE_PROGRESS),
    ).rejects.toThrow("Ambiguous Clean preparation is pending");

    store.restoreJournalReads();
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: completion.pet },
      careGuideResult: { kind: "loaded", progress: completion.progress },
      cleanCompletionRecovery: "committed",
      delayedCleanRecovery: "recovered",
    });
    expect(
      authority.acknowledgeCleanPublication(
        completion.pet,
        completion.progress,
      ),
    ).toBe(true);
    expect(authority.pendingCleanCompletionTarget()).toBeNull();
    const laterPet = { ...completion.pet, roomTheme: "blue" as const };
    await expect(authority.savePet(laterPet)).resolves.toBeUndefined();
    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: laterPet },
      cleanCompletionRecovery: "committed",
    });
  });

  it("preserves mismatched V2 journal/raw under ambiguity until absence is confirmed", async () => {
    const store = ambiguousInitialJournalMemory(
      "reject-with-mismatched-readback",
    );
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const unrelatedJournal = store.values.get(
      CLEAN_COMPLETION_TRANSACTION_KEY,
    );
    const authority = createPetGuidePersistenceAuthority(store);

    await expect(
      authority.saveClean(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
      ),
    ).resolves.toMatchObject({
      durability: { recoveryPending: true, interruptedAt: "prepare" },
      publishable: false,
    });
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      delayedCleanRecovery: "invalid",
    });
    expect(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(
      unrelatedJournal,
    );
    expect(JSON.parse(store.values.get(PET_STORAGE_KEY)!)).toEqual(before);
    expect(
      JSON.parse(store.values.get(CARE_GUIDE_PROGRESS_KEY)!),
    ).toEqual(DEFAULT_CARE_GUIDE_PROGRESS);
    await expect(authority.savePet(completion.pet)).rejects.toThrow(
      "persistence is pending",
    );

    store.values.delete(CLEAN_COMPLETION_TRANSACTION_KEY);
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      delayedCleanRecovery: "absent",
      petResult: { kind: "loaded", pet: before },
    });
    expect(authority.pendingCleanCompletionTarget()).toBeNull();
    await expect(authority.savePet(before)).resolves.toBeUndefined();
  });

  it("retries a prepared transaction idempotently until all keys agree", async () => {
    const store = faultingMemory(CARE_GUIDE_PROGRESS_KEY, 1);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);

    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: true, interruptedAt: "guide" });
    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: completion.pet },
      careGuideResult: { kind: "loaded", progress: completion.progress },
      cleanCompletionRecovery: "committed",
    });
  });

  it.each([
    ["pet", "before-before", PET_STORAGE_KEY],
    ["guide", "after-before", CARE_GUIDE_PROGRESS_KEY],
    ["marker", "after-after", CLEAN_COMPLETION_TRANSACTION_KEY],
  ] as const)(
    "durably recovers V2 after a failed %s recovery write and process restart",
    async (_label, boundary, failureKey) => {
      const { before, completion } = cleanFixture();
      const store = faultingMemory(failureKey, 1);
      seedPreparedClean(store.values, before, completion, boundary);

      await expect(
        createPetGuidePersistenceAuthority(store).loadAndRecover(),
      ).resolves.toMatchObject({
        cleanCompletionRecovery: "prepared",
        delayedCleanRecovery: "pending",
      });
      const recoveredAuthority = createPetGuidePersistenceAuthority(store);
      await expect(recoveredAuthority.loadAndRecover()).resolves.toMatchObject({
        petResult: { kind: "loaded", pet: completion.pet },
        careGuideResult: { kind: "loaded", progress: completion.progress },
        cleanCompletionRecovery: "committed",
        delayedCleanRecovery: "recovered",
      });
      expect(
        recoveredAuthority.acknowledgeCleanPublication(
          completion.pet,
          completion.progress,
        ),
      ).toBe(true);
      expect(
        JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
      ).toMatchObject({ version: 2, status: "committed" });
    },
  );

  it.each([
    ["pet", "before-before", PET_STORAGE_KEY],
    ["guide", "after-before", CARE_GUIDE_PROGRESS_KEY],
    ["marker", "after-after", CLEAN_COMPLETION_TRANSACTION_KEY],
  ] as const)(
    "recovers V2 idempotently when the %s write lands before rejection",
    async (_label, boundary, failureKey) => {
      const { before, completion } = cleanFixture();
      const values = new Map<string, string>();
      seedPreparedClean(values, before, completion, boundary);
      let failed = false;
      const storage: StorageLike = {
        async getItem(key) {
          return values.get(key) ?? null;
        },
        async setItem(key, value) {
          values.set(key, value);
          if (key === failureKey && !failed) {
            failed = true;
            throw new Error(`write-then-reject at ${key}`);
          }
        },
      };

      await expect(
        createPetGuidePersistenceAuthority(storage).loadAndRecover(),
      ).resolves.toMatchObject({ delayedCleanRecovery: "pending" });
      const recoveredAuthority = createPetGuidePersistenceAuthority(storage);
      await expect(recoveredAuthority.loadAndRecover()).resolves.toMatchObject({
        petResult: { kind: "loaded", pet: completion.pet },
        careGuideResult: { kind: "loaded", progress: completion.progress },
        cleanCompletionRecovery: "committed",
      });
    },
  );

  it("keeps legacy separate guide completion and newer reset saves backward compatible", async () => {
    const legacyStore = memory();
    const legacyPet = createNewPet(10);
    const legacyProgress = { version: 1 as const, firstCareCompleted: true };
    seedLegacyPair(legacyStore, legacyPet, legacyProgress);
    await expect(loadPetAndCareGuide(legacyStore)).resolves.toEqual({
      petResult: { kind: "loaded", pet: legacyPet },
      careGuideResult: { kind: "loaded", progress: legacyProgress },
      cleanCompletionRecovery: "none",
    });

    const transactionStore = memory();
    const { before, completion } = cleanFixture();
    seedLegacyPair(transactionStore, before);
    await saveCleanCompletion(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
      transactionStore,
    );
    const resetPet = createNewPet(5_000);
    transactionStore.values.set(PET_STORAGE_KEY, JSON.stringify(resetPet));
    transactionStore.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
    );
    await expect(loadPetAndCareGuide(transactionStore)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("treats a committed journal as cleanup residue for every valid current pair", async () => {
    const { before, completion } = cleanFixture();
    const sameClockFeed = careForPet(completion.pet, "feed", 500);
    const earlierClockPlay = {
      ...careForPet(completion.pet, "play", 500),
      lastUpdatedAt: 1_500,
    };
    const backwardClockSleep = startSleep(completion.pet, 1, 500);
    const backwardClockWakeWithTheme = wakePet(
      { ...backwardClockSleep, roomTheme: "blue" },
      500,
    );
    const cases = [
      ["Feed at the same saved clock", sameClockFeed],
      ["PLAY persisted with an earlier valid clock", earlierClockPlay],
      ["sleep started while the wall clock is backward", backwardClockSleep],
      ["wake and theme state after a backward clock", backwardClockWakeWithTheme],
    ] as const;

    for (const [, currentPet] of cases) {
      const store = memory();
      seedLegacyPair(store, before);
      await saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      );
      store.values.set(PET_STORAGE_KEY, JSON.stringify(currentPet));
      store.values.set(
        CARE_GUIDE_PROGRESS_KEY,
        JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
      );
      const audioRaw = JSON.stringify({
        version: 1,
        sfxEnabled: true,
        musicEnabled: false,
      });
      const trainingRaw = JSON.stringify(DEFAULT_TRAINING_PROGRESS);
      store.values.set(AUDIO_PREFERENCES_KEY, audioRaw);
      store.values.set(TRAINING_PROGRESS_KEY, trainingRaw);

      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: currentPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "committed",
      });
      expect(store.values.get(AUDIO_PREFERENCES_KEY)).toBe(audioRaw);
      expect(store.values.get(TRAINING_PROGRESS_KEY)).toBe(trainingRaw);
    }
  });

  it.each(["prepared", "committed"] as const)(
    "keeps current data authoritative beside a legacy V1 %s journal",
    async (status) => {
      const store = memory();
      const { completion } = cleanFixture();
      const currentPet = {
        ...completion.pet,
        roomTheme: "blue" as const,
        needs: { ...completion.pet.needs, hunger: 99 },
      };
      seedLegacyPair(store, currentPet, DEFAULT_CARE_GUIDE_PROGRESS);
      store.values.set(
        CLEAN_COMPLETION_TRANSACTION_KEY,
        JSON.stringify({
          version: 1,
          status,
          pet: completion.pet,
          progress: completion.progress,
        }),
      );
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: currentPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: status,
      });
    },
  );

  it("does not resurrect a missing key from committed cleanup residue", async () => {
    const store = memory();
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    await saveCleanCompletion(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
      store,
    );
    store.values.delete(PET_STORAGE_KEY);
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "missing" },
      careGuideResult: {
        kind: "loaded",
        progress: completion.progress,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("does not let a prepared journal roll back divergent same-generation gameplay", async () => {
    const store = faultingMemory(CLEAN_COMPLETION_TRANSACTION_KEY, 2);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: true, interruptedAt: "commit" });

    const backwardClockFeed = {
      ...careForPet(completion.pet, "feed", 500),
      lastUpdatedAt: 1_500,
      roomTheme: "garden" as const,
    };
    store.values.set(PET_STORAGE_KEY, JSON.stringify(backwardClockFeed));
    store.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
    );
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: backwardClockFeed },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "prepared",
    });
  });

  it("lets a newer reset supersede a prepared journal", async () => {
    const store = faultingMemory(PET_STORAGE_KEY);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    await expect(
      saveCleanCompletion(
        before,
        DEFAULT_CARE_GUIDE_PROGRESS,
        completion.pet,
        completion.progress,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: true, interruptedAt: "pet" });

    const resetPet = createNewPet(8_000);
    store.values.set(PET_STORAGE_KEY, JSON.stringify(resetPet));
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "prepared",
    });
  });

  it("rejects the impossible before-pet/after-guide prepared pairing", async () => {
    const store = faultingMemory(PET_STORAGE_KEY);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    await saveCleanCompletion(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
      store,
    );
    store.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(completion.progress),
    );

    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: before },
      careGuideResult: { kind: "loaded", progress: completion.progress },
      cleanCompletionRecovery: "prepared",
    });
  });

  it("rejects an impossible before-pet/after-guide V3 supersession boundary", async () => {
    const store = faultingMemory(PET_STORAGE_KEY);
    const { before } = cleanFixture();
    seedLegacyPair(store, before);
    const authority = createPetGuidePersistenceAuthority(store);
    const targetPet = { ...before, roomTheme: "blue" as const };
    const targetProgress = { version: 1 as const, firstCareCompleted: true };

    await expect(
      authority.supersedeWithPair(targetPet, targetProgress),
    ).resolves.toEqual({ recoveryPending: true, interruptedAt: "pet" });
    store.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(targetProgress),
    );
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: before },
      careGuideResult: { kind: "loaded", progress: targetProgress },
      cleanCompletionRecovery: "prepared",
    });
  });

  it("treats committed V3 supersession residue as cleanup-only", async () => {
    const store = memory();
    const { before } = cleanFixture();
    seedLegacyPair(store, before);
    const authority = createPetGuidePersistenceAuthority(store);
    const resetPet = createNewPet(15_000);
    await expect(
      authority.supersedeWithPair(resetPet, DEFAULT_CARE_GUIDE_PROGRESS),
    ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
    const laterGameplay = {
      ...careForPet(resetPet, "play", 14_000),
      roomTheme: "garden" as const,
    };
    store.values.set(PET_STORAGE_KEY, JSON.stringify(laterGameplay));
    const laterProgress = { version: 1 as const, firstCareCompleted: true };
    store.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(laterProgress),
    );

    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: laterGameplay },
      careGuideResult: { kind: "loaded", progress: laterProgress },
      cleanCompletionRecovery: "committed",
    });
  });

  it("rejects a V2 journal whose before and after pets have different generations", async () => {
    const store = memory();
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const unrelated = {
      ...createNewPet(9_000),
      adoptionCompleted: true,
      needs: { ...createNewPet(9_000).needs, hygiene: 100 },
    };
    const rawJournal = JSON.stringify({
      version: 2,
      status: "prepared",
      before: {
        pet: before,
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      after: { pet: unrelated, progress: completion.progress },
    });
    store.values.set(CLEAN_COMPLETION_TRANSACTION_KEY, rawJournal);

    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: before },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "invalid",
    });
    expect(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(rawJournal);
  });

  it("rejects an unrecognized V3 operation instead of weakening Clean generation rules", async () => {
    const store = memory();
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    const rawJournal = JSON.stringify({
      version: 3,
      operation: "clean",
      status: "prepared",
      before: {
        pet: before,
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      after: {
        pet: createNewPet(20_000),
        progress: completion.progress,
      },
    });
    store.values.set(CLEAN_COMPLETION_TRANSACTION_KEY, rawJournal);

    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: before },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "invalid",
    });
    expect(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(rawJournal);
  });

  it("rejects a reset generation or malformed preflight before preparing a journal", async () => {
    const { before, completion } = cleanFixture();
    for (const rawPet of [
      JSON.stringify(createNewPet(9_000)),
      "{bad",
    ]) {
      const store = memory();
      seedLegacyPair(store, before);
      store.values.set(PET_STORAGE_KEY, rawPet);
      await expect(
        saveCleanCompletion(
          before,
          DEFAULT_CARE_GUIDE_PROGRESS,
          completion.pet,
          completion.progress,
          store,
        ),
      ).rejects.toThrow();
      expect(store.values.has(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(false);
      expect(store.values.get(PET_STORAGE_KEY)).toBe(rawPet);
    }
  });

  it("does not mask unavailable current records or a failed journal read", async () => {
    const preparedStore = faultingMemory(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      2,
    );
    const { before, completion } = cleanFixture();
    seedLegacyPair(preparedStore, before);
    await saveCleanCompletion(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
      preparedStore,
    );
    const petUnavailable: StorageLike = {
      async getItem(key) {
        if (key === PET_STORAGE_KEY) throw new Error("pet unavailable");
        return preparedStore.values.get(key) ?? null;
      },
      async setItem(key, value) {
        preparedStore.values.set(key, value);
      },
    };
    await expect(loadPetAndCareGuide(petUnavailable)).resolves.toEqual({
      petResult: { kind: "unavailable" },
      careGuideResult: {
        kind: "loaded",
        progress: completion.progress,
      },
      cleanCompletionRecovery: "prepared",
    });

    const journalUnavailable: StorageLike = {
      async getItem(key) {
        if (key === CLEAN_COMPLETION_TRANSACTION_KEY) {
          throw new Error("journal unavailable");
        }
        return preparedStore.values.get(key) ?? null;
      },
      async setItem(key, value) {
        preparedStore.values.set(key, value);
      },
    };
    await expect(loadPetAndCareGuide(journalUnavailable)).resolves.toEqual({
      petResult: { kind: "loaded", pet: completion.pet },
      careGuideResult: {
        kind: "loaded",
        progress: completion.progress,
      },
      cleanCompletionRecovery: "unavailable",
    });
  });

  it("never overwrites or masks a malformed pet or guide key during recovery", async () => {
    const store = faultingMemory(CLEAN_COMPLETION_TRANSACTION_KEY, 2);
    const { before, completion } = cleanFixture();
    seedLegacyPair(store, before);
    await saveCleanCompletion(
      before,
      DEFAULT_CARE_GUIDE_PROGRESS,
      completion.pet,
      completion.progress,
      store,
    );
    store.values.set(PET_STORAGE_KEY, "{bad");
    store.values.set(CARE_GUIDE_PROGRESS_KEY, "{also-bad");

    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "invalid" },
      careGuideResult: { kind: "invalid" },
      cleanCompletionRecovery: "prepared",
    });
    expect(store.values.get(PET_STORAGE_KEY)).toBe("{bad");
    expect(store.values.get(CARE_GUIDE_PROGRESS_KEY)).toBe("{also-bad");
  });

  it.each([
    [
      "valid pet and guide",
      JSON.stringify(cleanFixture().before),
      JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
    ],
    ["missing pet", null, JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS)],
    ["missing guide", JSON.stringify(cleanFixture().before), null],
    ["both missing", null, null],
    ["malformed pet", "{pet-bad", JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS)],
    ["malformed guide", JSON.stringify(cleanFixture().before), "{guide-bad"],
    ["both malformed", " {pet-bad\r\n", "{guide-bad\n"],
  ] as const)(
    "records exact raw values and explicitly resets %s",
    async (_label, petRaw, progressRaw) => {
      const store = memory();
      if (petRaw !== null) store.values.set(PET_STORAGE_KEY, petRaw);
      if (progressRaw !== null) {
        store.values.set(CARE_GUIDE_PROGRESS_KEY, progressRaw);
      }
      const resetPet = createNewPet(30_000);

      await expect(
        saveExplicitResetPair(
          resetPet,
          DEFAULT_CARE_GUIDE_PROGRESS,
          store,
        ),
      ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
      expect(store.writes).toEqual([
        CLEAN_COMPLETION_TRANSACTION_KEY,
        PET_STORAGE_KEY,
        CARE_GUIDE_PROGRESS_KEY,
        CLEAN_COMPLETION_TRANSACTION_KEY,
      ]);
      expect(
        JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
      ).toEqual({
        version: 4,
        operation: "explicit-reset",
        status: "committed",
        before: { petRaw, progressRaw },
        after: {
          pet: resetPet,
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        targetGeneration: {
          id: resetPet.id,
          createdAt: resetPet.createdAt,
        },
      });
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: resetPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "committed",
      });
    },
  );

  it.each([
    ["pet write", PET_STORAGE_KEY, 1, "pet"],
    ["guide write", CARE_GUIDE_PROGRESS_KEY, 1, "guide"],
    ["commit marker", CLEAN_COMPLETION_TRANSACTION_KEY, 2, "commit"],
  ] as const)(
    "rolls an explicit reset forward after interruption at %s",
    async (_label, failureKey, failureOccurrence, interruptedAt) => {
      const store = faultingMemory(failureKey, failureOccurrence);
      const malformedPetRaw = " {pet-bad\r\n";
      const malformedGuideRaw = "{guide-bad\n";
      store.values.set(PET_STORAGE_KEY, malformedPetRaw);
      store.values.set(CARE_GUIDE_PROGRESS_KEY, malformedGuideRaw);
      const resetPet = createNewPet(31_000);

      await expect(
        saveExplicitResetPair(
          resetPet,
          DEFAULT_CARE_GUIDE_PROGRESS,
          store,
        ),
      ).resolves.toEqual({ recoveryPending: true, interruptedAt });
      expect(
        JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
      ).toMatchObject({
        version: 4,
        operation: "explicit-reset",
        status: "prepared",
        before: {
          petRaw: malformedPetRaw,
          progressRaw: malformedGuideRaw,
        },
      });
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "loaded", pet: resetPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "prepared",
      });
    },
  );

  it("treats an exact V4 prepared-journal readback as durable after write-then-reject", async () => {
    const store = ambiguousInitialJournalMemory("write-then-reject");
    store.values.set(PET_STORAGE_KEY, "{bad-pet");
    store.values.set(CARE_GUIDE_PROGRESS_KEY, "{bad-guide");
    const resetPet = createNewPet(30_500);

    await expect(
      saveExplicitResetPair(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        store,
      ),
    ).resolves.toEqual({ recoveryPending: false, interruptedAt: null });
    expect(
      JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
    ).toMatchObject({
      version: 4,
      operation: "explicit-reset",
      status: "committed",
      after: { pet: resetPet, progress: DEFAULT_CARE_GUIDE_PROGRESS },
    });
  });

  it("retains the exact V4 authority after unavailable initial readback and recovers once", async () => {
    const store = ambiguousInitialJournalMemory(
      "write-then-reject",
      true,
    );
    store.values.set(PET_STORAGE_KEY, "{bad-pet");
    store.values.set(CARE_GUIDE_PROGRESS_KEY, "{bad-guide");
    const authority = createPetGuidePersistenceAuthority(store);
    const resetPet = createNewPet(30_600);

    await expect(
      authority.explicitResetWithPair(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).resolves.toMatchObject({
      recoveryPending: true,
      interruptedAt: "prepare",
    });
    expect(authority.pendingExplicitResetTarget()).toEqual({
      pet: resetPet,
      progress: DEFAULT_CARE_GUIDE_PROGRESS,
    });
    await expect(authority.savePet(resetPet)).rejects.toThrow(
      "persistence is pending",
    );
    await expect(
      authority.saveClean(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        resetPet,
        { version: 1, firstCareCompleted: true },
      ),
    ).rejects.toThrow("persistence is pending");

    store.restoreJournalReads();
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
      explicitResetRecovery: "recovered",
    });
    expect(
      authority.acknowledgeExplicitResetPublication(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).toBe(true);
    const laterPet = { ...resetPet, name: "Later" };
    await expect(authority.savePet(laterPet)).resolves.toBeUndefined();
    await expect(loadPetAndCareGuide(store)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: laterPet },
      cleanCompletionRecovery: "committed",
    });
  });

  it("preserves mismatched V4 journal/raw until the retained intent is confirmed absent", async () => {
    const store = ambiguousInitialJournalMemory(
      "reject-with-mismatched-readback",
    );
    store.values.set(PET_STORAGE_KEY, "{bad-pet");
    store.values.set(CARE_GUIDE_PROGRESS_KEY, "{bad-guide");
    const unrelatedJournal = store.values.get(
      CLEAN_COMPLETION_TRANSACTION_KEY,
    );
    const authority = createPetGuidePersistenceAuthority(store);
    const resetPet = createNewPet(30_700);

    await expect(
      authority.explicitResetWithPair(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).resolves.toMatchObject({ interruptedAt: "prepare" });
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      explicitResetRecovery: "invalid",
    });
    expect(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(
      unrelatedJournal,
    );
    expect(store.values.get(PET_STORAGE_KEY)).toBe("{bad-pet");
    expect(store.values.get(CARE_GUIDE_PROGRESS_KEY)).toBe("{bad-guide");
    await expect(authority.savePet(resetPet)).rejects.toThrow(
      "persistence is pending",
    );

    store.values.delete(CLEAN_COMPLETION_TRANSACTION_KEY);
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      explicitResetRecovery: "absent",
      petResult: { kind: "invalid" },
      careGuideResult: { kind: "invalid" },
    });
    expect(authority.pendingExplicitResetTarget()).toBeNull();
  });

  it("rejects changed raw data and every illegal V4 ordered boundary", async () => {
    const store = faultingMemory(PET_STORAGE_KEY, 1);
    const beforePetRaw = "{bad-pet";
    const beforeGuideRaw = "{bad-guide";
    store.values.set(PET_STORAGE_KEY, beforePetRaw);
    store.values.set(CARE_GUIDE_PROGRESS_KEY, beforeGuideRaw);
    const resetPet = createNewPet(32_000);
    await saveExplicitResetPair(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      store,
    );
    const targetPetRaw = JSON.stringify(resetPet);
    const targetGuideRaw = JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS);

    store.values.set(PET_STORAGE_KEY, beforePetRaw);
    store.values.set(CARE_GUIDE_PROGRESS_KEY, targetGuideRaw);
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "invalid" },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "prepared",
    });

    const changedPet = createNewPet(32_001);
    store.values.set(PET_STORAGE_KEY, JSON.stringify(changedPet));
    store.values.set(CARE_GUIDE_PROGRESS_KEY, beforeGuideRaw);
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: changedPet },
      careGuideResult: { kind: "invalid" },
      cleanCompletionRecovery: "prepared",
    });

    store.values.set(PET_STORAGE_KEY, `${targetPetRaw}\n`);
    store.values.set(CARE_GUIDE_PROGRESS_KEY, beforeGuideRaw);
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: { kind: "invalid" },
      cleanCompletionRecovery: "prepared",
    });
  });

  it("rejects malformed, mismatched-generation, and non-Baby V4 journals", async () => {
    const beforePetRaw = "{bad-pet";
    const beforeGuideRaw = "{bad-guide";
    const resetPet = createNewPet(33_000);
    const baseJournal = {
      version: 4,
      operation: "explicit-reset",
      status: "prepared",
      before: {
        petRaw: beforePetRaw,
        progressRaw: beforeGuideRaw,
      },
      after: {
        pet: resetPet,
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      targetGeneration: { id: resetPet.id, createdAt: resetPet.createdAt },
    };
    const badJournals = [
      { ...baseJournal, operation: "supersede" },
      {
        ...baseJournal,
        targetGeneration: { id: "other", createdAt: resetPet.createdAt },
      },
      {
        ...baseJournal,
        after: { ...baseJournal.after, pet: { ...resetPet, adoptionCompleted: true } },
      },
      {
        ...baseJournal,
        after: {
          ...baseJournal.after,
          progress: { version: 1, firstCareCompleted: true },
        },
      },
      { ...baseJournal, extra: true },
    ];

    for (const journal of badJournals) {
      const store = memory();
      store.values.set(PET_STORAGE_KEY, beforePetRaw);
      store.values.set(CARE_GUIDE_PROGRESS_KEY, beforeGuideRaw);
      const rawJournal = JSON.stringify(journal);
      store.values.set(CLEAN_COMPLETION_TRANSACTION_KEY, rawJournal);
      await expect(loadPetAndCareGuide(store)).resolves.toEqual({
        petResult: { kind: "invalid" },
        careGuideResult: { kind: "invalid" },
        cleanCompletionRecovery: "invalid",
      });
      expect(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(
        rawJournal,
      );
    }
  });

  it("treats committed V4 residue as cleanup-only after later valid divergence", async () => {
    const store = memory();
    const resetPet = createNewPet(34_000);
    await saveExplicitResetPair(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      store,
    );
    const laterPet = {
      ...careForPet(resetPet, "play", 33_000),
      roomTheme: "garden" as const,
    };
    const laterProgress = { version: 1 as const, firstCareCompleted: true };
    store.values.set(PET_STORAGE_KEY, JSON.stringify(laterPet));
    store.values.set(CARE_GUIDE_PROGRESS_KEY, JSON.stringify(laterProgress));

    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: laterPet },
      careGuideResult: { kind: "loaded", progress: laterProgress },
      cleanCompletionRecovery: "committed",
    });
  });

  it("does not prepare an explicit reset when raw reads or the journal write are unavailable", async () => {
    for (const unavailableKey of [PET_STORAGE_KEY, CARE_GUIDE_PROGRESS_KEY]) {
      const values = new Map<string, string>();
      values.set(PET_STORAGE_KEY, "{pet-bad");
      values.set(CARE_GUIDE_PROGRESS_KEY, "{guide-bad");
      const writes: string[] = [];
      const storage: StorageLike = {
        async getItem(key) {
          if (key === unavailableKey) throw new Error("read unavailable");
          return values.get(key) ?? null;
        },
        async setItem(key, value) {
          writes.push(key);
          values.set(key, value);
        },
      };
      await expect(
        saveExplicitResetPair(
          createNewPet(35_000),
          DEFAULT_CARE_GUIDE_PROGRESS,
          storage,
        ),
      ).rejects.toThrow("Explicit-reset storage is not writable");
      expect(writes).toEqual([]);
      expect(values.get(PET_STORAGE_KEY)).toBe("{pet-bad");
      expect(values.get(CARE_GUIDE_PROGRESS_KEY)).toBe("{guide-bad");
    }

    const prepareFailure = faultingMemory(CLEAN_COMPLETION_TRANSACTION_KEY, 1);
    prepareFailure.values.set(PET_STORAGE_KEY, "{pet-bad");
    prepareFailure.values.set(CARE_GUIDE_PROGRESS_KEY, "{guide-bad");
    await expect(
      saveExplicitResetPair(
        createNewPet(35_001),
        DEFAULT_CARE_GUIDE_PROGRESS,
        prepareFailure,
      ),
    ).rejects.toThrow("journal preparation was rejected and is absent");
    expect(prepareFailure.values.get(PET_STORAGE_KEY)).toBe("{pet-bad");
    expect(prepareFailure.values.get(CARE_GUIDE_PROGRESS_KEY)).toBe(
      "{guide-bad",
    );
    expect(
      prepareFailure.values.has(CLEAN_COMPLETION_TRANSACTION_KEY),
    ).toBe(false);
  });

  it("does not mask an unavailable key with a prepared V4 reset", async () => {
    const preparedStore = faultingMemory(PET_STORAGE_KEY, 1);
    preparedStore.values.set(PET_STORAGE_KEY, "{bad-pet");
    preparedStore.values.set(CARE_GUIDE_PROGRESS_KEY, "{bad-guide");
    await saveExplicitResetPair(
      createNewPet(35_002),
      DEFAULT_CARE_GUIDE_PROGRESS,
      preparedStore,
    );
    const unavailable: StorageLike = {
      async getItem(key) {
        if (key === PET_STORAGE_KEY) throw new Error("pet unavailable");
        return preparedStore.values.get(key) ?? null;
      },
      async setItem(key, value) {
        preparedStore.values.set(key, value);
      },
    };

    await expect(loadPetAndCareGuide(unavailable)).resolves.toEqual({
      petResult: { kind: "unavailable" },
      careGuideResult: { kind: "invalid" },
      cleanCompletionRecovery: "prepared",
    });
    expect(preparedStore.values.get(CARE_GUIDE_PROGRESS_KEY)).toBe(
      "{bad-guide",
    );
  });

  it("does not mask unavailable raw behind committed V4 residue", async () => {
    const base = memory();
    const resetPet = createNewPet(35_050);
    await saveExplicitResetPair(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      base,
    );
    const unavailable: StorageLike = {
      async getItem(key) {
        if (key === CARE_GUIDE_PROGRESS_KEY) {
          throw new Error("guide unavailable");
        }
        return base.values.get(key) ?? null;
      },
      async setItem(key, value) {
        base.values.set(key, value);
      },
    };

    await expect(
      createPetGuidePersistenceAuthority(unavailable).loadAndRecover(),
    ).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: { kind: "unavailable" },
      cleanCompletionRecovery: "committed",
      explicitResetRecovery: "unavailable",
    });
  });

  it.each([
    ["pet", "before-before", PET_STORAGE_KEY],
    ["guide", "after-before", CARE_GUIDE_PROGRESS_KEY],
    ["marker", "after-after", CLEAN_COMPLETION_TRANSACTION_KEY],
  ] as const)(
    "durably recovers a prepared V4 after a failed %s recovery write and process restart",
    async (_label, boundary, failureKey) => {
      const resetPet = createNewPet(35_100);
      const store = faultingMemory(failureKey, 1);
      seedPreparedExplicitReset(store.values, resetPet, boundary);

      await expect(
        createPetGuidePersistenceAuthority(store).loadAndRecover(),
      ).resolves.toMatchObject({
        cleanCompletionRecovery: "prepared",
        explicitResetRecovery: "pending",
      });

      await expect(
        createPetGuidePersistenceAuthority(store).loadAndRecover(),
      ).resolves.toEqual({
        petResult: { kind: "loaded", pet: resetPet },
        careGuideResult: {
          kind: "loaded",
          progress: DEFAULT_CARE_GUIDE_PROGRESS,
        },
        cleanCompletionRecovery: "committed",
        explicitResetRecovery: "recovered",
      });
      expect(JSON.parse(store.values.get(PET_STORAGE_KEY)!)).toEqual(resetPet);
      expect(
        JSON.parse(store.values.get(CARE_GUIDE_PROGRESS_KEY)!),
      ).toEqual(DEFAULT_CARE_GUIDE_PROGRESS);
      expect(
        JSON.parse(store.values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
      ).toMatchObject({
        version: 4,
        operation: "explicit-reset",
        status: "committed",
      });

      await expect(
        createPetGuidePersistenceAuthority(store).loadAndRecover(),
      ).resolves.toMatchObject({
        petResult: { kind: "loaded", pet: resetPet },
        cleanCompletionRecovery: "committed",
        explicitResetRecovery: "committed-residue",
      });
    },
  );

  it.each([
    ["pet", "before-before", PET_STORAGE_KEY],
    ["guide", "after-before", CARE_GUIDE_PROGRESS_KEY],
    ["marker", "after-after", CLEAN_COMPLETION_TRANSACTION_KEY],
  ] as const)(
    "recovers idempotently when a %s recovery write lands before its promise rejects",
    async (_label, boundary, failureKey) => {
      const resetPet = createNewPet(35_200);
      const values = new Map<string, string>();
      seedPreparedExplicitReset(values, resetPet, boundary);
      let failed = false;
      const store: StorageLike = {
        async getItem(key) {
          return values.get(key) ?? null;
        },
        async setItem(key, value) {
          values.set(key, value);
          if (key === failureKey && !failed) {
            failed = true;
            throw new Error(`write-then-interrupt at ${key}`);
          }
        },
      };

      await expect(
        createPetGuidePersistenceAuthority(store).loadAndRecover(),
      ).resolves.toMatchObject({ explicitResetRecovery: "pending" });
      const recovered = await createPetGuidePersistenceAuthority(
        store,
      ).loadAndRecover();
      expect(recovered).toMatchObject({
        petResult: { kind: "loaded", pet: resetPet },
        cleanCompletionRecovery: "committed",
      });
      expect(
        ["recovered", "committed-residue"],
      ).toContain(recovered.explicitResetRecovery);
    },
  );

  it("retries prepared V4 recovery across repeated process loss and restored storage access", async () => {
    const resetPet = createNewPet(35_300);
    const values = new Map<string, string>();
    seedPreparedExplicitReset(values, resetPet, "after-after");
    let markerFailures = 2;
    let readsUnavailable = true;
    const store: StorageLike = {
      async getItem(key) {
        if (readsUnavailable && key === PET_STORAGE_KEY) {
          throw new Error("storage unavailable");
        }
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        if (
          key === CLEAN_COMPLETION_TRANSACTION_KEY &&
          markerFailures > 0
        ) {
          markerFailures -= 1;
          throw new Error("marker unavailable");
        }
        values.set(key, value);
      },
    };

    await expect(
      createPetGuidePersistenceAuthority(store).loadAndRecover(),
    ).resolves.toMatchObject({ explicitResetRecovery: "unavailable" });
    readsUnavailable = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        createPetGuidePersistenceAuthority(store).loadAndRecover(),
      ).resolves.toMatchObject({ explicitResetRecovery: "pending" });
    }
    await expect(
      createPetGuidePersistenceAuthority(store).loadAndRecover(),
    ).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: resetPet },
      explicitResetRecovery: "recovered",
    });
  });

  it("rechecks exact raw immediately before a recovery member write", async () => {
    const resetPet = createNewPet(35_350);
    const values = new Map<string, string>();
    seedPreparedExplicitReset(values, resetPet, "after-before");
    let guideReads = 0;
    const writes: string[] = [];
    const store: StorageLike = {
      async getItem(key) {
        if (key === CARE_GUIDE_PROGRESS_KEY && ++guideReads === 2) {
          values.set(key, "{unrelated-guide-change");
        }
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        writes.push(key);
        values.set(key, value);
      },
    };

    await expect(
      createPetGuidePersistenceAuthority(store).loadAndRecover(),
    ).resolves.toMatchObject({
      cleanCompletionRecovery: "prepared",
      explicitResetRecovery: "invalid",
    });
    expect(writes).toEqual([]);
    expect(values.get(CARE_GUIDE_PROGRESS_KEY)).toBe(
      "{unrelated-guide-change",
    );
  });

  it("blocks old timestamp and ordinary writes until the committed reset is published, then allows later gameplay", async () => {
    const store = memory();
    const oldPet = careForPet(createNewPet(1_000), "play", 2_000);
    store.values.set(PET_STORAGE_KEY, JSON.stringify(oldPet));
    store.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify({ version: 1, firstCareCompleted: true }),
    );
    const authority = createPetGuidePersistenceAuthority(store);
    const resetPet = createNewPet(35_400);
    await authority.explicitResetWithPair(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
    );

    await expect(
      authority.savePet({ ...oldPet, lastUpdatedAt: 99_999 }),
    ).rejects.toThrow("Superseding pair persistence is pending");
    await expect(
      authority.saveGuide({ version: 1, firstCareCompleted: true }),
    ).rejects.toThrow("Superseding pair persistence is pending");
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      explicitResetRecovery: "committed-residue",
    });
    expect(
      authority.acknowledgeExplicitResetPublication(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).toBe(true);

    const laterPet = careForPet(resetPet, "play", 35_500);
    await expect(authority.savePet(laterPet)).resolves.toBeUndefined();
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: laterPet },
      explicitResetRecovery: "committed-residue",
    });
  });

  it("recovers an interrupted explicit reset idempotently through the serialized authority", async () => {
    const store = faultingMemory(CARE_GUIDE_PROGRESS_KEY, 1);
    store.values.set(PET_STORAGE_KEY, "{bad-pet");
    store.values.set(CARE_GUIDE_PROGRESS_KEY, "{bad-guide");
    const authority = createPetGuidePersistenceAuthority(store);
    const resetPet = createNewPet(36_000);

    await expect(
      authority.explicitResetWithPair(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).resolves.toEqual({ recoveryPending: true, interruptedAt: "guide" });
    await expect(authority.loadAndRecover()).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
      explicitResetRecovery: "recovered",
    });
    expect(authority.retryPendingSupersession()).toBeNull();
    expect(authority.pendingExplicitResetTarget()).toEqual({
      pet: resetPet,
      progress: DEFAULT_CARE_GUIDE_PROGRESS,
    });
    expect(
      authority.acknowledgeExplicitResetPublication(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).toBe(true);
    expect(authority.pendingExplicitResetTarget()).toBeNull();
    await expect(loadPetAndCareGuide(store)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("keeps background V3 supersession preservation-only beside malformed raw", async () => {
    for (const malformedKey of [PET_STORAGE_KEY, CARE_GUIDE_PROGRESS_KEY]) {
      const store = memory();
      const before = cleanFixture().before;
      seedLegacyPair(store, before);
      store.values.set(malformedKey, "{bad");
      const authority = createPetGuidePersistenceAuthority(store);
      await expect(
        authority.supersedeWithPair(
          before,
          DEFAULT_CARE_GUIDE_PROGRESS,
        ),
      ).rejects.toThrow("Superseding pair storage is not writable");
      expect(store.values.get(malformedKey)).toBe("{bad");
      expect(store.values.has(CLEAN_COMPLETION_TRANSACTION_KEY)).toBe(false);
    }
  });
});
