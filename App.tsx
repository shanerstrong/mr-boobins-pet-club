import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { loadPet, savePet } from './src/persistence';
import { PixelDog } from './src/pixel-dog';
import { advancePet, careForPet, createNewPet, type CareAction, type NeedKey, type PetState } from './src/simulation';

type StorageMode = 'loading' | 'available' | 'invalid' | 'unavailable' | 'session';

const actionCopy: Record<CareAction, { label: string; icon: string; reaction: string }> = {
  feed: { label: 'Feed', icon: '🍓', reaction: 'Snack time! Jack is delighted.' },
  play: { label: 'Play', icon: '★', reaction: 'Zoomies in the pet room!' },
  rest: { label: 'Rest', icon: '☾', reaction: 'A cozy power nap.' },
  clean: { label: 'Clean', icon: '✦', reaction: 'Fresh and fluffy!' },
};

const needCopy: Record<NeedKey, { label: string; color: string }> = {
  hunger: { label: 'Hunger', color: '#ed7a55' },
  happiness: { label: 'Happiness', color: '#e6ae38' },
  energy: { label: 'Energy', color: '#7a82ce' },
  hygiene: { label: 'Hygiene', color: '#4eaf9c' },
};

function formatPetTime(realMs: number) {
  const virtualMinutes = Math.max(0, Math.floor((realMs / 60_000) * 12));
  return `${virtualMinutes} pet min`;
}

