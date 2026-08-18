import { describe, expect, it } from "vitest";
import {
  ALPHA_INSPECT_CAMERA,
  AUTHORED_CAMERA_VIEW,
  GROUNDED_RUNTIME_CLIPS,
  JACK_GROUND_CLEARANCE,
  JACK_HELD_POSE_CONTACT_Y,
  JACK_SOURCE_WORST_MIN_Y,
  ROOM_FLOOR_PLANE_Y,
  ROOM_WALKABLE_SURFACE_Y,
  resolveJackRoomTransform,
} from "./pet-room-3d-policy";

describe("pet-room 3D presentation policy", () => {
  it("keeps Alpha Inspect optional, bounded, non-panning, and session-only", () => {
    expect(ALPHA_INSPECT_CAMERA.persisted).toBe(false);
    expect(ALPHA_INSPECT_CAMERA.enablePan).toBe(false);
    expect(ALPHA_INSPECT_CAMERA.minDistance).toBeLessThan(ALPHA_INSPECT_CAMERA.maxDistance);
    expect(ALPHA_INSPECT_CAMERA.minPolarAngle).toBeLessThan(ALPHA_INSPECT_CAMERA.maxPolarAngle);
    expect(ALPHA_INSPECT_CAMERA.minAzimuthAngle).toBeLessThan(ALPHA_INSPECT_CAMERA.maxAzimuthAngle);
  });

  it("keeps the authored camera inside every inspect clamp", () => {
    const [x, y, z] = AUTHORED_CAMERA_VIEW.position;
    const [targetX, targetY, targetZ] = AUTHORED_CAMERA_VIEW.target;
    const dx = x - targetX;
    const dy = y - targetY;
    const dz = z - targetZ;
    const distance = Math.hypot(dx, dy, dz);
    const polarAngle = Math.acos(dy / distance);
    const azimuthAngle = Math.atan2(dx, dz);

    expect(distance).toBeGreaterThanOrEqual(ALPHA_INSPECT_CAMERA.minDistance);
    expect(distance).toBeLessThanOrEqual(ALPHA_INSPECT_CAMERA.maxDistance);
    expect(polarAngle).toBeGreaterThanOrEqual(ALPHA_INSPECT_CAMERA.minPolarAngle);
    expect(polarAngle).toBeLessThanOrEqual(ALPHA_INSPECT_CAMERA.maxPolarAngle);
    expect(azimuthAngle).toBeGreaterThanOrEqual(ALPHA_INSPECT_CAMERA.minAzimuthAngle);
    expect(azimuthAngle).toBeLessThanOrEqual(ALPHA_INSPECT_CAMERA.maxAzimuthAngle);
  });

  it("uses the authored y-zero ground reference for every supported clip and stage", () => {
    for (const stage of ["baby", "little-puppy"] as const) {
      for (const clip of GROUNDED_RUNTIME_CLIPS) {
        for (const large of [false, true]) {
          const transform = resolveJackRoomTransform({
            clip,
            large,
            poseHeld: false,
            stage,
          });
          expect(transform.position[1]).toBe(ROOM_WALKABLE_SURFACE_Y + JACK_GROUND_CLEARANCE);
          expect(transform.rotation).toEqual([0, 0.55, 0]);
          expect(transform.scale).toBe(large ? 3.5 : 3.65);
        }
      }
    }
  });

  it("aligns each named training reward-wait marker without moving the surrounding animation", () => {
    for (const clip of ["training_sit", "training_paw", "training_up"] as const) {
      const scale = 3.5;
      const playing = resolveJackRoomTransform({
        clip,
        large: true,
        poseHeld: false,
        stage: "baby",
      });
      const held = resolveJackRoomTransform({
        clip,
        large: true,
        poseHeld: true,
        stage: "baby",
      });
      expect(playing.position[1]).toBe(ROOM_WALKABLE_SURFACE_Y + JACK_GROUND_CLEARANCE);
      expect(held.position[1] + JACK_HELD_POSE_CONTACT_Y[clip] * scale).toBeCloseTo(
        ROOM_WALKABLE_SURFACE_Y + JACK_GROUND_CLEARANCE,
        12,
      );
    }
  });

  it("covers the measured animation dip without floating Jack above the rug", () => {
    const worstWorldDip = Math.abs(JACK_SOURCE_WORST_MIN_Y) * 3.65;
    expect(JACK_GROUND_CLEARANCE).toBeGreaterThan(worstWorldDip);
    expect(JACK_GROUND_CLEARANCE - worstWorldDip).toBeLessThan(0.001);
    expect(ROOM_FLOOR_PLANE_Y).toBeLessThan(ROOM_WALKABLE_SURFACE_Y);
  });

  it("rejects unsupported stages instead of borrowing the Baby ground contract", () => {
    expect(() =>
      resolveJackRoomTransform({
        clip: "idle",
        large: false,
        poseHeld: false,
        stage: "puppy",
      }),
    ).toThrow("does not support puppy");
  });
});
