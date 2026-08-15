import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type {
  CleaningPhase,
  Daypart,
  GrowthStage,
  HygieneAppearance,
  RoomTheme,
} from "./simulation";

export type DogEmote =
  | "feeding"
  | "fed"
  | "happy"
  | "toy"
  | "sparkle"
  | "yawn"
  | "whine"
  | "grumble"
  | "sneeze"
  | "huff"
  | "bark"
  | "cleaning"
  | null;

type Props = {
  bob: Animated.Value;
  wag: Animated.Value;
  pulse: Animated.Value;
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
  feedProgress: Animated.Value;
  zoom: Animated.Value;
  hygieneAppearance: HygieneAppearance;
  cleaningPhase: CleaningPhase | null;
  reduced: boolean;
  clockLabel: string;
  large?: boolean;
};

const stageLabel: Record<GrowthStage, string> = {
  baby: "New Baby",
  "little-puppy": "Little Puppy",
  puppy: "Puppy",
  "young-dog": "Young Dog",
  adult: "Grown-Up",
};

const themeColors: Record<
  RoomTheme,
  { wall: string; floor: string; curtain: string; bed: string }
> = {
  cozy: {
    wall: "#f3d7b6",
    floor: "#c58d62",
    curtain: "#d66d5b",
    bed: "#b95f55",
  },
  blue: {
    wall: "#cfdfef",
    floor: "#718aa6",
    curtain: "#5578a7",
    bed: "#38628d",
  },
  garden: {
    wall: "#dce8c7",
    floor: "#9dba73",
    curtain: "#729e62",
    bed: "#557f4c",
  },
};

const skyColors: Record<Daypart, string> = {
  morning: "#ffd59b",
  day: "#88d8ef",
  dusk: "#b879a6",
  night: "#243660",
};

export function PixelDog({
  bob,
  wag,
  pulse,
  stage,
  sleeping,
  tired,
  lowHappiness,
  emote,
  onBoop,
  boopDisabled,
  boopStatus,
  roomTheme,
  daypart,
  dead,
  feedProgress,
  zoom,
  hygieneAppearance,
  cleaningPhase,
  reduced,
  clockLabel,
  large = false,
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
  const run = zoom.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [0, 42, -28, 0],
  });
  const colors = themeColors[roomTheme];
  const holdingToy = !dead && (emote === "toy" || lowHappiness);
  const comfortable = emote === "happy" || emote === "fed" || emote === "bark";

  return (
    <View
      style={[
        styles.scene,
        { backgroundColor: colors.wall },
        large && styles.sceneLarge,
      ]}
      accessibilityLabel={`White ${stageLabel[stage]} Jack in a ${roomTheme} living room during ${daypart}`}
    >
      <View style={[styles.window, { backgroundColor: skyColors[daypart] }]} />
      <View style={[styles.curtain, styles.curtainLeft, { backgroundColor: colors.curtain }]} />
      <View style={[styles.curtain, styles.curtainRight, { backgroundColor: colors.curtain }]} />
      <View style={[styles.floor, { backgroundColor: colors.floor }]} />
      <View style={styles.lampStem} />
      <View style={[styles.lampShade, daypart === "night" && styles.lampNight]} />
      <View style={[styles.bed, { backgroundColor: colors.bed }, large && styles.bedLarge]}>
        <View style={[styles.bedCushion, { backgroundColor: colors.bed }]} />
      </View>
      <View
        accessibilityLabel={`Virtual pet clock ${clockLabel}`}
        style={[styles.clock, daypart === "night" && styles.clockNight]}
      >
        <Text style={[styles.clockText, daypart === "night" && styles.clockTextNight]}>
          {clockLabel}
        </Text>
      </View>
      <View style={[styles.dogLayer, { pointerEvents: "box-none" }]}>
        {sleeping ? (
          <SleepingJack stage={stage} />
        ) : (
          <AwakeJack
            bob={dead || reduced ? 0 : translateY}
            tail={dead || reduced ? "0deg" : tail}
            pulse={dead || reduced ? 1 : scale}
            run={dead || reduced ? 0 : run}
            stage={stage}
            tired={tired}
            smiling={comfortable}
            holdingToy={holdingToy}
            dead={dead}
            feeding={emote === "feeding"}
            feedProgress={feedProgress}
            onBoop={onBoop}
            boopDisabled={boopDisabled}
            boopStatus={boopStatus}
          />
        )}
      </View>
      <HygieneFx appearance={hygieneAppearance} cleaningPhase={cleaningPhase} />
      {sleeping && <Text style={styles.zs}>Z z z</Text>}
      {!dead && emote === "fed" && <Text style={styles.woof}>WOOF!</Text>}
      {!dead && emote === "bark" && <Text style={styles.woof}>BARK! ↥</Text>}
      {!dead && emote === "happy" && <Text style={styles.hearts}>♥ ♥</Text>}
      {!dead && emote === "toy" && <Text style={styles.zoomies}>ZOOMIES!</Text>}
      {!dead && emote === "sparkle" && <Text style={styles.sparkles}>✦ ✧ ✦</Text>}
      {!dead && emote === "yawn" && <Text style={styles.yawn}>yaaawn…</Text>}
      {!dead && emote === "whine" && <Text style={styles.yawn}>…whine…</Text>}
      {!dead && emote === "grumble" && <Text style={styles.yawn}>sleepy grr…</Text>}
      {!dead && emote === "sneeze" && <Text style={styles.hearts}>ACHOO!</Text>}
      {!dead && emote === "huff" && <Text style={styles.yawn}>huff…</Text>}
      {dead && <Text style={styles.deadNote}>NO EMOTES</Text>}
      <Text style={styles.stageNote}>
        {dead ? "STORY ENDED" : sleeping ? "SLEEPING IN BED" : stageLabel[stage]}
      </Text>
    </View>
  );
}

