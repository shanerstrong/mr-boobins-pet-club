import { useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import {
  PixelDog,
  type DogEmote,
  type TrainingVisualAction,
} from "./pixel-dog";
import type {
  CareAction,
  CleaningPhase,
  Daypart,
  GrowthStage,
  HygieneAppearance,
  RoomTheme,
} from "./simulation";

export type PetRoomSceneProps = {
  bob: Animated.Value;
  wag: Animated.Value;
  pulse: Animated.Value;
  zoom: Animated.Value;
  feedProgress: Animated.Value;
  stage: GrowthStage;
  sleeping: boolean;
  tired: boolean;
  lowHappiness: boolean;
  emote: DogEmote;
  onBoop: () => void;
  boopDisabled: boolean;
  boopStatus: string;
  roomTheme: RoomTheme;
  daypart: Daypart;
  dead: boolean;
  hygieneAppearance: HygieneAppearance;
  cleaningPhase: CleaningPhase | null;
  reduced: boolean;
  clockLabel: string;
  careDisabled: boolean;
  restDisabled: boolean;
  restLabel: "Rest" | "Wake";
  onCare: (action: CareAction) => void;
  onRest: () => void;
  large?: boolean;
  trainingAction: TrainingVisualAction;
  trainingProgress: Animated.Value;
  trainingAnimationRevision: number;
  trainingPoseHeld: boolean;
  trainingTreatProgress: Animated.Value;
  trainingTreatVisible: boolean;
  trainingModeOpen: boolean;
};

type ShellProps = PetRoomSceneProps & {
  children?: ReactNode;
  hideDog?: boolean;
  objectVisuals?: boolean;
};

/** Shared room semantics used by the pixel fallback and web 3D renderer. */
export function PetRoomSceneShell({
  careDisabled,
  children,
  hideDog = false,
  objectVisuals = true,
  onCare,
  onRest,
  restDisabled,
  restLabel,
  large = false,
  ...dogProps
}: ShellProps) {
  const treatTranslateX = dogProps.trainingTreatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-116, 0],
  });
  const treatTranslateY = dogProps.trainingTreatProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [64, 20, 0],
  });
  const treatRotate = dogProps.trainingTreatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["-18deg", "20deg"],
  });

  return (
    <View style={styles.root}>
      <PixelDog {...dogProps} hideDog={hideDog} large={large} />
      {children}
      {hideDog && dogProps.trainingTreatVisible && (
        <Animated.View
          accessibilityLabel="A training treat is traveling to Jack's mouth"
          pointerEvents="none"
          style={[
            styles.trainingTreat,
            large && styles.trainingTreatLarge,
            {
              transform: [
                { translateX: treatTranslateX },
                { translateY: treatTranslateY },
                { rotate: treatRotate },
              ],
            },
          ]}
        >
          <View style={styles.trainingTreatDot} />
        </Animated.View>
      )}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {hideDog && (
          <RoomObjectButton
            accessibilityLabel={`Boop Jack's nose. ${dogProps.boopStatus}`}
            disabled={dogProps.boopDisabled}
            onPress={dogProps.onBoop}
            style={[styles.noseTarget, large && styles.noseTargetLarge]}
            transparent
          />
        )}
        <RoomObjectButton
          accessibilityLabel="Food bowl. Feed Jack."
          disabled={careDisabled}
          onPress={() => onCare("feed")}
          style={styles.bowlTarget}
          transparent={!objectVisuals}
        >
          {objectVisuals && (
            <>
              <View style={styles.bowlFood}><Text style={styles.foodDots}>•••</Text></View>
              <View style={styles.bowlBase}><Text style={styles.pawMark}>•</Text></View>
            </>
          )}
        </RoomObjectButton>
        <RoomObjectButton
          accessibilityLabel="Jack's toy. Play with Jack."
          disabled={careDisabled}
          onPress={() => onCare("play")}
          style={styles.toyTarget}
          transparent={!objectVisuals}
        >
          {objectVisuals && (
            <>
              <View style={styles.toyEnd} />
              <View style={styles.toyRope} />
              <View style={styles.toyEnd} />
            </>
          )}
        </RoomObjectButton>
        <RoomObjectButton
          accessibilityLabel="Cleaning mat. Clean Jack."
          disabled={careDisabled}
          onPress={() => onCare("clean")}
          style={styles.cleanTarget}
          transparent={!objectVisuals}
        >
          {objectVisuals && (
            <View style={styles.cleanMat}>
              <Text style={styles.cleanIcon}>✦</Text>
            </View>
          )}
        </RoomObjectButton>
        <RoomObjectButton
          accessibilityLabel={`${restLabel} Jack using the bed.`}
          disabled={restDisabled}
          onPress={onRest}
          style={styles.bedTarget}
          transparent
        />
      </View>
    </View>
  );
}

