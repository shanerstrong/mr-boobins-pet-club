import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getLcdSemanticLabel,
  getLcdStatusTreatment,
  LCD_ACTIVITY_TREATMENTS,
  resolveLcdFrameIndex,
  type LcdJackPose,
} from "./lcd-presentation-policy";
import type { PetPresentationModel } from "./pet-presentation-model";

type QuietCareMonitorProps = {
  model: PetPresentationModel;
  boopDisabled: boolean;
  boopStatus: string;
  onBoop: () => void;
  large?: boolean;
};

const CELERY = "#d9e5a8";
const CELERY_DARK = "#bdcd82";
const INK = "#24352e";
const MOSS = "#617246";
const WARNING = "#7b313d";
const CASING = "#303634";

export function QuietCareMonitor({
  model,
  boopDisabled,
  boopStatus,
  onBoop,
  large = false,
}: QuietCareMonitorProps) {
  const [tick, setTick] = useState(0);
  const treatment = LCD_ACTIVITY_TREATMENTS[model.activity];
  const frameIndex = resolveLcdFrameIndex({
    activity: model.activity,
    reducedMotion: model.reducedMotion,
    tick,
  });
  const status = getLcdStatusTreatment(model);

  useEffect(() => {
    if (model.reducedMotion) return;
    const timer = setInterval(() => setTick((current) => current + 1), 460);
    return () => clearInterval(timer);
  }, [model.activity, model.reducedMotion]);

  return (
    <View
      accessible
      accessibilityLabel={getLcdSemanticLabel(model)}
      style={[styles.casing, large && styles.casingLarge]}
    >
      <View style={styles.casingTop}>
        <Text style={styles.casingBrand}>QUIET CARE MONITOR</Text>
        <Text style={styles.casingMode}>LCD • PROVISIONAL</Text>
      </View>
      <View style={styles.lcd}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBand, status.warning && styles.statusBandWarning]}>
            <Text style={[styles.statusIcon, status.warning && styles.statusWarningText]}>
              {status.icon}
            </Text>
            <Text style={[styles.statusLabel, status.warning && styles.statusWarningText]}>
              {status.label}
            </Text>
            <Text style={[styles.statusPattern, status.warning && styles.statusWarningText]}>
              {status.pattern}
            </Text>
          </View>
          <View style={styles.clockBlock}>
            <Text style={styles.clockText}>DAY {model.clock.day}</Text>
            <Text style={styles.clockText}>{model.clock.label}</Text>
          </View>
        </View>

        <View style={styles.stage}>
          <View style={styles.activityBlock}>
            <Text style={styles.activityIcon}>{treatment.icon}</Text>
            <Text style={styles.activityLabel}>{treatment.label}</Text>
            <Text style={styles.activityPattern}>{treatment.pattern}</Text>
          </View>
          <LcdJack
            frameIndex={frameIndex}
            pose={treatment.pose}
            boopDisabled={boopDisabled}
            boopStatus={boopStatus}
            name={model.name}
            onBoop={onBoop}
          />
          <View style={styles.recommendationBlock}>
            <Text style={styles.recommendationEyebrow}>
              NEXT • {model.recommendation.label.toUpperCase()}
            </Text>
            <Text numberOfLines={2} style={styles.recommendationText}>
              {model.recommendation.message}
            </Text>
          </View>
        </View>

        <View accessibilityLabel="All six pet needs" style={styles.needRail}>
          {model.needs.map((need) => (
            <View
              key={need.key}
              accessible
              accessibilityLabel={`${need.label} ${Math.round(need.value)} percent${
                need.warning ? ", needs attention" : ""
              }`}
              style={[styles.needItem, need.warning && styles.needItemWarning]}
            >
              <View style={styles.needLabelRow}>
                <Text style={[styles.needLabel, need.warning && styles.warningInk]}>
                  {need.warning ? "! " : ""}{need.shortLabel}
                </Text>
                <Text style={[styles.needValue, need.warning && styles.warningInk]}>
                  {Math.round(need.value)}
                </Text>
              </View>
              <View style={styles.segments}>
                {[20, 40, 60, 80, 100].map((threshold) => (
                  <View
                    key={threshold}
                    style={[
                      styles.segment,
                      need.value >= threshold && styles.segmentFilled,
                      need.warning && need.value >= threshold && styles.segmentWarning,
                    ]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function LcdJack({
  frameIndex,
  pose,
  boopDisabled,
  boopStatus,
  name,
  onBoop,
}: {
  frameIndex: number;
  pose: LcdJackPose;
  boopDisabled: boolean;
  boopStatus: string;
  name: string;
  onBoop: () => void;
}) {
  const curled = pose === "curl" || pose === "rest";
  const droop = pose === "droop";
  const upright = pose === "train" || pose === "reward";
  const lowered = pose === "eat" || pose === "wash";
  const medicine = pose === "medicine";
  const playful = pose === "play" || pose === "reward";

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.jackStage,
        frameIndex === 1 && !curled && styles.jackStageFrameOne,
        frameIndex === 2 && styles.jackStageFrameTwo,
        upright && styles.jackStageUpright,
        lowered && styles.jackStageLowered,
      ]}
    >
      <View
        style={[
          styles.tail,
          curled && styles.tailCurled,
          droop && styles.tailDroop,
          playful && frameIndex % 2 === 1 && styles.tailPlay,
        ]}
      />
      <View style={[styles.body, curled && styles.bodyCurled, upright && styles.bodyUpright]} />
      <View style={[styles.leg, styles.legBack, curled && styles.legCurled]} />
      <View style={[styles.leg, styles.legFront, curled && styles.legCurled]} />
      <View
        style={[
          styles.head,
          curled && styles.headCurled,
          droop && styles.headDroop,
          lowered && styles.headLowered,
          upright && styles.headUpright,
        ]}
      />
      <View style={[styles.ear, styles.earLeft, droop && styles.earDroop]} />
      <View style={[styles.ear, styles.earRight, droop && styles.earDroop]} />
      <View style={[styles.muzzle, lowered && styles.muzzleLowered]} />
      <View style={styles.eye} />
      <View style={styles.collar} />
      {pose === "eat" && <Text style={styles.poseGlyph}>◆ ◆</Text>}
      {pose === "wash" && <Text style={styles.poseGlyph}>│✦│</Text>}
      {pose === "train" && <Text style={styles.poseGlyph}>↑ PAW</Text>}
      {pose === "reward" && <Text style={styles.poseGlyph}>★</Text>}
      {pose === "medicine" && <Text style={styles.medicineGlyph}>+</Text>}
      {pose === "rest" && <Text style={styles.restGlyph}>◇</Text>}
      {pose === "curl" && <Text style={styles.sleepGlyph}>Zz</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          boopDisabled
            ? `Boop ${name}'s LCD snoot. ${boopStatus}`
            : `Boop ${name}'s LCD snoot`
        }
        accessibilityState={{ disabled: boopDisabled }}
        disabled={boopDisabled}
        hitSlop={6}
        onPress={onBoop}
        style={({ pressed }) => [
          styles.noseTarget,
          pressed && !boopDisabled && styles.noseTargetPressed,
          boopDisabled && styles.noseTargetDisabled,
        ]}
      >
        <View style={styles.nose} />
      </Pressable>
      {medicine && <View style={styles.medicinePulse} />}
    </View>
  );
}

const styles = StyleSheet.create({
  casing: {
    height: 390,
    padding: 10,
    gap: 7,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 5,
    borderColor: "#202624",
    backgroundColor: CASING,
  },
  casingLarge: { height: 460, padding: 14, gap: 9 },
  casingTop: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 4,
  },
  casingBrand: { color: "#f1eadb", fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 0.8 },
  casingMode: { color: "#b9c99a", fontSize: 10, lineHeight: 14, fontWeight: "800" },
  lcd: {
    flex: 1,
    gap: 7,
    padding: 9,
    borderWidth: 4,
    borderColor: "#151d19",
    borderRadius: 15,
    backgroundColor: CELERY,
  },
  statusRow: { minHeight: 36, flexDirection: "row", alignItems: "stretch", gap: 7 },
  statusBand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: CELERY_DARK,
  },
  statusBandWarning: { borderColor: WARNING, backgroundColor: "#d9c4a0" },
  statusIcon: { color: INK, fontSize: 15, lineHeight: 18, fontWeight: "900" },
  statusLabel: { flex: 1, color: INK, fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 0.4 },
  statusPattern: { color: MOSS, fontSize: 11, lineHeight: 15, fontWeight: "900" },
  statusWarningText: { color: WARNING },
  clockBlock: { minWidth: 78, alignItems: "flex-end", justifyContent: "center", borderLeftWidth: 2, borderLeftColor: INK, paddingLeft: 7 },
  clockText: { color: INK, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  stage: { flex: 1, minHeight: 185, position: "relative", borderWidth: 2, borderColor: MOSS, overflow: "hidden" },
  activityBlock: { position: "absolute", left: 7, top: 6, maxWidth: 104, zIndex: 4 },
  activityIcon: { color: INK, fontSize: 20, lineHeight: 22, fontWeight: "900" },
  activityLabel: { color: INK, fontSize: 11, lineHeight: 14, fontWeight: "900", letterSpacing: 0.4 },
  activityPattern: { color: MOSS, fontSize: 10, lineHeight: 13, fontWeight: "900" },
  recommendationBlock: { position: "absolute", left: 7, right: 7, bottom: 5, minHeight: 38, paddingHorizontal: 7, paddingVertical: 4, borderTopWidth: 2, borderTopColor: MOSS, backgroundColor: "rgba(217,229,168,0.94)" },
  recommendationEyebrow: { color: MOSS, fontSize: 9, lineHeight: 11, fontWeight: "900", letterSpacing: 0.4 },
  recommendationText: { color: INK, fontSize: 10, lineHeight: 13, fontWeight: "800" },
  jackStage: { position: "absolute", width: 190, height: 132, right: 5, top: 22 },
  jackStageFrameOne: { transform: [{ translateY: -3 }] },
  jackStageFrameTwo: { transform: [{ translateX: 3 }] },
  jackStageUpright: { transform: [{ translateY: -8 }] },
  jackStageLowered: { transform: [{ translateY: 5 }] },
  tail: { position: "absolute", width: 47, height: 13, left: 7, top: 62, borderWidth: 5, borderColor: INK, borderRadius: 2, backgroundColor: CELERY, transform: [{ rotate: "-25deg" }] },
  tailCurled: { left: 23, top: 55, transform: [{ rotate: "25deg" }] },
  tailDroop: { top: 82, transform: [{ rotate: "28deg" }] },
  tailPlay: { transform: [{ rotate: "18deg" }] },
  body: { position: "absolute", width: 91, height: 52, left: 48, top: 57, borderWidth: 6, borderColor: INK, borderRadius: 8, backgroundColor: CELERY_DARK },
  bodyCurled: { width: 102, height: 48, left: 41, top: 70, borderRadius: 28 },
  bodyUpright: { width: 63, height: 70, left: 74, top: 44 },
  leg: { position: "absolute", width: 16, height: 32, top: 95, borderWidth: 5, borderColor: INK, backgroundColor: CELERY_DARK },
  legBack: { left: 59 },
  legFront: { left: 116 },
  legCurled: { width: 29, height: 13, top: 105 },
  head: { position: "absolute", width: 62, height: 55, right: 5, top: 36, borderWidth: 6, borderColor: INK, borderRadius: 8, backgroundColor: CELERY_DARK },
  headCurled: { right: 12, top: 70 },
  headDroop: { top: 59, transform: [{ rotate: "10deg" }] },
  headLowered: { top: 66, transform: [{ rotate: "9deg" }] },
  headUpright: { top: 22 },
  ear: { position: "absolute", width: 20, height: 35, top: 29, borderWidth: 5, borderColor: INK, backgroundColor: CELERY_DARK, zIndex: -1 },
  earLeft: { right: 48, transform: [{ rotate: "-18deg" }] },
  earRight: { right: 1, transform: [{ rotate: "16deg" }] },
  earDroop: { top: 47, height: 42 },
  muzzle: { position: "absolute", width: 34, height: 22, right: -2, top: 65, borderWidth: 5, borderColor: INK, backgroundColor: CELERY_DARK },
  muzzleLowered: { top: 91 },
  eye: { position: "absolute", width: 7, height: 7, right: 33, top: 55, backgroundColor: INK },
  collar: { position: "absolute", width: 11, height: 47, right: 55, top: 61, borderWidth: 3, borderColor: INK, backgroundColor: MOSS },
  poseGlyph: { position: "absolute", left: 10, top: 14, color: MOSS, fontSize: 17, lineHeight: 20, fontWeight: "900" },
  medicineGlyph: { position: "absolute", left: 23, top: 26, color: WARNING, fontSize: 28, lineHeight: 31, fontWeight: "900" },
  medicinePulse: { position: "absolute", left: 15, top: 20, width: 42, height: 42, borderWidth: 3, borderColor: WARNING, borderRadius: 999 },
  restGlyph: { position: "absolute", left: 19, top: 34, color: MOSS, fontSize: 25, lineHeight: 28, fontWeight: "900" },
  sleepGlyph: { position: "absolute", left: 20, top: 23, color: MOSS, fontSize: 19, lineHeight: 22, fontWeight: "900" },
  noseTarget: { position: "absolute", right: -8, top: 54, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent", borderRadius: 4, zIndex: 8 },
  noseTargetPressed: { borderColor: WARNING, backgroundColor: "rgba(123,49,61,0.16)" },
  noseTargetDisabled: { opacity: 0.5 },
  nose: { width: 13, height: 9, backgroundColor: INK },
  needRail: { minHeight: 84, flexDirection: "row", flexWrap: "wrap", gap: 5 },
  needItem: { flexGrow: 1, flexBasis: "30%", minWidth: 86, minHeight: 39, paddingHorizontal: 5, paddingVertical: 3, borderWidth: 1, borderColor: MOSS, backgroundColor: "rgba(189,205,130,0.48)" },
  needItemWarning: { borderWidth: 2, borderColor: WARNING, backgroundColor: "#d9c4a0" },
  needLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  needLabel: { color: INK, fontSize: 9, lineHeight: 12, fontWeight: "900" },
  needValue: { color: INK, fontSize: 9, lineHeight: 12, fontWeight: "900" },
  warningInk: { color: WARNING },
  segments: { flexDirection: "row", gap: 2, marginTop: 3 },
  segment: { flex: 1, height: 6, borderWidth: 1, borderColor: MOSS, backgroundColor: "transparent" },
  segmentFilled: { backgroundColor: INK },
  segmentWarning: { backgroundColor: WARNING, borderColor: WARNING },
});
