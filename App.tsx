import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
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
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import {
  DEFAULT_AUDIO_PREFERENCES,
  DEFAULT_CARE_GUIDE_PROGRESS,
  DEFAULT_TRAINING_PROGRESS,
  completeTrainingCommand,
  loadAudioPreferences,
  loadCareGuideProgress,
  loadPet,
  loadTrainingProgress,
  saveAudioPreferences,
  saveCareGuideProgress,
  savePet,
  saveTrainingProgress,
  type AudioPreferences,
  type CareGuideProgress,
  type TrainingProgress,
} from "./src/persistence";
import {
  canPlayRememberedAudio,
  selectMusicTrack,
  syncAdaptiveMusic,
  syncSfxPlayers,
  type MusicTrack,
} from "./src/audio-policy";
import {
  createInteractionScheduler,
  getBoopAvailability,
  getTerminalUiPolicy,
  PLAY_REACTION_MS,
  resetTransientAnimations,
  resolvePetInteraction,
  restoreMessagePresentation,
  type PetInteraction,
} from "./src/interaction-policy";
import {
  MiniJack,
  type DogEmote,
  type TrainingVisualAction,
} from "./src/pixel-dog";
import { PetRoomScene } from "./src/pet-room-scene";
import {
  TRAINING_CELEBRATION_DURATION_MS,
  TRAINING_COMMANDS,
  TRAINING_COMMAND_DURATION_MS,
  TRAINING_EAT_DURATION_MS,
  TRAINING_TREAT_CONTACT_MS,
  createTrainingState,
  getTrainingAnnouncement,
  getReducedCelebrationPose,
  getTrainingMotionDuration,
  trainingCelebrationLabels,
  trainingCommandLabels,
  transitionTraining,
  type TrainingCelebration,
  type TrainingCommand,
  type TrainingState,
} from "./src/training-policy";
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
import { getReturnSummary } from "./src/return-policy";

