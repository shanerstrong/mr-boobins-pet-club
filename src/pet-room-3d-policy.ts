import type { Jack3DClipName } from "./jack-3d-policy";
import type { GrowthStage } from "./simulation";

export const AUTHORED_CAMERA_VIEW = {
  fov: 30,
  position: [8.2, 5.15, 10.4] as const,
  target: [0, 0.72, -0.15] as const,
};

export const ALPHA_INSPECT_CAMERA = {
  enablePan: false,
  maxAzimuthAngle: 1.41,
  maxDistance: 18,
  maxPolarAngle: 1.36,
  minAzimuthAngle: -0.09,
  minDistance: 8.5,
  minPolarAngle: 0.65,
  persisted: false,
} as const;

/** The rug is the walkable surface at Jack's authored room position. */
export const ROOM_WALKABLE_SURFACE_Y = 0;
export const ROOM_FLOOR_PLANE_Y = -0.08;

/**
 * The validated Baby V2.3 runtime GLB has a root-identity, y=0 ground origin
 * across its runtime clips. Blender floor repair leaves a worst sampled
 * source-space minimum of -0.001067045 (training_sit during its transition).
 * At the largest runtime scale that is less than 0.0039 world units, so the established 0.005
 * clearance remains conservative without suppressing authored airborne motion.
 */
export const JACK_AUTHORED_GROUND_Y = 0;
export const JACK_SOURCE_WORST_MIN_Y = -0.0010670441338103062;
export const JACK_GROUND_CLEARANCE = 0.005;

/** Exact source-space mesh minima at the existing named reward-wait markers. */
export const JACK_HELD_POSE_CONTACT_Y = {
  training_sit: 0.0378951655185555,
  training_paw: 0.0739133784349668,
  training_up: 0.375816669530795,
} as const satisfies Partial<Record<Jack3DClipName, number>>;

export const GROUNDED_RUNTIME_CLIPS = [
  "idle",
  "tail_wag",
  "feed",
  "sleep",
  "play",
  "clean_reaction",
  "tired",
  "dirty",
  "death_rest",
  "training_sit",
  "training_paw",
  "training_up",
  "training_treat_receive",
  "training_treat_eat",
  "celebration_happy_hop",
  "celebration_spin_wag",
  "celebration_goofy_shimmy",
] as const satisfies readonly Jack3DClipName[];

export function resolveJackRoomTransform({
  clip,
  large,
  poseHeld,
  stage,
}: {
  clip: Jack3DClipName;
  large: boolean;
  poseHeld: boolean;
  stage: GrowthStage;
}) {
  if (stage !== "baby" && stage !== "little-puppy") {
    throw new Error(`The V2 Jack room transform does not support ${stage}.`);
  }
  if (!(GROUNDED_RUNTIME_CLIPS as readonly Jack3DClipName[]).includes(clip)) {
    throw new Error(`The V2 Jack ground contract does not cover ${clip}.`);
  }

  const scale = large ? 3.5 : 3.65;
  const heldContactY = poseHeld
    ? JACK_HELD_POSE_CONTACT_Y[
        clip as keyof typeof JACK_HELD_POSE_CONTACT_Y
      ] ?? 0
    : 0;
  return {
    position: [
      0.15,
      ROOM_WALKABLE_SURFACE_Y -
        (JACK_AUTHORED_GROUND_Y + heldContactY) * scale +
        JACK_GROUND_CLEARANCE,
      0.15,
    ] as const,
    rotation: [0, 0.55, 0] as const,
    scale,
  };
}
