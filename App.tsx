import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import {
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  loadPet,
  saveAudioPreferences,
  savePet,
  type AudioPreferences,
} from "./src/persistence";
import {
  canPlayRememberedAudio,
  syncMusicPlayer,
  syncSfxPlayers,
} from "./src/audio-policy";
import {
  createInteractionScheduler,
  getBoopAvailability,
  getTerminalUiPolicy,
  resetTransientAnimations,
  resolvePetInteraction,
  restoreMessagePresentation,
  type PetInteraction,
} from "./src/interaction-policy";
import { MiniJack, PixelDog, type DogEmote } from "./src/pixel-dog";
import {
  BOOP_COOLDOWN_MS,
  CLEANING_DURATION_MS,
  DEFAULT_CLOCK_MULTIPLIER,
  GROWTH_STEP_MINUTES,
  advancePet,
  canCareForPet,
  careForPet,
  createNewPet,
  getBoopReaction,
  getGrowthStage,
  getHygieneAppearance,
  getVirtualClock,
  isSleeping,
  normalizeNickname,
  startSleep,
  switchClockRate,
  wakePet,
  type CareAction,
  type CleaningPhase,
  type GrowthStage,
  type NeedKey,
  type PetState,
  type RoomTheme,
} from "./src/simulation";

type Mode = "loading" | "available" | "invalid" | "unavailable" | "session";
type Screen = "title" | "hub" | "room" | "settings";
type PreferenceMode = "loading" | "available" | "invalid" | "session";
type SoundKind = "happy" | "sleepy" | "bark" | "shower" | "sneeze" | "huff";

const rates = [1, 12, 60, 360, 3600];
const sleepOptions = [1, 2, 4, 8];
const growthStages: GrowthStage[] = [
  "baby",
  "little-puppy",
  "puppy",
  "young-dog",
  "adult",
];
const needLabels: Record<NeedKey, string> = {
  hunger: "HUNGER",
  happiness: "HAPPINESS",
  energy: "ENERGY",
  hygiene: "HYGIENE",
};
const themeLabels: Record<RoomTheme, string> = {
  cozy: "COZY",
  blue: "BLUE",
  garden: "GARDEN",
};

const interactionNow = () => Date.now();
const subscribeToMount = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function playFromStart(player: { play: () => void; seekTo: (seconds: number) => Promise<void> }) {
  void player
    .seekTo(0)
    .then(() => player.play())
    .catch(() => player.play());
}

export default function App() {
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  if (!mounted) {
    return (
      <SafeAreaView style={s.recovery}>
        <Text style={s.pixelTitle}>Opening Jack’s pet club…</Text>
      </SafeAreaView>
    );
  }
  return <PetClub />;
}