type Mode = "loading" | "available" | "invalid" | "unavailable" | "session";
type Screen = "title" | "hub" | "room" | "settings";
type PreferenceMode = "loading" | "available" | "invalid" | "session";
type TrainingPersistenceMode = "loading" | "available" | "invalid" | "session";
type CareGuidePersistenceMode = "loading" | "available" | "invalid" | "session";
type SoundKind = "happy" | "sleepy" | "bark" | "shower" | "sneeze" | "huff";
type ReturnContext = { before: PetState };

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
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>(
    DEFAULT_TRAINING_PROGRESS,
  );
  const [trainingPersistenceMode, setTrainingPersistenceMode] =
    useState<TrainingPersistenceMode>("loading");
  const [trainingSaveFailed, setTrainingSaveFailed] = useState(false);
  const [careGuideProgress, setCareGuideProgress] = useState<CareGuideProgress>(
    DEFAULT_CARE_GUIDE_PROGRESS,
  );
  const [careGuidePersistenceMode, setCareGuidePersistenceMode] =
    useState<CareGuidePersistenceMode>("loading");
  const [careGuideSaveFailed, setCareGuideSaveFailed] = useState(false);
  const [trainingState, setTrainingState] = useState<TrainingState>(() =>
    createTrainingState(),
  );
  const trainingStateRef = useRef(trainingState);
  const [audioGestureGranted, setAudioGestureGranted] = useState(false);
  const [rate, setRate] = useState(DEFAULT_CLOCK_MULTIPLIER);
  const rateRef = useRef(DEFAULT_CLOCK_MULTIPLIER);
  const [nicknameDraft, setNicknameDraft] = useState("Jack");
  const [nicknameError, setNicknameError] = useState("");
  const [returnContext, setReturnContext] = useState<ReturnContext | null>(null);
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
  const [trainingAnimation] = useState(() => new Animated.Value(0));
  const [trainingAnimationRevision, setTrainingAnimationRevision] = useState(0);
  const [trainingTreatProgress] = useState(() => new Animated.Value(0));
  const happyPlayer = useAudioPlayer(require("./assets/audio/happy.wav"));
  const sleepyPlayer = useAudioPlayer(require("./assets/audio/sleepy.wav"));
  const barkPlayer = useAudioPlayer(require("./assets/audio/bark.wav"));
  const showerPlayer = useAudioPlayer(require("./assets/audio/shower.wav"));
  const sneezePlayer = useAudioPlayer(require("./assets/audio/sneeze.wav"));
  const huffPlayer = useAudioPlayer(require("./assets/audio/huff.wav"));
  const idleMusicPlayer = useAudioPlayer(require("./assets/audio/music-idle.wav"));
  const playMusicPlayer = useAudioPlayer(require("./assets/audio/music-play.wav"));
  const sleepMusicPlayer = useAudioPlayer(require("./assets/audio/music-sleep.wav"));
  const musicTrackRef = useRef<MusicTrack>(null);
  const petRef = useRef<PetState | null>(null);
  const native = Platform.OS !== "web";
  const sleeping = pet ? isSleeping(pet) : false;
  const playing = emote === "toy";
  const trainingOpen = trainingState.phase !== "closed";
  const modalOpen = trainingOpen || sleepMenuOpen || restartOpen;
  const trainingAnimating =
    trainingOpen && trainingState.phase !== "choosing";
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
    trainingAnimation.stopAnimation();
    trainingAnimation.setValue(0);
    trainingTreatProgress.stopAnimation();
    trainingTreatProgress.setValue(0);
    messageOpacity.stopAnimation();
    messageOpacity.setValue(1);
    setCleaningPhase(null);
    setCareLocked(false);
    setMessage("");
    setEmote(null);
    setSleepMenuOpen(false);
    setRestartOpen(false);
    setTrainingState((current) => {
      const next = transitionTraining(current, { type: "CLOSE" });
      trainingStateRef.current = next;
      return next;
    });
    manualWakeRef.current = false;
    [happyPlayer, sleepyPlayer, barkPlayer, showerPlayer, sneezePlayer, huffPlayer].forEach(
      (player) => player.pause(),
    );
    [idleMusicPlayer, playMusicPlayer, sleepMusicPlayer].forEach((player) => player.pause());
    musicTrackRef.current = null;
  }, [
    barkPlayer,
    feedProgress,
    happyPlayer,
    huffPlayer,
    messageOpacity,
    idleMusicPlayer,
    pulse,
    playMusicPlayer,
    showerPlayer,
    sleepyPlayer,
    sneezePlayer,
    sleepMusicPlayer,
    trainingAnimation,
    trainingTreatProgress,
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
    void Promise.all([
      loadPet(),
      loadAudioPreferences(),
      loadTrainingProgress(),
      loadCareGuideProgress(),
    ]).then(
      ([petResult, preferenceResult, trainingResult, careGuideResult]) => {
        if (!alive) return;
        const now = Date.now();
        if (petResult.kind === "loaded") {
          const wasSleeping = isSleeping(petResult.pet);
          const elapsedRealMs = Math.max(0, now - petResult.pet.lastUpdatedAt);
          const current = advancePet(
            petResult.pet,
            now,
            DEFAULT_CLOCK_MULTIPLIER,
          );
          previousSleepingRef.current = wasSleeping;
          setPet(current);
          setNicknameDraft(current.name);
          const summary = getReturnSummary({
            before: petResult.pet,
            after: current,
            elapsedRealMs,
          });
          setReturnContext(summary ? { before: petResult.pet } : null);
          setMode("available");
        } else if (petResult.kind === "missing") {
          const current = createNewPet(now);
          previousSleepingRef.current = false;
          setPet(current);
          setNicknameDraft(current.name);
          setReturnContext(null);
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
        if (trainingResult.kind === "loaded") {
          setTrainingProgress(trainingResult.progress);
          setTrainingPersistenceMode("available");
        } else if (trainingResult.kind === "missing") {
          setTrainingProgress(DEFAULT_TRAINING_PROGRESS);
          setTrainingPersistenceMode("available");
        } else {
          setTrainingProgress(DEFAULT_TRAINING_PROGRESS);
          setTrainingPersistenceMode(
            trainingResult.kind === "invalid" ? "invalid" : "session",
          );
        }
        if (careGuideResult.kind === "loaded") {
          setCareGuideProgress(careGuideResult.progress);
          setCareGuidePersistenceMode("available");
        } else if (careGuideResult.kind === "missing") {
          setCareGuideProgress(DEFAULT_CARE_GUIDE_PROGRESS);
          setCareGuidePersistenceMode("available");
        } else {
          setCareGuideProgress(DEFAULT_CARE_GUIDE_PROGRESS);
          setCareGuidePersistenceMode(
            careGuideResult.kind === "invalid" ? "invalid" : "session",
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
    if (!hydrated || trainingPersistenceMode !== "available") return;
    void saveTrainingProgress(trainingProgress).then(
      () => setTrainingSaveFailed(false),
      () => {
        setTrainingSaveFailed(true);
        setTrainingPersistenceMode("session");
      },
    );
  }, [hydrated, trainingPersistenceMode, trainingProgress]);

  useEffect(() => {
    if (!hydrated || careGuidePersistenceMode !== "available") return;
    void saveCareGuideProgress(careGuideProgress).then(
      () => setCareGuideSaveFailed(false),
      () => {
        setCareGuideSaveFailed(true);
        setCareGuidePersistenceMode("session");
      },
    );
  }, [careGuidePersistenceMode, careGuideProgress, hydrated]);

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
    if (reduced || sleeping || pet?.isDead || trainingAnimating) {
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
  }, [bob, native, pet?.isDead, reduced, sleeping, trainingAnimating, wag]);

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
    const nextTrack = selectMusicTrack({
      allowed: allowMusic,
      sleeping,
      playing,
    });
    syncAdaptiveMusic(
      {
        idle: idleMusicPlayer,
        play: playMusicPlayer,
        sleep: sleepMusicPlayer,
      },
      nextTrack,
      musicTrackRef.current,
    );
    musicTrackRef.current = nextTrack;
  }, [
    audioGestureGranted,
    idleMusicPlayer,
    pet?.isDead,
    playMusicPlayer,
    preferences.musicEnabled,
    playing,
    sleepMusicPlayer,
    sleeping,
  ]);

  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
      interactionScheduler.current.cancel();
      if (boopCooldownTimer.current) clearTimeout(boopCooldownTimer.current);
      feedProgress.stopAnimation();
      trainingAnimation.stopAnimation();
      trainingTreatProgress.stopAnimation();
      messageOpacity.stopAnimation();
      zoom.stopAnimation();
      idleMusicPlayer.pause();
      playMusicPlayer.pause();
      sleepMusicPlayer.pause();
    },
    [feedProgress, idleMusicPlayer, messageOpacity, playMusicPlayer, sleepMusicPlayer, trainingAnimation, trainingTreatProgress, zoom],
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

  const sendTrainingEvent = (event: Parameters<typeof transitionTraining>[1]) => {
    const current = trainingStateRef.current;
    const next = transitionTraining(current, event);
    if (next !== current) {
      trainingStateRef.current = next;
      setTrainingState(next);
    }
    return next;
  };

  const stopTrainingAnimations = () => {
    trainingAnimation.stopAnimation();
    trainingAnimation.setValue(0);
    trainingTreatProgress.stopAnimation();
    trainingTreatProgress.setValue(0);
  };

  const closeTraining = () => {
    stopTrainingAnimations();
    sendTrainingEvent({ type: "CLOSE" });
  };

  const runTrainingMotion = (
    duration: number,
    onComplete: () => void,
    reducedTarget = 1,
  ) => {
    trainingAnimation.stopAnimation();
    trainingAnimation.setValue(0);
    setTrainingAnimationRevision((current) => current + 1);
    Animated.timing(trainingAnimation, {
      toValue: reduced ? reducedTarget : 1,
      duration: getTrainingMotionDuration(reduced, duration),
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });
  };

  const finishCelebration = (
    session: number,
    celebration: TrainingCelebration,
  ) => {
    const current = trainingStateRef.current;
    if (
      current.phase !== "celebrating" ||
      current.session !== session ||
      current.celebration !== celebration
    ) {
      return;
    }
    sendTrainingEvent({ type: "CELEBRATION_COMPLETE", session });
  };

  const runCelebration = (
    session: number,
    celebration: TrainingCelebration,
  ) => {
    playSound("happy");
    runTrainingMotion(
      TRAINING_CELEBRATION_DURATION_MS[celebration],
      () => finishCelebration(session, celebration),
      getReducedCelebrationPose(celebration),
    );
  };

  const beginTraining = () => {
    const current = currentAliveSnapshot();
    if (!current || isSleeping(current) || careLocked) return;
    setReturnContext(null);
    interactionScheduler.current.begin();
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = null;
    feedProgress.stopAnimation();
    feedProgress.setValue(0);
    zoom.stopAnimation();
    zoom.setValue(0);
    pulse.stopAnimation();
    pulse.setValue(0);
    setMessage("");
    setEmote(null);
    setAudioGestureGranted(true);
    stopTrainingAnimations();
    sendTrainingEvent({ type: "OPEN" });
  };

  const chooseTrainingCommand = (command: TrainingCommand) => {
    const next = sendTrainingEvent({ type: "SELECT_COMMAND", command });
    if (next.phase !== "performing" || next.command !== command) return;
    const session = next.session;
    runTrainingMotion(TRAINING_COMMAND_DURATION_MS[command], () => {
      sendTrainingEvent({
        type: "COMMAND_COMPLETE",
        session,
        command,
      });
    });
  };

  const finishTrainingEat = (session: number) => {
    const current = trainingStateRef.current;
    if (
      current.phase !== "eating" ||
      current.session !== session ||
      !current.command
    ) {
      return;
    }
    const command = current.command;
    const completion = completeTrainingCommand(trainingProgress, command);
    const celebration = completion.celebration;
    setTrainingProgress(completion.progress);
    const next = sendTrainingEvent({
      type: "EAT_COMPLETE",
      session,
      celebration,
    });
    if (next.phase === "celebrating") {
      runCelebration(session, celebration);
    }
  };

  const giveTrainingTreat = () => {
    const next = sendTrainingEvent({ type: "GIVE_TREAT" });
    if (next.phase !== "treat-in-flight") return;
    const session = next.session;
    trainingTreatProgress.stopAnimation();
    trainingTreatProgress.setValue(0);
    Animated.timing(trainingTreatProgress, {
      toValue: 1,
      duration: getTrainingMotionDuration(reduced, TRAINING_TREAT_CONTACT_MS),
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (!finished) return;
      const contacted = sendTrainingEvent({ type: "TREAT_CONTACT", session });
      if (contacted.phase !== "eating") return;
      playSound("bark");
      runTrainingMotion(TRAINING_EAT_DURATION_MS, () =>
        finishTrainingEat(session),
      );
    });
  };

  const showTrainingAgain = () => {
    const next = sendTrainingEvent({ type: "SHOW_AGAIN" });
    if (next.phase === "celebrating" && next.celebration) {
      runCelebration(next.session, next.celebration);
    }
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
    if (resolution.allowed) setReturnContext(null);
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
    setCareGuideProgress((current) =>
      current.firstCareCompleted
        ? current
        : { ...current, firstCareCompleted: true },
    );
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
      setTransientMessage(
        "Zoomies! Jack grabs his toy and runs!",
        "toy",
        PLAY_REACTION_MS,
      );
      if (!reduced) {
        zoom.setValue(0);
        Animated.sequence([
          ...[0.35, 0.7, 0.35, 0.7, 0.35, 0.7, 0.35, 0.7, 0.35].map(
            (toValue) =>
              Animated.timing(zoom, {
                toValue,
                duration: PLAY_REACTION_MS / 10,
                useNativeDriver: native,
              }),
          ),
          Animated.timing(zoom, {
            toValue: 1,
            duration: PLAY_REACTION_MS / 10,
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
    const firstAdoption = !pet.adoptionCompleted;
    const next = { ...pet, name, adoptionCompleted: true };
    petRef.current = next;
    setPet(next);
    setNicknameDraft(name);
    if (firstAdoption) setReturnContext(null);
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
    setReturnContext(null);
    setTrainingProgress(DEFAULT_TRAINING_PROGRESS);
    setTrainingSaveFailed(false);
    setCareGuideProgress(DEFAULT_CARE_GUIDE_PROGRESS);
    setCareGuidePersistenceMode(session ? "session" : "available");
    setCareGuideSaveFailed(false);
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
  const returnSummary = returnContext
    ? getReturnSummary({
        before: returnContext.before,
        after: pet,
        elapsedRealMs: Math.max(
          0,
          pet.lastUpdatedAt - returnContext.before.lastUpdatedAt,
        ),
      })
    : null;
  const firstCareHint =
    pet.adoptionCompleted && !careGuideProgress.firstCareCompleted;
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
      ? "All grown up."
      : `Growth: ${Math.max(1, Math.ceil(nextGrowthMinutes / 60))}h + ${
          pet.growthMeals > stageIndex
            ? "meal ready"
            : "feed when hungry"
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
      : firstCareHint
        ? "Jack is home! Try FEED, PLAY, or CLEAN."
        : returnSummary
          ? returnSummary
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
  const trainingVisualAction: TrainingVisualAction =
    trainingState.phase === "eating"
      ? "eating"
      : trainingState.phase === "celebrating" ||
          trainingState.phase === "result"
        ? trainingState.celebration
        : trainingState.phase === "performing" ||
            trainingState.phase === "awaiting-treat" ||
            trainingState.phase === "treat-in-flight"
          ? trainingState.command
          : null;

  let content;
  if (screen === "title") {
    content = <TitleScreen bob={bob} reduced={reduced} onEnter={enter} />;
  } else if (screen === "hub") {
    content = (
      <PetHubScreen
        adopted={pet.adoptionCompleted}
        nickname={nicknameDraft}
        nicknameError={nicknameError}
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
        compactPhone={width < 350}
        desktop={desktop}
        displayEmote={displayEmote}
        feedProgress={feedProgress}
        growthHint={growthHint}
        message={terminalPolicy.terminal ? returnSummary ?? terminalPolicy.terminalMessage! : message || ambientMessage}
        messageOpacity={!terminalPolicy.terminal && message ? messageOpacity : undefined}
        boopAvailable={boopAvailability.available}
        boopStatus={boopAvailability.reason}
        onBoop={boop}
        onCare={care}
        onOpenSettings={() => {
          if (!terminalPolicy.settingsDisabled && !careLocked && !trainingOpen) setScreen("settings");
        }}
        onSleep={sleeping ? wakeUp : () => setSleepMenuOpen(true)}
        onTrain={beginTraining}
        pet={pet}
        pulse={pulse}
        reduced={reduced}
        sleeping={sleeping}
        stage={stage}
        wag={wag}
        zoom={zoom}
        trainingAction={trainingVisualAction}
        trainingAnimation={trainingAnimation}
        trainingAnimationRevision={trainingAnimationRevision}
        trainingPoseHeld={trainingState.phase === "awaiting-treat"}
        trainingDisabled={pet.isDead || sleeping || careLocked || trainingOpen}
        trainingTreatProgress={trainingTreatProgress}
        trainingTreatVisible={trainingState.phase === "treat-in-flight"}
        trainingModeOpen={trainingOpen}
      />
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        aria-hidden={modalOpen}
        accessibilityElementsHidden={modalOpen}
        {...(Platform.OS === "web" && modalOpen
          ? ({ inert: true } as const)
          : {})}
        contentContainerStyle={[
          s.page,
          screen === "room" && desktop && s.pageDesktop,
          screen === "room" && !desktop && s.pageRoomMobile,
        ]}
        importantForAccessibility={
          modalOpen ? "no-hide-descendants" : "auto"
        }
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
              {trainingSaveFailed ||
              trainingPersistenceMode === "session" ||
              trainingPersistenceMode === "invalid"
                ? " • Training progress session only"
                : " • Training progress remembered"}
              {careGuideSaveFailed ||
              careGuidePersistenceMode === "session" ||
              careGuidePersistenceMode === "invalid"
                ? " • Care guide session only"
                : " • Care guide remembered"}
            </Text>
            <FocusableButton
              accessibilityLabel="Start a new Baby Jack game"
              onPress={() => setRestartOpen(true)}
              style={() => s.textButton}
            >
              <Text style={s.textButtonLabel}>NEW BABY</Text>
            </FocusableButton>
          </>
        )}
      </ScrollView>
      <SleepDialog
        reduced={reduced}
        visible={sleepMenuOpen}
        onCancel={() => setSleepMenuOpen(false)}
        onChoose={beginSleep}
      />
      <TrainingDialog
        onCancel={closeTraining}
        onChooseCommand={chooseTrainingCommand}
        onDone={closeTraining}
        onGiveTreat={giveTrainingTreat}
        onShowAgain={showTrainingAgain}
        progress={trainingProgress}
        reduced={reduced}
        state={trainingState}
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
  adopted,
  nickname,
  nicknameError,
  onChangeNickname,
  onEnterRoom,
}: {
  adopted: boolean;
  nickname: string;
  nicknameError: string;
  onChangeNickname: (value: string) => void;
  onEnterRoom: () => void;
}) {
  return (
    <View style={s.screenCard}>
      <Text style={s.flowLabel}>02 • PET HUB</Text>
      <Text style={s.pixelTitle}>{adopted ? "WELCOME BACK" : "CHOOSE YOUR PET"}</Text>
      <Text style={s.subtitle}>
        {adopted ? "Jack saved your spot." : "One save. One very good boy."}
      </Text>
      <View style={s.petCards}>
        <View style={[s.petCard, s.petCardSelected]}>
          <MiniJack />
          <Text style={s.petName}>Jack</Text>
        </View>
        <View style={s.petCard}>
          <MiniJack locked />
          <Text style={s.petName}>COMING LATER</Text>
        </View>
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
        <ActionButton
          label={adopted ? "VISIT JACK" : "ADOPT JACK"}
          onPress={onEnterRoom}
          tone={adopted ? "sleep" : undefined}
          wide
        />
      </View>
      <Text accessibilityLiveRegion="polite" style={s.errorText}>
        {nicknameError || " "}
      </Text>
      <Text style={s.note}>
        More pets will join the club later. This build keeps one local Jack save.
      </Text>
      <Text style={s.flowNote}>02 {adopted ? "VISIT JACK" : "ADOPT JACK"} → 03 LIVING ROOM</Text>
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
      <Text style={s.note}>
        Music adapts automatically: calm while idle, upbeat during PLAY, and soft while sleeping. BOOP follows hunger, energy, hygiene, then happiness without changing needs.
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
  compactPhone: boolean;
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
  onTrain: () => void;
  pet: PetState;
  pulse: Animated.Value;
  reduced: boolean;
  sleeping: boolean;
  stage: GrowthStage;
  wag: Animated.Value;
  zoom: Animated.Value;
  trainingAction: TrainingVisualAction;
  trainingAnimation: Animated.Value;
  trainingAnimationRevision: number;
  trainingPoseHeld: boolean;
  trainingDisabled: boolean;
  trainingTreatProgress: Animated.Value;
  trainingTreatVisible: boolean;
  trainingModeOpen: boolean;
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
    onTrain,
    pet,
    pulse,
    reduced,
    sleeping,
    stage,
    wag,
    zoom,
    trainingAction,
    trainingAnimation,
    trainingAnimationRevision,
    trainingPoseHeld,
    trainingDisabled,
    trainingTreatProgress,
    trainingTreatVisible,
    trainingModeOpen,
  } = props;
  const hygieneAppearance = pet.isDead
    ? "clear"
    : getHygieneAppearance(pet.needs.hygiene);
  if (!desktop) {
    return (
      <MobileRoomScreen
        {...props}
        hygieneAppearance={hygieneAppearance}
      />
    );
  }
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
          <PetRoomScene
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
            careDisabled={!careAvailable}
            restDisabled={pet.isDead || careLocked}
            restLabel={sleeping ? "Wake" : "Rest"}
            onCare={onCare}
            onRest={onSleep}
            trainingAction={trainingAction}
            trainingProgress={trainingAnimation}
            trainingAnimationRevision={trainingAnimationRevision}
            trainingPoseHeld={trainingPoseHeld}
            trainingTreatProgress={trainingTreatProgress}
            trainingTreatVisible={trainingTreatVisible}
            trainingModeOpen={trainingModeOpen}
          />
          <Text
            accessibilityLabel={`${clock.daypart} lighting. New pets start at 8 AM. Morning is 6 to 10, day 10 to 5, dusk 5 to 8, and night 8 to 6.`}
            style={s.daypartCaption}
          >
            {clock.daypart.toUpperCase()} • {clock.label}
          </Text>
        </View>
        <View style={[s.roomControls, desktop && s.roomControlsDesktop]}>
          <View style={s.meters}>
            {(Object.keys(pet.needs) as NeedKey[]).map((key) => (
              <NeedMeter key={key} label={needLabels[key]} value={pet.needs[key]} />
            ))}
          </View>
          <FixedMessage message={message} opacity={messageOpacity} dead={pet.isDead} />
          <View style={s.actions}>
            <ActionButton label="BOOP" disabled={!boopAvailable} onPress={onBoop} compact />
            <ActionButton label="FEED" disabled={!careAvailable} onPress={() => onCare("feed")} compact />
            <ActionButton label="PLAY" disabled={!careAvailable} onPress={() => onCare("play")} compact />
            <ActionButton label="CLEAN" disabled={!careAvailable} onPress={() => onCare("clean")} compact />
            <ActionButton label="TRAIN" disabled={trainingDisabled} onPress={onTrain} compact />
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
              ? "Shower in progress."
              : sleeping
                ? "Only WAKE UP while Jack sleeps."
                : clock.daypart === "night"
                  ? "Bedtime suggested."
                  : !boopAvailable
                    ? boopStatus
                    : "BOOP is need-aware and reward-free."}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MobileRoomScreen({
  bob,
  boopAvailable,
  boopStatus,
  careAvailable,
  careLocked,
  cleaningPhase,
  clock,
  compactPhone,
  displayEmote,
  feedProgress,
  hygieneAppearance,
  message,
  messageOpacity,
  onBoop,
  onCare,
  onOpenSettings,
  onSleep,
  onTrain,
  pet,
  pulse,
  reduced,
  sleeping,
  stage,
  wag,
  zoom,
  trainingAction,
  trainingAnimation,
  trainingAnimationRevision,
  trainingPoseHeld,
  trainingDisabled,
  trainingTreatProgress,
  trainingTreatVisible,
  trainingModeOpen,
}: RoomScreenProps & { hygieneAppearance: ReturnType<typeof getHygieneAppearance> }) {
  const actionDisabled = !careAvailable;
  const restDisabled = pet.isDead || careLocked;

  return (
    <View style={s.deviceShell}>
      <View style={[s.deviceTopPanel, compactPhone && s.deviceTopPanelNarrow]}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          numberOfLines={1}
          style={[s.devicePetName, compactPhone && s.devicePetNameNarrow]}
        >
          {pet.name.toUpperCase()}
        </Text>
        <View style={[s.compactNeeds, compactPhone && s.compactNeedsNarrow]}>
          <CompactNeed compact={compactPhone} icon="♥" label="Happiness" value={pet.needs.happiness} tint="#ef7e73" />
          <CompactNeed compact={compactPhone} icon="●" label="Hygiene" value={pet.needs.hygiene} tint="#74bbd8" />
          <CompactNeed compact={compactPhone} icon="◆" label="Hunger" value={pet.needs.hunger} tint="#efbb4d" />
          <CompactNeed compact={compactPhone} icon="☾" label="Energy" value={pet.needs.energy} tint="#9b86c9" />
        </View>
        <View style={[s.deviceTimePanel, compactPhone && s.deviceTimePanelNarrow]}>
          {!compactPhone && <Text style={s.daypartGlyph}>{clock.daypart === "night" ? "☾" : clock.daypart === "dusk" ? "◐" : "☀"}</Text>}
          <View>
            <Text style={[s.deviceDaypart, compactPhone && s.deviceDaypartNarrow]}>{clock.daypart.toUpperCase()}</Text>
            <Text style={[s.deviceClock, compactPhone && s.deviceClockNarrow]}>{clock.label}</Text>
          </View>
        </View>
        <DeviceSettingsButton
          disabled={pet.isDead || careLocked}
          onPress={onOpenSettings}
        />
      </View>

      <View style={s.deviceScreenFrame}>
        <PetRoomScene
          bob={bob}
          boopDisabled={!boopAvailable}
          boopStatus={boopStatus}
          careDisabled={actionDisabled}
          cleaningPhase={pet.isDead ? null : cleaningPhase}
          clockLabel={clock.label}
          daypart={clock.daypart}
          dead={pet.isDead}
          emote={displayEmote}
          feedProgress={feedProgress}
          hygieneAppearance={hygieneAppearance}
          lowHappiness={!pet.isDead && pet.needs.happiness <= 30}
          onBoop={onBoop}
          onCare={onCare}
          onRest={onSleep}
          pulse={pulse}
          reduced={reduced}
          restDisabled={restDisabled}
          restLabel={sleeping ? "Wake" : "Rest"}
          roomTheme={pet.roomTheme}
          sleeping={sleeping}
          stage={stage}
          tired={!pet.isDead && pet.needs.energy <= 25}
          wag={wag}
          zoom={zoom}
          trainingAction={trainingAction}
          trainingProgress={trainingAnimation}
          trainingAnimationRevision={trainingAnimationRevision}
          trainingPoseHeld={trainingPoseHeld}
          trainingTreatProgress={trainingTreatProgress}
          trainingTreatVisible={trainingTreatVisible}
          trainingModeOpen={trainingModeOpen}
        />
        <View pointerEvents="none" style={s.mobileMessageOverlay}>
          <FixedMessage message={message} opacity={messageOpacity} dead={pet.isDead} overlay />
        </View>
        <View pointerEvents="none" style={s.boopHintBubble}>
          <Text style={s.boopHintText}>{boopAvailable ? "Boop the snoot!" : boopStatus}</Text>
        </View>
      </View>

      <View accessibilityLabel="Care actions" style={s.deviceActionStrip}>
        <DeviceActionButton icon="◆" label="Feed" tint="#ef8a78" disabled={actionDisabled} onPress={() => onCare("feed")} />
        <DeviceActionButton icon="◉" label="Play" tint="#a9cf82" disabled={actionDisabled} onPress={() => onCare("play")} />
        <DeviceActionButton icon="✦" label="Clean" tint="#91cadd" disabled={actionDisabled} onPress={() => onCare("clean")} />
        <DeviceActionButton icon="☾" label={sleeping ? "Wake" : "Rest"} tint="#b4a1d4" disabled={restDisabled} onPress={onSleep} />
        <DeviceActionButton icon="★" label="Train" tint="#efc553" disabled={trainingDisabled} onPress={onTrain} />
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.devicePawOrnament}>
        <View style={[s.pawToe, s.pawToeOne]} />
        <View style={[s.pawToe, s.pawToeTwo]} />
        <View style={[s.pawToe, s.pawToeThree]} />
        <View style={[s.pawToe, s.pawToeFour]} />
        <View style={s.pawPad} />
      </View>
    </View>
  );
}

function CompactNeed({ compact = false, icon, label, value, tint }: { compact?: boolean; icon: string; label: string; value: number; tint: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${Math.round(value)} percent`} style={[s.compactNeed, compact && s.compactNeedNarrow]}>
      <Text style={[s.compactNeedIcon, compact && s.compactNeedIconNarrow, { color: tint }]}>{icon}</Text>
      <View style={[s.compactNeedSegments, compact && s.compactNeedSegmentsNarrow]}>
        {[25, 50, 75].map((threshold) => (
          <View key={threshold} style={[s.compactNeedSegment, compact && s.compactNeedSegmentNarrow, value >= threshold && { backgroundColor: tint }]} />
        ))}
      </View>
    </View>
  );
}

function DeviceActionButton({
  disabled,
  icon,
  label,
  onPress,
  tint,
}: {
  disabled: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  tint: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.deviceAction,
        { backgroundColor: tint },
        pressed && !disabled && s.deviceActionPressed,
        focused && !disabled && s.focusRing,
        disabled && s.deviceActionDisabled,
      ]}
    >
      <Text style={s.deviceActionIcon}>{icon}</Text>
      <Text numberOfLines={1} style={s.deviceActionLabel}>{label}</Text>
    </Pressable>
  );
}

function DeviceSettingsButton({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.deviceSettings,
        pressed && !disabled && s.deviceActionPressed,
        focused && !disabled && s.focusRing,
        disabled && s.deviceActionDisabled,
      ]}
    >
      <Text style={s.deviceSettingsLabel}>⚙</Text>
    </Pressable>
  );
}

