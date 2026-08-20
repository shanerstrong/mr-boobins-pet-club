import { describe, expect, it, vi } from "vitest";
import * as persistence from "./persistence";
import * as simulation from "./simulation";
import {
  CLASSIC_CONTROL_MIN_TARGET_PX,
  CLASSIC_ROOM_ACTION_ORDER,
  CONTROL_MODE_PERSISTED,
  DEFAULT_CONTROL_MODE,
  createClassicMenuItem,
  createClassicRoomMenu,
  createClassicSleepMenu,
  createClassicStatusMenu,
  createClassicTrainingMenu,
  cycleClassicSelection,
  dispatchClassicActivation,
  dispatchClassicRoomAction,
  dispatchClassicSleepAction,
  dispatchClassicStatusAction,
  dispatchClassicTrainingAction,
  resolveClassicActivation,
  resolveClassicKeyCommand,
  resolveClassicSelection,
  resolveControlModeSwitch,
} from "./classic-controls";
import { createNewPet } from "./simulation";

const roomItems = CLASSIC_ROOM_ACTION_ORDER.map((id) =>
  createClassicMenuItem(id, id.toUpperCase()),
);

describe("Classic three-button controller policy", () => {
  it("keeps Direct as the session-only default with accessible targets", () => {
    expect(DEFAULT_CONTROL_MODE).toBe("direct");
    expect(CONTROL_MODE_PERSISTED).toBe(false);
    expect(CLASSIC_CONTROL_MIN_TARGET_PX).toBeGreaterThanOrEqual(44);
  });

  it("uses the approved room order and wraps both directions without skipping", () => {
    expect(roomItems.map((item) => item.id)).toEqual([
      "status",
      "feed",
      "play",
      "clean",
      "rest",
      "train",
      "boop",
    ]);
    expect(cycleClassicSelection(roomItems, "status", -1)?.id).toBe("boop");
    expect(cycleClassicSelection(roomItems, "boop", 1)?.id).toBe("status");
    expect(cycleClassicSelection(roomItems, "play", 1)?.id).toBe("clean");
  });

  it("retains a disabled action in the cycle and returns its truthful reason", () => {
    const items = [
      createClassicMenuItem("feed", "Feed", false, "Wake Jack before feeding."),
      createClassicMenuItem("play", "Play"),
    ];
    expect(resolveClassicSelection(items, "feed")?.available).toBe(false);
    expect(resolveClassicActivation(items[0])).toEqual({
      activate: false,
      action: null,
      announcement: "Wake Jack before feeding.",
    });
    expect(cycleClassicSelection(items, "play", 1)?.id).toBe("feed");
  });

  it("returns the exact allowed action without owning gameplay behavior", () => {
    expect(resolveClassicActivation(roomItems[3])).toEqual({
      activate: true,
      action: "clean",
      announcement: "CLEAN selected.",
    });
  });

  it("dispatches the exact highlighted callback token once and never dispatches a blocked token", () => {
    const dispatch = vi.fn();
    expect(dispatchClassicActivation(roomItems[2], dispatch).activate).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith("play");

    const blocked = createClassicMenuItem(
      "medicine",
      "Give Medicine",
      false,
      "Medicine is not needed.",
    );
    expect(dispatchClassicActivation(blocked, dispatch)).toEqual({
      activate: false,
      action: null,
      announcement: "Medicine is not needed.",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("builds the exact App-used room menu without skipping blocked actions", () => {
    const ready = createClassicRoomMenu({
      boopAvailable: true,
      boopReason: "Ready to boop.",
      careAvailable: true,
      careLocked: false,
      petIsDead: false,
      sleeping: false,
      trainingDisabled: false,
    });
    expect(ready.map(({ id, label, available }) => ({ id, label, available }))).toEqual([
      { id: "status", label: "Status", available: true },
      { id: "feed", label: "Feed", available: true },
      { id: "play", label: "Play", available: true },
      { id: "clean", label: "Clean", available: true },
      { id: "rest", label: "Rest", available: true },
      { id: "train", label: "Train", available: true },
      { id: "boop", label: "Boop", available: true },
    ]);

    const sleeping = createClassicRoomMenu({
      boopAvailable: false,
      boopReason: "Jack is sleeping.",
      careAvailable: false,
      careLocked: false,
      petIsDead: false,
      sleeping: true,
      trainingDisabled: true,
    });
    expect(sleeping.map((item) => item.id)).toEqual(CLASSIC_ROOM_ACTION_ORDER);
    expect(sleeping.find((item) => item.id === "rest")).toMatchObject({
      label: "Wake",
      available: true,
    });
    expect(sleeping.find((item) => item.id === "feed")).toMatchObject({
      available: false,
      reason: "Wake Jack before choosing this care action.",
    });
    expect(sleeping.find((item) => item.id === "train")).toMatchObject({
      available: false,
      reason: "Wake Jack before training.",
    });
    expect(sleeping.find((item) => item.id === "boop")).toMatchObject({
      available: false,
      reason: "Jack is sleeping.",
    });
  });

  it("dispatches every App-used room action to the exact existing callback", () => {
    const onStatus = vi.fn();
    const onCare = vi.fn();
    const onRest = vi.fn();
    const onTrain = vi.fn();
    const onBoop = vi.fn();
    const handlers = { onStatus, onCare, onRest, onTrain, onBoop };

    expect(dispatchClassicRoomAction("status", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("feed", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("play", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("clean", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("rest", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("train", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("boop", handlers)).toBe(true);
    expect(dispatchClassicRoomAction("medicine", handlers)).toBe(false);

    expect(onStatus).toHaveBeenCalledOnce();
    expect(onCare.mock.calls).toEqual([["feed"], ["play"], ["clean"]]);
    expect(onRest).toHaveBeenCalledOnce();
    expect(onTrain).toHaveBeenCalledOnce();
    expect(onBoop).toHaveBeenCalledOnce();
  });

  it("builds and dispatches the App-used Status actions exactly", () => {
    const unavailable = createClassicStatusMenu(false, "Medicine is not needed.");
    expect(unavailable).toEqual([
      {
        id: "medicine",
        label: "Give Medicine",
        available: false,
        reason: "Medicine is not needed.",
      },
      {
        id: "close-status",
        label: "Close Status",
        available: true,
        reason: "Ready.",
      },
    ]);

    const onMedicine = vi.fn();
    const onClose = vi.fn();
    const handlers = { onMedicine, onClose };
    expect(dispatchClassicStatusAction("medicine", handlers)).toBe(true);
    expect(dispatchClassicStatusAction("close-status", handlers)).toBe(true);
    expect(dispatchClassicStatusAction("feed", handlers)).toBe(false);
    expect(onMedicine).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("builds and dispatches every App-used Sleep duration exactly", () => {
    const items = createClassicSleepMenu([1, 2, 4, 8]);
    expect(items.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "sleep-1", label: "Sleep 1 pet hour" },
      { id: "sleep-2", label: "Sleep 2 pet hours" },
      { id: "sleep-4", label: "Sleep 4 pet hours" },
      { id: "sleep-8", label: "Sleep 8 pet hours" },
      { id: "cancel-sleep", label: "Cancel" },
    ]);

    const onChoose = vi.fn();
    const onCancel = vi.fn();
    const handlers = { onChoose, onCancel };
    for (const action of ["sleep-1", "sleep-2", "sleep-4", "sleep-8"] as const) {
      expect(dispatchClassicSleepAction(action, handlers)).toBe(true);
    }
    expect(dispatchClassicSleepAction("cancel-sleep", handlers)).toBe(true);
    expect(dispatchClassicSleepAction("rest", handlers)).toBe(false);
    expect(onChoose.mock.calls).toEqual([[1], [2], [4], [8]]);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("builds exact phase-specific Training menus and callback parity", () => {
    expect(createClassicTrainingMenu("choosing").map((item) => item.id)).toEqual([
      "train-sit",
      "train-paw",
      "train-up",
      "cancel-training",
    ]);
    expect(
      createClassicTrainingMenu("awaiting-treat").map((item) => item.id),
    ).toEqual(["give-treat", "cancel-training"]);
    expect(createClassicTrainingMenu("result").map((item) => item.id)).toEqual([
      "show-again",
      "finish-training",
    ]);
    for (const phase of [
      "closed",
      "performing",
      "treat-in-flight",
      "eating",
      "celebrating",
    ] as const) {
      expect(createClassicTrainingMenu(phase).map((item) => item.id)).toEqual([
        "cancel-training",
      ]);
    }

    const onChooseCommand = vi.fn();
    const onCancel = vi.fn();
    const onGiveTreat = vi.fn();
    const onShowAgain = vi.fn();
    const onDone = vi.fn();
    const handlers = {
      onChooseCommand,
      onCancel,
      onGiveTreat,
      onShowAgain,
      onDone,
    };
    for (const action of ["train-sit", "train-paw", "train-up"] as const) {
      expect(dispatchClassicTrainingAction(action, handlers)).toBe(true);
    }
    expect(dispatchClassicTrainingAction("cancel-training", handlers)).toBe(true);
    expect(dispatchClassicTrainingAction("give-treat", handlers)).toBe(true);
    expect(dispatchClassicTrainingAction("show-again", handlers)).toBe(true);
    expect(dispatchClassicTrainingAction("finish-training", handlers)).toBe(true);
    expect(dispatchClassicTrainingAction("status", handlers)).toBe(false);
    expect(onChooseCommand.mock.calls).toEqual([["sit"], ["paw"], ["up"]]);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onGiveTreat).toHaveBeenCalledOnce();
    expect(onShowAgain).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it.each([
    ["ArrowLeft", "previous"],
    ["ArrowRight", "next"],
    ["Enter", "select"],
    [" ", "select"],
    ["Escape", null],
  ] as const)("maps %s only while Classic owns the context", (key, expected) => {
    expect(resolveClassicKeyCommand({ active: true, key })).toBe(expected);
    expect(resolveClassicKeyCommand({ active: false, key })).toBeNull();
  });

  it.each([
    ["input", undefined],
    ["textarea", undefined],
    ["select", undefined],
    ["button", undefined],
    ["div", "button"],
    ["div", "radio"],
    ["div", "switch"],
    ["div", "textbox"],
  ])("does not steal keys from native or semantic %s controls", (tagName, role) => {
    expect(
      resolveClassicKeyCommand({
        active: true,
        key: "Enter",
        target: { tagName, role },
      }),
    ).toBeNull();
  });

  it("does not steal keys from editable content", () => {
    expect(
      resolveClassicKeyCommand({
        active: true,
        key: "ArrowRight",
        target: { tagName: "div", contentEditable: true },
      }),
    ).toBeNull();
  });

  it("switches only the control surface with exact state references and no side effects", () => {
    const pet = { ...createNewPet(0), adoptionCompleted: true };
    const model = Object.freeze({ sourcePetVersion: 7 as const });
    const before = JSON.stringify(pet);
    const advance = vi.spyOn(simulation, "advancePet");
    const persist = vi.spyOn(persistence, "savePet");
    const switched = resolveControlModeSwitch(pet, model, "classic");

    expect(switched).toEqual({
      mode: "classic",
      pet,
      model,
      advanced: false,
      persisted: false,
    });
    expect(switched.pet).toBe(pet);
    expect(switched.model).toBe(model);
    expect(JSON.stringify(pet)).toBe(before);
    expect(advance).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    advance.mockRestore();
    persist.mockRestore();
  });

});
