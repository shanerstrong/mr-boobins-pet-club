import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type PixelDogProps = {
  bob: Animated.Value;
  pulse: Animated.Value;
  reaction: string;
  onPet: () => void;
};

export function PixelDog({ bob, pulse, reaction, onPet }: PixelDogProps) {
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  return (
    <View style={styles.scene} accessibilityLabel="Jack's cozy pet room">
      <View style={styles.window} />
      <View style={styles.rug} />
      <Animated.View style={[styles.dog, { transform: [{ translateY }, { scale }] }]}>
        <View style={[styles.pixel, styles.earLeft]} />
        <View style={[styles.pixel, styles.earRight]} />
        <View style={[styles.pixel, styles.head]} />
        <View style={[styles.pixel, styles.muzzle]} />
        <View style={[styles.pixel, styles.eyeLeft]} />
        <View style={[styles.pixel, styles.eyeRight]} />
        <View style={[styles.pixel, styles.nose]} />
        <View style={[styles.pixel, styles.body]} />
        <View style={[styles.pixel, styles.chest]} />
        <View style={[styles.pixel, styles.legLeft]} />
        <View style={[styles.pixel, styles.legRight]} />
        <View style={[styles.pixel, styles.tail]} />
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Give Jack a gentle pat"
        accessibilityHint="Jack responds with a happy reaction"
        onPress={onPet}
        style={styles.patButton}
      >
        <Text style={styles.patText}>PAT JACK</Text>
      </Pressable>
      <Text style={styles.reaction} accessibilityLiveRegion="polite">{reaction}</Text>
      <Text style={styles.provisional}>Provisional pixel Jack</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    height: 304,
    overflow: 'hidden',
    borderRadius: 26,
    backgroundColor: '#9ed6df',
    borderWidth: 5,
    borderColor: '#27444c',
    position: 'relative',
  },
  window: { position: 'absolute', width: 90, height: 84, right: 24, top: 25, backgroundColor: '#d9f1f0', borderWidth: 6, borderColor: '#5a8a91' },
  rug: { position: 'absolute', width: 230, height: 86, left: '50%', bottom: 28, marginLeft: -115, backgroundColor: '#f0bd61', borderWidth: 5, borderColor: '#bd7347', borderRadius: 18 },
  dog: { position: 'absolute', width: 190, height: 190, left: '50%', top: 57, marginLeft: -95 },
  pixel: { position: 'absolute' },
  earLeft: { width: 45, height: 71, top: 7, left: 25, backgroundColor: '#815239', borderWidth: 5, borderColor: '#3a2b2c' },
  earRight: { width: 45, height: 71, top: 7, right: 25, backgroundColor: '#815239', borderWidth: 5, borderColor: '#3a2b2c' },
  head: { width: 118, height: 100, top: 36, left: 36, backgroundColor: '#c98454', borderWidth: 6, borderColor: '#3a2b2c', borderRadius: 12 },
  muzzle: { width: 61, height: 40, top: 92, left: 65, backgroundColor: '#f2d29f', borderWidth: 4, borderColor: '#3a2b2c' },
  eyeLeft: { width: 13, height: 18, top: 70, left: 64, backgroundColor: '#24313b' },
  eyeRight: { width: 13, height: 18, top: 70, right: 64, backgroundColor: '#24313b' },
  nose: { width: 20, height: 13, top: 95, left: 85, backgroundColor: '#24313b' },
  body: { width: 116, height: 64, top: 126, left: 37, backgroundColor: '#c98454', borderWidth: 6, borderColor: '#3a2b2c', borderRadius: 10 },
  chest: { width: 38, height: 50, top: 137, left: 77, backgroundColor: '#f2d29f' },
  legLeft: { width: 30, height: 35, bottom: 0, left: 48, backgroundColor: '#815239', borderWidth: 5, borderColor: '#3a2b2c' },
  legRight: { width: 30, height: 35, bottom: 0, right: 48, backgroundColor: '#815239', borderWidth: 5, borderColor: '#3a2b2c' },
  tail: { width: 58, height: 24, top: 142, right: 0, backgroundColor: '#815239', borderWidth: 5, borderColor: '#3a2b2c' },
  patButton: { position: 'absolute', right: 16, bottom: 14, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#ffdf8a', borderWidth: 3, borderColor: '#3a2b2c' },
  patText: { fontFamily: 'monospace', fontSize: 12, fontWeight: '900', color: '#3a2b2c' },
  reaction: { position: 'absolute', top: 15, left: 16, right: 120, color: '#24313b', fontSize: 16, fontWeight: '900' },
  provisional: { position: 'absolute', left: 16, bottom: 14, color: '#3a2b2c', fontSize: 11, fontWeight: '700' },
});
