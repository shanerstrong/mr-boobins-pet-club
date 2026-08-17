import {
  saveCleanCompletion,
  type CareGuideProgress,
  type PetGuidePersistenceAuthority,
  type StorageLike,
} from "./persistence";
import { getReturnSummary } from "./return-policy";
import {
  DEFAULT_CLOCK_MULTIPLIER,
  careForPet,
  isSleeping,
  type PetState,
} from "./simulation";

export const FIRST_CARE_GUIDANCE = "Jack is home! Try FEED, PLAY, or CLEAN.";

export type ReturnContext = { before: PetState };

export type DialogFocusElement = {
  focus: () => void;
  hasAttribute: (name: string) => boolean;
  isConnected?: boolean;
};

export type DialogFocusKeyEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
};

export type DialogFocusBoundaryAdapter = {
  getActiveElement: () => DialogFocusElement | null;
  getFocusableElements: () => DialogFocusElement[];
  contains: (element: DialogFocusElement | null) => boolean;
  addKeydownListener: (listener: (event: DialogFocusKeyEvent) => void) => void;
  removeKeydownListener: (listener: (event: DialogFocusKeyEvent) => void) => void;
  scheduleInitialFocus: (callback: () => void) => unknown;
  cancelInitialFocus: (handle: unknown) => void;
};

export function getFirstCareGuidance(
  pet: PetState,
  progress: CareGuideProgress,
  careLocked: boolean,
): string | null {
  return pet.adoptionCompleted &&
    !progress.firstCareCompleted &&
    !pet.isDead &&
    !isSleeping(pet) &&
    !careLocked
    ? FIRST_CARE_GUIDANCE
    : null;
}

export function completeFirstCareAfterAllowedAction(
  progress: CareGuideProgress,
  allowed: boolean,
): CareGuideProgress {
  return allowed && !progress.firstCareCompleted
    ? { ...progress, firstCareCompleted: true }
    : progress;
}

export function commitSuccessfulClean(
  pet: PetState,
  progress: CareGuideProgress,
  now: number,
) {
  return {
    pet: careForPet(pet, "clean", now, DEFAULT_CLOCK_MULTIPLIER),
    progress: completeFirstCareAfterAllowedAction(progress, true),
  };
}

export async function commitSuccessfulCleanDurably(
  pet: PetState,
  progress: CareGuideProgress,
  now: number,
  storage?: StorageLike,
) {
  const completion = commitSuccessfulClean(pet, progress, now);
  const durability = await saveCleanCompletion(
    pet,
    progress,
    completion.pet,
    completion.progress,
    storage,
  );
  return { ...completion, durability };
}

export type DurableCleanCompletion = Awaited<
  ReturnType<typeof commitSuccessfulCleanDurably>
>;

export type DelayedCleanCommitAdapter = {
  applyCommitted: (completion: DurableCleanCompletion) => void;
  restoreForRetry: () => void;
  retainForRecovery?: (
    reason: "pending" | "invalid" | "unavailable",
  ) => void;
  isCurrent?: () => boolean;
};

export type DelayedCleanPersistenceOptions = {
  authority?: PetGuidePersistenceAuthority;
  storage?: StorageLike;
};

/**
 * App-used publication boundary for delayed Clean. No in-memory completion or
 * success presentation is allowed until the prepared journal exists.
 */
export async function finishDelayedCleanDurably(
  pet: PetState,
  progress: CareGuideProgress,
  now: number,
  adapter: DelayedCleanCommitAdapter,
  options: DelayedCleanPersistenceOptions = {},
): Promise<"committed" | "recovery-pending" | "retry" | "superseded"> {
  try {
    const authority = options.authority;
    const completion = authority
      ? await (async () => {
          const next = commitSuccessfulClean(pet, progress, now);
          const serialized = await authority.saveClean(
            pet,
            progress,
            next.pet,
            next.progress,
          );
          return {
            ...next,
            durability: serialized.durability,
            publishable: serialized.publishable,
          };
        })()
      : {
          ...(await commitSuccessfulCleanDurably(
            pet,
            progress,
            now,
            options.storage,
          )),
          publishable: true,
        };
    if (completion.durability.interruptedAt === "prepare") {
      if (!authority) {
        adapter.retainForRecovery?.("unavailable");
        return "recovery-pending";
      }
      const recovered = await recoverDelayedCleanForPublicationDurably(
        authority,
        adapter,
      );
      return recovered === "none" ? "recovery-pending" : recovered;
    }
    if (!completion.publishable || adapter.isCurrent?.() === false) {
      return "superseded";
    }
    adapter.applyCommitted(completion);
    return "committed";
  } catch {
    if (adapter.isCurrent?.() === false) return "superseded";
    adapter.restoreForRetry();
    return "retry";
  }
}

