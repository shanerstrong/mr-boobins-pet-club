import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createNewPet,
  isPetState,
  migratePetState,
  type PetState,
} from "./simulation";
import {
  TRAINING_CELEBRATIONS,
  type TrainingCelebration,
  type TrainingCommand,
} from "./training-policy";

export const PET_STORAGE_KEY = "mr-boobins-pet-club/v0/pet";
export const AUDIO_PREFERENCES_KEY = "mr-boobins-pet-club/v0/audio-preferences";
export const TRAINING_PROGRESS_KEY = "mr-boobins-pet-club/v1/training";
export const CARE_GUIDE_PROGRESS_KEY = "mr-boobins-pet-club/v1/care-guide";
export const CLEAN_COMPLETION_TRANSACTION_KEY =
  "mr-boobins-pet-club/v1/clean-completion-transaction";

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

export type CleanCompletionTransactionStatus = "prepared" | "committed";

export interface LegacyCleanCompletionTransaction {
  version: 1;
  status: CleanCompletionTransactionStatus;
  pet: PetState;
  progress: CareGuideProgress;
}

export interface CleanCompletionSnapshot {
  pet: PetState | null;
  progress: CareGuideProgress | null;
}

export interface CleanCompletionTransaction {
  version: 2;
  status: CleanCompletionTransactionStatus;
  before: CleanCompletionSnapshot;
  after: {
    pet: PetState;
    progress: CareGuideProgress;
  };
}

export interface SupersedingPairTransaction {
  version: 3;
  operation: "supersede";
  status: CleanCompletionTransactionStatus;
  before: CleanCompletionSnapshot;
  after: {
    pet: PetState;
    progress: CareGuideProgress;
  };
}

export interface ExplicitResetTransaction {
  version: 4;
  operation: "explicit-reset";
  status: CleanCompletionTransactionStatus;
  before: {
    petRaw: string | null;
    progressRaw: string | null;
  };
  after: {
    pet: PetState;
    progress: CareGuideProgress;
  };
  targetGeneration: {
    id: string;
    createdAt: number;
  };
}

type StoredCleanCompletionTransaction =
  | LegacyCleanCompletionTransaction
  | CleanCompletionTransaction
  | SupersedingPairTransaction
  | ExplicitResetTransaction;

export type CleanCompletionRecovery =
  | "none"
  | "prepared"
  | "committed"
  | "invalid"
  | "unavailable";

export type LoadPetAndCareGuideResult = {
  petResult: LoadPetResult;
  careGuideResult: LoadCareGuideProgressResult;
  cleanCompletionRecovery: CleanCompletionRecovery;
};

export type ExplicitResetRecovery =
  | "none"
  | "absent"
  | "pending"
  | "recovered"
  | "committed-residue"
  | "invalid"
  | "unavailable";

export type DelayedCleanRecovery =
  | "absent"
  | "pending"
  | "recovered"
  | "invalid"
  | "unavailable";

export type DurableLoadPetAndCareGuideResult = LoadPetAndCareGuideResult & {
  explicitResetRecovery: ExplicitResetRecovery;
  delayedCleanRecovery?: DelayedCleanRecovery;
  delayedCleanTarget?: {
    pet: PetState;
    progress: CareGuideProgress;
    preparedJournalRaw: string;
  };
};

export type SaveCleanCompletionResult = {
  recoveryPending: boolean;
  interruptedAt: "prepare" | "pet" | "guide" | "commit" | null;
  preparedJournalRaw?: string;
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

function isExplicitResetRawSnapshot(
  value: unknown,
): value is ExplicitResetTransaction["before"] {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    (record.petRaw === null || typeof record.petRaw === "string") &&
    (record.progressRaw === null || typeof record.progressRaw === "string")
  );
}

function isExplicitResetTarget(
  pet: unknown,
  progress: unknown,
  generation: unknown,
  allowMigratedWellbeing = false,
): pet is PetState {
  const expected =
    pet && typeof pet === "object" && "createdAt" in pet
      ? createNewPet((pet as { createdAt: number }).createdAt)
      : null;
  const expectedWithMigration =
    expected && allowMigratedWellbeing && "wellbeingLastUpdatedAt" in (pet as object)
      ? {
          ...expected,
          wellbeingLastUpdatedAt: (pet as PetState).wellbeingLastUpdatedAt,
        }
      : expected;
  if (
    !isPetState(pet) ||
    !isCareGuideProgress(progress) ||
    !expectedWithMigration ||
    !samePet(pet, expectedWithMigration) ||
    progress.firstCareCompleted ||
    !generation ||
    typeof generation !== "object"
  ) {
    return false;
  }
  const targetGeneration = generation as Record<string, unknown>;
  return (
    Object.keys(targetGeneration).length === 2 &&
    targetGeneration.id === pet.id &&
    targetGeneration.createdAt === pet.createdAt
  );
}

function normalizeCleanCompletionSnapshot(
  value: unknown,
  migratedAt: number,
): CleanCompletionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2 ||
    (record.progress !== null && !isCareGuideProgress(record.progress))
  ) {
    return null;
  }
  const pet =
    record.pet === null ? null : migratePetState(record.pet, migratedAt);
  if (record.pet !== null && !pet) return null;
  return {
    pet,
    progress: record.progress as CareGuideProgress | null,
  };
}