function PetClub() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [pet, setPet] = useState<PetState | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [screen, setScreen] = useState<Screen>("title");
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [preferences, setPreferences] = useState<AudioPreferences>(
    DEFAULT_AUDIO_PREFERENCES,
  );
  const [preferenceMode, setPreferenceMode] =
    useState<PreferenceMode>("loading");
  const [audioGestureGranted, setAudioGestureGranted] = useState(false);
  const [rate, setRate] = useState(DEFAULT_CLOCK_MULTIPLIER);
  const rateRef = useRef(DEFAULT_CLOCK_MULTIPLIER);
  const [nicknameDraft, setNicknameDraft] = useState("Jack");
  const [nicknameError, setNicknameError] = useState("");
  const [browseIndex, setBrowseIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [emote, setEmote] = useState<DogEmote>(null);
  const [messageOpacity] = useState(() => new Animated.Value(1));
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionScheduler = useRef(createInteractionScheduler());
  const uiGeneration = useRef(0);
  const [cleaningPhase, setCleaningPhase] = useState<CleaningPhase | null>(null);
  const [careLocked, setCareLocked] = useState(false);
  const [boopCooldownUntil, setBoopCooldownUntil] = useState(0);
  const boopCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduced, setReduced] = useState(false);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [bob] = useState(() => new Animated.Value(0));
  const [wag] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [feedProgress] = useState(() => new Animated.Value(0));
  const [zoom] = useState(() => new Animated.Value(0));
  const happyPlayer = useAudioPlayer(require("./assets/audio/happy.wav"));
  const sleepyPlayer = useAudioPlayer(require("./assets/audio/sleepy.wav"));
  const barkPlayer = useAudioPlayer(require("./assets/audio/bark.wav"));
  const showerPlayer = useAudioPlayer(require("./assets/audio/shower.wav"));
  const sneezePlayer = useAudioPlayer(require("./assets/audio/sneeze.wav"));
  const huffPlayer = useAudioPlayer(require("./assets/audio/huff.wav"));
  const musicPlayer = useAudioPlayer(require("./assets/audio/music.wav"));
  const musicAllowedRef = useRef(false);
  const petRef = useRef<PetState | null>(null);
  const native = Platform.OS !== "web";
  const sleeping = pet ? isSleeping(pet) : false;
  const previousSleepingRef = useRef<boolean | null>(null);
  const manualWakeRef = useRef(false);

  const cancelActiveInteractions = useCallback(() => {
    uiGeneration.current += 1;
    interactionScheduler.current.cancel();
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = null;
    if (boopCooldownTimer.current) clearTimeout(boopCooldownTimer.current);
    boopCooldownTimer.current = null;
    setBoopCooldownUntil(0);
    feedProgress.stopAnimation();
    feedProgress.setValue(0);
    zoom.stopAnimation();
    zoom.setValue(0);
    pulse.stopAnimation();
    pulse.setValue(0);
    messageOpacity.stopAnimation();
    messageOpacity.setValue(1);
    setCleaningPhase(null);
    setCareLocked(false);
    setMessage("");
    setEmote(null);
    setSleepMenuOpen(false);
    setRestartOpen(false);
    manualWakeRef.current = false;
    [happyPlayer, sleepyPlayer, barkPlayer, showerPlayer, sneezePlayer, huffPlayer].forEach(
      (player) => player.pause(),
    );
    musicPlayer.pause();
    musicAllowedRef.current = false;
  }, [
    barkPlayer,
    feedProgress,
    happyPlayer,
    huffPlayer,
    messageOpacity,
    musicPlayer,
    pulse,
    showerPlayer,
    sleepyPlayer,
    sneezePlayer,
    zoom,
  ]);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => alive && setReduced(value),
    );
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadPet(), loadAudioPreferences()]).then(
      ([petResult, preferenceResult]) => {
        if (!alive) return;
        const now = Date.now();
        if (petResult.kind === "loaded") {
          const wasSleeping = isSleeping(petResult.pet);
          const current = advancePet(
            petResult.pet,
            now,
            DEFAULT_CLOCK_MULTIPLIER,
          );
          previousSleepingRef.current = wasSleeping;
          setPet(current);
          setNicknameDraft(current.name);
          setMode("available");
        } else if (petResult.kind === "missing") {
          const current = createNewPet(now);
          previousSleepingRef.current = false;
          setPet(current);
          setNicknameDraft(current.name);
          setMode("available");
        } else {
          previousSleepingRef.current = false;
          setMode(petResult.kind);
        }
        if (preferenceResult.kind === "loaded") {
          setPreferences(preferenceResult.preferences);
          setPreferenceMode("available");
        } else if (preferenceResult.kind === "missing") {
          setPreferences(DEFAULT_AUDIO_PREFERENCES);
          setPreferenceMode("available");
        } else {
          setPreferences(DEFAULT_AUDIO_PREFERENCES);
          setPreferenceMode(
            preferenceResult.kind === "invalid" ? "invalid" : "session",
          );
        }
        setScreen("title");
        setHydrated(true);
      },
    );
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
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const current = petRef.current;
      if (!current) return;
      const next = advancePet(current, now, rateRef.current);
      petRef.current = next;
      setPet(next);
      if (!current.isDead && next.isDead) {
        cancelActiveInteractions();
        setScreen((active) => active === "settings" ? "room" : active);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cancelActiveInteractions]);

  useEffect(() => {
    if (reduced || sleeping || pet?.isDead) {
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
  }, [bob, native, pet?.isDead, reduced, sleeping, wag]);

  useEffect(() => {
    const allowSfx = canPlayRememberedAudio(
      preferences.sfxEnabled,
      audioGestureGranted,
      !!pet?.isDead,
    );
    syncSfxPlayers([
      happyPlayer,
      sleepyPlayer,
      barkPlayer,
      showerPlayer,
      sneezePlayer,
      huffPlayer,
    ], allowSfx);
  }, [
    audioGestureGranted,
    barkPlayer,
    happyPlayer,
    huffPlayer,
    pet?.isDead,
    preferences.sfxEnabled,
    showerPlayer,
    sleepyPlayer,
    sneezePlayer,
  ]);

  useEffect(() => {
    const allowMusic = canPlayRememberedAudio(
      preferences.musicEnabled,
      audioGestureGranted,
      !!pet?.isDead,
    );
    syncMusicPlayer(musicPlayer, allowMusic, musicAllowedRef.current);
    musicAllowedRef.current = allowMusic;
  }, [
    audioGestureGranted,
    musicPlayer,
    pet?.isDead,
    preferences.musicEnabled,
  ]);

  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
      interactionScheduler.current.cancel();
      if (boopCooldownTimer.current) clearTimeout(boopCooldownTimer.current);
      feedProgress.stopAnimation();
      messageOpacity.stopAnimation();
      zoom.stopAnimation();
      musicPlayer.pause();
    },
    [feedProgress, messageOpacity, musicPlayer, zoom],
  );

  const playSound = (kind: SoundKind) => {
    if (
      !canPlayRememberedAudio(
        preferences.sfxEnabled,
        audioGestureGranted,
        !!pet?.isDead,
      )
    ) {
      return;
    }
    const player =
      kind === "happy"
        ? happyPlayer
        : kind === "sleepy"
          ? sleepyPlayer
          : kind === "bark"
            ? barkPlayer
            : kind === "shower"
              ? showerPlayer
              : kind === "sneeze"
                ? sneezePlayer
                : huffPlayer;
    playFromStart(player);
  };

  const setTransientMessage = useCallback(
    (nextMessage: string, nextEmote: DogEmote, duration = 3000) => {
      messageTimer.current = restoreMessagePresentation(
        messageTimer.current,
        messageOpacity,
      );
      setMessage(nextMessage);
      setEmote(nextEmote);
      const generation = uiGeneration.current;
      messageTimer.current = setTimeout(() => {
        if (generation !== uiGeneration.current) return;
        setEmote(null);
        if (reduced) {
          setMessage("");
          return;
        }
        Animated.timing(messageOpacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: native,
        }).start(({ finished }) => {
          if (finished && generation === uiGeneration.current) setMessage("");
        });
      }, duration);
    },
    [messageOpacity, native, reduced],
  );

  useEffect(() => {
    const wasSleeping = previousSleepingRef.current;
    if (wasSleeping && !sleeping && !manualWakeRef.current) {
      setTransientMessage("Jack woke up rested and ready for a wag!", "happy");
    }
    manualWakeRef.current = false;
    previousSleepingRef.current = sleeping;
  }, [setTransientMessage, sleeping]);

  const animatePulse = () => {
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

  const commitTerminalState = (current: PetState) => {
    cancelActiveInteractions();
    petRef.current = current;
    setPet(current);
    setScreen("room");
  };

  const prepareInteraction = (interaction: PetInteraction) => {
    const current = petRef.current ?? pet;
    if (!current) return null;
    const now = interactionNow();
    const resolution = resolvePetInteraction({
      pet: current,
      interaction,
      now,
      multiplier: rateRef.current,
      careLocked,
      cooldownUntil: boopCooldownUntil,
    });
    petRef.current = resolution.pet;
    setPet(resolution.pet);
    if (resolution.reason === "dead") commitTerminalState(resolution.pet);
    return { ...resolution, now };
  };

  const currentAliveSnapshot = () => {
    const current = petRef.current ?? pet;
    if (!current) return null;
    const next = advancePet(current, interactionNow(), rateRef.current);
    petRef.current = next;
    setPet(next);
    if (next.isDead) {
      commitTerminalState(next);
      return null;
    }
    return next;
  };

  const runCleaning = (currentPet: PetState) => {
    const token = interactionScheduler.current.begin();
    resetTransientAnimations([feedProgress, zoom, pulse]);
    messageTimer.current = restoreMessagePresentation(messageTimer.current, messageOpacity);
    setCareLocked(true);
    setCleaningPhase("water");
    setEmote("cleaning");
    setMessage("Cleaning: water → dirt washout → shake → sparkle.");
    playSound("shower");
    const schedule = (delay: number, callback: () => void) => {
      interactionScheduler.current.schedule(token, delay, callback);
    };
    schedule(400, () => setCleaningPhase("washout"));
    schedule(800, () => {
      setCleaningPhase("shake");
      animatePulse();
    });
    schedule(1150, () => setCleaningPhase("sparkle"));
    schedule(CLEANING_DURATION_MS, () => {
      const now = interactionNow();
      const livePet = petRef.current ?? currentPet;
      const resolution = resolvePetInteraction({
        pet: livePet,
        interaction: "clean",
        now,
        multiplier: rateRef.current,
      });
      if (resolution.reason === "dead") {
        commitTerminalState(resolution.pet);
        return;
      }
      const cleaned = careForPet(resolution.pet, "clean", now, rateRef.current);
      petRef.current = cleaned;
      setPet(cleaned);
      setCleaningPhase(null);
      setCareLocked(false);
      setTransientMessage("Fresh and fluffy! Jack sparkles.", "sparkle");
    });
  };

  const care = (action: CareAction) => {
    const resolution = prepareInteraction(action);
    if (!resolution?.allowed) return;
    if (action === "clean") {
      runCleaning(resolution.pet);
      return;
    }
    const now = resolution.now;
    const nextPet = careForPet(resolution.pet, action, now, rateRef.current);
    petRef.current = nextPet;
    setPet(nextPet);
    const token = interactionScheduler.current.begin();
    feedProgress.stopAnimation();
    feedProgress.setValue(0);
    zoom.stopAnimation();
    zoom.setValue(0);
    if (action === "feed") {
      setTransientMessage(
        "A crunchy pixel treat is headed for Jack’s open mouth!",
        "feeding",
        900,
      );
      if (reduced) {
        feedProgress.setValue(1);
        setTransientMessage("Jack caught the treat — WOOF!", "fed");
        playSound("bark");
      } else {
        Animated.timing(feedProgress, {
          toValue: 1,
          duration: 700,
          useNativeDriver: native,
        }).start(({ finished }) => {
          if (finished && interactionScheduler.current.isCurrent(token)) {
            setTransientMessage("Jack caught the treat — WOOF!", "fed");
            playSound("bark");
          }
        });
      }
    } else {
      setTransientMessage("Zoomies! Jack grabs his toy and runs!", "toy");
      if (!reduced) {
        zoom.setValue(0);
        Animated.sequence([
          Animated.timing(zoom, {
            toValue: 0.35,
            duration: 220,
            useNativeDriver: native,
          }),
          Animated.timing(zoom, {
            toValue: 0.7,
            duration: 280,
            useNativeDriver: native,
          }),
          Animated.timing(zoom, {
            toValue: 1,
            duration: 240,
            useNativeDriver: native,
          }),
        ]).start();
      }
      playSound("happy");
    }
    animatePulse();
  };

  const boop = () => {
    const resolution = prepareInteraction("boop");
    if (!resolution?.allowed) return;
    const now = resolution.now;
    interactionScheduler.current.begin();
    const cooldownUntil = now + BOOP_COOLDOWN_MS;
    setBoopCooldownUntil(cooldownUntil);
    if (boopCooldownTimer.current) clearTimeout(boopCooldownTimer.current);
    boopCooldownTimer.current = setTimeout(() => {
      setBoopCooldownUntil((current) =>
        current === cooldownUntil ? 0 : current,
      );
    }, BOOP_COOLDOWN_MS);
    const reaction = getBoopReaction(resolution.pet.needs);
    setTransientMessage(reaction.message, reaction.kind, 2200);
    if (reaction.kind === "bark") {
      animatePulse();
      playSound("bark");
    } else if (reaction.kind === "sneeze") {
      playSound("sneeze");
    } else if (reaction.kind === "huff") {
      playSound("huff");
    } else {
      playSound("sleepy");
    }
  };

  const changeRate = (direction: number) => {
    const currentPet = petRef.current ?? pet;
    if (!currentPet) return;
    const currentRate = rateRef.current;
    const index = rates.indexOf(currentRate);
    const next = rates[Math.max(0, Math.min(rates.length - 1, index + direction))];
    if (next === currentRate) return;
    const now = interactionNow();
    const switched = switchClockRate(currentPet, now, currentRate, next).pet;
    petRef.current = switched;
    setPet(switched);
    if (switched.isDead) {
      commitTerminalState(switched);
      return;
    }
    rateRef.current = next;
    setRate(next);
  };

  const beginSleep = (hours: number) => {
    const resolution = prepareInteraction("sleep");
    if (!resolution?.allowed) return;
    const now = resolution.now;
    const next = startSleep(resolution.pet, hours, now, rateRef.current);
    petRef.current = next;
    setPet(next);
    setSleepMenuOpen(false);
    setTransientMessage(
      `Jack is sleeping for ${hours} pet hour${hours === 1 ? "" : "s"}.`,
      null,
    );
    playSound("sleepy");
  };

  const wakeUp = () => {
    const resolution = prepareInteraction("wake");
    if (!resolution?.allowed) return;
    const now = resolution.now;
    manualWakeRef.current = true;
    const next = wakePet(resolution.pet, now, rateRef.current);
    petRef.current = next;
    setPet(next);
    setTransientMessage("Good morning, Jack! A gentle stretch and wag.", "happy");
    playSound("happy");
  };

  const persistPreferences = (next: AudioPreferences) => {
    if (!currentAliveSnapshot()) return;
    setPreferences(next);
    setAudioGestureGranted(true);
    void saveAudioPreferences(next).then(
      () => setPreferenceMode("available"),
      () => setPreferenceMode("session"),
    );
  };

  const chooseTheme = (roomTheme: RoomTheme) => {
    const current = currentAliveSnapshot();
    if (!current) return;
    const next = { ...current, roomTheme };
    petRef.current = next;
    setPet(next);
  };

  const enter = () => {
    setAudioGestureGranted(true);
    setScreen("hub");
  };

  const enterRoom = () => {
    if (!pet) return;
    if (pet.isDead) {
      setScreen("room");
      return;
    }
    const name = normalizeNickname(nicknameDraft);
    if (!name) {
      setNicknameError("Give Jack a nickname from 1–12 characters.");
      return;
    }
    setNicknameError("");
    setAudioGestureGranted(true);
    const next = { ...pet, name, adoptionCompleted: true };
    petRef.current = next;
    setPet(next);
    setNicknameDraft(name);
    setScreen("room");
  };

  const fresh = (session = false) => {
    cancelActiveInteractions();
    const current = createNewPet(interactionNow());
    petRef.current = current;
    setMode(session ? "session" : "available");
    setSaveFailed(false);
    setHydrated(true);
    setPet(current);
    setNicknameDraft(current.name);
    setScreen("title");
    setMessage("");
    setEmote(null);
    setAudioGestureGranted(false);
  };

  if (!pet) {
    return (
      <SafeAreaView style={s.recovery}>
        <Text style={s.pixelTitle}>
          {mode === "loading"
            ? "Opening Jack’s pet club…"
            : mode === "invalid"
              ? "Saved pet needs recovery"
              : "Local saves are unavailable"}
        </Text>
        {mode !== "loading" && (
          <View style={s.recoveryCard}>
            <Text style={s.bodyText}>
              {mode === "invalid"
                ? "This save was not changed. Start fresh only if you want to replace it."
                : "You can play, but this session will not be saved."}
            </Text>
            <ActionButton
              label={mode === "invalid" ? "START FRESH" : "START SESSION ONLY"}
              onPress={() => fresh(mode !== "invalid")}
            />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const clock = getVirtualClock(pet.ageVirtualMinutes);
  const terminalPolicy = getTerminalUiPolicy(pet);
  const stage = getGrowthStage(pet);
  const stageIndex = growthStages.indexOf(stage);
  const nextGrowthMinutes = Math.max(
    0,
    (stageIndex + 1) * GROWTH_STEP_MINUTES - pet.ageVirtualMinutes,
  );
  const growthHint = pet.isDead
    ? "Jack’s story is frozen. Start a new Baby Jack when you are ready."
    : stage === "adult"
      ? "Jack is all grown up!"
      : `Next growth: ${Math.ceil(nextGrowthMinutes)} pet min + ${
          pet.growthMeals > stageIndex
            ? "meal earned"
            : "a feed after hunger drops to 90"
        }.`;
  const sleepRemaining = Math.max(
    0,
    Math.ceil(
      (pet.sleepUntilVirtualMinutes ?? pet.ageVirtualMinutes) -
        pet.ageVirtualMinutes,
    ),
  );
  const careAvailable = canCareForPet(pet) && !careLocked;
  const boopAvailability = getBoopAvailability(
    pet,
    interactionNow(),
    boopCooldownUntil,
    careLocked,
  );
  const ambientMessage = pet.isDead
    ? "Oh no — Jack’s story ended."
    : sleeping
      ? `Jack is sleeping • ${sleepRemaining} pet min left`
      : pet.needs.hunger <= 20
        ? `${pet.name} is very hungry and needs food.`
        : pet.needs.energy <= 25
          ? `${pet.name} is tired. Bedtime?`
          : pet.needs.hygiene <= 35
            ? `${pet.name} is muddy and needs a clean.`
            : pet.needs.happiness <= 30
              ? `${pet.name} wants to play.`
              : clock.daypart === "night"
                ? "Nighttime makes Jack sleepy, but bedtime is your choice."
                : `${pet.name} is ready to play.`;
  const displayEmote = pet.isDead
    ? null
    : emote ?? (pet.needs.energy <= 25 && !sleeping ? "yawn" : null);

  let content;
  if (screen === "title") {
    content = <TitleScreen bob={bob} reduced={reduced} onEnter={enter} />;
  } else if (screen === "hub") {
    content = (
      <PetHubScreen
        browseIndex={browseIndex}
        nickname={nicknameDraft}
        nicknameError={nicknameError}
        onBrowse={(direction) =>
          setBrowseIndex((current) => (current + direction + 2) % 2)
        }
        onChangeNickname={(value) => {
          setNicknameDraft(value.slice(0, 12));
          setNicknameError("");
        }}
        onEnterRoom={enterRoom}
      />
    );
  } else if (screen === "settings") {
    content = (
      <SettingsScreen
        disabled={terminalPolicy.mutableControlsDisabled}
        desktop={desktop}
        preferences={preferences}
        preferenceMode={preferenceMode}
        rate={rate}
        roomTheme={pet.roomTheme}
        onChangeRate={changeRate}
        onChooseTheme={chooseTheme}
        onToggleMusic={() =>
          persistPreferences({
            ...preferences,
            musicEnabled: !preferences.musicEnabled,
          })
        }
        onToggleSfx={() =>
          persistPreferences({
            ...preferences,
            sfxEnabled: !preferences.sfxEnabled,
          })
        }
        onVisit={() => {
          setAudioGestureGranted(true);
          setScreen("room");
        }}
      />
    );
  } else {
    content = (
      <RoomScreen
        bob={bob}
        careAvailable={careAvailable}
        careLocked={careLocked}
        cleaningPhase={cleaningPhase}
        clock={clock}
        desktop={desktop}
        displayEmote={displayEmote}
        feedProgress={feedProgress}
        growthHint={growthHint}
        message={terminalPolicy.terminal ? terminalPolicy.terminalMessage! : message || ambientMessage}
        messageOpacity={!terminalPolicy.terminal && message ? messageOpacity : undefined}
        boopAvailable={boopAvailability.available}
        boopStatus={boopAvailability.reason}
        onBoop={boop}
        onCare={care}
        onOpenSettings={() => {
          if (!terminalPolicy.settingsDisabled && !careLocked) setScreen("settings");
        }}
        onSleep={sleeping ? wakeUp : () => setSleepMenuOpen(true)}
        pet={pet}
        pulse={pulse}
        reduced={reduced}
        sleeping={sleeping}
        stage={stage}
        wag={wag}
        zoom={zoom}
      />
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          s.page,
          screen === "room" && desktop && s.pageDesktop,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {content}
        {screen === "room" && (
          <>
            <Text style={s.footer}>
              {saveFailed || mode === "session"
                ? "Not saved • Session only"
                : "Saved locally"}
              {preferenceMode === "session" || preferenceMode === "invalid"
                ? " • Audio preferences session only"
                : " • Audio preferences remembered"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new Baby Jack game"
              onPress={() => setRestartOpen(true)}
              style={s.textButton}
            >
              <Text style={s.textButtonLabel}>NEW BABY</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <SleepDialog
        reduced={reduced}
        visible={sleepMenuOpen}
        onCancel={() => setSleepMenuOpen(false)}
        onChoose={beginSleep}
      />
      <RestartDialog
        reduced={reduced}
        visible={restartOpen}
        onCancel={() => setRestartOpen(false)}
        onConfirm={() => {
          setRestartOpen(false);
          fresh(false);
        }}
      />
    </SafeAreaView>
  );
}

function TitleScreen({
  bob,
  reduced,
  onEnter,
}: {
  bob: Animated.Value;
  reduced: boolean;
  onEnter: () => void;
}) {
  const sparkleOpacity = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });
  return (
    <View style={[s.screenCard, s.titleScreen]}>
      <Text style={s.flowLabel}>01 • START</Text>
      <Animated.Text
        style={[s.sparkles, !reduced && { opacity: sparkleOpacity }]}
      >
        ✦　✦　✦
      </Animated.Text>
      <Text style={s.heroTitle}>MR. BOOBINS’{`\n`}PET CLUB</Text>
      <Text style={s.subtitle}>A tiny pixel pup. A whole little life.</Text>
      <Animated.View
        style={[
          s.titleJack,
          !reduced && {
            transform: [
              {
                translateY: bob.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={s.ready}>READY!</Text>
        <MiniJack />
      </Animated.View>
      <ActionButton label="ENTER" onPress={onEnter} wide />
      <Text style={s.note}>
        First launch stays silent. Tap ENTER to enable remembered audio.
      </Text>
      <Text style={s.flowNote}>
        01 ENTER → 02 PET HUB{`\n`}Reduced motion keeps the pixels still.
      </Text>
    </View>
  );
}

function PetHubScreen({
  browseIndex,
  nickname,
  nicknameError,
  onBrowse,
  onChangeNickname,
  onEnterRoom,
}: {
  browseIndex: number;
  nickname: string;
  nicknameError: string;
  onBrowse: (direction: number) => void;
  onChangeNickname: (value: string) => void;
  onEnterRoom: () => void;
}) {
  return (
    <View style={s.screenCard}>
      <Text style={s.flowLabel}>02 • PET HUB</Text>
      <Text style={s.pixelTitle}>CHOOSE YOUR PET</Text>
      <Text style={s.subtitle}>One save. One very good boy.</Text>
      <View style={s.petCards}>
        <View style={[s.petCard, browseIndex === 0 && s.petCardSelected]}>
          <MiniJack />
          <Text style={s.petName}>Jack</Text>
        </View>
        <View style={[s.petCard, browseIndex === 1 && s.petCardSelected]}>
          <MiniJack locked />
          <Text style={s.petName}>LOCKED</Text>
        </View>
      </View>
      <View style={s.browseRow}>
        <UtilityButton label="−" accessibilityLabel="Browse previous pet" onPress={() => onBrowse(-1)} />
        <Text style={s.note}>More pets coming soon</Text>
        <UtilityButton label="+" accessibilityLabel="Browse next pet" onPress={() => onBrowse(1)} />
      </View>
      <View style={s.inputCard}>
        <Text style={s.inputLabel}>NICKNAME • 1–12 CHARACTERS</Text>
        <TextInput
          accessibilityLabel="Jack's nickname"
          maxLength={12}
          onChangeText={onChangeNickname}
          onSubmitEditing={onEnterRoom}
          returnKeyType="done"
          style={s.input}
          value={nickname}
        />
      </View>
      <View style={s.hubActions}>
        <ActionButton label="ADOPT JACK" onPress={onEnterRoom} compact />
        <ActionButton label="VISIT ROOM" onPress={onEnterRoom} tone="sleep" compact />
      </View>
      <Text accessibilityLiveRegion="polite" style={s.errorText}>
        {nicknameError || " "}
      </Text>
      <Text style={s.note}>
        Minus/plus browses Jack and locked cards only. It never creates another save.
      </Text>
      <Text style={s.flowNote}>02 ADOPT JACK / VISIT ROOM → 03 LIVING ROOM</Text>
    </View>
  );
}

function SettingsScreen({
  desktop,
  disabled,
  preferences,
  preferenceMode,
  rate,
  roomTheme,
  onChangeRate,
  onChooseTheme,
  onToggleMusic,
  onToggleSfx,
  onVisit,
}: {
  desktop: boolean;
  disabled: boolean;
  preferences: AudioPreferences;
  preferenceMode: PreferenceMode;
  rate: number;
  roomTheme: RoomTheme;
  onChangeRate: (direction: number) => void;
  onChooseTheme: (theme: RoomTheme) => void;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onVisit: () => void;
}) {
  return (
    <View style={[s.screenCard, desktop && s.settingsDesktop]}>
      <Text style={s.flowLabel}>04 • SETTINGS</Text>
      <Text style={s.pixelTitle}>SETTINGS</Text>
      <Text style={s.subtitle}>Remembered per player</Text>
      <SettingsToggle label="Sound effects" enabled={preferences.sfxEnabled} disabled={disabled} onPress={onToggleSfx} />
      <SettingsToggle label="Music" enabled={preferences.musicEnabled} disabled={disabled} onPress={onToggleMusic} />
      <Text style={s.sectionLabel}>ROOM THEME</Text>
      <View style={s.themeRow}>
        {(Object.keys(themeLabels) as RoomTheme[]).map((theme) => (
          <ChoiceButton
            key={theme}
            label={themeLabels[theme]}
            selected={roomTheme === theme}
            disabled={disabled}
            onPress={() => onChooseTheme(theme)}
          />
        ))}
      </View>
      <View style={s.settingRow}>
        <Text style={s.settingLabel}>Session clock speed</Text>
        <UtilityButton label="−" accessibilityLabel="Slower test clock" disabled={disabled} onPress={() => onChangeRate(-1)} />
        <Text style={s.rateLabel}>{rate}×</Text>
        <UtilityButton label="+" accessibilityLabel="Faster test clock" disabled={disabled} onPress={() => onChangeRate(1)} />
      </View>
      <Text style={s.daylightNote}>
        AUTOMATIC DAYLIGHT{`\n`}Morning 6–10 • Day 10–5 • Dusk 5–8 • Night 8–6
      </Text>
      <Text style={s.note}>
        Audio remains silent until ENTER or VISIT ROOM provides a player gesture. SFX and music remember their last settings.
      </Text>
      {(preferenceMode === "invalid" || preferenceMode === "session") && (
        <Text accessibilityLiveRegion="polite" style={s.errorText}>
          Audio preferences are session-only right now.
        </Text>
      )}
      <ActionButton label="VISIT ROOM" onPress={onVisit} wide />
      <Text style={s.flowNote}>04 SAVE → 03 LIVING ROOM</Text>
    </View>
  );
}

type RoomScreenProps = {
  bob: Animated.Value;
  boopAvailable: boolean;
  boopStatus: string;
  careAvailable: boolean;
  careLocked: boolean;
  cleaningPhase: CleaningPhase | null;
  clock: ReturnType<typeof getVirtualClock>;
  desktop: boolean;
  displayEmote: DogEmote;
  feedProgress: Animated.Value;
  growthHint: string;
  message: string;
  messageOpacity?: Animated.Value;
  onBoop: () => void;
  onCare: (action: CareAction) => void;
  onOpenSettings: () => void;
  onSleep: () => void;
  pet: PetState;
  pulse: Animated.Value;
  reduced: boolean;
  sleeping: boolean;
  stage: GrowthStage;
  wag: Animated.Value;
  zoom: Animated.Value;
};

function RoomScreen(props: RoomScreenProps) {
  const {
    bob,
    boopAvailable,
    boopStatus,
    careAvailable,
    careLocked,
    cleaningPhase,
    clock,
    desktop,
    displayEmote,
    feedProgress,
    growthHint,
    message,
    messageOpacity,
    onBoop,
    onCare,
    onOpenSettings,
    onSleep,
    pet,
    pulse,
    reduced,
    sleeping,
    stage,
    wag,
    zoom,
  } = props;
  const hygieneAppearance = pet.isDead
    ? "clear"
    : getHygieneAppearance(pet.needs.hygiene);
  return (
    <View style={[s.roomCard, desktop && s.roomCardDesktop]}>
      <View style={s.roomHeader}>
        <View>
          <Text style={s.flowLabel}>03 • LIVING ROOM</Text>
          <Text style={s.roomTitle}>
            {pet.name.toUpperCase()} • DAY {clock.day}
          </Text>
        </View>
        <UtilityButton label="⚙" accessibilityLabel="Open settings" disabled={pet.isDead || careLocked} onPress={onOpenSettings} />
      </View>
      <View style={[desktop && s.roomGrid]}>
        <View style={desktop && s.roomVisualColumn}>
          <PixelDog
            bob={bob}
            cleaningPhase={pet.isDead ? null : cleaningPhase}
            clockLabel={clock.label}
            daypart={clock.daypart}
            dead={pet.isDead}
            emote={displayEmote}
            feedProgress={feedProgress}
            hygieneAppearance={hygieneAppearance}
            large={desktop}
            lowHappiness={!pet.isDead && pet.needs.happiness <= 30}
            onBoop={onBoop}
            boopDisabled={!boopAvailable}
            boopStatus={boopStatus}
            pulse={pulse}
            reduced={reduced}
            roomTheme={pet.roomTheme}
            sleeping={sleeping}
            stage={stage}
            tired={!pet.isDead && pet.needs.energy <= 25}
            wag={wag}
            zoom={zoom}
          />
          <Text style={s.daypartCaption}>
            {clock.daypart.toUpperCase()} • 8:00 AM START • Morning 6–10 • Day 10–5 • Dusk 5–8 • Night 8–6
          </Text>
        </View>
        <View style={[s.roomControls, desktop && s.roomControlsDesktop]}>
          <FixedMessage message={message} opacity={messageOpacity} dead={pet.isDead} />
          <View style={s.meters}>
            {(Object.keys(pet.needs) as NeedKey[]).map((key) => (
              <NeedMeter key={key} label={needLabels[key]} value={pet.needs[key]} />
            ))}
          </View>
          <View style={s.actions}>
            <ActionButton label="BOOP" disabled={!boopAvailable} onPress={onBoop} compact />
            <ActionButton label="FEED" disabled={!careAvailable} onPress={() => onCare("feed")} compact />
            <ActionButton label="PLAY" disabled={!careAvailable} onPress={() => onCare("play")} compact />
            <ActionButton label="CLEAN" disabled={!careAvailable} onPress={() => onCare("clean")} compact />
            <ActionButton
              label={sleeping ? "WAKE UP" : "SLEEP"}
              disabled={pet.isDead || careLocked}
              onPress={onSleep}
              tone="sleep"
              compact
            />
          </View>
          <Text style={s.growthHint}>{growthHint}</Text>
          <Text style={s.note}>
            {careLocked
              ? "Cleaning runs for ~1.5s; other care is temporarily locked."
              : sleeping
                ? "Only WAKE UP is available while Jack sleeps."
                : clock.daypart === "night"
                  ? "Night suggests bedtime but never forces sleep."
                  : !boopAvailable
                    ? boopStatus
                    : "BOOP uses needs priority, changes no needs, and has a short cooldown."}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FixedMessage({
  message,
  opacity,
  dead,
}: {
  message: string;
  opacity?: Animated.Value;
  dead: boolean;
}) {
  return (
    <Animated.View
      style={[
        s.messageSlot,
        dead && s.messageDanger,
        opacity ? { opacity } : undefined,
      ]}
    >
      <Text accessibilityLiveRegion="polite" numberOfLines={2} style={s.messageText}>
        {message}
      </Text>
    </Animated.View>
  );
}

function NeedMeter({ label, value }: { label: string; value: number }) {
  const color = value <= 30 ? "#b94747" : value < 60 ? "#d79a38" : "#48784b";
  return (
    <View style={s.meter}>
      <View style={s.meterLabelRow}>
        <Text style={s.meterLabel}>{label}</Text>
        <Text style={s.meterValue}>{Math.round(value)}%</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { backgroundColor: color, width: `${Math.max(3, value)}%` }]} />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = "care",
  compact = false,
  wide = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "care" | "sleep" | "danger";
  compact?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.actionButton,
        tone === "sleep" && s.sleepButton,
        tone === "danger" && s.dangerButton,
        compact && s.actionCompact,
        wide && s.actionWide,
        pressed && !disabled && s.actionPressed,
        disabled && s.actionDisabled,
      ]}
    >
      <Text style={s.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function UtilityButton({
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.utilityButton, pressed && !disabled && s.utilityPressed, disabled && s.actionDisabled]}
    >
      <Text style={s.utilityLabel}>{label}</Text>
    </Pressable>
  );
}

function ChoiceButton({
  label,
  selected,
  disabled = false,
  onPress,
  accessibilityLabel = `Use ${label} room theme`,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.choiceButton, selected && s.choiceSelected, disabled && s.actionDisabled]}
    >
      <Text style={s.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

function SettingsToggle({
  label,
  enabled,
  disabled = false,
  onPress,
}: {
  label: string;
  enabled: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${label} ${enabled ? "on" : "off"}`}
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.settingRow, disabled && s.actionDisabled]}
    >
      <Text style={s.settingLabel}>{label}</Text>
      <Text style={s.toggleValue}>{enabled ? "ON" : "OFF"}</Text>
      <View style={[s.toggleTrack, enabled && s.toggleTrackOn]}>
        <View style={[s.toggleKnob, enabled && s.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

function SleepDialog({
  reduced,
  visible,
  onCancel,
  onChoose,
}: {
  reduced: boolean;
  visible: boolean;
  onCancel: () => void;
  onChoose: (hours: number) => void;
}) {
  return (
    <Modal transparent animationType={reduced ? "none" : "fade"} visible={visible} onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View accessibilityViewIsModal accessibilityLabel="Choose Jack's sleep duration" style={s.dialog}>
          <Text style={s.pixelTitle}>SLEEP TIMER</Text>
          <Text style={s.bodyText}>Choose a duration in accelerated pet hours.</Text>
          <View style={s.sleepOptions}>
            {sleepOptions.map((hours) => (
              <ChoiceButton
                key={hours}
                label={`${hours} HOUR${hours === 1 ? "" : "S"}`}
                selected={false}
                accessibilityLabel={`Sleep for ${hours} accelerated hour${hours === 1 ? "" : "s"}`}
                onPress={() => onChoose(hours)}
              />
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel sleep timer" onPress={onCancel} style={s.textButton}>
            <Text style={s.textButtonLabel}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RestartDialog({
  reduced,
  visible,
  onCancel,
  onConfirm,
}: {
  reduced: boolean;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent animationType={reduced ? "none" : "fade"} visible={visible} onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View accessibilityViewIsModal accessibilityLabel="Start a new Baby Jack" style={s.dialog}>
          <Text style={s.pixelTitle}>START A NEW BABY JACK?</Text>
          <Text style={s.bodyText}>This replaces this local pet’s age, needs, room, and sleep timer.</Text>
          <ActionButton label="NEW BABY" tone="danger" onPress={onConfirm} wide />
          <Pressable accessibilityRole="button" accessibilityLabel="Keep current Jack" onPress={onCancel} style={s.textButton}>
            <Text style={s.textButtonLabel}>KEEP JACK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const ink = "#27444c";
const outline = "#3a4850";
const surface = "#fffaf0";
const appBg = "#f8f0df";

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: appBg },
  page: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 12, gap: 12 },
  pageDesktop: { maxWidth: 1440, padding: 20 },
  recovery: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 18, backgroundColor: appBg },
  recoveryCard: { width: "100%", maxWidth: 420, padding: 20, gap: 16, borderRadius: 20, borderWidth: 3, borderColor: outline, backgroundColor: surface },
  screenCard: { width: "100%", maxWidth: 720, minHeight: 820, alignSelf: "center", padding: 20, gap: 18, borderRadius: 26, borderWidth: 2, borderColor: outline, backgroundColor: appBg, shadowColor: ink, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  titleScreen: { alignItems: "center", justifyContent: "space-between" },
  settingsDesktop: { maxWidth: 1000 },
  flowLabel: { alignSelf: "flex-start", color: "#60767c", fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
  pixelTitle: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 26, lineHeight: 34, fontWeight: "900", letterSpacing: 0.5, textAlign: "center" },
  heroTitle: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 32, lineHeight: 40, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  roomTitle: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 20, lineHeight: 28, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { color: "#60767c", fontFamily: "Inter, system-ui, sans-serif", fontSize: 15, lineHeight: 22, textAlign: "center" },
  bodyText: { color: ink, fontFamily: "Inter, system-ui, sans-serif", fontSize: 15, lineHeight: 22, textAlign: "center" },
  note: { color: "#60767c", fontFamily: "Inter, system-ui, sans-serif", fontSize: 13, lineHeight: 18, textAlign: "center" },
  flowNote: { color: "#60767c", fontFamily: "Inter, system-ui, sans-serif", fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: "auto" },
  sparkles: { color: "#ffdf8a", fontSize: 32, fontWeight: "900", textAlign: "center" },
  titleJack: { width: 180, height: 190, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: outline, borderRadius: 12, backgroundColor: surface },
  ready: { color: "#ef7659", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  petCards: { flexDirection: "row", gap: 14, justifyContent: "center" },
  petCard: { flex: 1, maxWidth: 220, minHeight: 190, padding: 12, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 2, borderColor: outline, backgroundColor: surface },
  petCardSelected: { borderColor: "#ef7659", borderWidth: 4 },
  petName: { color: ink, fontSize: 13, fontWeight: "800" },
  browseRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  inputCard: { minHeight: 78, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: outline, backgroundColor: surface },
  inputLabel: { color: "#60767c", fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
  input: { minHeight: 44, color: ink, fontFamily: "Inter, system-ui, sans-serif", fontSize: 16 },
  hubActions: { flexDirection: "row", gap: 12 },
  errorText: { minHeight: 18, color: "#b94747", fontSize: 13, lineHeight: 18, textAlign: "center", fontWeight: "700" },
  sectionLabel: { color: "#60767c", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  themeRow: { flexDirection: "row", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  settingRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderWidth: 2, borderColor: outline, borderRadius: 12, backgroundColor: surface },
  settingLabel: { flex: 1, color: ink, fontSize: 15, lineHeight: 22 },
  toggleValue: { minWidth: 32, color: "#60767c", fontSize: 12, fontWeight: "700" },
  toggleTrack: { width: 52, height: 30, padding: 4, justifyContent: "center", borderRadius: 999, backgroundColor: "#c9d0d0" },
  toggleTrackOn: { backgroundColor: "#48784b" },
  toggleKnob: { width: 22, height: 22, borderRadius: 999, backgroundColor: surface },
  toggleKnobOn: { alignSelf: "flex-end" },
  rateLabel: { minWidth: 50, color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 15, fontWeight: "900", textAlign: "center" },
  daylightNote: { color: "#60767c", fontSize: 15, lineHeight: 22, textAlign: "center" },
  roomCard: { width: "100%", alignSelf: "center", padding: 12, gap: 12, borderRadius: 26, borderWidth: 2, borderColor: outline, backgroundColor: appBg, shadowColor: ink, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  roomCardDesktop: { maxWidth: 1400, padding: 28 },
  roomHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  roomGrid: { flexDirection: "row", gap: 46, alignItems: "flex-start" },
  roomVisualColumn: { flex: 1.55 },
  roomControls: { gap: 10 },
  roomControlsDesktop: { flex: 1, paddingTop: 4 },
  daypartCaption: { minHeight: 36, paddingTop: 8, color: "#60767c", fontSize: 12, lineHeight: 18, textAlign: "center" },
  messageSlot: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderWidth: 2, borderLeftWidth: 6, borderColor: outline, borderRadius: 12, backgroundColor: surface, overflow: "hidden" },
  messageDanger: { borderLeftColor: "#b94747" },
  messageText: { flex: 1, color: ink, fontSize: 15, lineHeight: 22 },
  meters: { gap: 6 },
  meter: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: surface },
  meterLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meterLabel: { color: ink, fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.5 },
  meterValue: { color: ink, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  track: { height: 15, marginTop: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "#c9d0d0" },
  fill: { height: "100%", borderRadius: 999 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  actionButton: { minHeight: 64, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: outline, borderRadius: 20, backgroundColor: "#ef7659", shadowColor: ink, shadowOpacity: 0.18, shadowRadius: 0, shadowOffset: { width: 4, height: 4 } },
  actionCompact: { flexGrow: 1, flexBasis: "29%", minWidth: 102 },
  actionWide: { width: "100%", maxWidth: 300, alignSelf: "center" },
  sleepButton: { backgroundColor: "#7a82ce" },
  dangerButton: { backgroundColor: "#b94747" },
  actionPressed: { backgroundColor: "#c95842", transform: [{ translateX: 2 }, { translateY: 2 }] },
  actionDisabled: { backgroundColor: "#c9d0d0", opacity: 0.72 },
  actionLabel: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 18, lineHeight: 26, fontWeight: "900", letterSpacing: 0.5, textAlign: "center" },
  utilityButton: { minWidth: 54, minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: outline, borderRadius: 999, backgroundColor: surface },
  utilityPressed: { backgroundColor: "#ffdf8a" },
  utilityLabel: { color: ink, fontSize: 18, fontWeight: "800" },
  choiceButton: { minWidth: 92, minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: outline, borderRadius: 999, backgroundColor: surface },
  choiceSelected: { backgroundColor: "#ef7659" },
  choiceLabel: { color: ink, fontSize: 15, fontWeight: "800" },
  growthHint: { color: "#5a5688", fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  footer: { color: "#60767c", textAlign: "center", fontSize: 12 },
  textButton: { minWidth: 44, minHeight: 44, alignSelf: "center", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  textButtonLabel: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 12, fontWeight: "900" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(39,68,76,0.52)" },
  dialog: { width: "100%", maxWidth: 440, padding: 22, gap: 16, borderRadius: 26, borderWidth: 4, borderColor: outline, backgroundColor: surface },
  sleepOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
});
