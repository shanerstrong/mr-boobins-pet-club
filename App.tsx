import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import { loadPet, savePet } from "./src/persistence";
import { PixelDog } from "./src/pixel-dog";
import {
  DEFAULT_CLOCK_MULTIPLIER,
  advancePet,
  careForPet,
  createNewPet,
  getLifeStage,
  switchClockRate,
  type CareAction,
  type NeedKey,
  type PetState,
} from "./src/simulation";
type Mode = "loading" | "available" | "invalid" | "unavailable" | "session";
const rates = [1, 12, 60, 360, 3600];
const actionCopy: Record<CareAction, string> = {
  feed: "Snack time! Jack is delighted.",
  play: "Zoomies in the pet room!",
  rest: "Jack curls up for a nap.",
  clean: "Fresh and fluffy!",
};
const needs: Record<NeedKey, { label: string; color: string; tip: string }> = {
  hunger: {
    label: "Hunger",
    color: "#ed7a55",
    tip: "Jack would love a snack.",
  },
  happiness: {
    label: "Happiness",
    color: "#e6ae38",
    tip: "Jack could use some playtime.",
  },
  energy: {
    label: "Energy",
    color: "#7a82ce",
    tip: "Jack is tired and needs sleep.",
  },
  hygiene: {
    label: "Hygiene",
    color: "#4eaf9c",
    tip: "Jack would feel nice and clean.",
  },
};
const interactionNow = () => Date.now();
export default function App() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const [rate, setRate] = useState(DEFAULT_CLOCK_MULTIPLIER);
  const rateRef = useRef(DEFAULT_CLOCK_MULTIPLIER);
  const [muted, setMuted] = useState(true);
  const [reaction, setReaction] = useState("Jack is watching the sunbeams.");
  const [happy, setHappy] = useState(false);
  const happyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduced, setReduced] = useState(false);
  const [, setClock] = useState(() => Date.now());
  const [bob] = useState(() => new Animated.Value(0));
  const [wag] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const happyPlayer = useAudioPlayer(require("./assets/audio/happy.wav"));
  const sleepy = useAudioPlayer(require("./assets/audio/sleepy.wav"));
  const bark = useAudioPlayer(require("./assets/audio/bark.wav"));
  const native = Platform.OS !== "web";
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (v) => alive && setReduced(v),
    );
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void loadPet().then((result) => {
      if (!alive) return;
      const now = Date.now();
      setClock(now);
      if (result.kind === "loaded") {
        setMode("available");
        setPet(advancePet(result.pet, now, DEFAULT_CLOCK_MULTIPLIER));
      } else if (result.kind === "missing") {
        setMode("available");
        setPet(createNewPet(now));
      } else setMode(result.kind);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!pet || mode !== "available") return;
    void savePet(pet).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  }, [pet, mode]);
  useEffect(() => {
    if (reduced) {
      bob.setValue(0);
      wag.setValue(0);
      return;
    }
    const a = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bob, {
            toValue: 1,
            duration: 760,
            useNativeDriver: native,
          }),
          Animated.timing(bob, {
            toValue: 0,
            duration: 760,
            useNativeDriver: native,
          }),
        ]),
        Animated.sequence([
          Animated.timing(wag, {
            toValue: 1,
            duration: 420,
            useNativeDriver: native,
          }),
          Animated.timing(wag, {
            toValue: 0,
            duration: 420,
            useNativeDriver: native,
          }),
        ]),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [bob, wag, reduced, native]);
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setClock(now);
      setPet((current) => current && advancePet(current, now, rateRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    [happyPlayer, sleepy, bark].forEach((player) => {
      player.muted = muted;
      if (muted) player.pause();
    });
  }, [muted, happyPlayer, sleepy, bark]);
  useEffect(
    () => () => {
      if (happyTimer.current) clearTimeout(happyTimer.current);
    },
    [],
  );
  const sound = (kind: "happy" | "sleepy" | "bark") => {
    if (muted) return;
    const player =
      kind === "happy" ? happyPlayer : kind === "sleepy" ? sleepy : bark;
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  };
  const animate = () => {
    if (reduced) return;
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 140,
        useNativeDriver: native,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 220,
        useNativeDriver: native,
      }),
    ]).start();
  };
  const care = (action: CareAction) => {
    const now = interactionNow();
    setClock(now);
    setPet(
      (current) => current && careForPet(current, action, now, rateRef.current),
    );
    setReaction(actionCopy[action]);
    animate();
    sound(action === "rest" ? "sleepy" : "happy");
  };
  const petJack = () => {
    setReaction("Jack wags hard and makes a happy little hum!");
    setHappy(true);
    if (happyTimer.current) clearTimeout(happyTimer.current);
    happyTimer.current = setTimeout(() => setHappy(false), 1200);
    animate();
    sound("bark");
  };
  const changeRate = (direction: number) => {
    const currentRate = rateRef.current;
    const index = rates.indexOf(currentRate);
    const next =
      rates[Math.max(0, Math.min(rates.length - 1, index + direction))];
    if (next === currentRate) return;
    const now = interactionNow();
    setClock(now);
    setPet(
      (current) =>
        current && switchClockRate(current, now, currentRate, next).pet,
    );
    rateRef.current = next;
    setRate(next);
  };
  const fresh = (session = false) => {
    const now = interactionNow();
    setClock(now);
    setMode(session ? "session" : "available");
    setSaveFailed(false);
    setPet(createNewPet(now));
    setReaction(
      session
        ? "Jack is ready for this session."
        : "Jack has a fresh pet room.",
    );
  };
  if (!pet)
    return (
      <SafeAreaView style={s.recovery}>
        <Text style={s.title}>
          {mode === "loading"
            ? "Opening Jack’s pet room…"
            : mode === "invalid"
              ? "Saved pet needs recovery"
              : "Local saves are unavailable"}
        </Text>
        {mode !== "loading" && (
          <View style={s.card}>
            <Text style={s.text}>
              {mode === "invalid"
                ? "This save was not changed. Start fresh only if you want to replace it."
                : "You can play, but this session will not be saved."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => fresh(mode !== "invalid")}
              style={s.button}
            >
              <Text style={s.buttonText}>
                {mode === "invalid" ? "START FRESH" : "START SESSION ONLY"}
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    );
  const stage = getLifeStage(pet);
  const elapsed = Math.max(0, Math.floor(pet.ageVirtualMinutes));
  const tips = (Object.keys(pet.needs) as NeedKey[])
    .filter((k) => pet.needs[k] <= 30)
    .map((k) => needs[k].tip);
  return (
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>MR. BOOBINS’ PET CLUB</Text>
            <Text style={s.title}>Jack’s Pet Room</Text>
            <Text style={s.stage}>
              {stage === "puppy" ? "Puppy Jack" : "Adult Jack"} •{" "}
              {Math.floor(pet.ageVirtualMinutes / 60)} pet hours
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? "Turn sound on" : "Mute sound"}
            onPress={() => setMuted((v) => !v)}
            style={s.mute}
          >
            <Text style={s.muteText}>{muted ? "SOUND OFF" : "SOUND ON"}</Text>
          </Pressable>
        </View>
        <PixelDog
          bob={bob}
          wag={wag}
          pulse={pulse}
          reaction={reaction}
          stage={stage}
          sleeping={pet.isSleeping}
          tired={pet.needs.energy <= 30}
          happy={happy}
          onPet={petJack}
        />
        <View style={s.card}>
          <View style={s.speed}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Slower test clock"
              onPress={() => changeRate(-1)}
              style={s.speedButton}
            >
              <Text>−</Text>
            </Pressable>
            <Text
              accessibilityLabel={`Test clock ${rate} times real time`}
              style={s.speedText}
            >
              {rate}× TEST CLOCK
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Faster test clock"
              onPress={() => changeRate(1)}
              style={s.speedButton}
            >
              <Text>+</Text>
            </Pressable>
          </View>
          <Text style={s.text}>
            {pet.isSleeping
              ? "Jack is sleeping and recovering energy."
              : `${elapsed} pet min together`}
          </Text>
          {tips.map((t) => (
            <Text key={t} accessibilityLiveRegion="polite" style={s.tip}>
              {t}
            </Text>
          ))}
          {(Object.keys(pet.needs) as NeedKey[]).map((k) => (
            <View key={k} style={s.row}>
              <Text style={s.label}>{needs[k].label}</Text>
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${pet.needs[k]}%`,
                      backgroundColor: needs[k].color,
                    },
                  ]}
                />
              </View>
              <Text style={s.value}>{Math.round(pet.needs[k])}</Text>
            </View>
          ))}
        </View>
        <View style={s.actions}>
          {(["feed", "play", "rest", "clean"] as CareAction[]).map((a) => (
            <Pressable
              key={a}
              accessibilityRole="button"
              accessibilityLabel={`${a} Jack`}
              onPress={() => care(a)}
              style={s.action}
            >
              <Text style={s.buttonText}>{a.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.footer}>
          {saveFailed || mode === "session"
            ? "Not saved • Session only"
            : "Saved locally"}{" "}
          • Original local audio • Reduced-motion friendly
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#f8f0df" },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 18,
    gap: 16,
  },
  recovery: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 18,
    backgroundColor: "#f8f0df",
  },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: "#b65146", fontWeight: "900", fontSize: 11 },
  title: { color: "#27444c", fontSize: 29, fontWeight: "900" },
  stage: { color: "#63777d", fontWeight: "700" },
  mute: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderWidth: 3,
    borderColor: "#27444c",
    backgroundColor: "#f5cb6b",
  },
  muteText: { fontSize: 11, fontWeight: "900" },
  card: {
    backgroundColor: "#fffaf0",
    padding: 17,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#27444c",
    gap: 12,
  },
  text: { color: "#27444c", fontSize: 15, textAlign: "center" },
  speed: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  speedButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#27444c",
    backgroundColor: "#ffdf8a",
  },
  speedText: { fontWeight: "900", color: "#27444c" },
  tip: {
    backgroundColor: "#fff0c9",
    color: "#60441c",
    padding: 8,
    borderRadius: 8,
    fontWeight: "700",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { width: 82, color: "#27444c", fontWeight: "800" },
  track: {
    flex: 1,
    height: 15,
    backgroundColor: "#dfe4da",
    overflow: "hidden",
    borderRadius: 4,
  },
  fill: { height: "100%", minWidth: 3 },
  value: { width: 27, textAlign: "right", fontWeight: "900", color: "#27444c" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: {
    flexGrow: 1,
    flexBasis: "42%",
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef7659",
    borderWidth: 3,
    borderColor: "#27444c",
    borderRadius: 14,
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef7659",
    borderWidth: 3,
    borderColor: "#27444c",
    borderRadius: 12,
    padding: 12,
  },
  buttonText: { color: "#fffaf0", fontWeight: "900" },
  footer: { color: "#63777d", textAlign: "center", fontSize: 12 },
});