function normalizeStoredCleanCompletionTransaction(
  value: unknown,
  migratedAt: number,
): StoredCleanCompletionTransaction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const validStatus =
    record.status === "prepared" || record.status === "committed";
  if (
    Object.keys(record).length === 4 &&
    record.version === 1 &&
    validStatus &&
    isCareGuideProgress(record.progress) &&
    record.progress.firstCareCompleted
  ) {
    const pet = migratePetState(record.pet, migratedAt);
    return pet
      ? {
          version: 1,
          status: record.status as CleanCompletionTransactionStatus,
          pet,
          progress: record.progress,
        }
      : null;
  }
  const before = normalizeCleanCompletionSnapshot(record.before, migratedAt);
  if (
    record.version === 2 &&
    Object.keys(record).length === 4 &&
    validStatus &&
    before &&
    record.after &&
    typeof record.after === "object"
  ) {
    const after = record.after as Record<string, unknown>;
    const afterPet = migratePetState(after.pet, migratedAt);
    if (
      Object.keys(after).length === 2 &&
      afterPet &&
      isCareGuideProgress(after.progress) &&
      after.progress.firstCareCompleted
    ) {
      return (
        before.pet === null ||
        (before.pet.id === afterPet.id &&
          before.pet.createdAt === afterPet.createdAt)
      )
        ? {
            version: 2,
            status: record.status as CleanCompletionTransactionStatus,
            before,
            after: { pet: afterPet, progress: after.progress },
          }
        : null;
    }
    return null;
  }
  if (record.version === 3) {
    if (
      Object.keys(record).length !== 5 ||
      record.operation !== "supersede" ||
      !validStatus ||
      !before ||
      !record.after ||
      typeof record.after !== "object"
    ) {
      return null;
    }
    const after = record.after as Record<string, unknown>;
    const afterPet = migratePetState(after.pet, migratedAt);
    return (
      Object.keys(after).length === 2 &&
      afterPet &&
      isCareGuideProgress(after.progress)
    )
      ? {
          version: 3,
          operation: "supersede",
          status: record.status as CleanCompletionTransactionStatus,
          before,
          after: { pet: afterPet, progress: after.progress },
        }
      : null;
  }
  if (
    record.version !== 4 ||
    Object.keys(record).length !== 6 ||
    record.operation !== "explicit-reset" ||
    !validStatus ||
    !isExplicitResetRawSnapshot(record.before) ||
    !record.after ||
    typeof record.after !== "object"
  ) {
    return null;
  }
  const after = record.after as Record<string, unknown>;
  if (Object.keys(after).length !== 2 || !isCareGuideProgress(after.progress)) {
    return null;
  }
  const afterPet = migratePetState(after.pet, migratedAt);
  if (!afterPet) return null;
  const expectedReset = {
    ...createNewPet(afterPet.createdAt),
    wellbeingLastUpdatedAt: afterPet.wellbeingLastUpdatedAt,
  };
  if (
    !samePet(afterPet, expectedReset) ||
    !isExplicitResetTarget(
      afterPet,
      after.progress,
      record.targetGeneration,
      true,
    )
  ) {
    return null;
  }
  return {
    version: 4,
    operation: "explicit-reset",
    status: record.status as CleanCompletionTransactionStatus,
    before: record.before as ExplicitResetTransaction["before"],
    after: { pet: afterPet, progress: after.progress },
    targetGeneration: record.targetGeneration as ExplicitResetTransaction["targetGeneration"],
  };
}

function samePet(left: PetState, right: PetState) {
  return (
    left.version === right.version &&
    left.id === right.id &&
    left.name === right.name &&
    left.createdAt === right.createdAt &&
    left.lastUpdatedAt === right.lastUpdatedAt &&
    left.wellbeingLastUpdatedAt === right.wellbeingLastUpdatedAt &&
    left.needs.hunger === right.needs.hunger &&
    left.needs.happiness === right.needs.happiness &&
    left.needs.energy === right.needs.energy &&
    left.needs.hygiene === right.needs.hygiene &&
    left.needs.health === right.needs.health &&
    left.needs.attention === right.needs.attention &&
    left.ageVirtualMinutes === right.ageVirtualMinutes &&
    left.adoptionCompleted === right.adoptionCompleted &&
    left.sleepUntilVirtualMinutes === right.sleepUntilVirtualMinutes &&
    left.growthMeals === right.growthMeals &&
    left.growthMealReady === right.growthMealReady &&
    left.roomTheme === right.roomTheme &&
    left.starvationVirtualMinutes === right.starvationVirtualMinutes &&
    left.isDead === right.isDead
  );
}

function sameProgress(left: CareGuideProgress, right: CareGuideProgress) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function petMatchesSnapshot(
  result: LoadPetResult,
  snapshot: PetState | null,
) {
  return snapshot === null
    ? result.kind === "missing"
    : result.kind === "loaded" && samePet(result.pet, snapshot);
}

function guideMatchesSnapshot(
  result: LoadCareGuideProgressResult,
  snapshot: CareGuideProgress | null,
) {
  return snapshot === null
    ? result.kind === "missing"
    : result.kind === "loaded" && sameProgress(result.progress, snapshot);
}

type StorageValueRead =
  | { kind: "available"; raw: string | null }
  | { kind: "unavailable"; raw: null };

function readStorageValue(
  storage: StorageLike,
  key: string,
): Promise<StorageValueRead> {
  return storage.getItem(key).then(
    (raw) => ({ kind: "available" as const, raw }),
    () => ({ kind: "unavailable" as const, raw: null }),
  );
}

class JournalPreparationAbsentError extends Error {
  constructor(operation: string) {
    super(`${operation} journal preparation was rejected and is absent`);
    this.name = "JournalPreparationAbsentError";
  }
}

async function preparePairJournal(
  preparedJournalRaw: string,
  operation: string,
  storage: StorageLike,
): Promise<"durable" | "ambiguous"> {
  try {
    await storage.setItem(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      preparedJournalRaw,
    );
    return "durable";
  } catch {
    const readBack = await readStorageValue(
      storage,
      CLEAN_COMPLETION_TRANSACTION_KEY,
    );
    if (readBack.kind === "unavailable") return "ambiguous";
    if (readBack.raw === preparedJournalRaw) return "durable";
    if (readBack.raw === null) {
      throw new JournalPreparationAbsentError(operation);
    }
    return "ambiguous";
  }
}

function committedJournalRaw(preparedJournalRaw: string) {
  try {
    const prepared = JSON.parse(preparedJournalRaw) as Record<string, unknown>;
    return JSON.stringify({ ...prepared, status: "committed" });
  } catch {
    return null;
  }
}

