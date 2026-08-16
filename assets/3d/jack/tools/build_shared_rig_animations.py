"""Build Jack's canonical shared skeleton and reusable animation library.

This file is executed by Blender in background mode.  It authors no gameplay
events and never changes simulation state.  All clips keep the root transform
fixed; Baby, Teen and Adult meshes will bind to this one rest skeleton.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


FPS = 30


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--rig-contract", required=True)
    parser.add_argument("--clip-manifest", required=True)
    parser.add_argument("--blend-path", required=True)
    parser.add_argument("--glb-path", required=True)
    parser.add_argument("--metrics-path", required=True)
    return parser.parse_args(forwarded)


ARGS = parse_args()
RIG_CONTRACT = json.loads(Path(ARGS.rig_contract).read_text(encoding="utf-8"))
CLIP_MANIFEST = json.loads(Path(ARGS.clip_manifest).read_text(encoding="utf-8"))


# Canonical normalized rest skeleton. Jack faces -Y, Z is up, and every age
# mesh will use these exact bind transforms before any presentation-only scale.
BONES = {
    "root": ((0.0, 0.0, 0.0), (0.0, 0.0, 0.12), None),
    "pelvis": ((0.0, 0.27, 0.68), (0.0, 0.14, 0.72), "root"),
    "spine_01": ((0.0, 0.14, 0.72), (0.0, 0.01, 0.76), "pelvis"),
    "spine_02": ((0.0, 0.01, 0.76), (0.0, -0.13, 0.79), "spine_01"),
    "chest": ((0.0, -0.13, 0.79), (0.0, -0.28, 0.82), "spine_02"),
    "neck_01": ((0.0, -0.28, 0.82), (0.0, -0.35, 0.90), "chest"),
    "neck_02": ((0.0, -0.35, 0.90), (0.0, -0.43, 0.98), "neck_01"),
    "head": ((0.0, -0.43, 0.98), (0.0, -0.56, 1.06), "neck_02"),
    "muzzle": ((0.0, -0.56, 1.03), (0.0, -0.76, 0.99), "head"),
    "jaw": ((0.0, -0.55, 0.99), (0.0, -0.71, 0.94), "head"),
    "ear_L_base": ((-0.075, -0.48, 1.07), (-0.105, -0.465, 1.17), "head"),
    "ear_L_tip": ((-0.105, -0.465, 1.17), (-0.135, -0.45, 1.30), "ear_L_base"),
    "ear_R_base": ((0.075, -0.48, 1.07), (0.105, -0.465, 1.17), "head"),
    "ear_R_tip": ((0.105, -0.465, 1.17), (0.135, -0.45, 1.30), "ear_R_base"),
    "scapula_L": ((-0.16, -0.22, 0.80), (-0.17, -0.20, 0.65), "chest"),
    "upper_arm_L": ((-0.17, -0.20, 0.65), (-0.18, -0.27, 0.48), "scapula_L"),
    "forearm_L": ((-0.18, -0.27, 0.48), (-0.18, -0.31, 0.25), "upper_arm_L"),
    "wrist_L": ((-0.18, -0.31, 0.25), (-0.18, -0.33, 0.105), "forearm_L"),
    "front_paw_L": ((-0.18, -0.33, 0.105), (-0.18, -0.405, 0.055), "wrist_L"),
    "front_toe_L": ((-0.18, -0.405, 0.055), (-0.18, -0.49, 0.035), "front_paw_L"),
    "scapula_R": ((0.16, -0.22, 0.80), (0.17, -0.20, 0.65), "chest"),
    "upper_arm_R": ((0.17, -0.20, 0.65), (0.18, -0.27, 0.48), "scapula_R"),
    "forearm_R": ((0.18, -0.27, 0.48), (0.18, -0.31, 0.25), "upper_arm_R"),
    "wrist_R": ((0.18, -0.31, 0.25), (0.18, -0.33, 0.105), "forearm_R"),
    "front_paw_R": ((0.18, -0.33, 0.105), (0.18, -0.405, 0.055), "wrist_R"),
    "front_toe_R": ((0.18, -0.405, 0.055), (0.18, -0.49, 0.035), "front_paw_R"),
    "thigh_L": ((-0.16, 0.25, 0.70), (-0.19, 0.31, 0.52), "pelvis"),
    "shin_L": ((-0.19, 0.31, 0.52), (-0.19, 0.21, 0.31), "thigh_L"),
    "hock_L": ((-0.19, 0.21, 0.31), (-0.19, 0.33, 0.14), "shin_L"),
    "rear_paw_L": ((-0.19, 0.33, 0.14), (-0.19, 0.30, 0.065), "hock_L"),
    "rear_toe_L": ((-0.19, 0.30, 0.065), (-0.19, 0.19, 0.035), "rear_paw_L"),
    "thigh_R": ((0.16, 0.25, 0.70), (0.19, 0.31, 0.52), "pelvis"),
    "shin_R": ((0.19, 0.31, 0.52), (0.19, 0.21, 0.31), "thigh_R"),
    "hock_R": ((0.19, 0.21, 0.31), (0.19, 0.33, 0.14), "shin_R"),
    "rear_paw_R": ((0.19, 0.33, 0.14), (0.19, 0.30, 0.065), "hock_R"),
    "rear_toe_R": ((0.19, 0.30, 0.065), (0.19, 0.19, 0.035), "rear_paw_R"),
    "tail_01": ((0.0, 0.28, 0.72), (0.0, 0.45, 0.73), "pelvis"),
    "tail_02": ((0.0, 0.45, 0.73), (0.0, 0.62, 0.69), "tail_01"),
    "tail_03": ((0.0, 0.62, 0.69), (0.0, 0.78, 0.62), "tail_02"),
    "tail_04": ((0.0, 0.78, 0.62), (0.0, 0.92, 0.54), "tail_03"),
}


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.render.fps_base = 1.0


def build_armature() -> bpy.types.Object:
    armature = bpy.data.armatures.new("Jack_Shared_Rig")
    armature.display_type = "STICK"
    rig = bpy.data.objects.new("Jack_Shared_Rig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = {}
    for name in RIG_CONTRACT["bones"]:
        head, tail, _parent = BONES[name]
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.roll = 0.0
        bone.use_deform = name != "root"
        edit_bones[name] = bone

    for name in RIG_CONTRACT["bones"]:
        _head, _tail, parent_name = BONES[name]
        if parent_name:
            edit_bones[name].parent = edit_bones[parent_name]
            edit_bones[name].use_connect = (
                tuple(round(value, 6) for value in edit_bones[name].head)
                == tuple(round(value, 6) for value in edit_bones[parent_name].tail)
            )

    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")

    rig["schema_version"] = 2
    rig["presentation_only"] = True
    rig["simulation_mutation"] = False
    rig["root_motion_gameplay"] = False
    rig["forward_axis"] = "-Y"
    rig["up_axis"] = "Z"
    rig["required_morph_targets"] = ",".join(
        RIG_CONTRACT["requiredMorphTargetsPerSkin"]
    )
    return rig


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def pose_key(
    rig: bpy.types.Object,
    bone_name: str,
    frame: float,
    *,
    rotation_degrees: tuple[float, float, float] | None = None,
    location: tuple[float, float, float] | None = None,
    location_armature: tuple[float, float, float] | None = None,
    scale: tuple[float, float, float] | None = None,
) -> None:
    bone = rig.pose.bones[bone_name]
    if rotation_degrees is not None:
        bone.rotation_euler = tuple(math.radians(value) for value in rotation_degrees)
        bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    if location is not None and location_armature is not None:
        raise ValueError("Use either local location or armature-space location, not both")
    if location_armature is not None:
        # PoseBone.location follows the bone's rest-space axes. Convert authored
        # up/down offsets from armature space so lowering poses do not move up
        # or diagonally on sloped spine bones.
        bone.location = bone.bone.matrix_local.to_3x3().inverted() @ Vector(location_armature)
        bone.keyframe_insert("location", frame=frame, group=bone_name)
    elif location is not None:
        bone.location = location
        bone.keyframe_insert("location", frame=frame, group=bone_name)
    if scale is not None:
        bone.scale = scale
        bone.keyframe_insert("scale", frame=frame, group=bone_name)


def root_keys(rig: bpy.types.Object, end_frame: float) -> None:
    for frame in (0.0, end_frame):
        pose_key(rig, "root", frame, rotation_degrees=(0.0, 0.0, 0.0), location=(0.0, 0.0, 0.0))


def tail_wag_keys(rig: bpy.types.Object, frames: list[float], amount: float = 24.0) -> None:
    for index, frame in enumerate(frames):
        sign = 0.0 if index in (0, len(frames) - 1) else (-1.0 if index % 2 else 1.0)
        pose_key(rig, "tail_01", frame, rotation_degrees=(0.0, 0.0, amount * sign))
        pose_key(rig, "tail_02", frame, rotation_degrees=(0.0, 0.0, amount * 0.75 * sign))
        pose_key(rig, "tail_03", frame, rotation_degrees=(0.0, 0.0, amount * 0.55 * sign))
        pose_key(rig, "tail_04", frame, rotation_degrees=(0.0, 0.0, amount * 0.35 * sign))


def side_rest_limb_keys(rig: bpy.types.Object, frame: float, amount: float = 1.0) -> None:
    """Fold straight standing limbs into a relaxed side-rest silhouette."""
    for side in ("L", "R"):
        pose_key(rig, f"upper_arm_{side}", frame, rotation_degrees=(34 * amount, 0, 0))
        pose_key(rig, f"forearm_{side}", frame, rotation_degrees=(-52 * amount, 0, 0))
        pose_key(rig, f"wrist_{side}", frame, rotation_degrees=(18 * amount, 0, 0))
        # The left hind leg is the ground-side limb in this roll direction;
        # fold it farther so its paw does not become a single low point that
        # props the torso visibly above the floor.
        hind_amount = amount * (1.45 if side == "L" else 1.0)
        pose_key(
            rig,
            f"thigh_{side}",
            frame,
            rotation_degrees=(-28 * hind_amount, 0, 0),
            location_armature=(0, 0, 0.16 * amount) if side == "L" else None,
        )
        pose_key(rig, f"shin_{side}", frame, rotation_degrees=(46 * hind_amount, 0, 0))
        pose_key(rig, f"hock_{side}", frame, rotation_degrees=(-16 * hind_amount, 0, 0))
    pose_key(
        rig,
        "tail_01",
        frame,
        rotation_degrees=(38 * amount, 0, 0),
        location_armature=(0, 0, 0.16 * amount),
    )
    pose_key(rig, "tail_02", frame, rotation_degrees=(20 * amount, 0, 0))
    pose_key(rig, "tail_03", frame, rotation_degrees=(10 * amount, 0, 0))


def author_clip(rig: bpy.types.Object, clip: dict[str, object]) -> bpy.types.Action:
    name = str(clip["name"])
    duration_ms = int(clip["durationMs"])
    end = duration_ms * FPS / 1000.0
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action["duration_ms"] = duration_ms
    action["loop"] = bool(clip["loop"])
    action["presentation_only"] = True
    action["simulation_mutation"] = False
    action["root_motion"] = False

    rig.animation_data.action = action
    reset_pose(rig)
    root_keys(rig, end)

    if name == "idle":
        for frame, chest_x, head_x in ((0, 0, 0), (45, 2.0, -1.0), (90, 0, 0)):
            pose_key(rig, "chest", frame, rotation_degrees=(chest_x, 0, 0))
            pose_key(rig, "head", frame, rotation_degrees=(head_x, 0, 0))
        for frame, tilt in ((0, 0), (22, -3), (45, 2), (68, -2), (90, 0)):
            pose_key(rig, "ear_L_base", frame, rotation_degrees=(0, tilt, 0))
            pose_key(rig, "ear_R_base", frame, rotation_degrees=(0, -tilt, 0))
    elif name == "tail_wag":
        tail_wag_keys(rig, [0, 6, 12, 18, 24, 30, 36], 28)
        for frame, yaw in ((0, 0), (9, -2), (18, 2), (27, -2), (36, 0)):
            pose_key(rig, "pelvis", frame, rotation_degrees=(0, 0, yaw))
    elif name == "feed":
        for frame, neck, head, jaw in ((0, 0, 0, 0), (12, 12, 18, 0), (24, 22, 28, 20), (36, 16, 22, 5), (48, 24, 30, 18), (66, 0, 0, 0)):
            pose_key(rig, "neck_01", frame, rotation_degrees=(neck, 0, 0))
            pose_key(rig, "head", frame, rotation_degrees=(head, 0, 0))
            pose_key(rig, "jaw", frame, rotation_degrees=(jaw, 0, 0))
        tail_wag_keys(rig, [0, 11, 22, 33, 44, 55, 66], 16)
    elif name == "sleep":
        # Roll the whole character onto one side around the pelvis' longitudinal
        # axis.  The earlier blockout lowered an upright dog through the floor;
        # this pose uses an actual side-rest silhouette and only enough vertical
        # offset to place the shoulder/haunch on the ground.
        for frame, z, side_roll, breath in ((0, -0.46, 86, 0), (48, -0.465, 86, 2), (96, -0.46, 86, 0)):
            pose_key(rig, "pelvis", frame, rotation_degrees=(0, side_roll, 0), location_armature=(0, 0, z))
            pose_key(rig, "chest", frame, rotation_degrees=(-8 + breath, 0, 0))
            pose_key(rig, "head", frame, rotation_degrees=(20, 0, -8))
            pose_key(rig, "neck_01", frame, rotation_degrees=(14, 0, 0))
            side_rest_limb_keys(rig, frame, 0.7)
    elif name == "wake":
        for frame, z, side_roll, head, chest in (
            (0, -0.46, 86, 20, -8),
            (18, -0.32, 60, 8, 2),
            (30, -0.12, 30, -10, 10),
            (42, 0, 0, 0, 0),
        ):
            pose_key(rig, "pelvis", frame, rotation_degrees=(0, side_roll, 0), location_armature=(0, 0, z))
            pose_key(rig, "head", frame, rotation_degrees=(head, 0, 0))
            pose_key(rig, "chest", frame, rotation_degrees=(chest, 0, 0))
            side_rest_limb_keys(rig, frame, 0.7 * side_roll / 86)
    elif name == "play":
        for frame, chest_z, chest_x, head_x in ((0, 0, 0, 0), (15, -0.18, 18, -10), (30, -0.22, 22, -14), (45, -0.10, 8, -4), (60, -0.22, 22, -14), (75, -0.08, 6, -2), (90, 0, 0, 0)):
            pose_key(rig, "chest", frame, rotation_degrees=(chest_x, 0, 0), location_armature=(0, 0, chest_z))
            pose_key(rig, "head", frame, rotation_degrees=(head_x, 0, 0))
        tail_wag_keys(rig, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90], 30)
    elif name == "clean_reaction":
        phases = {"water": 0.0, "washout": 12.0, "shake": 24.0, "sparkle": 34.5, "complete": 45.0}
        action["phase_frames"] = ",".join(f"{key}:{value}" for key, value in phases.items())
        for label, frame in phases.items():
            marker = action.pose_markers.new(label)
            # Blender timeline markers are integer-frame only. The exact
            # 34.5-frame / 1150ms boundary remains in the action property and
            # JSON manifest; the visible marker is placed on nearest frame 35.
            marker.frame = int(math.floor(frame + 0.5))
        for frame, yaw in ((0, 0), (12, 0), (24, -14), (27, 16), (30, -16), (33, 14), (34.5, 0), (45, 0)):
            pose_key(rig, "chest", frame, rotation_degrees=(0, 0, yaw))
            pose_key(rig, "head", frame, rotation_degrees=(0, 0, -1.25 * yaw))
            pose_key(rig, "ear_L_base", frame, rotation_degrees=(0, 0, 0.7 * yaw))
            pose_key(rig, "ear_R_base", frame, rotation_degrees=(0, 0, 0.7 * yaw))
    elif name == "boop_comfortable":
        for frame, scale_y, head_x, jaw in ((0, 1.0, 0, 0), (2.4, 0.86, 3, 0), (6, 1.04, -5, 6), (13, 1.0, -8, 12), (21, 1.0, 0, 0)):
            pose_key(rig, "muzzle", frame, scale=(1, scale_y, 1))
            pose_key(rig, "head", frame, rotation_degrees=(head_x, 0, 0))
            pose_key(rig, "jaw", frame, rotation_degrees=(jaw, 0, 0))
    elif name in {
        "boop_need_hunger",
        "boop_need_energy",
        "boop_need_hygiene",
        "boop_need_happiness",
    }:
        gesture = {
            "boop_need_hunger": (12, 0),
            "boop_need_energy": (-8, 5),
            "boop_need_hygiene": (6, -7),
            "boop_need_happiness": (-12, -3),
        }[name]
        for frame, scale_y, head_z in ((0, 1.0, 0), (2.4, 0.88, 0), (6, 1.03, -5), (14, 1.0, gesture[0]), (24, 1.0, 0)):
            pose_key(rig, "muzzle", frame, scale=(1, scale_y, 1))
            pose_key(rig, "head", frame, rotation_degrees=(gesture[1], 0, head_z))
    elif name == "boop_rejected":
        for frame, scale_y, head_x in ((0, 1.0, 0), (2.4, 0.91, 2), (5, 1.02, 5), (9, 1.0, 0)):
            pose_key(rig, "muzzle", frame, scale=(1, scale_y, 1))
            pose_key(rig, "head", frame, rotation_degrees=(head_x, 0, 0))
    elif name == "tired":
        for frame, chest, head in ((0, -4, 16), (30, -2, 18), (60, -4, 16)):
            pose_key(rig, "chest", frame, rotation_degrees=(chest, 0, 0))
            pose_key(rig, "neck_01", frame, rotation_degrees=(12, 0, 0))
            pose_key(rig, "head", frame, rotation_degrees=(head, 0, 0))
            pose_key(rig, "ear_L_base", frame, rotation_degrees=(8, 0, -4))
            pose_key(rig, "ear_R_base", frame, rotation_degrees=(8, 0, 4))
    elif name == "dirty":
        for frame, yaw in ((0, 0), (6, -16), (10, 18), (14, -20), (18, 18), (22, -12), (27, 0)):
            pose_key(rig, "chest", frame, rotation_degrees=(0, 0, yaw))
            pose_key(rig, "head", frame, rotation_degrees=(0, 0, -1.2 * yaw))
            pose_key(rig, "tail_01", frame, rotation_degrees=(0, 0, 0.6 * yaw))
    elif name == "death_rest":
        # Gentle loss-of-strength into the same physically plausible side-rest
        # family as sleep.  Root remains fixed; this is presentation only.
        for frame, z, side_roll, chest, head in (
            (0, 0, 0, 0, 0),
            (16, -0.04, 18, -4, 8),
            (32, -0.18, 42, -8, 16),
            (46, -0.40, 78, -12, 24),
            (54, -0.46, 86, -14, 30),
        ):
            pose_key(rig, "pelvis", frame, rotation_degrees=(0, side_roll, 0), location_armature=(0, 0, z))
            pose_key(rig, "chest", frame, rotation_degrees=(chest, 0, 0))
            pose_key(rig, "neck_01", frame, rotation_degrees=(14, 0, 0))
            pose_key(rig, "head", frame, rotation_degrees=(head, 0, -8))
            side_rest_limb_keys(rig, frame, 0.7 * side_roll / 86)
    else:
        raise ValueError(f"Unsupported clip {name}")

    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"
    reset_pose(rig)
    return action


def export(rig: bpy.types.Object, actions: list[bpy.types.Action]) -> None:
    blend_path = Path(ARGS.blend_path).resolve()
    glb_path = Path(ARGS.glb_path).resolve()
    metrics_path = Path(ARGS.metrics_path).resolve()
    for path in (blend_path, glb_path, metrics_path):
        path.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = max(int(action.frame_range[1]) for action in actions)
    scene["jack_asset_role"] = "shared-rig-animation-library"
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["root_motion_gameplay"] = False
    scene["clip_manifest"] = "assets/3d/jack/animations/clip-manifest.json"

    rig.animation_data.action = actions[0]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_frame_range=False,
        export_force_sampling=True,
        export_anim_slide_to_zero=True,
        export_anim_single_armature=True,
        export_optimize_animation_size=False,
        export_skins=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )

    metrics = {
        "schemaVersion": 1,
        "status": "authored-and-exported-see-rig-animation-validation",
        "validationReport": "evidence/3d-jack/rig-animation-validation.json",
        "fps": FPS,
        "boneCount": len(rig.data.bones),
        "deformBoneCount": sum(1 for bone in rig.data.bones if bone.use_deform),
        "bones": [bone.name for bone in rig.data.bones],
        "clipCount": len(actions),
        "clips": [
            {
                "name": action.name,
                "durationMs": int(action["duration_ms"]),
                "frameStart": float(action.frame_range[0]),
                "frameEnd": float(action.frame_range[1]),
                "loop": bool(action["loop"]),
                "rootMotion": False,
                "simulationMutation": False,
            }
            for action in actions
        ],
        "rootInvariantExpected": True,
        "presentationOnly": True,
        "simulationMutation": False,
        "blendBytes": blend_path.stat().st_size,
        "glbBytes": glb_path.stat().st_size,
    }
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    expected = list(RIG_CONTRACT["bones"])
    if list(BONES) != expected:
        raise RuntimeError("Rest-skeleton order does not exactly match jack-rig.json")
    clear_scene()
    rig = build_armature()
    rig.animation_data_create()
    actions = [author_clip(rig, clip) for clip in CLIP_MANIFEST["clips"]]
    export(rig, actions)
    print(f"JACK_SHARED_RIG_COMPLETE bones={len(expected)} clips={len(actions)}")


main()
