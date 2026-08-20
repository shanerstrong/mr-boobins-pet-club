export const CONTROL_MODES = ["direct", "classic"] as const;
export type ControlMode = (typeof CONTROL_MODES)[number];

export const DEFAULT_CONTROL_MODE: ControlMode = "direct";
export const CONTROL_MODE_PERSISTED = false;
export const CLASSIC_CONTROL_MIN_TARGET_PX = 44;

export const CONTROL_MODE_LABELS: Readonly<Record<ControlMode, string>> =
  Object.freeze({
    direct: "Direct",
    classic: "Classic",
  });

export type ClassicActionId =
  | "status"
  | "feed"
  | "play"
  | "clean"
  | "rest"
  | "train"
  | "boop"
  | "medicine"
  | "close-status"
  | "sleep-1"
  | "sleep-2"
  | "sleep-4"
  | "sleep-8"
  | "cancel-sleep"
  | "train-sit"
  | "train-paw"
  | "train-up"
  | "cancel-training"
  | "give-treat"
  | "show-again"
  | "finish-training";

export type ClassicMenuItem = Readonly<{
  id: ClassicActionId;
  label: string;
  available: boolean;
  reason: string;
}>;

export type ClassicKeyCommand = "previous" | "next" | "select";

export const CLASSIC_ROOM_ACTION_ORDER = Object.freeze([
  "status",
  "feed",
  "play",
  "clean",
  "rest",
  "train",
  "boop",
] as const satisfies readonly ClassicActionId[]);

export type ClassicCareAction = "feed" | "play" | "clean";
export type ClassicTrainingCommand = "sit" | "paw" | "up";
export type ClassicTrainingPhase =
  | "closed"
  | "choosing"
  | "performing"
  | "awaiting-treat"
  | "treat-in-flight"
  | "eating"
  | "celebrating"
  | "result";

export function createClassicMenuItem(
  id: ClassicActionId,
  label: string,
  available = true,
  reason = "Ready.",
): ClassicMenuItem {
  return Object.freeze({ id, label, available, reason });
}

export function createClassicRoomMenu({
  boopAvailable,
  boopReason,
  careAvailable,
  careLocked,
  petIsDead,
  sleeping,
  trainingDisabled,
}: Readonly<{
  boopAvailable: boolean;
  boopReason: string;
  careAvailable: boolean;
  careLocked: boolean;
  petIsDead: boolean;
  sleeping: boolean;
  trainingDisabled: boolean;
}>): readonly ClassicMenuItem[] {
  const careReason = petIsDead
    ? "Jack's story has ended. Start a new Baby to care again."
    : sleeping
      ? "Wake Jack before choosing this care action."
      : careLocked
        ? "Finish the current care action first."
        : "This care action is unavailable right now.";
  const restReason = petIsDead
    ? "Jack's story has ended. Start a new Baby to rest again."
    : "Finish the current care action first.";
  const trainingReason = petIsDead
    ? "Jack's story has ended. Start a new Baby to train again."
    : sleeping
      ? "Wake Jack before training."
      : careLocked
        ? "Finish the current care action before training."
        : "Training is already in progress.";
  return Object.freeze([
    createClassicMenuItem(
      "status",
      "Status",
      !careLocked,
      "Finish the current care action before opening Status.",
    ),
    createClassicMenuItem("feed", "Feed", careAvailable, careReason),
    createClassicMenuItem("play", "Play", careAvailable, careReason),
    createClassicMenuItem("clean", "Clean", careAvailable, careReason),
    createClassicMenuItem(
      "rest",
      sleeping ? "Wake" : "Rest",
      !petIsDead && !careLocked,
      restReason,
    ),
    createClassicMenuItem(
      "train",
      "Train",
      !trainingDisabled,
      trainingReason,
    ),
    createClassicMenuItem("boop", "Boop", boopAvailable, boopReason),
  ]);
}

export function dispatchClassicRoomAction(
  action: ClassicActionId,
  handlers: Readonly<{
    onStatus: () => void;
    onCare: (action: ClassicCareAction) => void;
    onRest: () => void;
    onTrain: () => void;
    onBoop: () => void;
  }>,
): boolean {
  if (action === "status") handlers.onStatus();
  else if (action === "feed" || action === "play" || action === "clean")
    handlers.onCare(action);
  else if (action === "rest") handlers.onRest();
  else if (action === "train") handlers.onTrain();
  else if (action === "boop") handlers.onBoop();
  else return false;
  return true;
}

export function createClassicStatusMenu(
  medicineAvailable: boolean,
  medicineReason: string,
): readonly ClassicMenuItem[] {
  return Object.freeze([
    createClassicMenuItem(
      "medicine",
      "Give Medicine",
      medicineAvailable,
      medicineReason,
    ),
    createClassicMenuItem("close-status", "Close Status"),
  ]);
}

export function dispatchClassicStatusAction(
  action: ClassicActionId,
  handlers: Readonly<{ onMedicine: () => void; onClose: () => void }>,
): boolean {
  if (action === "medicine") handlers.onMedicine();
  else if (action === "close-status") handlers.onClose();
  else return false;
  return true;
}