function petResultFromRead(
  read: StorageValueRead,
  migratedAt = Date.now(),
): LoadPetResult {
  if (read.kind === "unavailable") return { kind: "unavailable" };
  if (read.raw === null) return { kind: "missing" };
  try {
    const pet = migratePetState(JSON.parse(read.raw) as unknown, migratedAt);
    return pet ? { kind: "loaded", pet } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function guideResultFromRead(
  read: StorageValueRead,
): LoadCareGuideProgressResult {
  if (read.kind === "unavailable") return { kind: "unavailable" };
  if (read.raw === null) return { kind: "missing" };
  try {
    const progress = JSON.parse(read.raw) as unknown;
    return isCareGuideProgress(progress)
      ? { kind: "loaded", progress }
      : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function isLegacyV6PetRaw(raw: string | null) {
  if (raw === null) return false;
  try {
    const value = JSON.parse(raw) as { version?: unknown };
    return value?.version === 6;
  } catch {
    return false;
  }
}

function stablePreparedJournalMigrationAnchor(
  value: unknown,
  petRead: StorageValueRead,
  fallback: number,
) {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { status?: unknown }).status !== "prepared" ||
    petRead.kind !== "available" ||
    petRead.raw === null
  ) {
    return fallback;
  }
  let current: unknown;
  try {
    current = JSON.parse(petRead.raw) as unknown;
  } catch {
    return fallback;
  }
  if (!isPetState(current)) return fallback;

  const record = value as Record<string, unknown>;
  const candidates: unknown[] = [];
  if (record.version === 2) {
    const before = record.before as { pet?: unknown } | null;
    const after = record.after as { pet?: unknown } | null;
    candidates.push(before?.pet, after?.pet);
  } else if (record.version === 4 && record.operation === "explicit-reset") {
    const after = record.after as { pet?: unknown } | null;
    candidates.push(after?.pet);
  }

  for (const candidate of candidates) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      (candidate as { version?: unknown }).version !== 6
    ) {
      continue;
    }
    const migrated = migratePetState(
      candidate,
      current.wellbeingLastUpdatedAt,
    );
    if (migrated && samePet(migrated, current)) {
      return current.wellbeingLastUpdatedAt;
    }
  }
  return fallback;
}

export async function loadPet(
  storage: StorageLike = AsyncStorage,
): Promise<LoadPetResult> {
  const migratedAt = Date.now();
  try {
    const raw = await storage.getItem(PET_STORAGE_KEY);
    if (raw === null) return { kind: "missing" };
    try {
      const pet = migratePetState(JSON.parse(raw) as unknown, migratedAt);
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

export async function loadPetAndCareGuide(
  storage: StorageLike = AsyncStorage,
): Promise<LoadPetAndCareGuideResult> {
  const migratedAt = Date.now();
  const [petRead, careGuideRead, transactionRead] = await Promise.all([
    readStorageValue(storage, PET_STORAGE_KEY),
    readStorageValue(storage, CARE_GUIDE_PROGRESS_KEY),
    readStorageValue(storage, CLEAN_COMPLETION_TRANSACTION_KEY),
  ]);
  const petResult = petResultFromRead(petRead, migratedAt);
  const careGuideResult = guideResultFromRead(careGuideRead);

  if (transactionRead.kind === "unavailable") {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "unavailable",
    };
  }
  if (transactionRead.raw === null) {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "none",
    };
  }

  let transaction: StoredCleanCompletionTransaction;
  try {
    const parsed = JSON.parse(transactionRead.raw) as unknown;
    const normalized = normalizeStoredCleanCompletionTransaction(
      parsed,
      stablePreparedJournalMigrationAnchor(parsed, petRead, migratedAt),
    );
    if (!normalized) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "invalid",
      };
    }
    transaction = normalized;
  } catch {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "invalid",
    };
  }

  if (transaction.status === "committed" || transaction.version === 1) {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: transaction.status,
    };
  }

  if (transaction.version === 4) {
    if (
      petRead.kind === "unavailable" ||
      careGuideRead.kind === "unavailable"
    ) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: transaction.status,
      };
    }
    const afterPetRaw = JSON.stringify(transaction.after.pet);
    const afterProgressRaw = JSON.stringify(transaction.after.progress);
    const beforePet = petRead.raw === transaction.before.petRaw;
    const afterPet =
      petRead.raw === afterPetRaw ||
      (isLegacyV6PetRaw(petRead.raw) &&
        petResult.kind === "loaded" &&
        samePet(petResult.pet, transaction.after.pet));
    const beforeGuide = careGuideRead.raw === transaction.before.progressRaw;
    const afterGuide = careGuideRead.raw === afterProgressRaw;
    const isLegalOrderedBoundary =
      (beforePet && beforeGuide) ||
      (afterPet && beforeGuide) ||
      (afterPet && afterGuide);
    if (!isLegalOrderedBoundary) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: transaction.status,
      };
    }
    return {
      petResult: { kind: "loaded", pet: transaction.after.pet },
      careGuideResult: {
        kind: "loaded",
        progress: transaction.after.progress,
      },
      cleanCompletionRecovery: transaction.status,
    };
  }

  const beforePet = petMatchesSnapshot(petResult, transaction.before.pet);
  const afterPet = petMatchesSnapshot(petResult, transaction.after.pet);
  const beforeGuide = guideMatchesSnapshot(
    careGuideResult,
    transaction.before.progress,
  );
  const afterGuide = guideMatchesSnapshot(
    careGuideResult,
    transaction.after.progress,
  );
  const isLegalOrderedBoundary =
    (beforePet && beforeGuide) ||
    (afterPet && beforeGuide) ||
    (afterPet && afterGuide);
  if (!isLegalOrderedBoundary) {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: transaction.status,
    };
  }

  return {
    petResult: { kind: "loaded", pet: transaction.after.pet },
    careGuideResult: {
      kind: "loaded",
      progress: transaction.after.progress,
    },
    cleanCompletionRecovery: transaction.status,
  };
}

/**
 * App-used V4 recovery seam. Unlike the read-only compatibility loader above,
 * this operation does not expose a prepared reset's target pair until every
 * missing member and the committed marker have been durably written in order.
 * A rejected write leaves the prepared journal intact for the next serialized
 * attempt, while malformed, unavailable, or divergent raw state is never
 * replaced automatically.
 */
