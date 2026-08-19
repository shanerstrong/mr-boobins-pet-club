import { useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  PRESENTATION_MODE_LABELS,
  PRESENTATION_MODES,
  resolvePresentationRenderer,
  type PetPresentationModel,
  type PresentationMode,
} from "./pet-presentation-model";
import { PetRoomScene } from "./pet-room-scene";
import {
  PetRoomSceneShell,
  type PetRoomSceneProps,
} from "./pet-room-scene-shell";
import { QuietCareMonitor } from "./quiet-care-monitor";
import type { CareAction } from "./simulation";

export type PetPresentationStageProps = {
  mode: PresentationMode;
  model: PetPresentationModel;
  bob: Animated.Value;
  wag: Animated.Value;
  pulse: Animated.Value;
  zoom: Animated.Value;
  feedProgress: Animated.Value;
  trainingProgress: Animated.Value;
  trainingAnimationRevision: number;
  trainingPoseHeld: boolean;
  trainingTreatProgress: Animated.Value;
  onBoop: () => void;
  boopDisabled: boolean;
  boopStatus: string;
  careDisabled: boolean;
  restDisabled: boolean;
  restLabel: "Rest" | "Wake";
  onCare: (action: CareAction) => void;
  onRest: () => void;
  large?: boolean;
  trainingModeOpen: boolean;
};

export function PetPresentationStage(props: PetPresentationStageProps) {
  const renderer = resolvePresentationRenderer(props.mode);
  if (renderer === "lcd") {
    return (
      <QuietCareMonitor
        boopDisabled={props.boopDisabled}
        boopStatus={props.boopStatus}
        large={props.large}
        model={props.model}
        onBoop={props.onBoop}
      />
    );
  }

  const sceneProps: PetRoomSceneProps = {
    bob: props.bob,
    wag: props.wag,
    pulse: props.pulse,
    zoom: props.zoom,
    feedProgress: props.feedProgress,
    stage: props.model.stage,
    sleeping: props.model.sleeping,
    tired: props.model.visual.tired,
    lowHappiness: props.model.visual.lowHappiness,
    emote: props.model.visual.emote,
    onBoop: props.onBoop,
    boopDisabled: props.boopDisabled,
    boopStatus: props.boopStatus,
    roomTheme: props.model.roomTheme,
    daypart: props.model.clock.daypart,
    dead: props.model.dead,
    hygieneAppearance: props.model.hygieneAppearance,
    cleaningPhase: props.model.visual.cleaningPhase,
    reduced: props.model.reducedMotion,
    clockLabel: props.model.clock.label,
    careDisabled: props.careDisabled,
    restDisabled: props.restDisabled,
    restLabel: props.restLabel,
    onCare: props.onCare,
    onRest: props.onRest,
    large: props.large,
    trainingAction: props.model.visual.trainingAction,
    trainingProgress: props.trainingProgress,
    trainingAnimationRevision: props.trainingAnimationRevision,
    trainingPoseHeld: props.trainingPoseHeld,
    trainingTreatProgress: props.trainingTreatProgress,
    trainingTreatVisible: props.model.visual.trainingTreatVisible,
    trainingModeOpen: props.trainingModeOpen,
  };

  if (renderer === "color-pixel") {
    return <PetRoomSceneShell {...sceneProps} />;
  }
  return <PetRoomScene {...sceneProps} />;
}

export function PresentationModeSwitcher({
  mode,
  onChange,
}: {
  mode: PresentationMode;
  onChange: (mode: PresentationMode) => void;
}) {
  return (
    <View
      accessibilityLabel="Presentation mode"
      accessibilityRole="radiogroup"
      style={styles.switcher}
    >
      {PRESENTATION_MODES.map((option) => (
        <PresentationModeButton
          key={option}
          label={PRESENTATION_MODE_LABELS[option]}
          mode={option}
          selected={mode === option}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

function PresentationModeButton({
  label,
  mode,
  selected,
  onPress,
}: {
  label: string;
  mode: PresentationMode;
  selected: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label} presentation`}
      accessibilityState={{ selected }}
      {...(Platform.OS === "web" ? ({ "aria-checked": selected } as const) : {})}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        selected && styles.modeButtonSelected,
        focused && styles.modeButtonFocused,
        pressed && styles.modeButtonPressed,
      ]}
      testID={`presentation-mode-${mode}`}
    >
      <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switcher: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 6,
  },
  modeButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#60767c",
    borderRadius: 12,
    backgroundColor: "#fffaf0",
  },
  modeButtonSelected: {
    borderColor: "#27444c",
    backgroundColor: "#d9e5a8",
  },
  modeButtonFocused: {
    borderColor: "#1f5f82",
    borderWidth: 4,
  },
  modeButtonPressed: { transform: [{ translateY: 2 }] },
  modeLabel: {
    color: "#60767c",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  modeLabelSelected: { color: "#27444c" },
});