export function createClassicSleepMenu(
  hours: readonly number[],
): readonly ClassicMenuItem[] {
  return Object.freeze([
    ...hours.map((duration) =>
      createClassicMenuItem(
        `sleep-${duration}` as ClassicActionId,
        `Sleep ${duration} pet hour${duration === 1 ? "" : "s"}`,
      ),
    ),
    createClassicMenuItem("cancel-sleep", "Cancel"),
  ]);
}

export function dispatchClassicSleepAction(
  action: ClassicActionId,
  handlers: Readonly<{
    onChoose: (hours: number) => void;
    onCancel: () => void;
  }>,
): boolean {
  if (action === "cancel-sleep") handlers.onCancel();
  else if (action === "sleep-1") handlers.onChoose(1);
  else if (action === "sleep-2") handlers.onChoose(2);
  else if (action === "sleep-4") handlers.onChoose(4);
  else if (action === "sleep-8") handlers.onChoose(8);
  else return false;
  return true;
}

export function createClassicTrainingMenu(
  phase: ClassicTrainingPhase,
): readonly ClassicMenuItem[] {
  if (phase === "choosing") {
    return Object.freeze([
      createClassicMenuItem("train-sit", "Sit"),
      createClassicMenuItem("train-paw", "Paw"),
      createClassicMenuItem("train-up", "Up"),
      createClassicMenuItem("cancel-training", "Cancel"),
    ]);
  }
  if (phase === "awaiting-treat") {
    return Object.freeze([
      createClassicMenuItem("give-treat", "Give Treat"),
      createClassicMenuItem("cancel-training", "Cancel"),
    ]);
  }
  if (phase === "result") {
    return Object.freeze([
      createClassicMenuItem("show-again", "Show Again"),
      createClassicMenuItem("finish-training", "Done"),
    ]);
  }
  return Object.freeze([
    createClassicMenuItem("cancel-training", "Cancel Training"),
  ]);
}

export function dispatchClassicTrainingAction(
  action: ClassicActionId,
  handlers: Readonly<{
    onChooseCommand: (command: ClassicTrainingCommand) => void;
    onCancel: () => void;
    onGiveTreat: () => void;
    onShowAgain: () => void;
    onDone: () => void;
  }>,
): boolean {
  if (action === "train-sit") handlers.onChooseCommand("sit");
  else if (action === "train-paw") handlers.onChooseCommand("paw");
  else if (action === "train-up") handlers.onChooseCommand("up");
  else if (action === "cancel-training") handlers.onCancel();
  else if (action === "give-treat") handlers.onGiveTreat();
  else if (action === "show-again") handlers.onShowAgain();
  else if (action === "finish-training") handlers.onDone();
  else return false;
  return true;
}

export function resolveClassicSelection(
  items: readonly ClassicMenuItem[],
  selectedId: ClassicActionId | null,
): ClassicMenuItem | null {
  if (items.length === 0) return null;
  return items.find((item) => item.id === selectedId) ?? items[0];
}

export function cycleClassicSelection(
  items: readonly ClassicMenuItem[],
  selectedId: ClassicActionId | null,
  direction: -1 | 1,
): ClassicMenuItem | null {
  if (items.length === 0) return null;
  const selected = resolveClassicSelection(items, selectedId);
  const index = selected ? items.indexOf(selected) : 0;
  return items[(index + direction + items.length) % items.length];
}

export function resolveClassicActivation(item: ClassicMenuItem | null):
  | Readonly<{ activate: true; action: ClassicActionId; announcement: string }>
  | Readonly<{ activate: false; action: null; announcement: string }> {
  if (!item) {
    return Object.freeze({
      activate: false,
      action: null,
      announcement: "No Classic action is available in this moment.",
    });
  }
  if (!item.available) {
    return Object.freeze({
      activate: false,
      action: null,
      announcement: item.reason,
    });
  }
  return Object.freeze({
    activate: true,
    action: item.id,
    announcement: `${item.label} selected.`,
  });
}

export function dispatchClassicActivation(
  item: ClassicMenuItem | null,
  dispatch: (action: ClassicActionId) => void,
) {
  const resolution = resolveClassicActivation(item);
  if (resolution.activate) dispatch(resolution.action);
  return resolution;
}

type ClassicKeyboardTarget = Readonly<{
  tagName?: string | null;
  role?: string | null;
  contentEditable?: boolean;
}>;

const nativeControlTags = new Set([
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "A",
]);
const interactiveRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menuitem",
  "option",
  "radio",
  "slider",
  "switch",
  "tab",
  "textbox",
]);

export function resolveClassicKeyCommand({
  active,
  key,
  target,
}: Readonly<{
  active: boolean;
  key: string;
  target?: ClassicKeyboardTarget | null;
}>): ClassicKeyCommand | null {
  if (!active) return null;
  const tagName = target?.tagName?.toUpperCase() ?? "";
  const role = target?.role?.toLowerCase() ?? "";
  if (
    target?.contentEditable ||
    nativeControlTags.has(tagName) ||
    interactiveRoles.has(role)
  ) {
    return null;
  }
  if (key === "ArrowLeft") return "previous";
  if (key === "ArrowRight") return "next";
  if (key === "Enter" || key === " ") return "select";
  return null;
}

export function resolveControlModeSwitch<TPet, TModel>(
  pet: TPet,
  model: TModel,
  mode: ControlMode,
) {
  return Object.freeze({
    mode,
    pet,
    model,
    advanced: false,
    persisted: false,
  });
}