export async function loadPetAndCareGuideDurably(
  storage: StorageLike = AsyncStorage,
): Promise<DurableLoadPetAndCareGuideResult> {
  const migratedAt = Date.now();
  const [petRead, careGuideRead, transactionRead] = await Promise.all([
    readStorageValue(storage, PET_STORAGE_KEY),
    readStorageValue(storage, CARE_GUIDE_PROGRESS_KEY),
    readStorageValue(storage, CLEAN_COMPLETION_TRANSACTION_KEY),
  ]);
  const petResult = petResultFromRead(petRead, migratedAt);
  const careGuideResult = guideResultFromRead(careGuideRead);

  if (transactionRead.kind === "unavailable") {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "unavailable",
      explicitResetRecovery: "unavailable",
    };
  }
  if (transactionRead.raw === null) {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "none",
      explicitResetRecovery: "none",
    };
  }

  let transaction: StoredCleanCompletionTransaction;
  try {
    const parsed = JSON.parse(transactionRead.raw) as unknown;
    const normalized = normalizeStoredCleanCompletionTransaction(
      parsed,
      stablePreparedJournalMigrationAnchor(parsed, petRead, migratedAt),
    );
    if (!normalized) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "invalid",
        explicitResetRecovery: "invalid",
      };
    }
    transaction = normalized;
  } catch {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "invalid",
      explicitResetRecovery: "invalid",
    };
  }

  if (transaction.version === 2 && transaction.status === "prepared") {
    const preparedJournalRaw = transactionRead.raw;
    const delayedCleanTarget = {
      pet: transaction.after.pet,
      progress: transaction.after.progress,
      preparedJournalRaw,
    };
    if (
      petRead.kind === "unavailable" ||
      careGuideRead.kind === "unavailable"
    ) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "prepared",
        explicitResetRecovery: "none",
        delayedCleanRecovery: "unavailable",
        delayedCleanTarget,
      };
    }

    const beforePet = petMatchesSnapshot(petResult, transaction.before.pet);
    const afterPet = petMatchesSnapshot(petResult, transaction.after.pet);
    const beforeGuide = guideMatchesSnapshot(
      careGuideResult,
      transaction.before.progress,
    );
    const afterGuide = guideMatchesSnapshot(
      careGuideResult,
      transaction.after.progress,
    );
    const isLegalOrderedBoundary =
      (beforePet && beforeGuide) ||
      (afterPet && beforeGuide) ||
      (afterPet && afterGuide);
    if (!isLegalOrderedBoundary) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "prepared",
        explicitResetRecovery: "none",
        delayedCleanRecovery: "invalid",
        delayedCleanTarget,
      };
    }

    try {
      if (beforePet) {
        const latestPet = await readStorageValue(storage, PET_STORAGE_KEY);
        if (latestPet.kind === "unavailable") {
          return {
            petResult,
            careGuideResult,
            cleanCompletionRecovery: "prepared",
            explicitResetRecovery: "none",
            delayedCleanRecovery: "unavailable",
            delayedCleanTarget,
          };
        }
        if (
          !petMatchesSnapshot(
            petResultFromRead(latestPet, migratedAt),
            transaction.before.pet,
          )
        ) {
          return {
            petResult,
            careGuideResult,
            cleanCompletionRecovery: "prepared",
            explicitResetRecovery: "none",
            delayedCleanRecovery: "invalid",
            delayedCleanTarget,
          };
        }
        await savePet(transaction.after.pet, storage);
      }
      if (beforeGuide) {
        const latestGuide = await readStorageValue(
          storage,
          CARE_GUIDE_PROGRESS_KEY,
        );
        if (latestGuide.kind === "unavailable") {
          return {
            petResult,
            careGuideResult,
            cleanCompletionRecovery: "prepared",
            explicitResetRecovery: "none",
            delayedCleanRecovery: "unavailable",
            delayedCleanTarget,
          };
        }
        if (
          !guideMatchesSnapshot(
            guideResultFromRead(latestGuide),
            transaction.before.progress,
          )
        ) {
          return {
            petResult,
            careGuideResult,
            cleanCompletionRecovery: "prepared",
            explicitResetRecovery: "none",
            delayedCleanRecovery: "invalid",
            delayedCleanTarget,
          };
        }
        await saveCareGuideProgress(transaction.after.progress, storage);
      }
      const [finalPet, finalGuide] = await Promise.all([
        readStorageValue(storage, PET_STORAGE_KEY),
        readStorageValue(storage, CARE_GUIDE_PROGRESS_KEY),
      ]);
      if (
        finalPet.kind === "unavailable" ||
        finalGuide.kind === "unavailable"
      ) {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "none",
          delayedCleanRecovery: "unavailable",
          delayedCleanTarget,
        };
      }
      if (
        !petMatchesSnapshot(
          petResultFromRead(finalPet, migratedAt),
          transaction.after.pet,
        ) ||
        !guideMatchesSnapshot(
          guideResultFromRead(finalGuide),
          transaction.after.progress,
        )
      ) {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "none",
          delayedCleanRecovery: "invalid",
          delayedCleanTarget,
        };
      }
      await storage.setItem(
        CLEAN_COMPLETION_TRANSACTION_KEY,
        JSON.stringify({ ...transaction, status: "committed" }),
      );
    } catch {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "prepared",
        explicitResetRecovery: "none",
        delayedCleanRecovery: "pending",
        delayedCleanTarget,
      };
    }

    return {
      petResult: { kind: "loaded", pet: transaction.after.pet },
      careGuideResult: {
        kind: "loaded",
        progress: transaction.after.progress,
      },
      cleanCompletionRecovery: "committed",
      explicitResetRecovery: "none",
      delayedCleanRecovery: "recovered",
      delayedCleanTarget,
    };
  }

  if (transaction.version !== 4) {
    return {
      ...(await loadPetAndCareGuide(storage)),
      explicitResetRecovery: "none",
    };
  }
  if (petRead.kind === "unavailable" || careGuideRead.kind === "unavailable") {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: transaction.status,
      explicitResetRecovery: "unavailable",
    };
  }
  if (transaction.status === "committed") {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "committed",
      explicitResetRecovery: "committed-residue",
    };
  }

  const afterPetRaw = JSON.stringify(transaction.after.pet);
  const afterProgressRaw = JSON.stringify(transaction.after.progress);
  const beforePet = petRead.raw === transaction.before.petRaw;
  const afterPetExact = petRead.raw === afterPetRaw;
  const afterPet =
    afterPetExact ||
    (isLegacyV6PetRaw(petRead.raw) &&
      petResult.kind === "loaded" &&
      samePet(petResult.pet, transaction.after.pet));
  const beforeGuide = careGuideRead.raw === transaction.before.progressRaw;
  const afterGuide = careGuideRead.raw === afterProgressRaw;
  const isLegalOrderedBoundary =
    (beforePet && beforeGuide) ||
    (afterPet && beforeGuide) ||
    (afterPet && afterGuide);
  if (!isLegalOrderedBoundary) {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "prepared",
      explicitResetRecovery: "invalid",
    };
  }

  try {
    if (beforePet) {
      const latestPet = await readStorageValue(storage, PET_STORAGE_KEY);
      if (latestPet.kind === "unavailable") {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "unavailable",
        };
      }
      if (latestPet.raw !== transaction.before.petRaw) {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "invalid",
        };
      }
      await savePet(transaction.after.pet, storage);
    } else if (afterPet && !afterPetExact) {
      const latestPet = await readStorageValue(storage, PET_STORAGE_KEY);
      if (latestPet.kind === "unavailable") {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "unavailable",
        };
      }
      const latestPetResult = petResultFromRead(latestPet, migratedAt);
      if (
        latestPetResult.kind !== "loaded" ||
        !samePet(latestPetResult.pet, transaction.after.pet)
      ) {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "invalid",
        };
      }
      await savePet(transaction.after.pet, storage);
    }
    if (beforeGuide) {
      const latestGuide = await readStorageValue(
        storage,
        CARE_GUIDE_PROGRESS_KEY,
      );
      if (latestGuide.kind === "unavailable") {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "unavailable",
        };
      }
      if (latestGuide.raw !== transaction.before.progressRaw) {
        return {
          petResult,
          careGuideResult,
          cleanCompletionRecovery: "prepared",
          explicitResetRecovery: "invalid",
        };
      }
      await saveCareGuideProgress(transaction.after.progress, storage);
    }
    const [finalPet, finalGuide] = await Promise.all([
      readStorageValue(storage, PET_STORAGE_KEY),
      readStorageValue(storage, CARE_GUIDE_PROGRESS_KEY),
    ]);
    if (finalPet.kind === "unavailable" || finalGuide.kind === "unavailable") {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "prepared",
        explicitResetRecovery: "unavailable",
      };
    }
    if (finalPet.raw !== afterPetRaw || finalGuide.raw !== afterProgressRaw) {
      return {
        petResult,
        careGuideResult,
        cleanCompletionRecovery: "prepared",
        explicitResetRecovery: "invalid",
      };
    }
    await storage.setItem(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      JSON.stringify({ ...transaction, status: "committed" }),
    );
  } catch {
    return {
      petResult,
      careGuideResult,
      cleanCompletionRecovery: "prepared",
      explicitResetRecovery: "pending",
    };
  }

  return {
    petResult: { kind: "loaded", pet: transaction.after.pet },
    careGuideResult: {
      kind: "loaded",
      progress: transaction.after.progress,
    },
    cleanCompletionRecovery: "committed",
    explicitResetRecovery: "recovered",
  };
}

