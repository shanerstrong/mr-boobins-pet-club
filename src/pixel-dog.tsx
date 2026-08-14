import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { LifeStage } from "./simulation";
type Props = {
  bob: Animated.Value;
  wag: Animated.Value;
  pulse: Animated.Value;
  reaction: string;
  stage: LifeStage;
  sleeping: boolean;
  tired: boolean;
  happy: boolean;
  onPet: () => void;
};
export function PixelDog({
  bob,
  wag,
  pulse,
  reaction,
  stage,
  sleeping,
  tired,
  happy,
  onPet,
}: Props) {
  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const tail = wag.interpolate({
    inputRange: [0, 1],
    outputRange: ["-12deg", "18deg"],
  });
  return (
    <View
      style={styles.scene}
      accessibilityLabel={`Provisional white ${stage} Jack in his pet room`}
    >
      <View style={styles.window} />
      <View style={styles.rug} />
      <Animated.View
        style={[
          styles.dog,
          stage === "adult" && styles.adult,
          { transform: [{ translateY }, { scale }] },
        ]}
      >
        <View
          style={[
            styles.pixel,
            styles.earLeft,
            stage === "adult" && styles.adultEar,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.earRight,
            stage === "adult" && styles.adultEar,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.head,
            stage === "adult" && styles.adultHead,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.muzzle,
            stage === "adult" && styles.adultMuzzle,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.eyeLeft,
            sleeping && styles.closedEye,
            tired && !sleeping && styles.droopyEye,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.eyeRight,
            sleeping && styles.closedEye,
            tired && !sleeping && styles.droopyEye,
          ]}
        />
        {happy && !sleeping && <View style={[styles.pixel, styles.smile]} />}
        <View style={[styles.pixel, styles.nose]} />
        <View
          style={[
            styles.pixel,
            styles.body,
            stage === "adult" && styles.adultBody,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.chest,
            stage === "adult" && styles.adultChest,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.legLeft,
            stage === "adult" && styles.adultLeg,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.legRight,
            stage === "adult" && styles.adultLeg,
          ]}
        />
        <Animated.View
          style={[
            styles.pixel,
            styles.tail,
            stage === "adult" && styles.adultTail,
            { transform: [{ rotate: tail }] },
          ]}
        />
      </Animated.View>
      {sleeping && <Text style={styles.zs}>Z z</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Give Jack a gentle pat"
        onPress={onPet}
        style={styles.patButton}
      >
        <Text style={styles.patText}>PAT JACK</Text>
      </Pressable>
      <Text style={styles.reaction} accessibilityLiveRegion="polite">
        {reaction}
      </Text>
      <Text style={styles.provisional}>Provisional white {stage} Jack</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  scene: {
    height: 304,
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: "#9ed6df",
    borderWidth: 5,
    borderColor: "#27444c",
    position: "relative",
  },
  window: {
    position: "absolute",
    width: 90,
    height: 84,
    right: 24,
    top: 25,
    backgroundColor: "#d9f1f0",
    borderWidth: 6,
    borderColor: "#5a8a91",
  },
  rug: {
    position: "absolute",
    width: 230,
    height: 86,
    left: "50%",
    bottom: 28,
    marginLeft: -115,
    backgroundColor: "#f0bd61",
    borderWidth: 5,
    borderColor: "#bd7347",
    borderRadius: 18,
  },
  dog: {
    position: "absolute",
    width: 170,
    height: 180,
    left: "50%",
    top: 67,
    marginLeft: -85,
  },
  adult: { width: 190, height: 195, top: 50, marginLeft: -95 },
  adultEar: { width: 48, height: 72 },
  adultHead: { width: 126, height: 102, left: 25, top: 30 },
  adultMuzzle: { width: 66, left: 60, top: 92 },
  adultBody: { width: 132, height: 70, left: 24, top: 126, borderRadius: 16 },
  adultChest: { width: 42, height: 55, left: 75, top: 137 },
  adultLeg: { width: 33, height: 40 },
  adultTail: { width: 66, height: 26, top: 145, right: -12 },
  pixel: { position: "absolute" },
  earLeft: {
    width: 42,
    height: 64,
    top: 7,
    left: 22,
    backgroundColor: "#ededdf",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  earRight: {
    width: 42,
    height: 64,
    top: 7,
    right: 22,
    backgroundColor: "#ededdf",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  head: {
    width: 112,
    height: 94,
    top: 34,
    left: 29,
    backgroundColor: "#fffdf2",
    borderWidth: 6,
    borderColor: "#3a4850",
    borderRadius: 12,
  },
  muzzle: {
    width: 58,
    height: 36,
    top: 86,
    left: 56,
    backgroundColor: "#e9e6d6",
    borderWidth: 4,
    borderColor: "#3a4850",
  },
  eyeLeft: {
    width: 12,
    height: 17,
    top: 65,
    left: 56,
    backgroundColor: "#24313b",
  },
  eyeRight: {
    width: 12,
    height: 17,
    top: 65,
    right: 56,
    backgroundColor: "#24313b",
  },
  closedEye: { height: 4, top: 75 },
  droopyEye: {
    top: 72,
    height: 10,
    borderBottomWidth: 4,
    borderColor: "#24313b",
    backgroundColor: "transparent",
  },
  smile: {
    width: 28,
    height: 7,
    top: 108,
    left: 71,
    borderBottomWidth: 4,
    borderColor: "#b75b5a",
    borderRadius: 8,
  },
  nose: {
    width: 19,
    height: 12,
    top: 89,
    left: 76,
    backgroundColor: "#24313b",
  },
  body: {
    width: 110,
    height: 61,
    top: 120,
    left: 30,
    backgroundColor: "#fffdf2",
    borderWidth: 6,
    borderColor: "#3a4850",
    borderRadius: 10,
  },
  chest: {
    width: 34,
    height: 46,
    top: 131,
    left: 68,
    backgroundColor: "#e9e6d6",
  },
  legLeft: {
    width: 28,
    height: 33,
    bottom: 0,
    left: 39,
    backgroundColor: "#ededdf",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  legRight: {
    width: 28,
    height: 33,
    bottom: 0,
    right: 39,
    backgroundColor: "#ededdf",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  tail: {
    width: 54,
    height: 22,
    top: 136,
    right: -4,
    backgroundColor: "#ededdf",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  patButton: {
    position: "absolute",
    right: 16,
    bottom: 14,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#ffdf8a",
    borderWidth: 3,
    borderColor: "#3a4850",
  },
  patText: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "900",
    color: "#3a4850",
  },
  reaction: {
    position: "absolute",
    top: 15,
    left: 16,
    right: 120,
    color: "#24313b",
    fontSize: 16,
    fontWeight: "900",
  },
  provisional: {
    position: "absolute",
    left: 16,
    bottom: 14,
    color: "#3a4850",
    fontSize: 11,
    fontWeight: "700",
  },
  zs: {
    position: "absolute",
    left: "58%",
    top: 70,
    color: "#3a4850",
    fontWeight: "900",
    fontSize: 24,
  },
});
