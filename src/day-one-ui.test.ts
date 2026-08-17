import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CARE_GUIDE_PROGRESS_KEY,
  CLEAN_COMPLETION_TRANSACTION_KEY,
  DEFAULT_CARE_GUIDE_PROGRESS,
  PET_STORAGE_KEY,
  createPetGuidePersistenceAuthority,
  loadCareGuideProgress,
  loadPetAndCareGuide,
  saveCareGuideProgress,
  type StorageLike,
} from "./persistence";
import {
  CLEANING_DURATION_MS,
  startSleep,
  createNewPet,
  type PetState,
} from "./simulation";
import { createAppTimeCoordinator } from "./app-lifecycle";
import { createInteractionScheduler } from "./interaction-policy";
import {
  FIRST_CARE_GUIDANCE,
  commitSuccessfulClean,
  commitSuccessfulCleanDurably,
  completeFirstCareAfterAllowedAction,
  finishDelayedCleanDurably,
  finishExplicitResetDurably,
  getFirstCareGuidance,
  getLiveReturnSummary,
  installDialogFocusBoundary,
  recoverDelayedCleanForPublicationDurably,
  recoverExplicitResetForPublicationDurably,
  type DialogFocusElement,
  type DialogFocusKeyEvent,
} from "./day-one-ui";

afterEach(() => vi.useRealTimers());

function adoptedPet(overrides: Partial<PetState> = {}): PetState {
  return { ...createNewPet(0), adoptionCompleted: true, ...overrides };
}

function memory(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

function deferredStorage(
  blockedKey: string,
  blockedOccurrence = 1,
): StorageLike & {
  values: Map<string, string>;
  blocked: Promise<void>;
  release: () => void;
} {
  const values = new Map<string, string>();
  let releaseWrite: () => void = () => {};
  let reportBlocked: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    reportBlocked = resolve;
  });
  let writeCount = 0;
  return {
    values,
    blocked,
    release: releaseWrite,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      if (key === blockedKey) writeCount += 1;
      if (key === blockedKey && writeCount === blockedOccurrence) {
        reportBlocked();
        await gate;
      }
      values.set(key, value);
    },
  };
}