export async function saveCleanCompletion(
  beforePet: PetState,
  beforeProgress: CareGuideProgress,
  pet: PetState,
  progress: CareGuideProgress,
  storage: StorageLike = AsyncStorage,
): Promise<SaveCleanCompletionResult> {
  if (
    !isPetState(beforePet) ||
    !isCareGuideProgress(beforeProgress) ||
    !isPetState(pet) ||
    !isCareGuideProgress(progress) ||
    !progress.firstCareCompleted ||
    beforePet.id !== pet.id ||
    beforePet.createdAt !== pet.createdAt
  ) {
    return Promise.reject(new Error("Invalid clean completion"));
  }
  const [currentPet, currentProgress] = await Promise.all([
    loadPet(storage),
    loadCareGuideProgress(storage),
  ]);
  if (
    currentPet.kind === "invalid" ||
    currentPet.kind === "unavailable" ||
    currentProgress.kind === "invalid" ||
    currentProgress.kind === "unavailable"
  ) {
    return Promise.reject(new Error("Clean completion storage is not writable"));
  }
  if (
    (currentPet.kind === "loaded" &&
      (currentPet.pet.id !== beforePet.id ||
        currentPet.pet.createdAt !== beforePet.createdAt))
  ) {
    return Promise.reject(new Error("Clean completion was superseded"));
  }
  const prepared: CleanCompletionTransaction = {
    version: 2,
    status: "prepared",
    before: {
      pet: currentPet.kind === "loaded" ? currentPet.pet : null,
      progress:
        currentProgress.kind === "loaded" ? currentProgress.progress : null,
    },
    after: { pet, progress },
  };
  const preparedJournalRaw = JSON.stringify(prepared);
  const preparation = await preparePairJournal(
    preparedJournalRaw,
    "Clean completion",
    storage,
  );
  if (preparation === "ambiguous") {
    return {
      recoveryPending: true,
      interruptedAt: "prepare",
      preparedJournalRaw,
    };
  }
  try {
    await savePet(pet, storage);
  } catch {
    return { recoveryPending: true, interruptedAt: "pet" };
  }
  try {
    await saveCareGuideProgress(progress, storage);
  } catch {
    return { recoveryPending: true, interruptedAt: "guide" };
  }
  try {
    await storage.setItem(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      JSON.stringify({ ...prepared, status: "committed" }),
    );
  } catch {
    return { recoveryPending: true, interruptedAt: "commit" };
  }
  return { recoveryPending: false, interruptedAt: null };
}

