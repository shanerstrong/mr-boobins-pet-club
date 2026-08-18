import type { Jack3DClipName } from "./jack-3d-policy";
import {
  ROOM_WALKABLE_SURFACE_Y,
  resolveJackRoomTransform,
} from "./pet-room-3d-policy";
import type { GrowthStage } from "./simulation";

const SETTLED_UP_HIND_PAW_SOURCE_XZ = [
  [0.11090264038493716, -0.0520160993010302],
  [-0.11398011273450888, -0.04526018309619583],
] as const;

export const UP_CONTACT_SHADOW_STYLE = {
  color: "#332d29",
  opacity: 0.32,
  radius: 0.18,
  scale: [1, 0.46, 1] as const,
  y: ROOM_WALKABLE_SURFACE_Y + 0.002,
} as const;

export function resolveSettledUpContactShadows({
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
  if (clip !== "training_up" || !poseHeld) return [];

  const transform = resolveJackRoomTransform({ clip, large, poseHeld, stage });
  const rotationY = transform.rotation[1];
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);

  return SETTLED_UP_HIND_PAW_SOURCE_XZ.map(([sourceX, sourceZ]) => [
    transform.position[0] + (cosine * sourceX + sine * sourceZ) * transform.scale,
    UP_CONTACT_SHADOW_STYLE.y,
    transform.position[2] + (-sine * sourceX + cosine * sourceZ) * transform.scale,
  ] as const);
}