export default function App() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [reaction, setReaction] = useState('Jack is watching the sunbeams.');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [bob] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => isMounted && setReducedMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loadPet().then((result) => {
      if (!active) return;
      const now = Date.now();
      setClockNow(now);
      if (result.kind === 'loaded') {
        setStorageMode('available');
        setPet(advancePet(result.pet, now));
      } else if (result.kind === 'missing') {
        setStorageMode('available');
        setPet(createNewPet(now));
      } else {
        setStorageMode(result.kind);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!pet || storageMode !== 'available') return;
    void savePet(pet).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  }, [pet, storageMode]);

  useEffect(() => {
    if (reducedMotion) {
      bob.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 760, useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 760, useNativeDriver }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [bob, reducedMotion, useNativeDriver]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setClockNow(now);
      setPet((current) => current && advancePet(current, now));
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  const celebrate = (message: string) => {
    setReaction(message);
    if (reducedMotion) return;
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 150, useNativeDriver }),
      Animated.timing(pulse, { toValue: 0, duration: 220, useNativeDriver }),
    ]).start();
  };

  const care = (action: CareAction) => {
    setPet((current) => current && careForPet(current, action, Date.now()));
    celebrate(actionCopy[action].reaction);
  };

  const startFresh = (sessionOnly = false) => {
    const now = Date.now();
    setClockNow(now);
    setSaveFailed(false);
    setStorageMode(sessionOnly ? 'session' : 'available');
    setPet(createNewPet(now));
    setReaction(sessionOnly ? 'Jack is ready for this session.' : 'Jack has a fresh new pet room.');
  };

  if (!pet) {
    const invalidSave = storageMode === 'invalid';
    return (
      <SafeAreaView style={styles.recovery}>
        <Text style={styles.loadingText}>{storageMode === 'loading' ? 'Opening Jack\'s pet room…' : invalidSave ? 'Saved pet needs recovery' : 'Local saves are unavailable'}</Text>
        {storageMode !== 'loading' && (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryText}>
              {invalidSave
                ? 'This browser has save data Jack cannot safely read. It has not been changed.'
                : 'This browser cannot read local storage. You can still play, but this session will not be saved.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={invalidSave ? 'Start fresh and replace the invalid saved pet' : 'Start a session-only pet room'}
              onPress={() => startFresh(!invalidSave)}
              style={({ pressed }) => [styles.recoveryButton, pressed && styles.actionPressed]}
            >
              <Text style={styles.recoveryButtonText}>{invalidSave ? 'START FRESH' : 'START SESSION ONLY'}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const realElapsed = clockNow - pet.createdAt;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MR. BOOBINS&apos; PET CLUB</Text>
            <Text style={styles.title}>Jack&apos;s Pet Room</Text>
          </View>
          <View style={styles.clockBadge} accessibilityLabel="Accelerated test clock">
            <Text style={styles.clockText}>×12 TEST CLOCK</Text>
          </View>
        </View>

        <PixelDog bob={bob} pulse={pulse} reaction={reaction} onPet={() => celebrate('Jack leans into the gentle pat.')} />

        <View style={styles.card} accessibilityLabel="Jack's current needs">
          <View style={styles.cardHeading}>
            <Text style={styles.cardTitle}>Care check-in</Text>
            <Text style={styles.petTime}>{formatPetTime(realElapsed)} together</Text>
          </View>
          {(Object.keys(pet.needs) as NeedKey[]).map((need) => {
            const details = needCopy[need];
            const value = pet.needs[need];
            return (
              <View key={need} style={styles.needRow} accessible accessibilityLabel={`${details.label}: ${value} out of 100`}>
                <Text style={styles.needLabel}>{details.label}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${value}%`, backgroundColor: details.color }]} />
                </View>
                <Text style={styles.needValue}>{value}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.actions} accessibilityLabel="Care actions">
          {(Object.keys(actionCopy) as CareAction[]).map((action) => (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={`${actionCopy[action].label} Jack`}
              accessibilityHint={`Changes Jack's needs and saves locally`}
              onPress={() => care(action)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Text style={styles.actionIcon}>{actionCopy[action].icon}</Text>
              <Text style={styles.actionLabel}>{actionCopy[action].label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>{saveFailed || storageMode === 'session' ? 'Not saved • Session only' : 'Saved locally'} • No sound • Reduced-motion friendly</Text>
          <Text style={styles.footerText}>Original V0 demo • Jack art is provisional</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f8f0df' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, gap: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f0df' },
  recovery: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, backgroundColor: '#f8f0df' },
  loadingText: { color: '#27444c', fontSize: 18, fontWeight: '800' },
  recoveryCard: { width: '100%', maxWidth: 460, gap: 16, padding: 20, borderWidth: 3, borderColor: '#27444c', borderRadius: 18, backgroundColor: '#fffaf0' },
  recoveryText: { color: '#27444c', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  recoveryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef7659', borderWidth: 3, borderColor: '#27444c', borderRadius: 12, paddingHorizontal: 14 },
  recoveryButtonText: { color: '#fffaf0', fontSize: 15, fontWeight: '900' },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  eyebrow: { color: '#b65146', letterSpacing: 1.2, fontSize: 11, fontWeight: '900' },
  title: { color: '#27444c', fontSize: 29, fontWeight: '900', marginTop: 2 },
  clockBadge: { backgroundColor: '#f5cb6b', borderWidth: 3, borderColor: '#27444c', paddingHorizontal: 8, paddingVertical: 7, marginTop: 2 },
  clockText: { color: '#27444c', fontSize: 10, fontWeight: '900' },
  card: { backgroundColor: '#fffaf0', padding: 17, borderRadius: 20, borderWidth: 3, borderColor: '#27444c', gap: 13 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  cardTitle: { color: '#27444c', fontSize: 19, fontWeight: '900' },
  petTime: { color: '#63777d', fontSize: 12, fontWeight: '700' },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  needLabel: { width: 82, color: '#27444c', fontSize: 13, fontWeight: '800' },
  track: { flex: 1, height: 15, backgroundColor: '#dfe4da', overflow: 'hidden', borderRadius: 4 },
  fill: { height: '100%', minWidth: 3, borderRadius: 4 },
  needValue: { width: 27, textAlign: 'right', color: '#27444c', fontSize: 13, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexGrow: 1, flexBasis: '42%', minHeight: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef7659', borderWidth: 4, borderColor: '#27444c', borderRadius: 16, gap: 2 },
  actionPressed: { transform: [{ translateY: 3 }], backgroundColor: '#d95c4d' },
  actionIcon: { color: '#fffaf0', fontSize: 23, fontWeight: '900' },
  actionLabel: { color: '#fffaf0', fontSize: 16, fontWeight: '900' },
  footerNote: { alignItems: 'center', gap: 3, paddingVertical: 6 },
  footerText: { color: '#63777d', fontSize: 12, textAlign: 'center' },
});