export async function saveSupersedingPair(
  pet: PetState,
  progress: CareGuideProgress,
  storage: StorageLike = AsyncStorage,
): Promise<SaveCleanCompletionResult> {
  if (!isPetState(pet) || !isCareGuideProgress(progress)) {
    return Promise.reject(new Error("Invalid superseding pet/guide pair"));
  }
  const [currentPet, currentProgress] = await Promise.all([
    loadPet(storage),
    loadCareGuideProgress(storage),
  ]);
  if (
    currentPet.kind === "invalid" ||
    currentPet.kind === "unavailable" ||
    currentProgress.kind === "invalid" ||
    currentProgress.kind === "unavailable"
  ) {
    return Promise.reject(new Error("Superseding pair storage is not writable"));
  }
  const prepared: SupersedingPairTransaction = {
    version: 3,
    operation: "supersede",
    status: "prepared",
    before: {
      pet: currentPet.kind === "loaded" ? currentPet.pet : null,
      progress:
        currentProgress.kind === "loaded" ? currentProgress.progress : null,
    },
    after: { pet, progress },
  };
  await storage.setItem(
    CLEAN_COMPLETION_TRANSACTION_KEY,
    JSON.stringify(prepared),
  );
  try {
    await savePet(pet, storage);
  } catch {
    return { recoveryPending: true, interruptedAt: "pet" };
  }
  try {
    await saveCareGuideProgress(progress, storage);
  } catch {
    return { recoveryPending: true, interruptedAt: "guide" };
  }
  try {
    await storage.setItem(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      JSON.stringify({ ...prepared, status: "committed" }),
    );
  } catch {
    return { recoveryPending: true, interruptedAt: "commit" };
  }
  return { recoveryPending: false, interruptedAt: null };
}

export async function saveExplicitResetPair(
  pet: PetState,
  progress: CareGuideProgress,
  storage: StorageLike = AsyncStorage,
): Promise<SaveCleanCompletionResult> {
  if (
    !isPetState(pet) ||
    !isCareGuideProgress(progress) ||
    JSON.stringify(pet) !== JSON.stringify(createNewPet(pet.createdAt)) ||
    progress.firstCareCompleted
  ) {
    return Promise.reject(new Error("Invalid explicit-reset pet/guide pair"));
  }
  const [petRead, progressRead] = await Promise.all([
    readStorageValue(storage, PET_STORAGE_KEY),
    readStorageValue(storage, CARE_GUIDE_PROGRESS_KEY),
  ]);
  if (petRead.kind === "unavailable" || progressRead.kind === "unavailable") {
    return Promise.reject(new Error("Explicit-reset storage is not writable"));
  }
  const prepared: ExplicitResetTransaction = {
    version: 4,
    operation: "explicit-reset",
    status: "prepared",
    before: {
      petRaw: petRead.raw,
      progressRaw: progressRead.raw,
    },
    after: { pet, progress },
    targetGeneration: { id: pet.id, createdAt: pet.createdAt },
  };
  const preparedJournalRaw = JSON.stringify(prepared);
  const preparation = await preparePairJournal(
    preparedJournalRaw,
    "Explicit reset",
    storage,
  );
  if (preparation === "ambiguous") {
    return {
      recoveryPending: true,
      interruptedAt: "prepare",
      preparedJournalRaw,
    };
  }
  try {
    await savePet(pet, storage);
  } catch {
    return { recoveryPending: true, interruptedAt: "pet" };
  }
  try {
    await saveCareGuideProgress(progress, storage);
  } catch {
    return { recoveryPending: true, interruptedAt: "guide" };
  }
  try {
    await storage.setItem(
      CLEAN_COMPLETION_TRANSACTION_KEY,
      JSON.stringify({ ...prepared, status: "committed" }),
    );
  } catch {
    return { recoveryPending: true, interruptedAt: "commit" };
  }
  return { recoveryPending: false, interruptedAt: null };
}

export type SerializedCleanCompletionResult = {
  durability: SaveCleanCompletionResult;
  publishable: boolean;
};

export interface PetGuidePersistenceAuthority {
  loadAndRecover(): Promise<DurableLoadPetAndCareGuideResult>;
  savePet(pet: PetState): Promise<void>;
  saveGuide(progress: CareGuideProgress): Promise<void>;
  saveClean(
    beforePet: PetState,
    beforeProgress: CareGuideProgress,
    pet: PetState,
    progress: CareGuideProgress,
  ): Promise<SerializedCleanCompletionResult>;
  supersedeWithPair(
    pet: PetState,
    progress: CareGuideProgress,
  ): Promise<SaveCleanCompletionResult>;
  explicitResetWithPair(
    pet: PetState,
    progress: CareGuideProgress,
  ): Promise<SaveCleanCompletionResult>;
  supersedePendingCleanWithPair(
    pet: PetState,
    progress: CareGuideProgress,
  ): Promise<SaveCleanCompletionResult> | null;
  retryPendingSupersession(): Promise<SaveCleanCompletionResult> | null;
  pendingCleanCompletionTarget(): {
    pet: PetState;
    progress: CareGuideProgress;
  } | null;
  acknowledgeCleanPublication(
    pet: PetState,
    progress: CareGuideProgress,
  ): boolean;
  pendingExplicitResetTarget(): {
    pet: PetState;
    progress: CareGuideProgress;
  } | null;
  acknowledgeExplicitResetPublication(
    pet: PetState,
    progress: CareGuideProgress,
  ): boolean;
  invalidateCleanPublication(): void;
}

/**
 * One ordered authority for every App write that can affect the pet/guide pair.
 * Superseding operations invalidate Clean publication synchronously, then take
 * their place after all older writes and the in-flight Clean.
 */
