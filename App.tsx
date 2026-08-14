import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
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
import { PixelDog, type DogEmote } from "./src/pixel-dog";
import {
  DEFAULT_CLOCK_MULTIPLIER,
  advancePet,
  canCareForPet,
  careForPet,
  createNewPet,
  getGrowthStage,
  isSleeping,
  startSleep,
  switchClockRate,
  wakePet,
  type CareAction,
  type GrowthStage,
  type NeedKey,
  type PetState,
} from "./src/simulation";

type Mode = "loading" | "available" | "invalid" | "unavailable" | "session";
type SoundKind = "happy" | "sleepy" | "bark";

const rates = [1, 12, 60, 360, 3600];
const sleepOptions = [1, 2, 4, 8];
const actionCopy: Record<CareAction, string> = {
  feed: "Snack time! Baby Jack gives a growing grin.",
  play: "Zoomies! Jack grabs his toy for playtime.",
  clean: "Fresh and fluffy! Jack sparkles.",
};
const stageLabels: Record<GrowthStage, string> = {
  baby: "Baby",
  "little-puppy": "Little Puppy",
  puppy: "Puppy",
  "young-dog": "Young Dog",
  adult: "Adult",
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
    tip: "Jack could use some playtime with his toy.",
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

type MusicPlayer = {
  muted: boolean;
  loop: boolean;
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
};

function configureMusic(player: MusicPlayer, enabled: boolean) {
  player.loop = true;
  player.muted = !enabled;
  if (!enabled) player.pause();
}

function playMusicFromStart(player: MusicPlayer) {
  void player
    .seekTo(0)
    .then(() => player.play())
    .catch(() => player.play());
}

export default function App() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [rate, setRate] = useState(DEFAULT_CLOCK_MULTIPLIER);
  const rateRef = useRef(DEFAULT_CLOCK_MULTIPLIER);
  const [sfxEnabled, setSfxEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [reaction, setReaction] = useState("Jack is watching the sunbeams.");
  const [emote, setEmote] = useState<DogEmote>(null);
  const emoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduced, setReduced] = useState(false);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [, setClock] = useState(() => Date.now());
  const [bob] = useState(() => new Animated.Value(0));
  const [wag] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const happyPlayer = useAudioPlayer(require("./assets/audio/happy.wav"));
  const sleepyPlayer = useAudioPlayer(require("./assets/audio/sleepy.wav"));
  const barkPlayer = useAudioPlayer(require("./assets/audio/bark.wav"));
  const musicPlayer = useAudioPlayer(require("./assets/audio/music.wav"));
  const native = Platform.OS !== "web";
  const sleeping = pet ? isSleeping(pet) : false;
  const previousSleepingRef = useRef<boolean | null>(null);
  const manualWakeRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => alive && setReduced(value),
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
        const wasSleeping = isSleeping(result.pet);
        const advancedPet = advancePet(
          result.pet,
          now,
          DEFAULT_CLOCK_MULTIPLIER,
        );
        previousSleepingRef.current = wasSleeping;
        setMode("available");
        setPet(advancedPet);
      } else if (result.kind === "missing") {
        previousSleepingRef.current = false;
        setMode("available");
        setPet(createNewPet(now));
      } else {
        previousSleepingRef.current = false;
        setMode(result.kind);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!pet || !hydrated || mode !== "available") return;
    void savePet(pet).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  }, [hydrated, mode, pet]);

  useEffect(() => {
    if (reduced || sleeping) {
      bob.stopAnimation();
      wag.stopAnimation();
      bob.setValue(0);
      wag.setValue(0);
      return;
    }
    const animation = Animated.loop(
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
    animation.start();
    return () => animation.stop();
  }, [bob, native, reduced, sleeping, wag]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setClock(now);
      setPet((current) => current && advancePet(current, now, rateRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    [happyPlayer, sleepyPlayer, barkPlayer].forEach((player) => {
      player.muted = !sfxEnabled;
      if (!sfxEnabled) player.pause();
    });
    configureMusic(musicPlayer, musicEnabled);
  }, [barkPlayer, happyPlayer, musicEnabled, musicPlayer, sfxEnabled, sleepyPlayer]);

  useEffect(
    () => () => {
      if (emoteTimer.current) clearTimeout(emoteTimer.current);
      musicPlayer.pause();
    },
    [musicPlayer],
  );

  const playSound = (kind: SoundKind) => {
    if (!sfxEnabled) return;
    const player =
      kind === "happy"
        ? happyPlayer
        : kind === "sleepy"
          ? sleepyPlayer
          : barkPlayer;
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  };

  const setTransientReaction = (
    message: string,
    nextEmote: DogEmote,
    duration = 1300,
  ) => {
    setReaction(message);
    setEmote(nextEmote);
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
    emoteTimer.current = setTimeout(() => setEmote(null), duration);
  };

  useEffect(() => {
    const wasSleeping = previousSleepingRef.current;
    if (wasSleeping && !sleeping && !manualWakeRef.current) {
      setTransientReaction("Jack woke up rested and ready for a wag!", "happy");
    }
    manualWakeRef.current = false;
    previousSleepingRef.current = sleeping;
  }, [sleeping]);

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
    setPet((current) =>
      current ? careForPet(current, action, now, rateRef.current) : current,
    );
    const nextEmote: DogEmote =
      action === "play" ? "toy" : action === "clean" ? "sparkle" : "happy";
    setTransientReaction(actionCopy[action], nextEmote);
    animate();
    playSound(action === "feed" ? "bark" : "happy");
  };

  const petJack = () => {
    setTransientReaction("Jack wags hard and makes a happy little hum!", "happy");
    animate();
    playSound("happy");
  };

  const changeRate = (direction: number) => {
    const currentRate = rateRef.current;
    const index = rates.indexOf(currentRate);
    const next = rates[Math.max(0, Math.min(rates.length - 1, index + direction))];
    if (next === currentRate) return;
    const now = interactionNow();
    setClock(now);
    setPet((current) =>
      current
        ? switchClockRate(current, now, currentRate, next).pet
        : current,
    );
    rateRef.current = next;
    setRate(next);
  };

  const beginSleep = (hours: number) => {
    const now = interactionNow();
    setClock(now);
    setPet((current) =>
      current ? startSleep(current, hours, now, rateRef.current) : current,
    );
    setSleepMenuOpen(false);
    setReaction(`Jack is napping for ${hours} pet hour${hours === 1 ? "" : "s"}.`);
    setEmote(null);
    playSound("sleepy");
  };

  const wakeUp = () => {
    const now = interactionNow();
    setClock(now);
    manualWakeRef.current = true;
    setPet((current) =>
      current ? wakePet(current, now, rateRef.current) : current,
    );
    setTransientReaction("Good morning, Jack! A gentle stretch and wag.", "happy");
    playSound("happy");
  };

  const completeIntro = () => {
    setPet((current) => current && { ...current, introCompleted: true });
    setReaction("Baby Jack is ready for his first cozy day.");
  };

  const toggleMusic = () => {
    const next = !musicEnabled;
    setMusicEnabled(next);
    configureMusic(musicPlayer, next);
    if (next) {
      playMusicFromStart(musicPlayer);
    }
  };

  const toggleSfx = () => {
    const next = !sfxEnabled;
    if (!next) {
      [happyPlayer, sleepyPlayer, barkPlayer].forEach((player) => {
        player.muted = true;
        player.pause();
      });
    }
    setSfxEnabled(next);
  };

  const fresh = (session = false) => {
    const now = interactionNow();
    setClock(now);
    setMode(session ? "session" : "available");
    setSaveFailed(false);
    setHydrated(true);
    setPet(createNewPet(now));
    setReaction(
      session ? "Baby Jack is ready for this session." : "Baby Jack has a fresh pet room.",
    );
  };

  if (!pet) {
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
  }

  const stage = getGrowthStage(pet);
  const elapsed = Math.max(0, Math.floor(pet.ageVirtualMinutes));
  const sleepRemaining = Math.max(
    0,
    Math.ceil((pet.sleepUntilVirtualMinutes ?? pet.ageVirtualMinutes) - pet.ageVirtualMinutes),
  );
  const tips = (Object.keys(pet.needs) as NeedKey[])
    .filter((key) => pet.needs[key] <= 30)
    .map((key) => needs[key].tip);
  const careAvailable = canCareForPet(pet);
  const displayEmote = emote ?? (pet.needs.energy <= 30 && !sleeping ? "yawn" : null);

  return (
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>MR. BOOBINS’ PET CLUB</Text>
            <Text style={s.title}>Jack’s Pet Room</Text>
            <Text style={s.stage}>
              {stageLabels[stage]} Jack • {Math.floor(pet.ageVirtualMinutes / 60)} pet hours
            </Text>
          </View>
          <View style={s.audioControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sfxEnabled ? "Turn sound effects off" : "Turn sound effects on"}
              onPress={toggleSfx}
              style={s.mute}
            >
              <Text style={s.muteText}>{sfxEnabled ? "SFX ON" : "SFX OFF"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={musicEnabled ? "Turn music off" : "Turn music on"}
              onPress={toggleMusic}
              style={s.mute}
            >
              <Text style={s.muteText}>{musicEnabled ? "MUSIC ON" : "MUSIC OFF"}</Text>
            </Pressable>
          </View>
        </View>
        <PixelDog
          bob={bob}
          wag={wag}
          pulse={pulse}
          reaction={reaction}
          stage={stage}
          sleeping={sleeping}
          tired={pet.needs.energy <= 30}
          lowHappiness={pet.needs.happiness <= 30}
          happy={displayEmote === "happy"}
          emote={displayEmote}
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
            <Text accessibilityLabel={`Test clock ${rate} times real time`} style={s.speedText}>
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
            {sleeping
              ? `Jack is sleeping • ${sleepRemaining} pet min left`
              : `${elapsed} pet min together`}
          </Text>
          {tips.map((tip) => (
            <Text key={tip} accessibilityLiveRegion="polite" style={s.tip}>
              {tip}
            </Text>
          ))}
          {(Object.keys(pet.needs) as NeedKey[]).map((key) => (
            <View key={key} style={s.row}>
              <Text style={s.label}>{needs[key].label}</Text>
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    { width: `${pet.needs[key]}%`, backgroundColor: needs[key].color },
                  ]}
                />
              </View>
              <Text style={s.value}>{Math.round(pet.needs[key])}</Text>
            </View>
          ))}
        </View>
        <View style={s.actions}>
          {(["feed", "play", "clean"] as CareAction[]).map((action) => (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={`${action} Jack`}
              accessibilityState={{ disabled: !careAvailable }}
              disabled={!careAvailable}
              onPress={() => care(action)}
              style={[s.action, !careAvailable && s.actionDisabled]}
            >
              <Text style={s.buttonText}>{action.toUpperCase()}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sleeping ? "Wake Jack up" : "Choose Jack’s nap length"}
            onPress={sleeping ? wakeUp : () => setSleepMenuOpen(true)}
            style={[s.action, s.sleepAction]}
          >
            <Text style={s.buttonText}>{sleeping ? "WAKE UP" : "SLEEP"}</Text>
          </Pressable>
        </View>
        <Text style={s.footer}>
          {saveFailed || mode === "session" ? "Not saved • Session only" : "Saved locally"} •
          Original local SFX/music • Reduced-motion friendly
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new Baby Jack game"
          onPress={() => setRestartOpen(true)}
          style={s.restart}
        >
          <Text style={s.restartText}>NEW BABY</Text>
        </Pressable>
      </ScrollView>
      {!pet.introCompleted && (
        <Modal
          transparent
          animationType={reduced ? "none" : "fade"}
          visible
          onRequestClose={completeIntro}
        >
          <View style={s.overlay}>
            <View
              accessibilityViewIsModal
              accessibilityLabel="Meet Baby Jack"
              style={s.dialog}
            >
              <Text style={s.dialogTitle}>Meet Baby Jack</Text>
              <Text style={s.text}>
                Hi! I’m Jack. Feed, play, clean, and choose cozy naps while I grow.
              </Text>
              <Pressable accessibilityRole="button" onPress={completeIntro} style={s.button}>
                <Text style={s.buttonText}>LET’S PLAY</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      <Modal
        transparent
        animationType={reduced ? "none" : "fade"}
        visible={sleepMenuOpen}
        onRequestClose={() => setSleepMenuOpen(false)}
      >
        <View style={s.overlay}>
          <View
            accessibilityViewIsModal
            accessibilityLabel="Choose a cozy nap"
            style={s.dialog}
          >
            <Text style={s.dialogTitle}>Choose a cozy nap</Text>
            <Text style={s.text}>Pick how long Jack should sleep in pet hours.</Text>
            <View style={s.sleepOptions}>
              {sleepOptions.map((hours) => (
                <Pressable
                  key={hours}
                  accessibilityRole="button"
                  accessibilityLabel={`Sleep for ${hours} pet hours`}
                  onPress={() => beginSleep(hours)}
                  style={s.sleepOption}
                >
                  <Text style={s.muteText}>{hours} HOUR{hours === 1 ? "" : "S"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel sleep selection"
              onPress={() => setSleepMenuOpen(false)}
              style={s.cancel}
            >
              <Text style={s.cancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        animationType={reduced ? "none" : "fade"}
        visible={restartOpen}
        onRequestClose={() => setRestartOpen(false)}
      >
        <View style={s.overlay}>
          <View
            accessibilityViewIsModal
            accessibilityLabel="Start a new Baby Jack"
            style={s.dialog}
          >
            <Text style={s.dialogTitle}>Start a new Baby Jack?</Text>
            <Text style={s.text}>
              This replaces this local pet’s age, needs, and nap with a fresh Baby Jack.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm new Baby Jack"
              onPress={() => {
                setRestartOpen(false);
                fresh(false);
              }}
              style={s.button}
            >
              <Text style={s.buttonText}>NEW BABY</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep current Jack"
              onPress={() => setRestartOpen(false)}
              style={s.cancel}
            >
              <Text style={s.cancelText}>KEEP JACK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#f8f0df" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 18, gap: 16 },
  recovery: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 18,
    backgroundColor: "#f8f0df",
  },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  audioControls: { alignItems: "flex-end", gap: 6 },
  eyebrow: { color: "#b65146", fontWeight: "900", fontSize: 11 },
  title: { color: "#27444c", fontSize: 29, fontWeight: "900" },
  stage: { color: "#63777d", fontWeight: "700" },
  mute: {
    minWidth: 84,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderWidth: 3,
    borderColor: "#27444c",
    backgroundColor: "#f5cb6b",
  },
  muteText: { fontSize: 11, fontWeight: "900", color: "#27444c" },
  card: {
    backgroundColor: "#fffaf0",
    padding: 17,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#27444c",
    gap: 12,
  },
  text: { color: "#27444c", fontSize: 15, textAlign: "center" },
  speed: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12 },
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
  track: { flex: 1, height: 15, backgroundColor: "#dfe4da", overflow: "hidden", borderRadius: 4 },
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
  sleepAction: { backgroundColor: "#7a82ce" },
  actionDisabled: { backgroundColor: "#ad9d9a", opacity: 0.7 },
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
  restart: {
    minWidth: 44,
    minHeight: 44,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  restartText: { color: "#27444c", fontSize: 12, fontWeight: "900" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(39,68,76,0.52)" },
  dialog: { width: "100%", maxWidth: 420, padding: 22, gap: 16, borderRadius: 20, borderWidth: 4, borderColor: "#27444c", backgroundColor: "#fffaf0" },
  dialogTitle: { color: "#27444c", fontSize: 25, fontWeight: "900", textAlign: "center" },
  sleepOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sleepOption: { flexGrow: 1, flexBasis: "40%", minHeight: 52, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#27444c", backgroundColor: "#ffdf8a" },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#27444c", fontWeight: "900" },
});