function RoomObjectButton({
  accessibilityLabel,
  children,
  disabled,
  onPress,
  style,
  transparent = false,
}: {
  accessibilityLabel: string;
  children?: ReactNode;
  disabled: boolean;
  onPress: () => void;
  style: object | object[];
  transparent?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.target,
        style,
        transparent && styles.transparentTarget,
        pressed && !disabled && styles.targetPressed,
        focused && !disabled && styles.targetFocused,
        disabled && styles.targetDisabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative" },
  target: {
    position: "absolute",
    minWidth: 56,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#f7d56e",
    backgroundColor: "rgba(255, 240, 173, 0.28)",
    shadowColor: "#f4c44f",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  transparentTarget: { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0 },
  targetPressed: { transform: [{ scale: 0.95 }], backgroundColor: "rgba(255, 240, 173, 0.5)", borderColor: "#f7d56e" },
  targetFocused: { borderColor: "#1f5f82", borderWidth: 4, shadowColor: "#1f5f82", shadowOpacity: 0.85 },
  targetDisabled: { opacity: 0.48 },
  noseTarget: { left: "35%", top: "35%", width: 62, height: 62 },
  noseTargetLarge: { left: "39%", top: "34%", width: 68, height: 68 },
  bowlTarget: { left: "5%", bottom: "4%", width: 74, height: 66 },
  bowlFood: { width: 48, height: 18, marginBottom: -4, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#80563d" },
  foodDots: { color: "#d6a252", fontSize: 17, lineHeight: 18, fontWeight: "900", letterSpacing: 1 },
  bowlBase: { width: 58, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#62a5c7", borderWidth: 3, borderColor: "#27444c" },
  pawMark: { color: "#f4e3bd", fontSize: 22, lineHeight: 22, fontWeight: "900" },
  toyTarget: { right: "8%", bottom: "28%", width: 74, height: 58, flexDirection: "row", gap: 2 },
  toyEnd: { width: 19, height: 31, borderRadius: 8, backgroundColor: "#68a9c8", borderWidth: 3, borderColor: "#27444c" },
  toyRope: { width: 25, height: 12, borderRadius: 999, backgroundColor: "#e5c69c", borderWidth: 3, borderColor: "#27444c" },
  cleanTarget: { right: "5%", bottom: "3%", width: 82, height: 68 },
  cleanMat: { width: 68, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#b9dce5", borderWidth: 3, borderColor: "#27444c" },
  cleanIcon: { color: "#3b83a7", fontSize: 25, fontWeight: "900" },
  bedTarget: { left: "5%", bottom: "28%", width: 128, height: 76 },
  trainingTreat: {
    position: "absolute",
    left: "52%",
    top: "47%",
    width: 22,
    height: 18,
    borderWidth: 3,
    borderColor: "#412f2b",
    backgroundColor: "#e6a04d",
    borderRadius: 5,
    zIndex: 24,
  },
  trainingTreatLarge: { left: "53%", top: "46%", width: 25, height: 20 },
  trainingTreatDot: { position: "absolute", width: 4, height: 4, borderRadius: 2, backgroundColor: "#8f542e", left: 4, top: 3 },
});