export function createPetGuidePersistenceAuthority(
  storage: StorageLike = AsyncStorage,
): PetGuidePersistenceAuthority {
  let tail: Promise<void> = Promise.resolve();
  let publicationRevision = 0;
  let pendingCleans = 0;
  let pendingCleanPreparation: {
    pet: PetState;
    progress: CareGuideProgress;
    preparedJournalRaw: string;
    committedJournalRaw: string;
  } | null = null;
  let supersessionRevision = 0;
  let pendingSupersession: {
    revision: number;
    operation: "supersede" | "explicit-reset";
    pet: PetState;
    progress: CareGuideProgress;
    active: Promise<SaveCleanCompletionResult> | null;
    durablyPrepared: boolean;
    initialPreparationAmbiguous: boolean;
    preparedJournalRaw: string | null;
    committedJournalRaw: string | null;
    lastResult: SaveCleanCompletionResult | null;
  } | null = null;
  const currentPendingSupersession = () => pendingSupersession;

  const enqueue = <Result>(operation: () => Promise<Result>) => {
    const result = tail.then(operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const queueSupersession = (
    intent: NonNullable<typeof pendingSupersession>,
  ): Promise<SaveCleanCompletionResult> => {
    if (intent.active) return intent.active;
    if (
      intent.operation === "explicit-reset" &&
      intent.durablyPrepared &&
      intent.lastResult
    ) {
      return Promise.resolve(intent.lastResult);
    }
    const active = enqueue(async () => {
      if (intent.operation === "explicit-reset") {
        pendingCleanPreparation = null;
        return saveExplicitResetPair(intent.pet, intent.progress, storage);
      }
      if (pendingCleanPreparation) {
        throw new Error("Ambiguous Clean preparation is pending");
      }
      return saveSupersedingPair(intent.pet, intent.progress, storage);
    });
    intent.active = active;
    void active.then(
      (result) => {
        if (pendingSupersession !== intent) return;
        if (intent.operation === "explicit-reset") {
          if (
            result.interruptedAt === "prepare" &&
            result.preparedJournalRaw
          ) {
            intent.initialPreparationAmbiguous = true;
            intent.preparedJournalRaw = result.preparedJournalRaw;
            intent.committedJournalRaw = committedJournalRaw(
              result.preparedJournalRaw,
            );
          } else {
            intent.durablyPrepared = true;
            intent.initialPreparationAmbiguous = false;
          }
          intent.lastResult = result;
        } else if (!result.recoveryPending) {
          pendingSupersession = null;
        }
      },
      () => {
        if (
          pendingSupersession === intent &&
          intent.operation === "explicit-reset"
        ) {
          pendingSupersession = null;
        }
      },
    ).finally(() => {
      intent.active = null;
    });
    return active;
  };

  const supersede = (
    operation: "supersede" | "explicit-reset",
    pet: PetState,
    progress: CareGuideProgress,
  ) => {
    if (!isPetState(pet) || !isCareGuideProgress(progress)) {
      return Promise.reject(new Error("Invalid superseding pet/guide pair"));
    }
    if (operation === "supersede" && pendingCleanPreparation) {
      return Promise.reject(new Error("Ambiguous Clean preparation is pending"));
    }
    publicationRevision += 1;
    const intent = {
      revision: ++supersessionRevision,
      operation,
      pet,
      progress,
      active: null,
      durablyPrepared: false,
      initialPreparationAmbiguous: false,
      preparedJournalRaw: null,
      committedJournalRaw: null,
      lastResult: null,
    } satisfies NonNullable<typeof pendingSupersession>;
    if (operation === "explicit-reset") pendingCleanPreparation = null;
    pendingSupersession = intent;
    return queueSupersession(intent);
  };

  const rememberLoadedCleanBarrier = (
    loaded: DurableLoadPetAndCareGuideResult,
  ) => {
    const target = loaded.delayedCleanTarget;
    if (!target || pendingCleanPreparation) return loaded;
    const committedRaw = committedJournalRaw(target.preparedJournalRaw);
    if (!committedRaw) return loaded;
    pendingCleanPreparation = {
      pet: target.pet,
      progress: target.progress,
      preparedJournalRaw: target.preparedJournalRaw,
      committedJournalRaw: committedRaw,
    };
    return loaded;
  };

  const loadReadOnlyForAmbiguousPreparation = async (
    operation: "clean" | "explicit-reset",
    reason: "invalid" | "unavailable",
  ): Promise<DurableLoadPetAndCareGuideResult> => {
    const loaded = await loadPetAndCareGuide(storage);
    return operation === "explicit-reset"
      ? { ...loaded, explicitResetRecovery: reason }
      : {
          ...loaded,
          explicitResetRecovery: "none",
          delayedCleanRecovery: reason,
        };
  };

  const loadAndRecover = async (): Promise<DurableLoadPetAndCareGuideResult> => {
    const explicitIntent = pendingSupersession;
    if (
      explicitIntent?.operation === "explicit-reset" &&
      explicitIntent.initialPreparationAmbiguous &&
      explicitIntent.preparedJournalRaw &&
      explicitIntent.committedJournalRaw
    ) {
      const journalRead = await readStorageValue(
        storage,
        CLEAN_COMPLETION_TRANSACTION_KEY,
      );
      if (journalRead.kind === "unavailable") {
        return loadReadOnlyForAmbiguousPreparation(
          "explicit-reset",
          "unavailable",
        );
      }
      if (journalRead.raw === null) {
        if (pendingSupersession === explicitIntent) {
          pendingSupersession = null;
        }
        return {
          ...(await loadPetAndCareGuideDurably(storage)),
          explicitResetRecovery: "absent",
        };
      }
      if (
        journalRead.raw !== explicitIntent.preparedJournalRaw &&
        journalRead.raw !== explicitIntent.committedJournalRaw
      ) {
        return loadReadOnlyForAmbiguousPreparation(
          "explicit-reset",
          "invalid",
        );
      }
      explicitIntent.initialPreparationAmbiguous = false;
      explicitIntent.durablyPrepared = true;
      const loaded = await loadPetAndCareGuideDurably(storage);
      return loaded;
    }

    const cleanIntent = pendingCleanPreparation;
    if (cleanIntent) {
      const journalRead = await readStorageValue(
        storage,
        CLEAN_COMPLETION_TRANSACTION_KEY,
      );
      if (journalRead.kind === "unavailable") {
        return loadReadOnlyForAmbiguousPreparation("clean", "unavailable");
      }
      if (journalRead.raw === null) {
        if (pendingCleanPreparation === cleanIntent) {
          pendingCleanPreparation = null;
        }
        return {
          ...(await loadPetAndCareGuideDurably(storage)),
          delayedCleanRecovery: "absent",
        };
      }
      if (
        journalRead.raw !== cleanIntent.preparedJournalRaw &&
        journalRead.raw !== cleanIntent.committedJournalRaw
      ) {
        return loadReadOnlyForAmbiguousPreparation("clean", "invalid");
      }
      const loaded = rememberLoadedCleanBarrier(
        await loadPetAndCareGuideDurably(storage),
      );
      if (
        journalRead.raw === cleanIntent.committedJournalRaw &&
        loaded.delayedCleanRecovery === undefined &&
        loaded.petResult.kind === "loaded" &&
        loaded.careGuideResult.kind === "loaded" &&
        samePet(loaded.petResult.pet, cleanIntent.pet) &&
        sameProgress(loaded.careGuideResult.progress, cleanIntent.progress)
      ) {
        return { ...loaded, delayedCleanRecovery: "recovered" };
      }
      return loaded;
    }

    return rememberLoadedCleanBarrier(
      await loadPetAndCareGuideDurably(storage),
    );
  };

  const authority: PetGuidePersistenceAuthority = {
    loadAndRecover: () => enqueue(loadAndRecover),
    savePet: (pet) => {
      if (pendingSupersession || pendingCleanPreparation) {
        return Promise.reject(new Error("Superseding pair persistence is pending"));
      }
      return enqueue(() => {
        if (pendingSupersession || pendingCleanPreparation) {
          return Promise.reject(
            new Error("Superseding pair persistence is pending"),
          );
        }
        return savePet(pet, storage);
      });
    },
    saveGuide: (progress) => {
      if (pendingSupersession || pendingCleanPreparation) {
        return Promise.reject(new Error("Superseding pair persistence is pending"));
      }
      return enqueue(() => {
        if (pendingSupersession || pendingCleanPreparation) {
          return Promise.reject(
            new Error("Superseding pair persistence is pending"),
          );
        }
        return saveCareGuideProgress(progress, storage);
      });
    },
    saveClean: (beforePet, beforeProgress, pet, progress) => {
      if (pendingSupersession || pendingCleanPreparation) {
        return Promise.reject(
          new Error("Superseding pair persistence is pending"),
        );
      }
      const cleanRevision = publicationRevision;
      pendingCleans += 1;
      return enqueue(async () => {
        if (pendingSupersession || pendingCleanPreparation) {
          throw new Error("Superseding pair persistence is pending");
        }
        const durability = await saveCleanCompletion(
          beforePet,
          beforeProgress,
          pet,
          progress,
          storage,
        );
        const supersessionAfterClean = currentPendingSupersession();
        if (
          durability.interruptedAt === "prepare" &&
          durability.preparedJournalRaw &&
          supersessionAfterClean?.operation !== "explicit-reset"
        ) {
          const committedRaw = committedJournalRaw(
            durability.preparedJournalRaw,
          );
          if (committedRaw) {
            pendingCleanPreparation = {
              pet,
              progress,
              preparedJournalRaw: durability.preparedJournalRaw,
              committedJournalRaw: committedRaw,
            };
            if (supersessionAfterClean?.operation === "supersede") {
              pendingSupersession = null;
            }
          }
        }
        return durability;
      })
        .then((durability) => ({
          durability,
          publishable:
            durability.interruptedAt !== "prepare" &&
            cleanRevision === publicationRevision,
        }))
        .finally(() => {
          pendingCleans -= 1;
        });
    },
    supersedeWithPair: (pet, progress) =>
      supersede("supersede", pet, progress),
    explicitResetWithPair: (pet, progress) =>
      pendingSupersession?.operation === "explicit-reset"
        ? samePet(pendingSupersession.pet, pet) &&
          sameProgress(pendingSupersession.progress, progress)
          ? queueSupersession(pendingSupersession)
          : supersede("explicit-reset", pet, progress)
        : supersede("explicit-reset", pet, progress),
    supersedePendingCleanWithPair: (pet, progress) => {
      if (pendingSupersession?.operation === "explicit-reset") return null;
      if (pendingCleanPreparation) return null;
      if (pendingCleans === 0) return null;
      return supersede("supersede", pet, progress);
    },
    retryPendingSupersession: () => {
      if (!pendingSupersession) return null;
      if (
        pendingSupersession.operation === "explicit-reset" &&
        (pendingSupersession.durablyPrepared ||
          pendingSupersession.initialPreparationAmbiguous)
      ) {
        return null;
      }
      return queueSupersession(pendingSupersession);
    },
    pendingCleanCompletionTarget: () =>
      pendingCleanPreparation
        ? {
            pet: pendingCleanPreparation.pet,
            progress: pendingCleanPreparation.progress,
          }
        : null,
    acknowledgeCleanPublication: (pet, progress) => {
      const intent = pendingCleanPreparation;
      if (
        !intent ||
        !samePet(intent.pet, pet) ||
        !sameProgress(intent.progress, progress)
      ) {
        return false;
      }
      pendingCleanPreparation = null;
      return true;
    },
    pendingExplicitResetTarget: () => {
      const intent = pendingSupersession;
      return intent?.operation === "explicit-reset"
        ? { pet: intent.pet, progress: intent.progress }
        : null;
    },
    acknowledgeExplicitResetPublication: (pet, progress) => {
      const intent = pendingSupersession;
      if (
        intent?.operation !== "explicit-reset" ||
        !intent.durablyPrepared ||
        !samePet(intent.pet, pet) ||
        !sameProgress(intent.progress, progress)
      ) {
        return false;
      }
      pendingSupersession = null;
      return true;
    },
    invalidateCleanPublication: () => {
      publicationRevision += 1;
    },
  };
  return authority;
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
