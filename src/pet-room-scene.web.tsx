/* eslint-disable react/no-unknown-property -- React Three Fiber elements intentionally use Three.js JSX props. */
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Asset } from "expo-asset";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  TOUCH,
  type Object3D,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  isJack3DStageSupported,
  isLoopingJack3DClip,
  resolveJack3DClip,
  type Jack3DClipName,
} from "./jack-3d-policy";
import {
  ALPHA_INSPECT_CAMERA,
  AUTHORED_CAMERA_VIEW,
  ROOM_FLOOR_PLANE_Y,
  ROOM_WALKABLE_SURFACE_Y,
  resolveJackRoomTransform,
} from "./pet-room-3d-policy";
import {
  PetRoomSceneShell,
  type PetRoomSceneProps,
} from "./pet-room-scene-shell";
import type { Daypart, RoomTheme } from "./simulation";
import {
  UP_CONTACT_SHADOW_STYLE,
  resolveSettledUpContactShadows,
} from "./up-contact-shadow-policy";
import jackModelModule from "../assets/3d/jack/v2/exports/preview/jack-baby-v2-all-clips.glb";

const JACK_MODEL_URL = Asset.fromModule(jackModelModule).uri;

const themePalette: Record<RoomTheme, {
  wall: string;
  sideWall: string;
  floor: string;
  rug: string;
  bed: string;
  curtain: string;
}> = {
  cozy: {
    wall: "#f1d6b8",
    sideWall: "#e8c69f",
    floor: "#bb8159",
    rug: "#ca945f",
    bed: "#c76559",
    curtain: "#d76c5c",
  },
  blue: {
    wall: "#cadbea",
    sideWall: "#b7cce0",
    floor: "#71859b",
    rug: "#4f7194",
    bed: "#765f9d",
    curtain: "#4f719c",
  },
  garden: {
    wall: "#dce7c7",
    sideWall: "#cadbb1",
    floor: "#9eb173",
    rug: "#c79a62",
    bed: "#62865a",
    curtain: "#6f9b64",
  },
};

const daypartPalette: Record<Daypart, {
  background: string;
  ambient: number;
  key: string;
  keyIntensity: number;
  sky: string;
}> = {
  morning: { background: "#f8deb8", ambient: 1.2, key: "#ffd18e", keyIntensity: 2.65, sky: "#ffd594" },
  day: { background: "#d8ebee", ambient: 1.35, key: "#fff4d7", keyIntensity: 2.8, sky: "#87d8ee" },
  dusk: { background: "#7b718b", ambient: 0.9, key: "#f0a66b", keyIntensity: 2.55, sky: "#b879a6" },
  night: { background: "#263550", ambient: 0.55, key: "#f0bd72", keyIntensity: 2.15, sky: "#253962" },
};

export type { PetRoomSceneProps } from "./pet-room-scene-shell";