function sameCleanPair(
  leftPet: PetState,
  leftProgress: CareGuideProgress,
  rightPet: PetState,
  rightProgress: CareGuideProgress,
) {
  return (
    JSON.stringify(leftPet) === JSON.stringify(rightPet) &&
    JSON.stringify(leftProgress) === JSON.stringify(rightProgress)
  );
}

/**
 * App-used publication seam for a V2 Clean whose initial journal write had an
 * ambiguous outcome. Publication waits for strict serialized recovery of the
 * exact prepared pair; a confirmed absent journal returns the original action
 * to a truthful retry state.
 */
export async function recoverDelayedCleanForPublicationDurably(
  authority: PetGuidePersistenceAuthority,
  adapter: DelayedCleanCommitAdapter,
): Promise<
  "committed" | "recovery-pending" | "retry" | "superseded" | "none"
> {
  const expected = authority.pendingCleanCompletionTarget();
  const loaded = await authority.loadAndRecover();
  if (loaded.delayedCleanRecovery === "absent") {
    if (adapter.isCurrent?.() === false) return "superseded";
    adapter.restoreForRetry();
    return "retry";
  }
  if (
    loaded.delayedCleanRecovery === "pending" ||
    loaded.delayedCleanRecovery === "invalid" ||
    loaded.delayedCleanRecovery === "unavailable"
  ) {
    adapter.retainForRecovery?.(loaded.delayedCleanRecovery);
    return "recovery-pending";
  }
  if (
    loaded.petResult.kind !== "loaded" ||
    loaded.careGuideResult.kind !== "loaded"
  ) {
    return "none";
  }
  const recoveredPreparedClean =
    loaded.delayedCleanRecovery === "recovered";
  const matchesPendingClean =
    expected !== null &&
    sameCleanPair(
      loaded.petResult.pet,
      loaded.careGuideResult.progress,
      expected.pet,
      expected.progress,
    );
  if (!recoveredPreparedClean && !matchesPendingClean) {
    if (expected) {
      adapter.retainForRecovery?.("invalid");
      return "recovery-pending";
    }
    return "none";
  }
  if (adapter.isCurrent?.() === false) return "superseded";

  const completion = {
    pet: loaded.petResult.pet,
    progress: loaded.careGuideResult.progress,
    durability: { recoveryPending: false, interruptedAt: null },
  } satisfies DurableCleanCompletion;
  adapter.applyCommitted(completion);
  authority.acknowledgeCleanPublication(
    completion.pet,
    completion.progress,
  );
  return "committed";
}

export type DurableExplicitReset = {
  pet: PetState;
  progress: CareGuideProgress;
  durability: Awaited<
    ReturnType<PetGuidePersistenceAuthority["explicitResetWithPair"]>
  >;
};

export type ExplicitResetPublicationAdapter = {
  applyPrepared: (reset: DurableExplicitReset) => void;
  restoreForRetry: () => void;
  retainForRecovery?: (
    reason: "pending" | "invalid" | "unavailable",
  ) => void;
  isCurrent?: () => boolean;
};

function sameResetPair(
  leftPet: PetState,
  leftProgress: CareGuideProgress,
  rightPet: PetState,
  rightProgress: CareGuideProgress,
) {
  return (
    JSON.stringify(leftPet) === JSON.stringify(rightPet) &&
    JSON.stringify(leftProgress) === JSON.stringify(rightProgress)
  );
}