describe("Baby Day 1 App presentation contract", () => {
  it("shows one actionable first-care guide only when care is reachable", () => {
    const adopted = adoptedPet();
    expect(
      getFirstCareGuidance(adopted, DEFAULT_CARE_GUIDE_PROGRESS, false),
    ).toBe(FIRST_CARE_GUIDANCE);
    expect(
      getFirstCareGuidance(createNewPet(0), DEFAULT_CARE_GUIDE_PROGRESS, false),
    ).toBeNull();
    expect(
      getFirstCareGuidance(
        startSleep(adopted, 1, 0),
        DEFAULT_CARE_GUIDE_PROGRESS,
        false,
      ),
    ).toBeNull();
    expect(
      getFirstCareGuidance(adopted, DEFAULT_CARE_GUIDE_PROGRESS, true),
    ).toBeNull();
    expect(
      getFirstCareGuidance(
        {
          ...adopted,
          isDead: true,
          starvationVirtualMinutes: 120,
          sleepUntilVirtualMinutes: null,
        },
        DEFAULT_CARE_GUIDE_PROGRESS,
        false,
      ),
    ).toBeNull();
  });

  it("resolves only after an allowed care action and persists across reload", async () => {
    const rejected = completeFirstCareAfterAllowedAction(
      DEFAULT_CARE_GUIDE_PROGRESS,
      false,
    );
    expect(rejected).toBe(DEFAULT_CARE_GUIDE_PROGRESS);

    const completed = completeFirstCareAfterAllowedAction(rejected, true);
    expect(completed).toEqual({ version: 1, firstCareCompleted: true });
    expect(completeFirstCareAfterAllowedAction(completed, true)).toBe(completed);

    const storage = memory();
    await saveCareGuideProgress(completed, storage);
    await expect(loadCareGuideProgress(storage)).resolves.toEqual({
      kind: "loaded",
      progress: completed,
    });
    expect(getFirstCareGuidance(adoptedPet(), completed, false)).toBeNull();
  });

  it("keeps a return summary live as the current pet changes", () => {
    const before = adoptedPet({ lastUpdatedAt: 0 });
    const context = { before };
    const hungry = adoptedPet({
      lastUpdatedAt: 10 * 60_000,
      needs: { hunger: 10, happiness: 80, energy: 76, hygiene: 88 },
    });
    const cared = adoptedPet({
      lastUpdatedAt: 10 * 60_000,
      needs: { hunger: 80, happiness: 80, energy: 76, hygiene: 88 },
    });
    expect(getLiveReturnSummary(context, hungry)).toContain("hunger is very low");
    expect(getLiveReturnSummary(context, cared)).toContain("doing well");
  });

  it("has no alive-to-dead while-away presentation branch", () => {
    const before = adoptedPet({ lastUpdatedAt: 0 });
    const dead = adoptedPet({
      lastUpdatedAt: 10 * 60_000,
      isDead: true,
      starvationVirtualMinutes: 120,
      sleepUntilVirtualMinutes: null,
    });
    expect(getLiveReturnSummary({ before }, dead)).toBeNull();
  });

  it("cancels a backgrounded delayed Clean without hygiene or guide mutation", () => {
    vi.useFakeTimers();
    const coordinator = createAppTimeCoordinator({
      screen: "room",
      foreground: true,
      careReachable: true,
    });
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    coordinator.hydrateLoadedPet(originalPet, 0);
    coordinator.apply({
      type: "CARE_REACHABILITY",
      now: 0,
      reachable: false,
    });

    let currentPet = originalPet;
    let progress = DEFAULT_CARE_GUIDE_PROGRESS;
    const scheduler = createInteractionScheduler();
    const token = scheduler.begin();
    scheduler.schedule(token, CLEANING_DURATION_MS, () => {
      const completion = commitSuccessfulClean(currentPet, progress, 1_500);
      currentPet = completion.pet;
      progress = completion.progress;
    });

    coordinator.apply({ type: "VISIBILITY", now: 500, foreground: false });
    scheduler.cancel();
    coordinator.apply({
      type: "CARE_REACHABILITY",
      now: 500,
      reachable: true,
    });
    vi.advanceTimersByTime(CLEANING_DURATION_MS);

    expect(currentPet).toEqual(originalPet);
    expect(progress).toEqual(DEFAULT_CARE_GUIDE_PROGRESS);
  });

  it("uses the App-wired durable seam after the exact delayed Clean boundary", async () => {
    vi.useFakeTimers();
    const storage = memory();
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    let currentPet = originalPet;
    let progress = DEFAULT_CARE_GUIDE_PROGRESS;
    let persistence: Promise<void> | null = null;
    const scheduler = createInteractionScheduler();
    const token = scheduler.begin();
    scheduler.schedule(token, CLEANING_DURATION_MS, () => {
      persistence = commitSuccessfulCleanDurably(
        currentPet,
        progress,
        1_500,
        storage,
      ).then((completion) => {
        currentPet = completion.pet;
        progress = completion.progress;
      });
    });
    vi.advanceTimersByTime(CLEANING_DURATION_MS - 1);
    expect(currentPet).toEqual(originalPet);
    expect(progress.firstCareCompleted).toBe(false);
    vi.advanceTimersByTime(1);
    await persistence;
    expect(currentPet.needs.hygiene).toBeGreaterThan(
      originalPet.needs.hygiene,
    );
    expect(progress.firstCareCompleted).toBe(true);
    await expect(loadPetAndCareGuide(storage)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: currentPet },
      careGuideResult: { kind: "loaded", progress },
      cleanCompletionRecovery: "committed",
    });
  });

  it("keeps the App-wired Clean retryable when initial journal preparation fails", async () => {
    const values = new Map<string, string>();
    let prepareAttempts = 0;
    const storage: StorageLike = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        if (
          key === CLEAN_COMPLETION_TRANSACTION_KEY &&
          prepareAttempts++ === 0
        ) {
          throw new Error("journal preparation unavailable");
        }
        values.set(key, value);
      },
    };
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    const authority = createPetGuidePersistenceAuthority(storage);
    let currentPet = originalPet;
    let progress = DEFAULT_CARE_GUIDE_PROGRESS;
    let cleaningPhase: "sparkle" | null = "sparkle";
    let careLocked = true;
    let careReachable = false;
    let message = "Cleaning: water → dirt washout → shake → sparkle.";
    let successCount = 0;
    const adapter = {
      applyCommitted: (
        completion: Awaited<
          ReturnType<typeof commitSuccessfulCleanDurably>
        >,
      ) => {
        currentPet = completion.pet;
        progress = completion.progress;
        cleaningPhase = null;
        careLocked = false;
        careReachable = true;
        message = "Fresh and fluffy! Jack sparkles.";
        successCount += 1;
      },
      restoreForRetry: () => {
        cleaningPhase = null;
        careLocked = false;
        careReachable = true;
        message = "Clean couldn't be saved. Please try again.";
      },
    };

    await expect(
      finishDelayedCleanDurably(
        currentPet,
        progress,
        1_500,
        adapter,
        { authority },
      ),
    ).resolves.toBe("retry");
    expect(currentPet).toEqual(originalPet);
    expect(progress).toEqual(DEFAULT_CARE_GUIDE_PROGRESS);
    expect(cleaningPhase).toBeNull();
    expect(careLocked).toBe(false);
    expect(careReachable).toBe(true);
    expect(message).toBe("Clean couldn't be saved. Please try again.");
    expect(successCount).toBe(0);
    expect(values.size).toBe(0);

    cleaningPhase = "sparkle";
    careLocked = true;
    careReachable = false;
    await expect(
      finishDelayedCleanDurably(
        currentPet,
        progress,
        1_500,
        adapter,
        { authority },
      ),
    ).resolves.toBe("committed");
    expect(currentPet.needs.hygiene).toBeGreaterThan(
      originalPet.needs.hygiene,
    );
    expect(progress.firstCareCompleted).toBe(true);
    expect(cleaningPhase).toBeNull();
    expect(careLocked).toBe(false);
    expect(careReachable).toBe(true);
    expect(message).toBe("Fresh and fluffy! Jack sparkles.");
    expect(successCount).toBe(1);
    await expect(loadPetAndCareGuide(storage)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: currentPet },
      careGuideResult: { kind: "loaded", progress },
      cleanCompletionRecovery: "committed",
    });
  });

  it("keeps ambiguous Clean truthful and blocked, then reload-recovers and publishes once", async () => {
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    const values = new Map<string, string>([
      [PET_STORAGE_KEY, JSON.stringify(originalPet)],
      [
        CARE_GUIDE_PROGRESS_KEY,
        JSON.stringify(DEFAULT_CARE_GUIDE_PROGRESS),
      ],
    ]);
    let initialJournalWrite = true;
    let journalReadsUnavailable = true;
    const storage: StorageLike = {
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
        if (
          key === CLEAN_COMPLETION_TRANSACTION_KEY &&
          initialJournalWrite
        ) {
          initialJournalWrite = false;
          values.set(key, value);
          throw new Error("journal write landed before rejection");
        }
        values.set(key, value);
      },
    };
    const authority = createPetGuidePersistenceAuthority(storage);
    let currentPet = originalPet;
    let progress = DEFAULT_CARE_GUIDE_PROGRESS;
    let careLocked = true;
    let message = "Cleaning…";
    let successCount = 0;
    const adapter = {
      applyCommitted: (
        completion: Awaited<
          ReturnType<typeof commitSuccessfulCleanDurably>
        >,
      ) => {
        currentPet = completion.pet;
        progress = completion.progress;
        careLocked = false;
        message = "Fresh and fluffy! Jack sparkles.";
        successCount += 1;
      },
      restoreForRetry: () => {
        careLocked = false;
        message = "Clean couldn't be saved. Please try again.";
      },
      retainForRecovery: () => {
        careLocked = true;
        message =
          "The Clean save outcome is still being safely checked. Restore local storage access, then retry.";
      },
    };

    await expect(
      finishDelayedCleanDurably(
        currentPet,
        progress,
        1_500,
        adapter,
        { authority },
      ),
    ).resolves.toBe("recovery-pending");
    expect(currentPet).toEqual(originalPet);
    expect(progress).toEqual(DEFAULT_CARE_GUIDE_PROGRESS);
    expect(careLocked).toBe(true);
    expect(message).toContain("save outcome is still being safely checked");
    expect(successCount).toBe(0);
    await expect(authority.savePet(originalPet)).rejects.toThrow(
      "persistence is pending",
    );

    journalReadsUnavailable = false;
    const reloadedAuthority = createPetGuidePersistenceAuthority(storage);
    await expect(
      recoverDelayedCleanForPublicationDurably(
        reloadedAuthority,
        adapter,
      ),
    ).resolves.toBe("committed");
    expect(currentPet.needs.hygiene).toBeGreaterThan(
      originalPet.needs.hygiene,
    );
    expect(progress.firstCareCompleted).toBe(true);
    expect(careLocked).toBe(false);
    expect(message).toBe("Fresh and fluffy! Jack sparkles.");
    expect(successCount).toBe(1);
    await expect(
      recoverDelayedCleanForPublicationDurably(
        reloadedAuthority,
        adapter,
      ),
    ).resolves.toBe("none");
    expect(successCount).toBe(1);
  });

  it("blocks stale Clean publication and restores the current pair after background cancellation", async () => {
    const storage = deferredStorage(CLEAN_COMPLETION_TRANSACTION_KEY);
    const authority = createPetGuidePersistenceAuthority(storage);
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    let currentGeneration = true;
    const applyCommitted = vi.fn();
    const restoreForRetry = vi.fn();
    const clean = finishDelayedCleanDurably(
      originalPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      1_500,
      {
        applyCommitted,
        restoreForRetry,
        isCurrent: () => currentGeneration,
      },
      { authority },
    );
    await storage.blocked;

    currentGeneration = false;
    const restore = authority.supersedePendingCleanWithPair(
      originalPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
    );
    expect(restore).not.toBeNull();
    storage.release();
    await expect(clean).resolves.toBe("superseded");
    await restore;
    expect(applyCommitted).not.toHaveBeenCalled();
    expect(restoreForRetry).not.toHaveBeenCalled();
    await expect(loadPetAndCareGuide(storage)).resolves.toEqual({
      petResult: { kind: "loaded", pet: originalPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("checks the App UI generation again after the durable await", async () => {
    const storage = memory();
    const authority = createPetGuidePersistenceAuthority(storage);
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    const applyCommitted = vi.fn();
    const restoreForRetry = vi.fn();

    await expect(
      finishDelayedCleanDurably(
        originalPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        1_500,
        {
          applyCommitted,
          restoreForRetry,
          isCurrent: () => false,
        },
        { authority },
      ),
    ).resolves.toBe("superseded");
    expect(applyCommitted).not.toHaveBeenCalled();
    expect(restoreForRetry).not.toHaveBeenCalled();
  });

  it("lets a later reset win without stale Clean publication", async () => {
    const storage = deferredStorage(CLEAN_COMPLETION_TRANSACTION_KEY);
    const authority = createPetGuidePersistenceAuthority(storage);
    const originalPet = adoptedPet({
      needs: { hunger: 84, happiness: 80, energy: 76, hygiene: 20 },
    });
    let currentGeneration = true;
    const applyCommitted = vi.fn();
    const restoreForRetry = vi.fn();
    const clean = finishDelayedCleanDurably(
      originalPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      1_500,
      {
        applyCommitted,
        restoreForRetry,
        isCurrent: () => currentGeneration,
      },
      { authority },
    );
    await storage.blocked;

    currentGeneration = false;
    const resetPet = createNewPet(9_000);
    const applyReset = vi.fn();
    const reset = finishExplicitResetDurably(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      authority,
      { applyPrepared: applyReset, restoreForRetry: vi.fn() },
    );
    storage.release();
    await expect(clean).resolves.toBe("superseded");
    await expect(reset).resolves.toBe("committed");
    expect(applyCommitted).not.toHaveBeenCalled();
    expect(restoreForRetry).not.toHaveBeenCalled();
    expect(applyReset).toHaveBeenCalledOnce();
    await expect(loadPetAndCareGuide(storage)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("keeps the invalid-save screen unchanged after V4 prepare failure and succeeds on retry", async () => {
    const values = new Map<string, string>([
      [PET_STORAGE_KEY, "{bad-pet"],
      [CARE_GUIDE_PROGRESS_KEY, "{bad-guide"],
    ]);
    let journalAttempts = 0;
    const storage: StorageLike = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        if (
          key === CLEAN_COMPLETION_TRANSACTION_KEY &&
          journalAttempts++ === 0
        ) {
          throw new Error("prepare unavailable");
        }
        values.set(key, value);
      },
    };
    const authority = createPetGuidePersistenceAuthority(storage);
    const resetPet = createNewPet(12_000);
    let publishedPet: PetState | null = null;
    let screen: "invalid" | "title" = "invalid";
    let error = "";
    const adapter = {
      applyPrepared: ({ pet: preparedPet }: { pet: PetState }) => {
        publishedPet = preparedPet;
        screen = "title";
        error = "";
      },
      restoreForRetry: () => {
        error = "New Baby couldn't be saved. Nothing was replaced. Please try again.";
      },
    };

    await expect(
      finishExplicitResetDurably(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        authority,
        adapter,
      ),
    ).resolves.toBe("retry");
    expect(publishedPet).toBeNull();
    expect(screen).toBe("invalid");
    expect(error).toContain("Nothing was replaced");
    expect(values.get(PET_STORAGE_KEY)).toBe("{bad-pet");
    expect(values.get(CARE_GUIDE_PROGRESS_KEY)).toBe("{bad-guide");

    await expect(
      finishExplicitResetDurably(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        authority,
        adapter,
      ),
    ).resolves.toBe("committed");
    expect(publishedPet).toEqual(resetPet);
    expect(screen).toBe("title");
    expect(error).toBe("");
    await expect(loadPetAndCareGuide(storage)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("keeps ambiguous V4 truthful and authoritative, then reload-recovers and publishes once", async () => {
    const values = new Map<string, string>([
      [PET_STORAGE_KEY, "{bad-pet"],
      [CARE_GUIDE_PROGRESS_KEY, "{bad-guide"],
    ]);
    let initialJournalWrite = true;
    let journalReadsUnavailable = true;
    const storage: StorageLike = {
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
        if (
          key === CLEAN_COMPLETION_TRANSACTION_KEY &&
          initialJournalWrite
        ) {
          initialJournalWrite = false;
          values.set(key, value);
          throw new Error("journal write landed before rejection");
        }
        values.set(key, value);
      },
    };
    const authority = createPetGuidePersistenceAuthority(storage);
    const resetPet = createNewPet(12_500);
    let publishedPet: PetState | null = null;
    let message = "";
    let successCount = 0;
    const adapter = {
      applyPrepared: ({ pet: preparedPet }: { pet: PetState }) => {
        publishedPet = preparedPet;
        message = "New Baby saved.";
        successCount += 1;
      },
      restoreForRetry: () => {
        message = "New Baby couldn't be saved. Nothing was replaced.";
      },
      retainForRecovery: () => {
        message =
          "The reset save outcome is still being safely checked. Restore local storage access, then retry recovery.";
      },
    };

    await expect(
      finishExplicitResetDurably(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        authority,
        adapter,
      ),
    ).resolves.toBe("recovery-pending");
    expect(publishedPet).toBeNull();
    expect(message).toContain("save outcome is still being safely checked");
    expect(values.get(PET_STORAGE_KEY)).toBe("{bad-pet");
    expect(values.get(CARE_GUIDE_PROGRESS_KEY)).toBe("{bad-guide");
    await expect(authority.savePet(resetPet)).rejects.toThrow(
      "persistence is pending",
    );

    journalReadsUnavailable = false;
    const reloadedAuthority = createPetGuidePersistenceAuthority(storage);
    await expect(
      recoverExplicitResetForPublicationDurably(
        reloadedAuthority,
        adapter,
      ),
    ).resolves.toBe("committed");
    expect(publishedPet).toEqual(resetPet);
    expect(message).toBe("New Baby saved.");
    expect(successCount).toBe(1);
    await expect(
      recoverExplicitResetForPublicationDurably(
        reloadedAuthority,
        adapter,
      ),
    ).resolves.toBe("none");
    expect(successCount).toBe(1);
  });

  it("does not publish a confirmed Restart until its V4 prepare is durable", async () => {
    const storage = deferredStorage(CLEAN_COMPLETION_TRANSACTION_KEY);
    const currentPet = adoptedPet({ createdAt: 1_000, id: "pet-1000" });
    storage.values.set(PET_STORAGE_KEY, JSON.stringify(currentPet));
    storage.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify({ version: 1, firstCareCompleted: true }),
    );
    const authority = createPetGuidePersistenceAuthority(storage);
    const resetPet = createNewPet(13_000);
    const applyPrepared = vi.fn();
    const restoreForRetry = vi.fn();
    const reset = finishExplicitResetDurably(
      resetPet,
      DEFAULT_CARE_GUIDE_PROGRESS,
      authority,
      { applyPrepared, restoreForRetry },
    );

    await storage.blocked;
    expect(applyPrepared).not.toHaveBeenCalled();
    expect(restoreForRetry).not.toHaveBeenCalled();
    expect(JSON.parse(storage.values.get(PET_STORAGE_KEY)!)).toEqual(
      currentPet,
    );
    storage.release();
    await expect(reset).resolves.toBe("committed");
    expect(applyPrepared).toHaveBeenCalledOnce();
    expect(restoreForRetry).not.toHaveBeenCalled();
    await expect(loadPetAndCareGuide(storage)).resolves.toEqual({
      petResult: { kind: "loaded", pet: resetPet },
      careGuideResult: {
        kind: "loaded",
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      },
      cleanCompletionRecovery: "committed",
    });
  });

  it("publishes only after a prepared guide failure is durably recovered and retried", async () => {
    const values = new Map<string, string>([
      [PET_STORAGE_KEY, "{bad-pet"],
      [CARE_GUIDE_PROGRESS_KEY, "{bad-guide"],
    ]);
    let guideWrites = 0;
    const storage: StorageLike = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        if (
          key === CARE_GUIDE_PROGRESS_KEY &&
          ++guideWrites <= 2
        ) {
          throw new Error("guide unavailable");
        }
        values.set(key, value);
      },
    };
    const authority = createPetGuidePersistenceAuthority(storage);
    const resetPet = createNewPet(13_500);
    const applyPrepared = vi.fn();
    const retainForRecovery = vi.fn();

    await expect(
      finishExplicitResetDurably(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        authority,
        {
          applyPrepared,
          restoreForRetry: vi.fn(),
          retainForRecovery,
        },
      ),
    ).resolves.toBe("recovery-pending");
    expect(applyPrepared).not.toHaveBeenCalled();
    expect(retainForRecovery).toHaveBeenCalledWith("pending");
    expect(values.get(CARE_GUIDE_PROGRESS_KEY)).toBe("{bad-guide");

    await expect(
      recoverExplicitResetForPublicationDurably(authority, {
        applyPrepared,
        restoreForRetry: vi.fn(),
        retainForRecovery,
      }),
    ).resolves.toBe("committed");
    expect(applyPrepared).toHaveBeenCalledOnce();
    expect(JSON.parse(values.get(PET_STORAGE_KEY)!)).toEqual(resetPet);
    expect(JSON.parse(values.get(CARE_GUIDE_PROGRESS_KEY)!)).toEqual(
      DEFAULT_CARE_GUIDE_PROGRESS,
    );
    expect(
      JSON.parse(values.get(CLEAN_COMPLETION_TRANSACTION_KEY)!),
    ).toMatchObject({ status: "committed" });
  });

  it("reloads a prepared reset to the exact Baby pair without returning to malformed-save UI", async () => {
    const values = new Map<string, string>([
      [PET_STORAGE_KEY, "{bad-pet"],
      [CARE_GUIDE_PROGRESS_KEY, "{bad-guide"],
    ]);
    let failGuide = true;
    const storage: StorageLike = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        if (key === CARE_GUIDE_PROGRESS_KEY && failGuide) {
          failGuide = false;
          throw new Error("process stopped at guide");
        }
        values.set(key, value);
      },
    };
    const resetPet = createNewPet(13_750);
    await expect(
      createPetGuidePersistenceAuthority(storage).explicitResetWithPair(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
      ),
    ).resolves.toMatchObject({ recoveryPending: true });

    const reloadedAuthority = createPetGuidePersistenceAuthority(storage);
    const applyPrepared = vi.fn();
    await expect(
      recoverExplicitResetForPublicationDurably(reloadedAuthority, {
        applyPrepared,
        restoreForRetry: vi.fn(),
      }),
    ).resolves.toBe("committed");
    expect(applyPrepared).toHaveBeenCalledWith({
      pet: resetPet,
      progress: DEFAULT_CARE_GUIDE_PROGRESS,
      durability: { recoveryPending: false, interruptedAt: null },
    });
    await expect(loadPetAndCareGuide(storage)).resolves.toMatchObject({
      petResult: { kind: "loaded", pet: resetPet },
      cleanCompletionRecovery: "committed",
    });
  });

  it.each([
    ["before prepare", CLEAN_COMPLETION_TRANSACTION_KEY, 1],
    ["after prepare", PET_STORAGE_KEY, 1],
    ["before commit marker", CLEAN_COMPLETION_TRANSACTION_KEY, 2],
  ] as const)(
    "keeps a reset authoritative when background suppresses publication %s",
    async (_label, blockedKey, blockedOccurrence) => {
      const storage = deferredStorage(blockedKey, blockedOccurrence);
      const oldPet = adoptedPet({ createdAt: 1_000, id: "pet-1000" });
      storage.values.set(PET_STORAGE_KEY, JSON.stringify(oldPet));
      storage.values.set(
        CARE_GUIDE_PROGRESS_KEY,
        JSON.stringify({ version: 1, firstCareCompleted: true }),
      );
      const authority = createPetGuidePersistenceAuthority(storage);
      const resetPet = createNewPet(14_000);
      const coordinator = createAppTimeCoordinator({
        screen: "room",
        foreground: true,
        careReachable: true,
      });
      coordinator.replacePet(oldPet);
      const applyPrepared = vi.fn();
      const restoreForRetry = vi.fn();
      let current = true;
      const reset = finishExplicitResetDurably(
        resetPet,
        DEFAULT_CARE_GUIDE_PROGRESS,
        authority,
        {
          applyPrepared,
          restoreForRetry,
          isCurrent: () => current,
        },
      );
      await storage.blocked;
      coordinator.apply({
        type: "VISIBILITY",
        now: 14_050,
        foreground: false,
      });
      current = false;
      await expect(
        authority.savePet({ ...oldPet, lastUpdatedAt: 99_000 }),
      ).rejects.toThrow("Superseding pair persistence is pending");
      storage.release();
      await expect(reset).resolves.toBe("superseded");
      expect(applyPrepared).not.toHaveBeenCalled();
      expect(restoreForRetry).not.toHaveBeenCalled();
      expect(authority.pendingExplicitResetTarget()).toEqual({
        pet: resetPet,
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
      });

      const applyRecovered = vi.fn(
        ({ pet: recoveredPet }: { pet: PetState }) => {
          coordinator.replacePet(recoveredPet);
          coordinator.apply({
            type: "VISIBILITY",
            now: 14_100,
            foreground: true,
          });
        },
      );
      await expect(
        recoverExplicitResetForPublicationDurably(authority, {
          applyPrepared: applyRecovered,
          restoreForRetry: vi.fn(),
        }),
      ).resolves.toBe("committed");
      expect(applyRecovered).toHaveBeenCalledWith({
        pet: resetPet,
        progress: DEFAULT_CARE_GUIDE_PROGRESS,
        durability: { recoveryPending: false, interruptedAt: null },
      });
      expect(authority.pendingExplicitResetTarget()).toBeNull();
      expect(coordinator.snapshot().pet).toEqual({
        ...resetPet,
        lastUpdatedAt: 14_100,
      });

      const laterPet = { ...resetPet, name: "Bobby" };
      await expect(authority.savePet(laterPet)).resolves.toBeUndefined();
      await expect(loadPetAndCareGuide(storage)).resolves.toMatchObject({
        petResult: { kind: "loaded", pet: laterPet },
        cleanCompletionRecovery: "committed",
      });
    },
  );

  it("never lets stale UI overwrite valid divergence beside committed residue", async () => {
    const storage = deferredStorage(CLEAN_COMPLETION_TRANSACTION_KEY, 2);
    const authority = createPetGuidePersistenceAuthority(storage);
    const firstReset = createNewPet(14_500);
    const reset = finishExplicitResetDurably(
      firstReset,
      DEFAULT_CARE_GUIDE_PROGRESS,
      authority,
      {
        applyPrepared: vi.fn(),
        restoreForRetry: vi.fn(),
        isCurrent: () => false,
      },
    );
    await storage.blocked;
    storage.release();
    await expect(reset).resolves.toBe("superseded");

    const laterValidPet = { ...firstReset, name: "Later" };
    const laterValidGuide = { version: 1 as const, firstCareCompleted: true };
    storage.values.set(PET_STORAGE_KEY, JSON.stringify(laterValidPet));
    storage.values.set(
      CARE_GUIDE_PROGRESS_KEY,
      JSON.stringify(laterValidGuide),
    );
    const retainForRecovery = vi.fn();
    await expect(
      recoverExplicitResetForPublicationDurably(authority, {
        applyPrepared: vi.fn(),
        restoreForRetry: vi.fn(),
        retainForRecovery,
      }),
    ).resolves.toBe("recovery-pending");
    expect(retainForRecovery).toHaveBeenCalledWith("invalid");
    await expect(authority.savePet(firstReset)).rejects.toThrow(
      "Superseding pair persistence is pending",
    );
    expect(JSON.parse(storage.values.get(PET_STORAGE_KEY)!)).toEqual(
      laterValidPet,
    );

    const newlyAuthorizedReset = createNewPet(14_600);
    const applyPrepared = vi.fn();
    await expect(
      finishExplicitResetDurably(
        newlyAuthorizedReset,
        DEFAULT_CARE_GUIDE_PROGRESS,
        authority,
        { applyPrepared, restoreForRetry: vi.fn() },
      ),
    ).resolves.toBe("committed");
    expect(applyPrepared).toHaveBeenCalledWith({
      pet: newlyAuthorizedReset,
      progress: DEFAULT_CARE_GUIDE_PROGRESS,
      durability: { recoveryPending: false, interruptedAt: null },
    });
  });

  it("uses the wired Sleep focus boundary for focus, wrapping, Escape, and restore", () => {
    vi.useFakeTimers();
    let active: DialogFocusElement | null = null;
    const element = (name: string): DialogFocusElement & { name: string } => ({
      name,
      isConnected: true,
      focus: () => {
        active = elements[name];
      },
      hasAttribute: () => false,
    });
    const elements: Record<string, DialogFocusElement & { name: string }> = {};
    elements.opener = element("opener");
    elements.first = element("first");
    elements.last = element("last");
    active = elements.opener;
    let keydown: ((event: DialogFocusKeyEvent) => void) | null = null;
    const cancel = vi.fn();
    const cleanup = installDialogFocusBoundary(
      {
        getActiveElement: () => active,
        getFocusableElements: () => [elements.first, elements.last],
        contains: (candidate) =>
          candidate === elements.first || candidate === elements.last,
        addKeydownListener: (listener) => {
          keydown = listener;
        },
        removeKeydownListener: (listener) => {
          if (keydown === listener) keydown = null;
        },
        scheduleInitialFocus: (callback) => setTimeout(callback, 0),
        cancelInitialFocus: (handle) =>
          clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
      cancel,
    );
    vi.runOnlyPendingTimers();
    expect(active).toBe(elements.first);

    const press = (key: string, shiftKey = false) => {
      const event = { key, shiftKey, preventDefault: vi.fn() };
      keydown?.(event);
      return event;
    };
    expect(press("Tab", true).preventDefault).toHaveBeenCalledOnce();
    expect(active).toBe(elements.last);
    expect(press("Tab").preventDefault).toHaveBeenCalledOnce();
    expect(active).toBe(elements.first);
    const escape = press("Escape");
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    cleanup();
    expect(active).toBe(elements.opener);
    expect(keydown).toBeNull();
  });
});
