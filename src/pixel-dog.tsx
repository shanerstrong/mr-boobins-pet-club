import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { GrowthStage } from "./simulation";

export type DogEmote = "happy" | "toy" | "sparkle" | "yawn" | null;

type Props = {
  bob: Animated.Value;
  wag: Animated.Value;
  pulse: Animated.Value;
  reaction: string;
  stage: GrowthStage;
  sleeping: boolean;
  tired: boolean;
  lowHappiness: boolean;
  happy: boolean;
  emote: DogEmote;
  onPet: () => void;
};

const stageLabel: Record<GrowthStage, string> = {
  baby: "Baby",
  "little-puppy": "Little Puppy",
  puppy: "Puppy",
  "young-dog": "Young Dog",
  adult: "Adult",
};

export function PixelDog({
  bob,
  wag,
  pulse,
  reaction,
  stage,
  sleeping,
  tired,
  lowHappiness,
  happy,
  emote,
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
  const holdingToy = emote === "toy" || lowHappiness;
  const sizeStyle = stageStyles[stage];

  return (
    <View
      style={styles.scene}
      accessibilityLabel={`Provisional white ${stageLabel[stage]} Jack in his pet room`}
    >
      <View style={styles.window} />
      <View style={styles.rug} />
      <Animated.View
        style={[
          styles.dog,
          sizeStyle.dog,
          {
            transform: sleeping
              ? []
              : [{ translateY }, { scale }],
          },
        ]}
      >
        <View
          style={[styles.pixel, styles.earLeft, sizeStyle.ear, sleeping && styles.sleepingEar]}
        />
        <View
          style={[styles.pixel, styles.earRight, sizeStyle.ear, sleeping && styles.sleepingEar]}
        />
        <View
          style={[styles.pixel, styles.head, sizeStyle.head, sleeping && styles.sleepingHead]}
        />
        <View
          style={[
            styles.pixel,
            styles.muzzle,
            sizeStyle.muzzle,
            sleeping && styles.sleepingMuzzle,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.eyeLeft,
            sizeStyle.eye,
            sleeping && styles.closedEye,
            sleeping && styles.sleepingEye,
            tired && !sleeping && styles.droopyEye,
          ]}
        />
        <View
          style={[
            styles.pixel,
            styles.eyeRight,
            sizeStyle.eye,
            sleeping && styles.closedEye,
            sleeping && styles.sleepingEye,
            tired && !sleeping && styles.droopyEye,
          ]}
        />
        {(happy || emote === "happy") && !sleeping && (
          <View style={[styles.pixel, styles.smile, sizeStyle.smile]} />
        )}
        <View
          style={[styles.pixel, styles.nose, sizeStyle.nose, sleeping && styles.sleepingNose]}
        />
        <View
          style={[styles.pixel, styles.body, sizeStyle.body, sleeping && styles.sleepingBody]}
        />
        <View
          style={[styles.pixel, styles.chest, sizeStyle.chest, sleeping && styles.sleepingChest]}
        />
        <View
          style={[styles.pixel, styles.legLeft, sizeStyle.leg, sleeping && styles.sleepingLegLeft]}
        />
        <View
          style={[styles.pixel, styles.legRight, sizeStyle.leg, sleeping && styles.sleepingLegRight]}
        />
        <Animated.View
          style={[
            styles.pixel,
            styles.tail,
            sizeStyle.tail,
            sleeping && styles.sleepingTail,
            { transform: sleeping ? [] : [{ rotate: tail }] },
          ]}
        />
        {holdingToy && !sleeping && <View style={[styles.pixel, styles.toy]} />}
      </Animated.View>
      {sleeping && <Text style={styles.zs}>Z z</Text>}
      {emote === "happy" && <Text style={styles.hearts}>♥ ♥</Text>}
      {emote === "toy" && <Text style={styles.zoomies}>ZOOM!</Text>}
      {emote === "sparkle" && <Text style={styles.sparkles}>✦ ✧</Text>}
      {emote === "yawn" && <Text style={styles.yawn}>yaaaawn</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Give Jack a gentle pat"
        disabled={sleeping}
        onPress={onPet}
        style={[styles.patButton, sleeping && styles.disabled]}
      >
        <Text style={styles.patText}>{sleeping ? "NAP TIME" : "PAT JACK"}</Text>
      </Pressable>
      <Text style={styles.reaction} accessibilityLiveRegion="polite">
        {reaction}
      </Text>
      <Text style={styles.provisional}>
        Provisional white {stageLabel[stage]} Jack
      </Text>
    </View>
  );
}

const stageStyles: Record<GrowthStage, Record<string, object>> = {
  baby: {
    dog: { width: 124, height: 142, top: 103, marginLeft: -62 },
    ear: { width: 31, height: 48, top: 12 },
    head: { width: 84, height: 70, top: 37, left: 20 },
    muzzle: { width: 43, height: 27, top: 77, left: 41 },
    eye: { top: 61, width: 9, height: 12 },
    nose: { width: 14, height: 9, top: 80, left: 55 },
    smile: { top: 94, left: 48 },
    body: { width: 83, height: 45, top: 101, left: 20 },
    chest: { width: 25, height: 32, top: 110, left: 50 },
    leg: { width: 21, height: 25, bottom: 0 },
    tail: { width: 39, height: 17, top: 112 },
  },
  "little-puppy": {
    dog: { width: 144, height: 157, top: 88, marginLeft: -72 },
    ear: { width: 36, height: 55 },
    head: { width: 96, height: 80, top: 34, left: 24 },
    muzzle: { width: 50, height: 31, top: 80, left: 47 },
    eye: { top: 62, width: 10, height: 14 },
    nose: { width: 16, height: 10, top: 84, left: 64 },
    smile: { top: 99, left: 58 },
    body: { width: 95, height: 53, top: 108, left: 24 },
    chest: { width: 29, height: 38, top: 118, left: 58 },
    leg: { width: 24, height: 29, bottom: 0 },
    tail: { width: 46, height: 19, top: 123 },
  },
  puppy: {
    dog: { width: 160, height: 171, top: 75, marginLeft: -80 },
    ear: { width: 40, height: 61 },
    head: { width: 106, height: 89, top: 34, left: 27 },
    muzzle: { width: 55, height: 34, top: 84, left: 53 },
    eye: { top: 65, width: 11, height: 16 },
    nose: { width: 18, height: 11, top: 87, left: 71 },
    smile: { top: 104, left: 65 },
    body: { width: 105, height: 58, top: 116, left: 28 },
    chest: { width: 32, height: 43, top: 127, left: 64 },
    leg: { width: 27, height: 32, bottom: 0 },
    tail: { width: 51, height: 21, top: 132 },
  },
  "young-dog": {
    dog: { width: 177, height: 186, top: 61, marginLeft: -88 },
    ear: { width: 45, height: 68 },
    head: { width: 118, height: 98, top: 30, left: 29 },
    muzzle: { width: 62, height: 38, top: 90, left: 58 },
    eye: { top: 68, width: 12, height: 17 },
    nose: { width: 19, height: 12, top: 94, left: 78 },
    smile: { top: 112, left: 73 },
    body: { width: 121, height: 66, top: 123, left: 28 },
    chest: { width: 38, height: 51, top: 135, left: 70 },
    leg: { width: 31, height: 37, bottom: 0 },
    tail: { width: 60, height: 24, top: 142 },
  },
  adult: {
    dog: { width: 196, height: 202, top: 46, marginLeft: -98 },
    ear: { width: 50, height: 77, top: 4 },
    head: { width: 132, height: 108, top: 28, left: 32 },
    muzzle: { width: 70, height: 42, top: 100, left: 65 },
    eye: { top: 74, width: 13, height: 19 },
    nose: { width: 21, height: 13, top: 104, left: 87 },
    smile: { top: 123, left: 82 },
    body: { width: 142, height: 76, top: 133, left: 27, borderRadius: 18 },
    chest: { width: 45, height: 59, top: 146, left: 78 },
    leg: { width: 35, height: 43, bottom: 0 },
    tail: { width: 70, height: 28, top: 153, right: -13 },
  },
};

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
  dog: { position: "absolute", left: "50%" },
  pixel: { position: "absolute" },
  earLeft: {
    left: 18,
    backgroundColor: "#ffffff",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  earRight: {
    right: 18,
    backgroundColor: "#ffffff",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  head: {
    backgroundColor: "#ffffff",
    borderWidth: 6,
    borderColor: "#3a4850",
    borderRadius: 12,
  },
  muzzle: {
    backgroundColor: "#ffffff",
    borderWidth: 4,
    borderColor: "#3a4850",
  },
  eyeLeft: { left: "33%", backgroundColor: "#24313b" },
  eyeRight: { right: "33%", backgroundColor: "#24313b" },
  closedEye: { height: 4, top: 76 },
  droopyEye: {
    height: 10,
    borderBottomWidth: 4,
    borderColor: "#24313b",
    backgroundColor: "transparent",
  },
  smile: {
    width: 28,
    height: 7,
    borderBottomWidth: 4,
    borderColor: "#b75b5a",
    borderRadius: 8,
  },
  nose: { backgroundColor: "#24313b" },
  body: {
    backgroundColor: "#ffffff",
    borderWidth: 6,
    borderColor: "#3a4850",
    borderRadius: 10,
  },
  chest: { backgroundColor: "#ffffff" },
  legLeft: {
    left: "24%",
    backgroundColor: "#ffffff",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  legRight: {
    right: "24%",
    backgroundColor: "#ffffff",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  tail: {
    right: -4,
    backgroundColor: "#ffffff",
    borderWidth: 5,
    borderColor: "#3a4850",
  },
  sleepingEar: { width: 28, height: 34, top: 92 },
  sleepingHead: {
    width: "42%",
    height: 50,
    left: "5%",
    top: 96,
    borderRadius: 18,
  },
  sleepingMuzzle: { width: "26%", height: 24, left: "9%", top: 125 },
  sleepingEye: { top: 119, height: 4 },
  sleepingNose: { width: 14, height: 9, left: "17%", top: 128 },
  sleepingBody: {
    width: "66%",
    height: 48,
    left: "28%",
    top: 119,
    borderRadius: 24,
  },
  sleepingChest: { width: "16%", height: 36, left: "35%", top: 128 },
  sleepingLegLeft: { width: "24%", height: 20, left: "47%", top: 157 },
  sleepingLegRight: { width: "24%", height: 20, right: "5%", top: 157 },
  sleepingTail: { width: "27%", height: 16, right: "-4%", top: 112 },
  toy: {
    width: 23,
    height: 23,
    left: "51%",
    top: "67%",
    backgroundColor: "#e86358",
    borderWidth: 4,
    borderColor: "#3a4850",
    borderRadius: 3,
  },
  patButton: {
    position: "absolute",
    right: 16,
    bottom: 14,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#ffdf8a",
    borderWidth: 3,
    borderColor: "#3a4850",
  },
  disabled: { opacity: 0.52 },
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
  hearts: {
    position: "absolute",
    left: "57%",
    top: 116,
    color: "#d65262",
    fontSize: 22,
    fontWeight: "900",
  },
  zoomies: {
    position: "absolute",
    left: "59%",
    top: 132,
    color: "#ef7659",
    fontSize: 18,
    fontWeight: "900",
  },
  sparkles: {
    position: "absolute",
    left: "58%",
    top: 94,
    color: "#fffaf0",
    fontSize: 26,
    fontWeight: "900",
  },
  yawn: {
    position: "absolute",
    left: "57%",
    top: 132,
    color: "#3a4850",
    fontSize: 16,
    fontWeight: "900",
  },
});