/**
 * Completes or observes the serialized V4 recovery barrier, then publishes the
 * exact reset pair only after pet, guide, and committed marker are durable.
 * This is also the foreground/reload seam for a reset whose earlier UI
 * publication was intentionally suppressed.
 */
export async function recoverExplicitResetForPublicationDurably(
  authority: PetGuidePersistenceAuthority,
  adapter: ExplicitResetPublicationAdapter,
): Promise<
  "committed" | "recovery-pending" | "retry" | "superseded" | "none"
> {
  const expected = authority.pendingExplicitResetTarget();
  const loaded = await authority.loadAndRecover();
  if (loaded.explicitResetRecovery === "absent") {
    if (adapter.isCurrent?.() === false) return "superseded";
    adapter.restoreForRetry();
    return "retry";
  }
  if (
    loaded.explicitResetRecovery === "pending" ||
    loaded.explicitResetRecovery === "invalid" ||
    loaded.explicitResetRecovery === "unavailable"
  ) {
    adapter.retainForRecovery?.(loaded.explicitResetRecovery);
    return "recovery-pending";
  }
  if (
    loaded.petResult.kind !== "loaded" ||
    loaded.careGuideResult.kind !== "loaded"
  ) {
    return "none";
  }

  const recoveredPreparedReset = loaded.explicitResetRecovery === "recovered";
  const matchesPendingReset =
    expected !== null &&
    sameResetPair(
      loaded.petResult.pet,
      loaded.careGuideResult.progress,
      expected.pet,
      expected.progress,
    );
  if (!recoveredPreparedReset && !matchesPendingReset) {
    if (expected) {
      adapter.retainForRecovery?.("invalid");
      return "recovery-pending";
    }
    return "none";
  }
  if (adapter.isCurrent?.() === false) return "superseded";

  const reset = {
    pet: loaded.petResult.pet,
    progress: loaded.careGuideResult.progress,
    durability: { recoveryPending: false, interruptedAt: null },
  } satisfies DurableExplicitReset;
  adapter.applyPrepared(reset);
  authority.acknowledgeExplicitResetPublication(reset.pet, reset.progress);
  return "committed";
}

/**
 * App-used explicit-reset publication boundary. A new Baby is not published
 * until the V4 journal preparation has succeeded. Later member/marker failures
 * are safe to publish because the exact prepared transaction can roll forward.
 */
export async function finishExplicitResetDurably(
  pet: PetState,
  progress: CareGuideProgress,
  authority: PetGuidePersistenceAuthority,
  adapter: ExplicitResetPublicationAdapter,
): Promise<"committed" | "recovery-pending" | "retry" | "superseded"> {
  try {
    await authority.explicitResetWithPair(pet, progress);
    const recovered = await recoverExplicitResetForPublicationDurably(
      authority,
      adapter,
    );
    return recovered === "none" ? "recovery-pending" : recovered;
  } catch {
    if (adapter.isCurrent?.() === false) return "superseded";
    adapter.restoreForRetry();
    return "retry";
  }
}

export function installDialogFocusBoundary(
  adapter: DialogFocusBoundaryAdapter,
  onCancel: () => void,
) {
  const opener = adapter.getActiveElement();
  const focusable = () =>
    adapter
      .getFocusableElements()
      .filter((element) => !element.hasAttribute("disabled"));
  const focusHandle = adapter.scheduleInitialFocus(() => {
    focusable()[0]?.focus();
  });
  const onKeydown = (event: DialogFocusKeyEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = focusable();
    if (elements.length === 0) {
      event.preventDefault();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = adapter.getActiveElement();
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (!adapter.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };
  adapter.addKeydownListener(onKeydown);
  return () => {
    adapter.cancelInitialFocus(focusHandle);
    adapter.removeKeydownListener(onKeydown);
    if (opener?.isConnected !== false) opener?.focus();
  };
}

export function getLiveReturnSummary(
  context: ReturnContext | null,
  pet: PetState,
): string | null {
  return context
    ? getReturnSummary({
        before: context.before,
        after: pet,
        elapsedRealMs: Math.max(
          0,
          pet.lastUpdatedAt - context.before.lastUpdatedAt,
        ),
      })
    : null;
}
