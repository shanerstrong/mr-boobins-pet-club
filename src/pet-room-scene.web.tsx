/* eslint-disable react/no-unknown-property -- React Three Fiber elements intentionally use Three.js JSX props. */
import { Canvas, useThree } from "@react-three/fiber";
import { Center, useAnimations, useGLTF } from "@react-three/drei";
import { Asset } from "expo-asset";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
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
  PetRoomSceneShell,
  type PetRoomSceneProps,
} from "./pet-room-scene-shell";
import type { Daypart, RoomTheme } from "./simulation";
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
    rug: "#efd09b",
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
    rug: "#e5c48d",
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
  morning: { background: "#f8deb8", ambient: 1.8, key: "#ffd18e", keyIntensity: 3.2, sky: "#ffd594" },
  day: { background: "#d8ebee", ambient: 2.1, key: "#fff4d7", keyIntensity: 3.5, sky: "#87d8ee" },
  dusk: { background: "#7b718b", ambient: 1.3, key: "#f0a66b", keyIntensity: 3.1, sky: "#b879a6" },
  night: { background: "#263550", ambient: 0.75, key: "#f0bd72", keyIntensity: 2.6, sky: "#253962" },
};

export type { PetRoomSceneProps } from "./pet-room-scene-shell";

export function PetRoomScene(props: PetRoomSceneProps) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const supported = isJack3DStageSupported(props.stage) && !props.reduced && Boolean(JACK_MODEL_URL);

  if (!supported || failed) {
    return <PetRoomSceneShell {...props} />;
  }

  return (
    <PetRoomSceneShell {...props} hideDog={ready} objectVisuals={!ready}>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <SceneErrorBoundary onError={() => setFailed(true)}>
          <Canvas
            camera={{ fov: 30, near: 0.1, far: 100, position: [8.2, 6.1, 10.4] }}
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
      </View>
    </PetRoomSceneShell>
  );
}

function DollhouseRoom(props: PetRoomSceneProps & { onReady: () => void }) {
  const palette = themePalette[props.roomTheme];
  const light = daypartPalette[props.daypart];
  const clip = resolveJack3DClip(props);

  return (
    <>
      <color attach="background" args={[light.background]} />
      <ambientLight intensity={light.ambient} color="#f7f2e5" />
      <directionalLight position={[2.5, 7, 5]} intensity={light.keyIntensity} color={light.key} />
      <pointLight position={[-3.6, 3.1, -1.8]} intensity={props.daypart === "night" ? 12 : 4} distance={7} color="#ffd07f" />
      <FixedCamera />
      <RoomGeometry palette={palette} sky={light.sky} />
      <mesh position={[0.15, 0.015, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 28]} />
        <meshBasicMaterial color="#3b3029" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <JackModel
        clip={clip}
        animationRevision={props.trainingAnimationRevision}
        poseHeld={props.trainingPoseHeld}
        large={Boolean(props.large)}
        onReady={props.onReady}
      />
    </>
  );
}

function FixedCamera() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.lookAt(0, 0.7, -0.15);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function JackModel({
  animationRevision,
  clip,
  large,
  onReady,
  poseHeld,
}: {
  animationRevision: number;
  clip: Jack3DClipName;
  large: boolean;
  onReady: () => void;
  poseHeld: boolean;
}) {
  const root = useRef<Group>(null);
  const gltf = useGLTF(JACK_MODEL_URL);
  const scene = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, root);

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
      position={[0.15, 0.02, 0.15]}
      rotation={[0, -0.28, 0]}
      scale={large ? 3.05 : 3.2}
    >
      <Center bottom>
        <primitive object={scene} />
      </Center>
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
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
      <mesh position={[0, 0, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
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