export function PetRoomScene(props: PetRoomSceneProps) {
  const [failed, setFailed] = useState(false);
  const [inspectEnabled, setInspectEnabled] = useState(false);
  const [inspectResetRevision, setInspectResetRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const supported = isJack3DStageSupported(props.stage) && !props.reduced && Boolean(JACK_MODEL_URL);

  if (!supported || failed) {
    return <PetRoomSceneShell {...props} />;
  }

  return (
    <PetRoomSceneShell
      {...props}
      hideDog={ready}
      objectTargetsEnabled={!inspectEnabled}
      objectVisuals={!ready}
    >
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <SceneErrorBoundary onError={() => setFailed(true)}>
          <Canvas
            camera={{
              far: 100,
              fov: AUTHORED_CAMERA_VIEW.fov,
              near: 0.1,
              position: [...AUTHORED_CAMERA_VIEW.position],
            }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", () => setFailed(true), { once: true });
            }}
            style={styles.canvas}
          >
            <Suspense fallback={null}>
              <DollhouseRoom
                {...props}
                inspectEnabled={inspectEnabled}
                inspectResetRevision={inspectResetRevision}
                onReady={() => setReady(true)}
              />
            </Suspense>
          </Canvas>
        </SceneErrorBoundary>
        {ready && props.large && (
          <View pointerEvents="none" style={[styles.clockChip, props.large && styles.clockChipLarge]}>
            <Text style={styles.clockText}>{props.clockLabel}</Text>
          </View>
        )}
        {ready && (
          <View
            pointerEvents="box-none"
            style={[styles.inspectControls, !props.large && styles.inspectControlsCompact]}
          >
            <Pressable
              accessibilityLabel={`Alpha Inspect View ${inspectEnabled ? "on" : "off"}. ${
                inspectEnabled
                  ? "Drag to orbit and use the wheel or pinch to zoom."
                  : "Uses the authored fixed camera."
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: inspectEnabled }}
              onPress={() => setInspectEnabled((current) => !current)}
              style={({ pressed }) => [
                styles.inspectButton,
                !props.large && styles.inspectButtonCompact,
                pressed && styles.inspectButtonPressed,
              ]}
            >
              <Text style={[styles.inspectButtonText, !props.large && styles.inspectButtonTextCompact]}>
                {props.large
                  ? `ALPHA • INSPECT ${inspectEnabled ? "ON" : "OFF"}`
                  : `ALPHA\nINSPECT ${inspectEnabled ? "ON" : "OFF"}`}
              </Text>
            </Pressable>
            {inspectEnabled && (
              <Pressable
                accessibilityLabel="Reset Alpha Inspect View to the authored camera"
                accessibilityRole="button"
                onPress={() => setInspectResetRevision((current) => current + 1)}
                style={({ pressed }) => [
                  styles.inspectButton,
                  !props.large && styles.inspectButtonCompact,
                  pressed && styles.inspectButtonPressed,
                ]}
              >
                <Text style={[styles.inspectButtonText, !props.large && styles.inspectButtonTextCompact]}>
                  RESET VIEW
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </PetRoomSceneShell>
  );
}

function DollhouseRoom(
  props: PetRoomSceneProps & {
    inspectEnabled: boolean;
    inspectResetRevision: number;
    onReady: () => void;
  },
) {
  const palette = themePalette[props.roomTheme];
  const light = daypartPalette[props.daypart];
  const clip = resolveJack3DClip(props);
  const upContactShadows = resolveSettledUpContactShadows({
    clip,
    large: Boolean(props.large),
    poseHeld: props.trainingPoseHeld,
    stage: props.stage,
  });

  return (
    <>
      <color attach="background" args={[light.background]} />
      <ambientLight intensity={light.ambient} color="#f7f2e5" />
      <directionalLight position={[-2.8, 6.5, 4.5]} intensity={light.keyIntensity} color={light.key} />
      <pointLight position={[-3.6, 3.1, -1.8]} intensity={props.daypart === "night" ? 12 : 4} distance={7} color="#ffd07f" />
      <CameraRig
        inspectEnabled={props.inspectEnabled}
        resetRevision={props.inspectResetRevision}
      />
      <RoomGeometry palette={palette} sky={light.sky} />
      <mesh position={[0.15, 0.012, 0.15]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.25, 0.72, 1]}>
        <circleGeometry args={[0.82, 28]} />
        <meshBasicMaterial
          color="#40342d"
          depthWrite={false}
          opacity={upContactShadows.length > 0 ? 0.16 : 0.24}
          transparent
        />
      </mesh>
      {upContactShadows.map((position, index) => (
        <mesh
          key={`up-contact-${index}`}
          position={[...position]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[...UP_CONTACT_SHADOW_STYLE.scale]}
        >
          <circleGeometry args={[UP_CONTACT_SHADOW_STYLE.radius, 20]} />
          <meshBasicMaterial
            color={UP_CONTACT_SHADOW_STYLE.color}
            depthWrite={false}
            opacity={UP_CONTACT_SHADOW_STYLE.opacity}
            transparent
          />
        </mesh>
      ))}
      <JackModel
        clip={clip}
        animationRevision={props.trainingAnimationRevision}
        poseHeld={props.trainingPoseHeld}
        large={Boolean(props.large)}
        onReady={props.onReady}
        stage={props.stage}
      />
    </>
  );
}

function CameraRig({
  inspectEnabled,
  resetRevision,
}: {
  inspectEnabled: boolean;
  resetRevision: number;
}) {
  const camera = useThree((state) => state.camera);
  const [mountedResetRevision, setMountedResetRevision] = useState(resetRevision);
  const restoreAuthoredView = useCallback(() => {
    camera.position.set(...AUTHORED_CAMERA_VIEW.position);
    camera.lookAt(...AUTHORED_CAMERA_VIEW.target);
    camera.updateProjectionMatrix();
  }, [camera]);

  useLayoutEffect(() => {
    restoreAuthoredView();
    if (mountedResetRevision === resetRevision) return;
    const frame = requestAnimationFrame(() => setMountedResetRevision(resetRevision));
    return () => cancelAnimationFrame(frame);
  }, [inspectEnabled, mountedResetRevision, resetRevision, restoreAuthoredView]);

  if (!inspectEnabled || mountedResetRevision !== resetRevision) return null;

  return (
    <OrbitControls
      key={`alpha-inspect-${mountedResetRevision}`}
      enablePan={ALPHA_INSPECT_CAMERA.enablePan}
      enableRotate
      enableZoom
      makeDefault
      maxAzimuthAngle={ALPHA_INSPECT_CAMERA.maxAzimuthAngle}
      maxDistance={ALPHA_INSPECT_CAMERA.maxDistance}
      maxPolarAngle={ALPHA_INSPECT_CAMERA.maxPolarAngle}
      minAzimuthAngle={ALPHA_INSPECT_CAMERA.minAzimuthAngle}
      minDistance={ALPHA_INSPECT_CAMERA.minDistance}
      minPolarAngle={ALPHA_INSPECT_CAMERA.minPolarAngle}
      target={[...AUTHORED_CAMERA_VIEW.target]}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
    />
  );
}

function JackModel({
  animationRevision,
  clip,
  large,
  onReady,
  poseHeld,
  stage,
}: {
  animationRevision: number;
  clip: Jack3DClipName;
  large: boolean;
  onReady: () => void;
  poseHeld: boolean;
  stage: PetRoomSceneProps["stage"];
}) {
  const root = useRef<Group>(null);
  const gltf = useGLTF(JACK_MODEL_URL);
  const scene = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, root);
  const transform = resolveJackRoomTransform({ clip, large, poseHeld, stage });

  useEffect(() => {
    scene.traverse((node: Object3D) => {
      if (node instanceof Mesh) {
        node.castShadow = false;
        node.receiveShadow = false;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material instanceof MeshStandardMaterial) {
            material.roughness = Math.max(material.roughness, 0.72);
          }
        }
      }
    });
    onReady();
  }, [onReady, scene]);

  useEffect(() => {
    const action = actions[clip];
    if (!action) return;

    const looping = isLoopingJack3DClip(clip);
    action.reset();
    // AnimationAction is an imperative Three.js controller owned by the mixer.
    // eslint-disable-next-line react-hooks/immutability
    action.enabled = true;
    action.clampWhenFinished = !looping;
    action.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
    action.fadeIn(0.12).play();
    const commandHoldSeconds: Partial<Record<Jack3DClipName, number>> = {
      training_sit: 1,
      training_paw: 0.8,
      training_up: 0.85,
    };
    const holdSeconds = poseHeld ? commandHoldSeconds[clip] : undefined;
    if (holdSeconds !== undefined) {
      // The state machine holds the manifest's named pose marker while the
      // child-facing reward control waits for input.
      action.time = holdSeconds;
      action.paused = true;
    }

    return () => {
      action.stop();
    };
  }, [actions, animationRevision, clip, poseHeld]);

  return (
    <group
      ref={root}
      position={[...transform.position]}
      rotation={[...transform.rotation]}
      scale={transform.scale}
    >
      <primitive object={scene} />
    </group>
  );
}

function RoomGeometry({
  palette,
  sky,
}: {
  palette: (typeof themePalette)[RoomTheme];
  sky: string;
}) {
  return (
    <group>
      <mesh position={[0, ROOM_FLOOR_PLANE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 6.5]} />
        <meshStandardMaterial color={palette.floor} roughness={0.92} />
      </mesh>
      <mesh position={[0, 2.1, -3.2]}>
        <boxGeometry args={[10, 4.4, 0.16]} />
        <meshStandardMaterial color={palette.wall} roughness={0.95} />
      </mesh>
      <mesh position={[-4.9, 2.1, 0]}>
        <boxGeometry args={[0.16, 4.4, 6.5]} />
        <meshStandardMaterial color={palette.sideWall} roughness={0.95} />
      </mesh>
      <mesh position={[0, ROOM_WALKABLE_SURFACE_Y, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.65, 32]} />
        <meshStandardMaterial color={palette.rug} roughness={1} />
      </mesh>

      <group position={[2.35, 2.15, -3.08]}>
        <mesh>
          <boxGeometry args={[2.7, 1.65, 0.1]} />
          <meshBasicMaterial color="#f4e7cf" />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <planeGeometry args={[2.42, 1.36]} />
          <meshBasicMaterial color={sky} />
        </mesh>
        <mesh position={[0, 0, 0.13]}>
          <boxGeometry args={[0.1, 1.45, 0.08]} />
          <meshBasicMaterial color="#f4e7cf" />
        </mesh>
        <mesh position={[0, 0, 0.13]}>
          <boxGeometry args={[2.5, 0.1, 0.08]} />
          <meshBasicMaterial color="#f4e7cf" />
        </mesh>
        <mesh position={[-1.52, 0, 0.17]}>
          <boxGeometry args={[0.35, 1.9, 0.2]} />
          <meshStandardMaterial color={palette.curtain} roughness={0.9} />
        </mesh>
        <mesh position={[1.52, 0, 0.17]}>
          <boxGeometry args={[0.35, 1.9, 0.2]} />
          <meshStandardMaterial color={palette.curtain} roughness={0.9} />
        </mesh>
      </group>

      <group position={[-3.25, 0.34, -1.42]} rotation={[0, 0.18, 0]}>
        <mesh>
          <boxGeometry args={[2.25, 0.5, 1.22]} />
          <meshStandardMaterial color={palette.bed} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[1.94, 0.32, 0.98]} />
          <meshStandardMaterial color="#f1d4b7" roughness={1} />
        </mesh>
      </group>

      <group position={[-3.25, 0.13, 1.48]}>
        <mesh>
          <cylinderGeometry args={[0.43, 0.54, 0.25, 20]} />
          <meshStandardMaterial color="#65a8c8" roughness={0.58} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 20]} />
          <meshStandardMaterial color="#9a6644" roughness={1} />
        </mesh>
      </group>

      <group position={[3.05, 0.18, 0.78]} rotation={[Math.PI / 2, 0.2, 0]}>
        <mesh>
          <torusGeometry args={[0.34, 0.13, 10, 24]} />
          <meshStandardMaterial color="#5c9fc1" roughness={0.72} />
        </mesh>
      </group>

      <group position={[3.2, 0.025, 1.88]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.35, 1.08]} />
          <meshStandardMaterial color="#b9dce5" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <ringGeometry args={[0.18, 0.27, 4]} />
          <meshBasicMaterial color="#3b83a7" />
        </mesh>
      </group>

      <group position={[-3.85, 2.05, -2.72]}>
        <mesh>
          <cylinderGeometry args={[0.09, 0.12, 2.6, 12]} />
          <meshStandardMaterial color="#58473d" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.28, 0]}>
          <coneGeometry args={[0.7, 0.92, 16]} />
          <meshStandardMaterial color="#f1bd69" roughness={0.88} />
        </mesh>
      </group>
    </group>
  );
}

class SceneErrorBoundary extends Component<{
  children: ReactNode;
  onError: (error: Error) => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const styles = StyleSheet.create({
  canvas: { position: "absolute", inset: 0 },
  inspectControls: {
    position: "absolute",
    left: 10,
    top: 10,
    flexDirection: "row",
    gap: 6,
    zIndex: 30,
  },
  inspectControlsCompact: { top: 72, flexDirection: "column" },
  inspectButton: {
    minHeight: 44,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#314455",
    backgroundColor: "rgba(247, 240, 219, 0.94)",
  },
  inspectButtonPressed: { transform: [{ scale: 0.97 }], backgroundColor: "#ffe1a2" },
  inspectButtonCompact: { width: 96, minWidth: 96, paddingHorizontal: 4 },
  inspectButtonText: { color: "#23313c", fontSize: 11, lineHeight: 14, fontWeight: "900", letterSpacing: 0.5 },
  inspectButtonTextCompact: { fontSize: 10, lineHeight: 11, textAlign: "center" },
  clockChip: {
    position: "absolute",
    right: 12,
    top: 10,
    minWidth: 62,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#314455",
    backgroundColor: "rgba(235, 244, 225, 0.9)",
  },
  clockChipLarge: { right: 18, top: 16, minWidth: 76, minHeight: 36 },
  clockText: { color: "#23313c", fontSize: 12, lineHeight: 14, fontWeight: "900", letterSpacing: 1 },
});