function FixedMessage({
  message,
  opacity,
  dead,
  overlay = false,
}: {
  message: string;
  opacity?: Animated.Value;
  dead: boolean;
  overlay?: boolean;
}) {
  return (
    <Animated.View
      style={[
        s.messageSlot,
        overlay && s.messageSlotOverlay,
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
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.actionButton,
        tone === "sleep" && s.sleepButton,
        tone === "danger" && s.dangerButton,
        compact && s.actionCompact,
        wide && s.actionWide,
        pressed && !disabled && s.actionPressed,
        focused && !disabled && s.focusRing,
        disabled && s.actionDisabled,
      ]}
    >
      <Text style={[s.actionLabel, compact && s.actionLabelCompact]}>{label}</Text>
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
      style={({ pressed }) => [s.utilityButton, pressed && !disabled && s.utilityPressed, focused && !disabled && s.focusRing, disabled && s.actionDisabled]}
    >
      <Text style={s.utilityLabel}>{label}</Text>
    </Pressable>
  );
}

function ChoiceButton({
  label,
  selected,
  disabled = false,
  initialFocus = false,
  onPress,
  accessibilityLabel = `Use ${label} room theme`,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  initialFocus?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const pressableRef = useRef<View>(null);
  useEffect(() => {
    if (!initialFocus || Platform.OS !== "web") return;
    const id = setTimeout(() => {
      const element = pressableRef.current as unknown as { focus?: () => void };
      element.focus?.();
    }, 50);
    return () => clearTimeout(id);
  }, [initialFocus]);
  return (
    <Pressable
      ref={pressableRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={[s.choiceButton, selected && s.choiceSelected, focused && !disabled && s.focusRing, disabled && s.actionDisabled]}
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
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${label} ${enabled ? "on" : "off"}`}
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={[s.settingRow, focused && !disabled && s.focusRing, disabled && s.actionDisabled]}
    >
      <Text style={s.settingLabel}>{label}</Text>
      <Text style={s.toggleValue}>{enabled ? "ON" : "OFF"}</Text>
      <View style={[s.toggleTrack, enabled && s.toggleTrackOn]}>
        <View style={[s.toggleKnob, enabled && s.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

function FocusableButton({
  accessibilityLabel,
  children,
  onPress,
  style,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  onPress: () => void;
  style: (pressed: boolean) => StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [style(pressed), focused && s.focusRing]}
    >
      {children}
    </Pressable>
  );
}

function TrainingDialog({
  onCancel,
  onChooseCommand,
  onDone,
  onGiveTreat,
  onShowAgain,
  progress,
  reduced,
  state,
}: {
  onCancel: () => void;
  onChooseCommand: (command: TrainingCommand) => void;
  onDone: () => void;
  onGiveTreat: () => void;
  onShowAgain: () => void;
  progress: TrainingProgress;
  reduced: boolean;
  state: TrainingState;
}) {
  const visible = state.phase !== "closed";
  const announcement = getTrainingAnnouncement(state);
  const commandLabel = state.command
    ? trainingCommandLabels[state.command]
    : null;
  const celebrationLabel = state.celebration
    ? trainingCelebrationLabels[state.celebration]
    : null;
  const commandIcons: Record<TrainingCommand, string> = {
    sit: "▰",
    paw: "◒",
    up: "↥",
  };

  return (
    <Modal
      animationType={reduced ? "none" : "fade"}
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={s.trainingOverlay}>
        <View
          accessibilityLabel="Training Mode"
          accessibilityViewIsModal
          style={s.trainingDialog}
        >
          <View style={s.trainingHeader}>
            <View style={s.trainingHeaderCopy}>
              <Text style={s.trainingEyebrow}>★ TRAINING MODE</Text>
              <Text style={s.trainingTitle}>
                {state.phase === "choosing"
                  ? "WHAT SHOULD JACK LEARN?"
                  : state.phase === "result"
                    ? `${celebrationLabel?.toUpperCase()}!`
                    : commandLabel
                      ? `${commandLabel.toUpperCase()} IN PROGRESS`
                      : "GOOD BOY IN PROGRESS"}
              </Text>
            </View>
            <FocusableButton
              accessibilityLabel="Close Training Mode"
              onPress={onCancel}
              style={(pressed) => [
                s.trainingClose,
                pressed && s.utilityPressed,
              ]}
            >
              <Text style={s.trainingCloseLabel}>×</Text>
            </FocusableButton>
          </View>

          <Text accessibilityLiveRegion="polite" style={s.trainingMessage}>
            {announcement}
          </Text>

          {state.phase === "choosing" && (
            <View accessibilityLabel="Training commands" style={s.trainingCommands}>
              {TRAINING_COMMANDS.map((command) => {
                const learned = progress.learned[command];
                return (
                  <FocusableButton
                    key={command}
                    accessibilityLabel={`${trainingCommandLabels[command]}. ${learned ? "Learned" : "New command"}.`}
                    onPress={() => onChooseCommand(command)}
                    style={(pressed) => [
                      s.trainingCommand,
                      pressed && s.trainingCommandPressed,
                    ]}
                  >
                    <Text style={s.trainingCommandIcon}>{commandIcons[command]}</Text>
                    <Text style={s.trainingCommandLabel}>
                      {trainingCommandLabels[command].toUpperCase()}
                    </Text>
                    <Text style={s.trainingLearned}>
                      {learned ? "LEARNED ✓" : "NEW"}
                    </Text>
                  </FocusableButton>
                );
              })}
            </View>
          )}

          {state.phase === "awaiting-treat" && (
            <FocusableButton
              accessibilityLabel={`Give Jack one unlimited treat for ${commandLabel}`}
              onPress={onGiveTreat}
              style={(pressed) => [
                s.trainingTreatButton,
                pressed && s.trainingCommandPressed,
              ]}
            >
              <Text style={s.trainingTreatIcon}>◆</Text>
              <Text style={s.trainingTreatLabel}>GIVE TREAT</Text>
            </FocusableButton>
          )}

          {(state.phase === "performing" ||
            state.phase === "treat-in-flight" ||
            state.phase === "eating" ||
            state.phase === "celebrating") && (
            <View accessible accessibilityLabel={announcement} style={s.trainingBusy}>
              <Text style={s.trainingBusyPixels}>
                {state.phase === "treat-in-flight"
                  ? "◆  ·  ·  →"
                  : state.phase === "eating"
                    ? "CRUNCH  CRUNCH"
                    : state.phase === "celebrating"
                      ? "★  ✦  ★"
                      : "●  ●  ●"}
              </Text>
              <Text style={s.trainingBusyLabel}>
                {reduced ? "STILL POSE • MOTION REDUCED" : "WATCH JACK"}
              </Text>
            </View>
          )}

          {state.phase === "result" && (
            <View style={s.trainingResultActions}>
              <FocusableButton
                accessibilityLabel={`Show ${celebrationLabel} again`}
                onPress={onShowAgain}
                style={(pressed) => [
                  s.trainingResultButton,
                  pressed && s.trainingCommandPressed,
                ]}
              >
                <Text style={s.trainingResultLabel}>SHOW AGAIN</Text>
              </FocusableButton>
              <FocusableButton
                accessibilityLabel="Finish Training Mode"
                onPress={onDone}
                style={(pressed) => [
                  s.trainingResultButton,
                  s.trainingDoneButton,
                  pressed && s.trainingCommandPressed,
                ]}
              >
                <Text style={s.trainingResultLabel}>DONE</Text>
              </FocusableButton>
            </View>
          )}

          <Text style={s.trainingFooterNote}>
            UNLIMITED TREATS • NO STREAKS • SAVED ON THIS DEVICE
          </Text>
        </View>
      </View>
    </Modal>
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
                initialFocus={visible && hours === sleepOptions[0]}
                accessibilityLabel={`Sleep for ${hours} accelerated hour${hours === 1 ? "" : "s"}`}
                onPress={() => onChoose(hours)}
              />
            ))}
          </View>
          <FocusableButton accessibilityLabel="Cancel sleep timer" onPress={onCancel} style={() => s.textButton}>
            <Text style={s.textButtonLabel}>CANCEL</Text>
          </FocusableButton>
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
          <FocusableButton accessibilityLabel="Keep current Jack" onPress={onCancel} style={() => s.textButton}>
            <Text style={s.textButtonLabel}>KEEP JACK</Text>
          </FocusableButton>
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
  pageRoomMobile: { maxWidth: 390, paddingHorizontal: 0, paddingTop: 4, paddingBottom: 12, gap: 8 },
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
  roomCard: { width: "100%", alignSelf: "center", padding: 10, gap: 8, borderRadius: 26, borderWidth: 2, borderColor: outline, backgroundColor: appBg, shadowColor: ink, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  roomCardDesktop: { maxWidth: 1400, padding: 20 },
  deviceShell: {
    width: "100%",
    maxWidth: 390,
    minHeight: 790,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 18,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: "#c9b994",
    backgroundColor: "#f3e6ca",
    shadowColor: "#5b4d39",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
  },
  deviceTopPanel: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#d2c19c",
    backgroundColor: "#fff6df",
    shadowColor: "#6e5d43",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  deviceTopPanelNarrow: { gap: 2, paddingHorizontal: 8 },
  devicePetName: { width: 60, color: "#4c3928", fontSize: 17, lineHeight: 23, fontWeight: "900", letterSpacing: 0.3 },
  devicePetNameNarrow: { width: 42, fontSize: 14, lineHeight: 19 },
  compactNeeds: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: 4 },
  compactNeedsNarrow: { gap: 0 },
  compactNeed: { minWidth: 27, alignItems: "center", gap: 3 },
  compactNeedNarrow: { minWidth: 20, gap: 1 },
  compactNeedIcon: { minHeight: 22, fontSize: 20, lineHeight: 22, fontWeight: "900" },
  compactNeedIconNarrow: { minHeight: 17, fontSize: 15, lineHeight: 17 },
  compactNeedSegments: { flexDirection: "row", gap: 2 },
  compactNeedSegmentsNarrow: { gap: 1 },
  compactNeedSegment: { width: 7, height: 5, borderRadius: 999, backgroundColor: "#d8ccb3" },
  compactNeedSegmentNarrow: { width: 4, height: 4 },
  deviceTimePanel: { minWidth: 78, paddingLeft: 6, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, borderLeftWidth: 1, borderLeftColor: "#dcccad" },
  deviceTimePanelNarrow: { minWidth: 56, paddingLeft: 3, gap: 0 },
  daypartGlyph: { color: "#e7af31", fontSize: 20, lineHeight: 24, fontWeight: "900" },
  deviceDaypart: { color: "#4c3928", fontSize: 11, lineHeight: 14, fontWeight: "900", letterSpacing: 0.4, textAlign: "right" },
  deviceDaypartNarrow: { fontSize: 9, lineHeight: 11, letterSpacing: 0 },
  deviceClock: { color: "#4c3928", fontSize: 13, lineHeight: 17, fontWeight: "900", textAlign: "right" },
  deviceClockNarrow: { fontSize: 10, lineHeight: 13 },
  deviceScreenFrame: {
    position: "relative",
    borderRadius: 29,
    borderWidth: 7,
    borderColor: "#4b4c49",
    backgroundColor: "#e6cfaa",
    overflow: "visible",
    shadowColor: "#4a3d2d",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  mobileMessageOverlay: { position: "absolute", left: 24, right: 24, top: 18, zIndex: 40 },
  boopHintBubble: { position: "absolute", left: 70, right: 70, bottom: -18, minHeight: 42, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 2, borderColor: "#d2c19c", backgroundColor: "#fff6df", zIndex: 45 },
  boopHintText: { color: "#4c3928", fontSize: 15, lineHeight: 20, fontWeight: "900", textAlign: "center" },
  deviceActionStrip: { minHeight: 92, paddingTop: 11, flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: 5 },
  deviceAction: { flex: 1, minWidth: 0, minHeight: 80, paddingHorizontal: 3, paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 17, borderWidth: 2, borderColor: "#a9946e", shadowColor: "#6d5d43", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 4 } },
  deviceActionPressed: { transform: [{ translateY: 3 }, { scale: 0.98 }], shadowOpacity: 0.08 },
  deviceActionDisabled: { opacity: 0.48 },
  deviceActionIcon: { color: "#4c3928", fontSize: 25, lineHeight: 28, fontWeight: "900" },
  deviceActionLabel: { color: "#4c3928", fontSize: 12, lineHeight: 16, fontWeight: "900", textAlign: "center" },
  deviceSettings: { width: 44, height: 44, marginLeft: 2, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#a9946e", borderRadius: 999, backgroundColor: "#efd6a8" },
  deviceSettingsLabel: { color: "#4c3928", fontSize: 19, lineHeight: 22, fontWeight: "900" },
  devicePawOrnament: { width: 78, height: 66, alignSelf: "center", position: "relative" },
  pawToe: { position: "absolute", width: 18, height: 24, borderRadius: 999, backgroundColor: "#5b99a4", borderWidth: 2, borderColor: "#3b6f78" },
  pawToeOne: { left: 4, top: 10, transform: [{ rotate: "-24deg" }] },
  pawToeTwo: { left: 24, top: 0, transform: [{ rotate: "-8deg" }] },
  pawToeThree: { right: 18, top: 0, transform: [{ rotate: "8deg" }] },
  pawToeFour: { right: 0, top: 12, transform: [{ rotate: "24deg" }] },
  pawPad: { position: "absolute", width: 47, height: 34, left: 16, bottom: 0, borderRadius: 22, backgroundColor: "#5b99a4", borderWidth: 2, borderColor: "#3b6f78", transform: [{ rotate: "-2deg" }] },
  roomHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  roomGrid: { flexDirection: "row", gap: 28, alignItems: "flex-start" },
  roomVisualColumn: { flex: 1.6 },
  roomControls: { gap: 6 },
  roomControlsDesktop: { flex: 1, paddingTop: 4 },
  daypartCaption: { minHeight: 22, paddingTop: 4, color: "#60767c", fontSize: 12, lineHeight: 16, textAlign: "center" },
  messageSlot: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderWidth: 2, borderLeftWidth: 6, borderColor: outline, borderRadius: 12, backgroundColor: surface, overflow: "hidden" },
  messageSlotOverlay: { height: 48, borderColor: "#d2c19c", borderLeftWidth: 2, borderRadius: 18, backgroundColor: "#fff6df", shadowColor: "#5b4d39", shadowOpacity: 0.16, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  messageDanger: { borderLeftColor: "#b94747" },
  messageText: { flex: 1, color: ink, fontSize: 15, lineHeight: 22 },
  meters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meter: { flexGrow: 1, flexBasis: "47%", minHeight: 44, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: surface },
  meterLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meterLabel: { color: ink, fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.5 },
  meterValue: { color: ink, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  track: { height: 8, marginTop: 3, borderRadius: 999, overflow: "hidden", backgroundColor: "#c9d0d0" },
  fill: { height: "100%", borderRadius: 999 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  actionButton: { minHeight: 64, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: outline, borderRadius: 20, backgroundColor: "#ef7659", shadowColor: ink, shadowOpacity: 0.18, shadowRadius: 0, shadowOffset: { width: 4, height: 4 } },
  actionCompact: { flexGrow: 1, flexBasis: "29%", minWidth: 96, minHeight: 48, paddingHorizontal: 10, borderRadius: 14 },
  actionWide: { width: "100%", maxWidth: 300, alignSelf: "center" },
  sleepButton: { backgroundColor: "#7a82ce" },
  dangerButton: { backgroundColor: "#b94747" },
  actionPressed: { backgroundColor: "#c95842", transform: [{ translateX: 2 }, { translateY: 2 }] },
  actionDisabled: { backgroundColor: "#c9d0d0", opacity: 0.72 },
  focusRing: { borderColor: "#1f5f82", borderWidth: 4 },
  actionLabel: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 18, lineHeight: 26, fontWeight: "900", letterSpacing: 0.5, textAlign: "center" },
  actionLabelCompact: { fontSize: 14, lineHeight: 18 },
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
  trainingOverlay: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 16, backgroundColor: "rgba(39,68,76,0.18)" },
  trainingDialog: { width: "100%", maxWidth: 480, minHeight: 228, alignSelf: "center", padding: 14, gap: 10, borderRadius: 22, borderWidth: 4, borderColor: outline, backgroundColor: "#fff6df", shadowColor: "#4a3d2d", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  trainingHeader: { minHeight: 48, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  trainingHeaderCopy: { flex: 1, gap: 2 },
  trainingEyebrow: { color: "#5a5688", fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.5 },
  trainingTitle: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 16, lineHeight: 21, fontWeight: "900" },
  trainingClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#a9946e", borderRadius: 999, backgroundColor: "#efd6a8" },
  trainingCloseLabel: { color: ink, fontSize: 27, lineHeight: 29, fontWeight: "900" },
  trainingMessage: { minHeight: 42, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 13, backgroundColor: "#f4e3bd", color: ink, fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center" },
  trainingCommands: { flexDirection: "row", gap: 7 },
  trainingCommand: { flex: 1, minWidth: 0, minHeight: 82, paddingHorizontal: 3, paddingVertical: 7, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 2, borderColor: "#a9946e", borderRadius: 15, backgroundColor: "#efd6a8" },
  trainingCommandPressed: { transform: [{ translateY: 2 }, { scale: 0.98 }], backgroundColor: "#efc553" },
  trainingCommandIcon: { color: "#5a5688", fontSize: 23, lineHeight: 25, fontWeight: "900" },
  trainingCommandLabel: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  trainingLearned: { color: "#48784b", fontSize: 10, lineHeight: 13, fontWeight: "900" },
  trainingTreatButton: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 3, borderColor: outline, borderRadius: 17, backgroundColor: "#efc553", shadowColor: ink, shadowOpacity: 0.2, shadowRadius: 0, shadowOffset: { width: 3, height: 3 } },
  trainingTreatIcon: { color: "#d07d35", fontSize: 23, lineHeight: 26, fontWeight: "900" },
  trainingTreatLabel: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 17, lineHeight: 22, fontWeight: "900" },
  trainingBusy: { minHeight: 68, alignItems: "center", justifyContent: "center", gap: 3 },
  trainingBusyPixels: { color: "#b9477f", fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 18, lineHeight: 23, fontWeight: "900", letterSpacing: 1 },
  trainingBusyLabel: { color: "#60767c", fontSize: 11, lineHeight: 15, fontWeight: "900" },
  trainingResultActions: { flexDirection: "row", gap: 9 },
  trainingResultButton: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderWidth: 3, borderColor: outline, borderRadius: 15, backgroundColor: "#efd6a8" },
  trainingDoneButton: { backgroundColor: "#a9cf82" },
  trainingResultLabel: { color: ink, fontFamily: "Roboto Mono, ui-monospace, monospace", fontSize: 13, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  trainingFooterNote: { color: "#60767c", fontSize: 9, lineHeight: 12, fontWeight: "800", textAlign: "center", letterSpacing: 0.2 },
});
