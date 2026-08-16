import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type {
  CleaningPhase,
  Daypart,
  GrowthStage,
  HygieneAppearance,
  RoomTheme,
} from "./simulation";
import type {
  TrainingCelebration,
  TrainingCommand,
} from "./training-policy";

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

export type TrainingVisualAction =
  | TrainingCommand
  | TrainingCelebration
  | "eating"
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
  trainingAction: TrainingVisualAction;
  trainingProgress: Animated.Value;
  trainingTreatProgress: Animated.Value;
  trainingTreatVisible: boolean;
  trainingModeOpen: boolean;
  hideDog?: boolean;
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
  trainingAction,
  trainingProgress,
  trainingTreatProgress,
  trainingTreatVisible,
  trainingModeOpen,
  hideDog = false,
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
  const comfortable =
    emote === "happy" ||
    emote === "fed" ||
    emote === "bark" ||
    trainingAction === "happy-hop" ||
    trainingAction === "spin-wag" ||
    trainingAction === "goofy-shimmy";

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
      <View style={[styles.rug, roomTheme === "blue" && styles.rugBlue, roomTheme === "garden" && styles.rugGarden]} />
      <View style={styles.lampStem} />
      <View style={[styles.lampShade, daypart === "night" && styles.lampNight]} />
      <View style={[styles.bed, { backgroundColor: colors.bed }, large && styles.bedLarge]}>
        <View style={[styles.bedCushion, { backgroundColor: colors.bed }]} />
      </View>
      {!hideDog && (
        <View
          accessibilityLabel={`Virtual pet clock ${clockLabel}`}
          style={[styles.clock, daypart === "night" && styles.clockNight]}
        >
          <Text style={[styles.clockText, daypart === "night" && styles.clockTextNight]}>
            {clockLabel}
          </Text>
        </View>
      )}
      {!hideDog && (
        <View
          style={[
            styles.dogLayer,
            large && styles.dogLayerLarge,
            trainingModeOpen && !large && styles.dogLayerTraining,
            { pointerEvents: "box-none" },
          ]}
        >
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
              trainingAction={trainingAction}
              trainingProgress={trainingProgress}
              trainingTreatProgress={trainingTreatProgress}
              trainingTreatVisible={trainingTreatVisible}
            />
          )}
        </View>
      )}
      {!hideDog && sleeping && (
        <View
          style={[
            styles.bedFront,
            { backgroundColor: colors.bed },
            large && styles.bedFrontLarge,
          ]}
        />
      )}
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
      {!dead && trainingAction === "sit" && <Text style={styles.trainingCallout}>SIT! ✓</Text>}
      {!dead && trainingAction === "paw" && <Text style={styles.trainingCallout}>PAW! ✓</Text>}
      {!dead && trainingAction === "up" && <Text style={styles.trainingCallout}>UP! ✓</Text>}
      {!dead && trainingAction === "eating" && <Text style={styles.trainingCallout}>CRUNCH!</Text>}
      {!dead && trainingAction === "happy-hop" && <Text style={styles.celebrationCallout}>HAPPY HOP! ★</Text>}
      {!dead && trainingAction === "spin-wag" && <Text style={styles.celebrationCallout}>SPIN + WAG! ★</Text>}
      {!dead && trainingAction === "goofy-shimmy" && <Text style={styles.celebrationCallout}>GOOFY SHIMMY! ★</Text>}
      {!hideDog && (
        <Text style={styles.stageNote}>
          {dead ? "STORY ENDED" : sleeping ? "SLEEPING IN BED" : stageLabel[stage]}
        </Text>
      )}
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
      <View style={[styles.miniEar, styles.miniEarLeft, { backgroundColor: fur }]} />
      <View style={[styles.miniEar, styles.miniEarRight, { backgroundColor: fur }]} />
      {!locked && <View style={styles.miniCollar} />}
      {!locked && <View style={styles.miniTag} />}
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
  trainingAction,
  trainingProgress,
  trainingTreatProgress,
  trainingTreatVisible,
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
  trainingAction: TrainingVisualAction;
  trainingProgress: Animated.Value;
  trainingTreatProgress: Animated.Value;
  trainingTreatVisible: boolean;
}) {
  const size = awakeStages[stage];
  const trainingTranslateX = trainingProgress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange:
      trainingAction === "goofy-shimmy"
        ? [0, -15, 15, -15, 0]
        : trainingAction === "spin-wag"
          ? [0, 8, 0, -8, 0]
          : [0, 0, 0, 0, 0],
  });
  const trainingTranslateY = trainingProgress.interpolate({
    inputRange: [0, 0.28, 0.55, 0.78, 1],
    outputRange:
      trainingAction === "happy-hop"
        ? [0, -38, 0, -13, 0]
        : trainingAction === "eating"
          ? [0, 5, 0, 4, 0]
          : trainingAction === "sit" || trainingAction === "paw"
            ? [0, 4, 8, 12, 14]
            : trainingAction === "up"
              ? [0, -7, -14, -20, -22]
              : [0, 0, 0, 0, 0],
  });
  const trainingRotate = trainingProgress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange:
      trainingAction === "spin-wag"
        ? ["0deg", "90deg", "180deg", "270deg", "360deg"]
        : trainingAction === "goofy-shimmy"
          ? ["0deg", "-7deg", "7deg", "-7deg", "0deg"]
          : trainingAction === "up"
            ? ["0deg", "-2deg", "-4deg", "-6deg", "-6deg"]
            : trainingAction === "paw"
              ? ["0deg", "-1deg", "-2deg", "-3deg", "-3deg"]
              : ["0deg", "0deg", "0deg", "0deg", "0deg"],
  });
  const trainingScaleY = trainingProgress.interpolate({
    inputRange: [0, 1],
    outputRange:
      trainingAction === "sit" || trainingAction === "paw"
        ? [1, 0.9]
        : trainingAction === "up"
          ? [1, 1.1]
          : [1, 1],
  });
  const pawLift = trainingProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, -12, -25],
  });
  return (
    <Animated.View
      style={[
        styles.dog,
        size.dog,
        {
          transform: [
            { translateX: run },
            { translateX: trainingTranslateX },
            { translateY: bob },
            { translateY: trainingTranslateY },
            { rotate: trainingRotate },
            { scale: pulse },
            { scaleY: trainingScaleY },
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
      <View style={[styles.pixel, styles.paw, styles.pawBackFar, size.paw]} />
      <View style={[styles.pixel, styles.paw, styles.pawBack, size.paw]} />
      <View style={[styles.pixel, styles.paw, styles.pawFrontFar, size.paw]} />
      <Animated.View
        style={[
          styles.pixel,
          styles.paw,
          styles.pawFront,
          size.paw,
          (trainingAction === "paw" || trainingAction === "up") && {
            transform: [{ translateY: pawLift }, { rotate: "-16deg" }],
          },
        ]}
      />
      <View style={[styles.pixel, styles.earLeft, size.ear]} />
      <View style={[styles.pixel, styles.earRight, size.ear]} />
      <View style={[styles.pixel, styles.head, size.head]} />
      <View style={[styles.pixel, styles.muzzle, size.muzzle]} />
      <View style={[styles.pixel, styles.collar, size.collar]} />
      <View style={[styles.pixel, styles.collarTag, size.tag]} />
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
          <View style={[styles.pixel, styles.browLeft, tired && styles.sleepyBrow]} />
          <View style={[styles.pixel, styles.browRight, tired && styles.sleepyBrow]} />
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
      {trainingTreatVisible && (
        <TrainingTreat progress={trainingTreatProgress} stage={stage} />
      )}
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

function TrainingTreat({
  progress,
  stage,
}: {
  progress: Animated.Value;
  stage: GrowthStage;
}) {
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-112, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [62, 24, 0],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["-18deg", "20deg"],
  });
  return (
    <Animated.View
      accessibilityLabel="A pixel training treat is traveling to Jack's mouth"
      style={[
        styles.trainingTreat,
        awakeStages[stage].treat,
        { transform: [{ translateX }, { translateY }, { rotate }] },
      ]}
    >
      <View style={styles.trainingTreatDot} />
    </Animated.View>
  );
}

function SleepingJack({ stage }: { stage: GrowthStage }) {
  return (
    <View style={[styles.sleepDog, sleepStages[stage]]} accessibilityLabel="Jack lying asleep inside his bed">
      <View style={[styles.pixel, styles.sleepTail]} />
      <View style={[styles.pixel, styles.sleepBody]} />
      <View style={[styles.pixel, styles.sleepHead]} />
      <View style={[styles.pixel, styles.sleepEar, styles.sleepEarLeft]} />
      <View style={[styles.pixel, styles.sleepEar, styles.sleepEarRight]} />
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
    dog: { width: 150, height: 160, bottom: 34, marginLeft: -75 },
    ear: { width: 34, height: 42, top: 18 },
    head: { width: 92, height: 80, top: 13, left: 42 },
    muzzle: { width: 54, height: 35, top: 58, left: 92 },
    eye: { top: 43, width: 7, height: 9 },
    nose: { width: 15, height: 10 },
    noseTarget: { top: 53, left: 112 },
    smile: { top: 79, left: 105 },
    body: { width: 105, height: 63, top: 88, left: 16 },
    chest: { width: 42, height: 48, top: 94, left: 78 },
    paw: { width: 24, height: 27, bottom: 0 },
    tail: { width: 48, height: 19, top: 102 },
    collar: { width: 72, height: 11, top: 84, left: 54 },
    tag: { width: 12, height: 12, top: 91, left: 85 },
    mouth: { width: 27, height: 8, top: 78, left: 108 },
    treat: { top: 71, left: 116 },
  },
  "little-puppy": {
    dog: { width: 166, height: 176, bottom: 30, marginLeft: -83 },
    ear: { width: 38, height: 47, top: 18 },
    head: { width: 102, height: 88, top: 12, left: 47 },
    muzzle: { width: 59, height: 39, top: 63, left: 102 },
    eye: { top: 46, width: 8, height: 10 },
    nose: { width: 17, height: 11 },
    noseTarget: { top: 58, left: 126 },
    smile: { top: 86, left: 118 },
    body: { width: 117, height: 70, top: 97, left: 17 },
    chest: { width: 47, height: 54, top: 103, left: 87 },
    paw: { width: 27, height: 30, bottom: 0 },
    tail: { width: 53, height: 21, top: 112 },
    collar: { width: 80, height: 12, top: 92, left: 61 },
    tag: { width: 13, height: 13, top: 100, left: 95 },
    mouth: { width: 30, height: 9, top: 85, left: 121 },
    treat: { top: 78, left: 130 },
  },
  puppy: {
    dog: { width: 180, height: 190, bottom: 27, marginLeft: -90 },
    ear: { width: 41, height: 52, top: 18 },
    head: { width: 111, height: 95, top: 10, left: 50 },
    muzzle: { width: 64, height: 42, top: 66, left: 111 },
    eye: { top: 48, width: 9, height: 11 },
    nose: { width: 19, height: 12 },
    noseTarget: { top: 61, left: 138 },
    smile: { top: 91, left: 129 },
    body: { width: 127, height: 76, top: 104, left: 18 },
    chest: { width: 51, height: 58, top: 111, left: 94 },
    paw: { width: 29, height: 33, bottom: 0 },
    tail: { width: 58, height: 23, top: 120 },
    collar: { width: 87, height: 13, top: 98, left: 66 },
    tag: { width: 14, height: 14, top: 107, left: 103 },
    mouth: { width: 33, height: 9, top: 91, left: 132 },
    treat: { top: 83, left: 142 },
  },
  "young-dog": {
    dog: { width: 198, height: 206, bottom: 24, marginLeft: -99 },
    ear: { width: 45, height: 57, top: 18 },
    head: { width: 121, height: 103, top: 8, left: 56 },
    muzzle: { width: 69, height: 46, top: 70, left: 123 },
    eye: { top: 51, width: 10, height: 12 },
    nose: { width: 21, height: 13 },
    noseTarget: { top: 65, left: 151 },
    smile: { top: 97, left: 142 },
    body: { width: 140, height: 82, top: 113, left: 19 },
    chest: { width: 56, height: 64, top: 119, left: 103 },
    paw: { width: 32, height: 36, bottom: 0 },
    tail: { width: 64, height: 25, top: 130 },
    collar: { width: 95, height: 14, top: 106, left: 73 },
    tag: { width: 15, height: 15, top: 116, left: 113 },
    mouth: { width: 36, height: 10, top: 98, left: 145 },
    treat: { top: 90, left: 156 },
  },
  adult: {
    dog: { width: 216, height: 224, bottom: 21, marginLeft: -108 },
    ear: { width: 49, height: 62, top: 18 },
    head: { width: 132, height: 112, top: 6, left: 61 },
    muzzle: { width: 76, height: 50, top: 76, left: 134 },
    eye: { top: 55, width: 11, height: 13 },
    nose: { width: 22, height: 14 },
    noseTarget: { top: 70, left: 165 },
    smile: { top: 105, left: 155 },
    body: { width: 153, height: 89, top: 123, left: 21 },
    chest: { width: 61, height: 69, top: 130, left: 113 },
    paw: { width: 35, height: 39, bottom: 0 },
    tail: { width: 70, height: 27, top: 142 },
    collar: { width: 104, height: 15, top: 115, left: 80 },
    tag: { width: 16, height: 16, top: 126, left: 124 },
    mouth: { width: 40, height: 11, top: 107, left: 159 },
    treat: { top: 98, left: 171 },
  },
};

const sleepStages: Record<GrowthStage, object> = {
  baby: { width: 150, height: 100, bottom: 116, marginLeft: -75 },
  "little-puppy": { width: 168, height: 108, bottom: 112, marginLeft: -84 },
  puppy: { width: 186, height: 116, bottom: 108, marginLeft: -93 },
  "young-dog": { width: 208, height: 126, bottom: 104, marginLeft: -104 },
  adult: { width: 232, height: 136, bottom: 100, marginLeft: -116 },
};

const outline = "#3a4850";
const fur = "#ffffff";

const styles = StyleSheet.create({
  scene: {
    height: 390,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 5,
    borderColor: outline,
    position: "relative",
  },
  sceneLarge: { height: 460 },
  window: {
    position: "absolute",
    width: "37%",
    height: 128,
    right: "7%",
    top: 28,
    borderWidth: 6,
    borderColor: outline,
  },
  curtain: { position: "absolute", width: "11%", height: 148, top: 18 },
  curtainLeft: { right: "38%" },
  curtainRight: { right: "4%" },
  floor: { position: "absolute", left: 0, right: 0, bottom: 0, height: "46%" },
  rug: { position: "absolute", width: "54%", height: "31%", left: "23%", bottom: "5%", borderRadius: 999, backgroundColor: "#dfc39f", borderWidth: 3, borderColor: "rgba(39,68,76,0.28)" },
  rugBlue: { backgroundColor: "#8097b1" },
  rugGarden: { backgroundColor: "#b6cc8a" },
  lampStem: { position: "absolute", width: 8, height: 96, right: "4%", bottom: "24%", backgroundColor: outline },
  lampShade: { position: "absolute", width: 64, height: 43, right: "1%", bottom: "51%", borderRadius: 12, backgroundColor: "#ffdf8a" },
  lampNight: { backgroundColor: "#ffe7a6" },
  bed: { position: "absolute", width: 128, height: 54, left: 14, bottom: 118, borderRadius: 22 },
  bedLarge: { width: 158, height: 66, left: 28, bottom: 132 },
  bedCushion: { position: "absolute", width: "72%", height: 32, left: "14%", top: -17, borderRadius: 999 },
  bedFront: { position: "absolute", width: 128, height: 22, left: 14, bottom: 116, borderRadius: 999, zIndex: 8 },
  bedFrontLarge: { width: 158, height: 25, left: 28, bottom: 130 },
  clock: { position: "absolute", left: "34%", top: 22, minWidth: 96, minHeight: 54, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: outline, borderRadius: 999, backgroundColor: "#ffd59b" },
  clockNight: { backgroundColor: "#243660" },
  clockText: { fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 19, fontWeight: "900", letterSpacing: 1, color: "#27444c" },
  clockTextNight: { color: "#ffffff" },
  dogLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  dogLayerLarge: { transform: [{ scale: 1.15 }] },
  dogLayerTraining: { transform: [{ translateY: -46 }] },
  dog: { position: "absolute", left: "46%" },
  sleepDog: { position: "absolute", left: "23%", zIndex: 6 },
  pixel: { position: "absolute" },
  earLeft: { left: 34, backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 999, transform: [{ rotate: "-20deg" }], zIndex: 1 },
  earRight: { right: 3, backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 999, transform: [{ rotate: "16deg" }], zIndex: 1 },
  head: { backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 999, zIndex: 4 },
  muzzle: { backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 999, zIndex: 6 },
  eyeLeft: { left: "58%", backgroundColor: "#24313b", borderRadius: 999, zIndex: 8 },
  eyeRight: { right: "26%", backgroundColor: "#24313b", borderRadius: 999, zIndex: 8 },
  browLeft: { left: "56%", top: "18%", width: 18, height: 3, borderRadius: 3, backgroundColor: outline, transform: [{ rotate: "7deg" }], zIndex: 8 },
  browRight: { right: "23%", top: "18%", width: 18, height: 3, borderRadius: 3, backgroundColor: outline, transform: [{ rotate: "-7deg" }], zIndex: 8 },
  sleepyBrow: { transform: [{ rotate: "18deg" }] },
  droopyEye: { height: 10, borderBottomWidth: 4, borderColor: "#24313b", backgroundColor: "transparent" },
  smile: { width: 28, height: 7, borderBottomWidth: 4, borderColor: "#b75b5a", borderRadius: 8, zIndex: 9 },
  mouthOpen: { backgroundColor: "#24313b", borderWidth: 2, borderColor: outline, borderRadius: 5, zIndex: 10 },
  noseTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", zIndex: 12 },
  nose: { backgroundColor: "#24313b" },
  body: { backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 999, zIndex: 2 },
  chest: { backgroundColor: fur, borderLeftWidth: 4, borderColor: outline, borderRadius: 999, zIndex: 3 },
  paw: { backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 999, zIndex: 3 },
  pawBackFar: { left: "17%", opacity: 0.9 },
  pawBack: { left: "32%" },
  pawFrontFar: { right: "24%", opacity: 0.9 },
  pawFront: { right: "9%" },
  tail: { left: -7, backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 999, zIndex: 0 },
  collar: { backgroundColor: "#2f76c7", borderWidth: 3, borderColor: outline, borderRadius: 999, zIndex: 8 },
  collarTag: { backgroundColor: "#ffdf8a", borderWidth: 2, borderColor: outline, borderRadius: 999, zIndex: 9 },
  xEyes: { position: "absolute", left: "55%", color: "#24313b", fontWeight: "900", fontSize: 20, zIndex: 11 },
  sleepTail: { width: "28%", height: "34%", top: "10%", right: "1%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 50 },
  sleepBody: { width: "66%", height: "55%", top: "29%", left: "29%", backgroundColor: fur, borderWidth: 6, borderColor: outline, borderRadius: 60 },
  sleepHead: { width: "41%", height: "58%", top: "24%", left: "3%", backgroundColor: fur, borderWidth: 6, borderColor: outline, borderRadius: 28 },
  sleepEar: { width: "19%", height: "37%", top: "12%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 999 },
  sleepEarLeft: { left: "9%", transform: [{ rotate: "-14deg" }] },
  sleepEarRight: { left: "26%", top: "16%", transform: [{ rotate: "12deg" }] },
  sleepMuzzle: { width: "25%", height: "26%", top: "54%", left: "8%", backgroundColor: fur, borderWidth: 4, borderColor: outline, borderRadius: 14 },
  sleepEyeLeft: { width: "9%", height: 4, top: "49%", left: "14%", backgroundColor: "#24313b" },
  sleepEyeRight: { width: "9%", height: 4, top: "49%", left: "28%", backgroundColor: "#24313b" },
  sleepNose: { width: "10%", height: "10%", top: "60%", left: "18%", backgroundColor: "#24313b" },
  sleepPawLeft: { width: "23%", height: "20%", top: "67%", left: "43%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 18 },
  sleepPawRight: { width: "23%", height: "20%", top: "67%", right: "5%", backgroundColor: fur, borderWidth: 5, borderColor: outline, borderRadius: 18 },
  sleepCollar: { position: "absolute", width: "27%", height: 9, top: "67%", left: "20%", borderRadius: 999, backgroundColor: "#2f76c7", borderWidth: 2, borderColor: outline },
  toy: { width: 25, height: 25, left: "68%", top: "42%", backgroundColor: "#e86358", borderWidth: 4, borderColor: outline, borderRadius: 13, overflow: "hidden", zIndex: 14 },
  toyStripe: { position: "absolute", width: "100%", height: 5, top: 8, backgroundColor: "#ffd36f" },
  toyDot: { position: "absolute", width: 5, height: 5, left: 8, top: 4, backgroundColor: fur },
  stageNote: { position: "absolute", left: 14, bottom: 9, color: "#60767c", fontSize: 11, fontWeight: "800" },
  zs: { position: "absolute", left: "63%", top: "42%", color: outline, fontWeight: "900", fontSize: 24 },
  woof: { position: "absolute", left: "67%", top: "48%", color: "#ef7659", fontSize: 17, fontWeight: "900" },
  hearts: { position: "absolute", left: "65%", top: "34%", color: "#ef7659", fontSize: 20, fontWeight: "900" },
  zoomies: { position: "absolute", left: "60%", bottom: 72, color: "#ef7659", fontSize: 16, fontWeight: "900" },
  trainingCallout: { position: "absolute", left: "58%", top: "34%", color: "#5a5688", fontSize: 17, fontWeight: "900", zIndex: 22 },
  celebrationCallout: { position: "absolute", left: "45%", top: "29%", color: "#b9477f", fontSize: 17, fontWeight: "900", zIndex: 22 },
  sparkles: { position: "absolute", left: "62%", top: "40%", color: "#ffffff", fontSize: 24, fontWeight: "900" },
  yawn: { position: "absolute", left: 18, bottom: 72, color: outline, fontSize: 15, fontWeight: "900" },
  treat: { position: "absolute", width: 18, height: 13, borderWidth: 3, borderColor: outline, backgroundColor: "#d99047", borderRadius: 3, zIndex: 15 },
  trainingTreat: { position: "absolute", width: 21, height: 17, borderWidth: 3, borderColor: outline, backgroundColor: "#e6a04d", borderRadius: 4, zIndex: 18 },
  trainingTreatDot: { position: "absolute", width: 4, height: 4, top: 3, left: 4, backgroundColor: "#fff0b8" },
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
  miniBody: { position: "absolute", width: 78, height: 58, left: 34, top: 63, borderWidth: 4, borderColor: outline, borderRadius: 999 },
  miniHead: { position: "absolute", width: 68, height: 60, left: 48, top: 25, borderWidth: 4, borderColor: outline, borderRadius: 999 },
  miniEar: { position: "absolute", width: 23, height: 34, top: 35, borderWidth: 4, borderColor: outline, borderRadius: 999 },
  miniEarLeft: { left: 37, transform: [{ rotate: "-18deg" }] },
  miniEarRight: { right: 2, transform: [{ rotate: "16deg" }] },
  miniCollar: { position: "absolute", width: 68, height: 10, left: 43, top: 78, borderWidth: 3, borderColor: outline, borderRadius: 999, backgroundColor: "#2f76c7" },
  miniTag: { position: "absolute", width: 11, height: 11, left: 73, top: 84, borderWidth: 2, borderColor: outline, borderRadius: 999, backgroundColor: "#ffdf8a" },
  miniEye: { position: "absolute", width: 7, height: 7, left: 91, top: 44, backgroundColor: outline },
  miniNose: { position: "absolute", width: 10, height: 7, left: 106, top: 59, backgroundColor: outline },
  miniLocked: { position: "absolute", left: 36, top: 72, color: outline, fontSize: 12, fontWeight: "900" },
});