export function MiniJack({ locked = false }: { locked?: boolean }) {
  const fur = locked ? "#c9d0d0" : "#ffffff";
  return (
    <View style={styles.mini} accessibilityLabel={locked ? "Locked future pet" : "White Baby Jack with a blue collar"}>
      <View style={[styles.miniTail, { backgroundColor: fur }]} />
      <View style={[styles.miniBody, { backgroundColor: fur }]} />
      <View style={[styles.miniHead, { backgroundColor: fur }]} />
      <View style={[styles.miniEar, { backgroundColor: fur }]} />
      {!locked && <View style={styles.miniCollar} />}
      <View style={styles.miniEye} />
      <View style={styles.miniNose} />
      {locked && <Text style={styles.miniLocked}>LOCKED</Text>}
    </View>
  );
}

function HygieneFx({
  appearance,
  cleaningPhase,
}: {
  appearance: HygieneAppearance;
  cleaningPhase: CleaningPhase | null;
}) {
  if (cleaningPhase) {
    return (
      <View style={[styles.cleaningFx, { pointerEvents: "none" }]}>
        <Text style={styles.showerHead}>▰</Text>
        {cleaningPhase === "water" && <Text style={styles.water}>│ │ │{`\n`}│ │ │</Text>}
        {cleaningPhase === "washout" && <Text style={styles.washout}>water ↓ dirt ↓</Text>}
        {cleaningPhase === "shake" && <Text style={styles.shake}>SHAKE!</Text>}
        {cleaningPhase === "sparkle" && <Text style={styles.cleanSparkle}>✦ CLEAN ✦</Text>}
      </View>
    );
  }
  if (appearance === "clear") return null;
  return (
    <View style={[styles.dirtFx, { pointerEvents: "none" }]}>
      {appearance === "dust" && <Text style={styles.dust}>·  ·   ·{`\n`}  ·  ·</Text>}
      {(appearance === "mud" || appearance === "stink") && (
        <>
          <View style={[styles.mud, styles.mudOne]} />
          <View style={[styles.mud, styles.mudTwo]} />
        </>
      )}
      {appearance === "stink" && <Text style={styles.stink}>≈ STINK ≈</Text>}
    </View>
  );
}

function AwakeJack({
  bob,
  tail,
  pulse,
  stage,
  tired,
  smiling,
  holdingToy,
  dead,
  run,
  feeding,
  feedProgress,
  onBoop,
  boopDisabled,
  boopStatus,
}: {
  bob: Animated.AnimatedInterpolation<number> | number;
  tail: Animated.AnimatedInterpolation<string | number> | string;
  pulse: Animated.AnimatedInterpolation<number> | number;
  stage: GrowthStage;
  tired: boolean;
  smiling: boolean;
  holdingToy: boolean;
  dead: boolean;
  run: Animated.AnimatedInterpolation<number> | number;
  feeding: boolean;
  feedProgress: Animated.Value;
  onBoop: () => void;
  boopDisabled: boolean;
  boopStatus: string;
}) {
  const size = awakeStages[stage];
  return (
    <Animated.View
      style={[
        styles.dog,
        size.dog,
        {
          transform: [
            { translateX: run },
            { translateY: bob },
            { scale: pulse },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.pixel,
          styles.tail,
          size.tail,
          { transform: [{ rotate: tail }] },
        ]}
      />
      <View style={[styles.pixel, styles.body, size.body]} />
      <View style={[styles.pixel, styles.chest, size.chest]} />
      <View style={[styles.pixel, styles.legLeft, size.leg]} />
      <View style={[styles.pixel, styles.legRight, size.leg]} />
      <View style={[styles.pixel, styles.earLeft, size.ear]} />
      <View style={[styles.pixel, styles.earRight, size.ear]} />
      <View style={[styles.pixel, styles.head, size.head]} />
      <View style={[styles.pixel, styles.muzzle, size.muzzle]} />
      <View style={[styles.pixel, styles.collar, size.collar]} />
      {feeding && (
        <View
          accessibilityLabel="Jack's mouth is open for the incoming treat"
          style={[styles.pixel, styles.mouthOpen, size.mouth]}
        />
      )}
      {dead ? (
        <Text style={[styles.xEyes, size.eye]}>× ×</Text>
      ) : (
        <>
          <View style={[styles.pixel, styles.eyeLeft, size.eye, tired && styles.droopyEye]} />
          <View style={[styles.pixel, styles.eyeRight, size.eye, tired && styles.droopyEye]} />
        </>
      )}
      {smiling && <View style={[styles.pixel, styles.smile, size.smile]} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={boopDisabled ? `Boop Jack's snoot. ${boopStatus}` : "Boop Jack's snoot"}
        accessibilityState={{ disabled: boopDisabled }}
        disabled={boopDisabled}
        onPress={onBoop}
        hitSlop={8}
        style={[styles.pixel, styles.noseTarget, size.noseTarget]}
      >
        <View style={[styles.nose, size.nose]} />
      </Pressable>
      {feeding && <Treat progress={feedProgress} stage={stage} />}
      {holdingToy && <ToyBall />}
    </Animated.View>
  );
}

function Treat({ progress, stage }: { progress: Animated.Value; stage: GrowthStage }) {
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-92, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [38, 0] });
  return (
    <Animated.View
      style={[
        styles.treat,
        awakeStages[stage].treat,
        { transform: [{ translateX }, { translateY }] },
      ]}
      accessibilityLabel={`A pixel treat is traveling to ${stageLabel[stage]} Jack's mouth`}
    />
  );
}

function SleepingJack({ stage }: { stage: GrowthStage }) {
  return (
    <View style={[styles.sleepDog, sleepStages[stage]]} accessibilityLabel="Jack lying asleep inside his bed">
      <View style={[styles.pixel, styles.sleepTail]} />
      <View style={[styles.pixel, styles.sleepBody]} />
      <View style={[styles.pixel, styles.sleepHead]} />
      <View style={[styles.pixel, styles.sleepEar]} />
      <View style={[styles.pixel, styles.sleepMuzzle]} />
      <View style={[styles.pixel, styles.sleepEyeLeft]} />
      <View style={[styles.pixel, styles.sleepEyeRight]} />
      <View style={[styles.pixel, styles.sleepNose]} />
      <View style={[styles.pixel, styles.sleepPawLeft]} />
      <View style={[styles.pixel, styles.sleepPawRight]} />
      <View style={styles.sleepCollar} />
    </View>
  );
}

function ToyBall() {
  return (
    <View style={[styles.pixel, styles.toy]} accessibilityLabel="Jack's red pixel ball">
      <View style={styles.toyStripe} />
      <View style={styles.toyDot} />
    </View>
  );
}

const awakeStages: Record<GrowthStage, Record<string, object>> = {
  baby: {
    dog: { width: 124, height: 142, top: 103, marginLeft: -62 },
    ear: { width: 31, height: 48, top: 12 },
    head: { width: 84, height: 70, top: 37, left: 20 },
    muzzle: { width: 43, height: 27, top: 77, left: 41 },
    eye: { top: 61, width: 9, height: 12 },
    nose: { width: 14, height: 9 },
    noseTarget: { top: 64, left: 42 },
    smile: { top: 94, left: 48 },
    body: { width: 83, height: 45, top: 101, left: 20 },
    chest: { width: 25, height: 32, top: 110, left: 50 },
    leg: { width: 21, height: 25, bottom: 0 },
    tail: { width: 39, height: 17, top: 112 },
    collar: { width: 62, height: 10, top: 99, left: 31 },
    mouth: { width: 24, height: 7, top: 91, left: 50 },
    treat: { top: 84, left: 52 },
  },
  "little-puppy": {
    dog: { width: 144, height: 157, top: 88, marginLeft: -72 },
    ear: { width: 36, height: 55 },
    head: { width: 96, height: 80, top: 34, left: 24 },
    muzzle: { width: 50, height: 31, top: 80, left: 47 },
    eye: { top: 62, width: 10, height: 14 },
    nose: { width: 16, height: 10 },
    noseTarget: { top: 67, left: 51 },
    smile: { top: 99, left: 58 },
    body: { width: 95, height: 53, top: 108, left: 24 },
    chest: { width: 29, height: 38, top: 118, left: 58 },
    leg: { width: 24, height: 29, bottom: 0 },
    tail: { width: 46, height: 19, top: 123 },
    collar: { width: 70, height: 10, top: 105, left: 37 },
    mouth: { width: 27, height: 8, top: 95, left: 57 },
    treat: { top: 89, left: 60 },
  },
  puppy: {
    dog: { width: 160, height: 171, top: 75, marginLeft: -80 },
    ear: { width: 40, height: 61 },
    head: { width: 106, height: 89, top: 34, left: 27 },
    muzzle: { width: 55, height: 34, top: 84, left: 53 },
    eye: { top: 65, width: 11, height: 16 },
    nose: { width: 18, height: 11 },
    noseTarget: { top: 70, left: 57 },
    smile: { top: 104, left: 65 },
    body: { width: 105, height: 58, top: 116, left: 28 },
    chest: { width: 32, height: 43, top: 127, left: 64 },
    leg: { width: 27, height: 32, bottom: 0 },
    tail: { width: 51, height: 21, top: 132 },
    collar: { width: 78, height: 11, top: 113, left: 41 },
    mouth: { width: 30, height: 8, top: 100, left: 64 },
    treat: { top: 94, left: 68 },
  },
  "young-dog": {
    dog: { width: 177, height: 186, top: 61, marginLeft: -88 },
    ear: { width: 45, height: 68 },
    head: { width: 118, height: 98, top: 30, left: 29 },
    muzzle: { width: 62, height: 38, top: 90, left: 58 },
    eye: { top: 68, width: 12, height: 17 },
    nose: { width: 19, height: 12 },
    noseTarget: { top: 76, left: 64 },
    smile: { top: 112, left: 73 },
    body: { width: 121, height: 66, top: 123, left: 28 },
    chest: { width: 38, height: 51, top: 135, left: 70 },
    leg: { width: 31, height: 37, bottom: 0 },
    tail: { width: 60, height: 24, top: 142 },
    collar: { width: 86, height: 12, top: 120, left: 46 },
    mouth: { width: 34, height: 9, top: 107, left: 72 },
    treat: { top: 101, left: 77 },
  },
  adult: {
    dog: { width: 196, height: 202, top: 46, marginLeft: -98 },
    ear: { width: 50, height: 77, top: 4 },
    head: { width: 132, height: 108, top: 28, left: 32 },
    muzzle: { width: 70, height: 42, top: 100, left: 65 },
    eye: { top: 74, width: 13, height: 19 },
    nose: { width: 21, height: 13 },
    noseTarget: { top: 86, left: 71 },
    smile: { top: 123, left: 82 },
    body: { width: 142, height: 76, top: 133, left: 27, borderRadius: 18 },
    chest: { width: 45, height: 59, top: 146, left: 78 },
    leg: { width: 35, height: 43, bottom: 0 },
    tail: { width: 70, height: 28, top: 153, right: -13 },
    collar: { width: 98, height: 13, top: 129, left: 49 },
    mouth: { width: 39, height: 10, top: 118, left: 82 },
    treat: { top: 112, left: 89 },
  },
};

const sleepStages: Record<GrowthStage, object> = {
  baby: { width: 150, height: 100, top: 145, marginLeft: -75 },
  "little-puppy": { width: 168, height: 108, top: 137, marginLeft: -84 },
  puppy: { width: 186, height: 116, top: 129, marginLeft: -93 },
  "young-dog": { width: 208, height: 126, top: 119, marginLeft: -104 },
  adult: { width: 232, height: 136, top: 108, marginLeft: -116 },
};

const outline = "#3a4850";
const fur = "#ffffff";

const styles = StyleSheet.create({
  scene: {
    height: 304,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 5,
    borderColor: outline,
    position: "relative",
  },
  sceneLarge: { height: 440 },
  window: {
    position: "absolute",
    width: "40%",
    height: 105,
    left: "8%",
    top: 28,
    borderWidth: 6,
    borderColor: outline,
  },
  curtain: { position: "absolute", width: "11%", height: 126, top: 18 },
  curtainLeft: { left: "5%" },
  curtainRight: { left: "41%" },
  floor: { position: "absolute", left: 0, right: 0, bottom: 0, height: "32%" },
  lampStem: { position: "absolute", width: 8, height: 96, right: "34%", bottom: "25%", backgroundColor: outline },
  lampShade: { position: "absolute", width: 72, height: 46, right: "25%", bottom: "53%", borderRadius: 12, backgroundColor: "#ffdf8a" },
  lampNight: { backgroundColor: "#ffe7a6" },
  bed: { position: "absolute", width: 132, height: 47, right: 18, bottom: 22, borderRadius: 18 },
  bedLarge: { width: 170, height: 62, right: 34, bottom: 30 },
  bedCushion: { position: "absolute", width: "72%", height: 32, left: "14%", top: -17, borderRadius: 999 },
  clock: { position: "absolute", right: 15, top: 14, minWidth: 135, minHeight: 54, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: outline, borderRadius: 8, backgroundColor: "#ffd59b" },
  clockNight: { backgroundColor: "#243660" },
  clockText: { fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 19, fontWeight: "900", letterSpacing: 1, color: "#27444c" },
  clockTextNight: { color: "#ffffff" },
  dogLayer: { position: "absolute", left: 0, right: 0, bottom: 0, height: 304 },
  dog: { position: "absolute", left: "48%" },
  sleepDog: { position: "absolute", left: "76%" },
  pixel: { position: "absolute" },
  earLeft: { left: 18, backgroundColor: fur, borderWidth: 5, borderColor: outline },
  earRight: { right: 18, backgroundColor: fur, borderWidth: 5, borderColor: outline },
  head: { backgroundColor: fur, borderWidth: 6, borderColor: outline, borderRadius: 12 },
  muzzle: { backgroundColor: fur, borderWidth: 4, borderColor: outline },
  eyeLeft: { left: "33%", backgroundColor: "#24313b" },
  eyeRight: { right: "33%", backgroundColor: "#24313b" },
  droopyEye: { height: 10, borderBottomWidth: 4, borderColor: "#24313b", backgroundColor: "transparent" },
  smile: { width: 28, height: 7, borderBottomWidth: 4, borderColor: "#b75b5a", borderRadius: 8, zIndex: 9 },
  mouthOpen: { backgroundColor: "#24313b", borderWidth: 2, borderColor: outline, borderRadius: 5, zIndex: 10 },
  noseTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", zIndex: 12 },
  nose: { backgroundColor: "#24313b" },
  body: { backgroundColor: fur, borderWidth: 6, borderColor: outline, borderRadius: 10, zIndex: 2 },
  chest: { backgroundColor: fur, zIndex: 3 },
  legLeft: { left: "24%", backgroundColor: fur, borderWidth: 5, borderColor: outline, zIndex: 2 },
  legRight: { right: "24%", backgroundColor: fur, borderWidth: 5, borderColor: outline, zIndex: 2 },
  tail: { right: -4, backgroundColor: fur, borderWidth: 5, borderColor: outline, zIndex: 0 },
  collar: { backgroundColor: "#2f76c7", borderWidth: 3, borderColor: outline, borderRadius: 999, zIndex: 8 },
  xEyes: { position: "absolute", left: "30%", color: "#24313b", fontWeight: "900", fontSize: 20, zIndex: 11 },
  sleepTail: { width: "28%", height: "34%", top: "10%", right: "1%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 50 },
  sleepBody: { width: "66%", height: "55%", top: "29%", left: "29%", backgroundColor: fur, borderWidth: 6, borderColor: outline, borderRadius: 60 },
  sleepHead: { width: "41%", height: "58%", top: "24%", left: "3%", backgroundColor: fur, borderWidth: 6, borderColor: outline, borderRadius: 28 },
  sleepEar: { width: "19%", height: "37%", top: "12%", left: "12%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 18 },
  sleepMuzzle: { width: "25%", height: "26%", top: "54%", left: "8%", backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 14 },
  sleepEyeLeft: { width: "9%", height: 4, top: "49%", left: "14%", backgroundColor: "#24313b" },
  sleepEyeRight: { width: "9%", height: 4, top: "49%", left: "28%", backgroundColor: "#24313b" },
  sleepNose: { width: "10%", height: "10%", top: "60%", left: "18%", backgroundColor: "#24313b" },
  sleepPawLeft: { width: "23%", height: "20%", top: "67%", left: "43%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 18 },
  sleepPawRight: { width: "23%", height: "20%", top: "67%", right: "5%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 18 },
  sleepCollar: { position: "absolute", width: "27%", height: 9, top: "67%", left: "20%", borderRadius: 999, backgroundColor: "#2f76c7", borderWidth: 2, borderColor: outline },
  toy: { width: 25, height: 25, left: "45%", top: "53%", backgroundColor: "#e86358", borderWidth: 4, borderColor: outline, borderRadius: 13, overflow: "hidden", zIndex: 14 },
  toyStripe: { position: "absolute", width: "100%", height: 5, top: 8, backgroundColor: "#ffd36f" },
  toyDot: { position: "absolute", width: 5, height: 5, left: 8, top: 4, backgroundColor: fur },
  stageNote: { position: "absolute", left: 14, bottom: 9, color: "#60767c", fontSize: 11, fontWeight: "800" },
  deadNote: { position: "absolute", left: "40%", top: "47%", color: "#b94747", fontSize: 12, fontWeight: "900" },
  zs: { position: "absolute", left: "63%", top: "42%", color: outline, fontWeight: "900", fontSize: 24 },
  woof: { position: "absolute", left: "67%", top: "48%", color: "#ef7659", fontSize: 17, fontWeight: "900" },
  hearts: { position: "absolute", left: "65%", top: "34%", color: "#ef7659", fontSize: 20, fontWeight: "900" },
  zoomies: { position: "absolute", left: "60%", bottom: 72, color: "#ef7659", fontSize: 16, fontWeight: "900" },
  sparkles: { position: "absolute", left: "62%", top: "40%", color: "#ffffff", fontSize: 24, fontWeight: "900" },
  yawn: { position: "absolute", left: 18, bottom: 72, color: outline, fontSize: 15, fontWeight: "900" },
  treat: { position: "absolute", width: 18, height: 13, borderWidth: 3, borderColor: outline, backgroundColor: "#d99047", borderRadius: 3, zIndex: 15 },
  dirtFx: { position: "absolute", left: "31%", bottom: 54, width: 180, height: 150 },
  dust: { color: "#cba37c", fontSize: 26, fontWeight: "900", textAlign: "center" },
  mud: { position: "absolute", width: 34, height: 18, borderRadius: 5, backgroundColor: "#76513e", opacity: 0.86 },
  mudOne: { left: 56, top: 67 },
  mudTwo: { left: 102, top: 96 },
  stink: { color: "#76513e", fontSize: 15, fontWeight: "900", textAlign: "center", marginTop: 12 },
  cleaningFx: { position: "absolute", left: "28%", bottom: 55, width: 200, height: 210, alignItems: "center" },
  showerHead: { color: outline, fontSize: 31, fontWeight: "900" },
  water: { color: "#2f76c7", fontSize: 22, lineHeight: 25, textAlign: "center" },
  washout: { color: "#76513e", fontSize: 16, fontWeight: "900", marginTop: 32 },
  shake: { color: "#27444c", fontSize: 20, fontWeight: "900", marginTop: 48 },
  cleanSparkle: { color: "#ffffff", fontSize: 20, fontWeight: "900", marginTop: 44 },
  mini: { width: 126, height: 130, position: "relative" },
  miniTail: { position: "absolute", width: 38, height: 16, left: 8, top: 78, borderWidth: 4, borderColor: outline, transform: [{ rotate: "28deg" }] },
  miniBody: { position: "absolute", width: 78, height: 58, left: 38, top: 62, borderWidth: 4, borderColor: outline, borderRadius: 15 },
  miniHead: { position: "absolute", width: 62, height: 58, left: 48, top: 26, borderWidth: 4, borderColor: outline, borderRadius: 14 },
  miniEar: { position: "absolute", width: 20, height: 36, left: 38, top: 38, borderWidth: 4, borderColor: outline, borderRadius: 8 },
  miniCollar: { position: "absolute", width: 68, height: 10, left: 43, top: 78, borderWidth: 3, borderColor: outline, borderRadius: 999, backgroundColor: "#2f76c7" },
  miniEye: { position: "absolute", width: 7, height: 7, left: 91, top: 44, backgroundColor: outline },
  miniNose: { position: "absolute", width: 10, height: 7, left: 106, top: 59, backgroundColor: outline },
  miniLocked: { position: "absolute", left: 36, top: 72, color: outline, fontSize: 12, fontWeight: "900" },
});
