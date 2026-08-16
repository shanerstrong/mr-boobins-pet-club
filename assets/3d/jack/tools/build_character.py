"""Build the refined Baby Jack hero model, rig, controls, clips, and exports."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import build_blockout as base  # noqa: E402
import build_hero_geometry as hero_geometry  # noqa: E402


ROOT = base.ROOT
ASSET_ROOT = base.ASSET_ROOT
SOURCE_DIR = base.SOURCE_DIR
EXPORT_DIR = base.EXPORT_DIR
EVIDENCE_DIR = base.EVIDENCE_DIR
RIG_DIR = ASSET_ROOT / "rig"
ANIMATION_DIR = ASSET_ROOT / "animations"

for directory in (SOURCE_DIR, EXPORT_DIR, EVIDENCE_DIR, RIG_DIR, ANIMATION_DIR):
    directory.mkdir(parents=True, exist_ok=True)

FPS = 30


def object_named(name: str) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise KeyError(name)
    return obj


def add_shape_key(obj_name: str, key_name: str, transform) -> None:
    obj = object_named(obj_name)
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name=key_name)
    for vertex, key_vertex in zip(obj.data.vertices, key.data):
        key_vertex.co = transform(vertex.co.copy())


def build_facial_controls() -> None:
    nose = object_named("Jack_Nose")
    nose_center_y = sum(vertex.co.y for vertex in nose.data.vertices) / len(nose.data.vertices)
    nose_center_z = sum(vertex.co.z for vertex in nose.data.vertices) / len(nose.data.vertices)
    add_shape_key(
        "Jack_Nose",
        "Nose_Compress",
        lambda co: type(co)((co.x * 1.06, nose_center_y + (co.y - nose_center_y) * 0.58, nose_center_z + (co.z - nose_center_z) * 0.92)),
    )
    for side in ("L", "R"):
        eye = object_named(f"Jack_Eye_{side}")
        center_z = sum(vertex.co.z for vertex in eye.data.vertices) / len(eye.data.vertices)
        add_shape_key(
            f"Jack_Eye_{side}",
            "Blink",
            lambda co, cz=center_z: type(co)((co.x, co.y, cz + (co.z - cz) * 0.08)),
        )
    add_shape_key("Jack_Tongue", "Tongue_Out", lambda co: type(co)((co.x, co.y - 0.105, co.z - 0.045)))
    add_shape_key(
        "Jack_MuzzleWedge",
        "Smile",
        lambda co: type(co)(
            (
                co.x * (1.035 if co.y < -1.0 and co.z < 1.96 else 1.0),
                co.y,
                co.z + (0.040 if co.y < -1.0 and co.z < 1.92 else 0.0),
            )
        ),
    )
    mouth = object_named("Jack_Mouth")
    mouth_center_z = sum(vertex.co.z for vertex in mouth.data.vertices) / len(mouth.data.vertices)
    add_shape_key(
        "Jack_Mouth",
        "Mouth_Open",
        lambda co: type(co)((co.x, co.y, co.z - (0.055 if co.z < mouth_center_z else 0.0))),
    )


def build_armature() -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("Jack_RigData")
    armature = bpy.data.objects.new("Jack_Rig", armature_data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    armature["presentationOnly"] = True
    armature["rootMotionGameplay"] = False

    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    specs = {
        "root": ((0.0, 0.0, 0.0), (0.0, 0.0, 0.25), None),
        "pelvis": ((0.0, 0.25, 0.65), (0.0, 0.20, 1.05), "root"),
        "spine": ((0.0, 0.18, 1.00), (0.0, -0.05, 1.38), "pelvis"),
        "chest": ((0.0, -0.05, 1.28), (0.0, -0.28, 1.62), "spine"),
        "neck": ((0.0, -0.28, 1.55), (0.0, -0.42, 1.92), "chest"),
        "head": ((0.0, -0.42, 1.88), (0.0, -0.48, 2.38), "neck"),
        "muzzle": ((0.0, -0.68, 1.94), (0.0, -1.42, 1.94), "head"),
        "jaw": ((0.0, -0.72, 1.78), (0.0, -1.20, 1.58), "head"),
        "ear_L": ((-0.31, -0.43, 2.18), (-0.39, -0.43, 2.85), "head"),
        "ear_R": ((0.31, -0.43, 2.16), (0.39, -0.43, 2.80), "head"),
        "front_leg_L": ((-0.39, -0.38, 0.91), (-0.39, -0.38, 0.25), "chest"),
        "front_paw_L": ((-0.39, -0.38, 0.25), (-0.39, -0.62, 0.14), "front_leg_L"),
        "front_leg_R": ((0.39, -0.38, 0.91), (0.39, -0.38, 0.25), "chest"),
        "front_paw_R": ((0.39, -0.38, 0.25), (0.39, -0.62, 0.14), "front_leg_R"),
        "rear_leg_L": ((-0.42, 0.59, 0.91), (-0.42, 0.59, 0.25), "pelvis"),
        "rear_paw_L": ((-0.42, 0.59, 0.25), (-0.42, 0.42, 0.14), "rear_leg_L"),
        "rear_leg_R": ((0.42, 0.59, 0.91), (0.42, 0.59, 0.25), "pelvis"),
        "rear_paw_R": ((0.42, 0.59, 0.25), (0.42, 0.42, 0.14), "rear_leg_R"),
        "tail_base": ((0.18, 0.90, 1.15), (0.38, 1.27, 1.24), "pelvis"),
        "tail_mid": ((0.38, 1.27, 1.24), (0.58, 1.58, 1.08), "tail_base"),
        "tail_tip": ((0.58, 1.58, 1.08), (0.68, 1.84, 0.88), "tail_mid"),
    }

    for name, (head, tail, parent_name) in specs.items():
        bone = armature_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent_name:
            bone.parent = armature_data.edit_bones[parent_name]

    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    return armature


def bone_for_object(name: str) -> str:
    if name == "Jack_Body":
        return "spine"
    if name == "Jack_Chest":
        return "chest"
    if name == "Jack_Neck" or name.startswith("Jack_Collar") or name.startswith("Jack_Tag"):
        return "neck"
    if name.startswith("Jack_Haunch"):
        return "pelvis"
    if name.startswith("Jack_Leg_Front_L"):
        return "front_leg_L"
    if name.startswith("Jack_Paw_Front_L") or name.startswith("Jack_Toe_Front_L"):
        return "front_paw_L"
    if name.startswith("Jack_Leg_Front_R"):
        return "front_leg_R"
    if name.startswith("Jack_Paw_Front_R") or name.startswith("Jack_Toe_Front_R"):
        return "front_paw_R"
    if name.startswith("Jack_Leg_Rear_L"):
        return "rear_leg_L"
    if name.startswith("Jack_Paw_Rear_L") or name.startswith("Jack_Toe_Rear_L"):
        return "rear_paw_L"
    if name.startswith("Jack_Leg_Rear_R"):
        return "rear_leg_R"
    if name.startswith("Jack_Paw_Rear_R") or name.startswith("Jack_Toe_Rear_R"):
        return "rear_paw_R"
    if name == "Jack_Ear_L" or name == "Jack_EarInner_L":
        return "ear_L"
    if name == "Jack_Ear_R" or name == "Jack_EarInner_R":
        return "ear_R"
    if name == "Jack_Tail" or name.startswith("Jack_Tail_Base"):
        return "tail_base"
    if name.startswith("Jack_Tail_Mid"):
        return "tail_mid"
    if name.startswith("Jack_Tail_Tip"):
        return "tail_tip"
    if name in {"Jack_Mouth", "Jack_Tongue", "Jack_Tooth_L", "Jack_Tooth_R"}:
        return "jaw"
    if name in {"Jack_MuzzleWedge", "Jack_Cheek_L", "Jack_Cheek_R", "Jack_Nose", "Jack_NoseHighlight", "Jack_Nostril_L", "Jack_Nostril_R"}:
        return "muzzle"
    return "head"


def bind_rigid_weights(armature: bpy.types.Object) -> dict[str, str]:
    mapping = {}
    for obj in base.MODEL_OBJECTS:
        bone_name = bone_for_object(obj.name)
        mapping[obj.name] = bone_name
        if obj.name == "Jack_Tail":
            groups = {name: obj.vertex_groups.new(name=name) for name in ("tail_base", "tail_mid", "tail_tip")}
            for vertex in obj.data.vertices:
                if vertex.co.y < 1.23:
                    target = "tail_base"
                elif vertex.co.y < 1.62:
                    target = "tail_mid"
                else:
                    target = "tail_tip"
                groups[target].add([vertex.index], 1.0, "REPLACE")
            mapping[obj.name] = "tail_base|tail_mid|tail_tip"
        else:
            group = obj.vertex_groups.new(name=bone_name)
            group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        modifier = obj.modifiers.new(name="Jack_Rig", type="ARMATURE")
        modifier.object = armature
        obj.parent = armature
    return mapping


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def create_action(armature: bpy.types.Object, name: str, duration_ms: int, keys: list[tuple[float, dict]]) -> bpy.types.Action:
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    reset_pose(armature)

    for time_ms, pose in keys:
        frame = 1.0 + (time_ms / 1000.0) * FPS
        for bone_name, values in pose.items():
            bone = armature.pose.bones[bone_name]
            if "rotation" in values:
                bone.rotation_euler = tuple(values["rotation"])
                bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)
            if "location" in values:
                bone.location = tuple(values["location"])
                bone.keyframe_insert(data_path="location", frame=frame, group=bone_name)
            if "scale" in values:
                bone.scale = tuple(values["scale"])
                bone.keyframe_insert(data_path="scale", frame=frame, group=bone_name)

    track = armature.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_start = 1.0
    strip.action_frame_end = 1.0 + (duration_ms / 1000.0) * FPS
    armature.animation_data.action = None
    reset_pose(armature)
    return action


def create_morph_action(obj_name: str, clip_name: str, key_name: str, duration_ms: int, keys: list[tuple[float, float]]) -> None:
    obj = object_named(obj_name)
    shape_keys = obj.data.shape_keys
    action = bpy.data.actions.new(name=f"{clip_name}__{obj_name}__{key_name}")
    action.use_fake_user = True
    shape_keys.animation_data_create()
    shape_keys.animation_data.action = action
    key = shape_keys.key_blocks[key_name]
    for time_ms, value in keys:
        key.value = value
        frame = 1.0 + (time_ms / 1000.0) * FPS
        key.keyframe_insert(data_path="value", frame=frame)
    track = shape_keys.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, 1, action)
    strip.action_frame_start = 1.0
    strip.action_frame_end = 1.0 + (duration_ms / 1000.0) * FPS
    shape_keys.animation_data.action = None
    key.value = 0.0


def build_clips(armature: bpy.types.Object) -> list[dict]:
    clips = [
        ("idle", 3000, True, [
            (0, {"chest": {"rotation": (0.0, 0.0, -0.018)}, "head": {"rotation": (0.0, 0.0, -0.035)}}),
            (1500, {"chest": {"rotation": (0.018, 0.0, 0.018)}, "head": {"rotation": (0.0, 0.0, 0.035)}, "ear_R": {"rotation": (0.0, 0.08, 0.0)}}),
            (3000, {"chest": {"rotation": (0.0, 0.0, -0.018)}, "head": {"rotation": (0.0, 0.0, -0.035)}}),
        ]),
        ("tail_wag", 1200, True, [
            (0, {"tail_base": {"rotation": (0.0, 0.0, -0.48)}, "tail_mid": {"rotation": (0.0, 0.0, -0.22)}}),
            (300, {"tail_base": {"rotation": (0.0, 0.0, 0.48)}, "tail_mid": {"rotation": (0.0, 0.0, 0.22)}}),
            (600, {"tail_base": {"rotation": (0.0, 0.0, -0.48)}, "tail_mid": {"rotation": (0.0, 0.0, -0.22)}}),
            (900, {"tail_base": {"rotation": (0.0, 0.0, 0.48)}, "tail_mid": {"rotation": (0.0, 0.0, 0.22)}}),
            (1200, {"tail_base": {"rotation": (0.0, 0.0, -0.48)}, "tail_mid": {"rotation": (0.0, 0.0, -0.22)}}),
        ]),
        ("feed", 2200, False, [
            (0, {"neck": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}}),
            (550, {"neck": {"rotation": (0.32, 0.0, 0.0)}, "head": {"rotation": (0.22, 0.0, 0.0)}, "jaw": {"rotation": (0.18, 0.0, 0.0)}}),
            (1450, {"neck": {"rotation": (0.36, 0.0, 0.0)}, "head": {"rotation": (0.16, 0.0, 0.0)}, "jaw": {"rotation": (0.30, 0.0, 0.0)}}),
            (2200, {"neck": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}, "jaw": {"rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("sleep", 3200, True, [
            (0, {"pelvis": {"location": (0.0, 0.0, -0.40), "rotation": (0.18, 0.0, 0.0)}, "spine": {"rotation": (0.16, 0.0, 0.0)}, "head": {"rotation": (0.38, 0.0, 0.0)}}),
            (1600, {"pelvis": {"location": (0.0, 0.0, -0.42), "rotation": (0.18, 0.0, 0.0)}, "spine": {"rotation": (0.19, 0.0, 0.0)}, "head": {"rotation": (0.40, 0.0, 0.0)}}),
            (3200, {"pelvis": {"location": (0.0, 0.0, -0.40), "rotation": (0.18, 0.0, 0.0)}, "spine": {"rotation": (0.16, 0.0, 0.0)}, "head": {"rotation": (0.38, 0.0, 0.0)}}),
        ]),
        ("wake", 1400, False, [
            (0, {"pelvis": {"location": (0.0, 0.0, -0.40)}, "spine": {"rotation": (0.16, 0.0, 0.0)}, "head": {"rotation": (0.38, 0.0, 0.0)}}),
            (700, {"pelvis": {"location": (0.0, 0.0, -0.10)}, "head": {"rotation": (-0.16, 0.0, 0.0)}, "ear_L": {"rotation": (0.0, -0.10, 0.0)}, "ear_R": {"rotation": (0.0, 0.10, 0.0)}}),
            (1400, {"pelvis": {"location": (0.0, 0.0, 0.0)}, "spine": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("play", 3000, False, [
            (0, {"chest": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}}),
            (500, {"chest": {"rotation": (0.28, 0.0, 0.0)}, "head": {"rotation": (-0.18, 0.0, 0.0)}, "front_leg_L": {"rotation": (-0.25, 0.0, 0.0)}, "front_leg_R": {"rotation": (-0.25, 0.0, 0.0)}, "tail_base": {"rotation": (0.0, 0.0, -0.45)}}),
            (1500, {"chest": {"rotation": (0.22, 0.0, 0.0)}, "head": {"rotation": (-0.10, 0.0, 0.12)}, "tail_base": {"rotation": (0.0, 0.0, 0.45)}}),
            (2500, {"chest": {"rotation": (0.28, 0.0, 0.0)}, "head": {"rotation": (-0.18, 0.0, -0.12)}, "tail_base": {"rotation": (0.0, 0.0, -0.45)}}),
            (3000, {"chest": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}, "tail_base": {"rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("clean", 1500, False, [
            (0, {"chest": {"rotation": (0.0, 0.0, 0.0)}}),
            (375, {"chest": {"rotation": (0.0, 0.0, -0.13)}, "head": {"rotation": (0.0, 0.0, 0.10)}}),
            (750, {"chest": {"rotation": (0.0, 0.0, 0.13)}, "head": {"rotation": (0.0, 0.0, -0.10)}}),
            (1125, {"chest": {"rotation": (0.0, 0.0, -0.08)}, "head": {"rotation": (0.0, 0.0, 0.06)}}),
            (1500, {"chest": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("boop_comfortable", 700, False, [
            (0, {"head": {"location": (0.0, 0.0, 0.0)}}),
            (80, {"head": {"location": (0.0, 0.055, 0.0), "rotation": (-0.08, 0.0, 0.0)}}),
            (200, {"head": {"location": (0.0, 0.085, 0.0), "rotation": (-0.14, 0.0, 0.0)}}),
            (420, {"pelvis": {"location": (0.0, 0.0, 0.10)}, "head": {"rotation": (0.08, 0.0, 0.0)}}),
            (700, {"pelvis": {"location": (0.0, 0.0, 0.0)}, "head": {"location": (0.0, 0.0, 0.0), "rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("boop_need", 800, False, [
            (0, {"head": {"rotation": (0.0, 0.0, 0.0)}}),
            (80, {"head": {"location": (0.0, 0.045, 0.0)}}),
            (350, {"head": {"rotation": (0.10, 0.0, -0.24)}}),
            (800, {"head": {"location": (0.0, 0.0, 0.0), "rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("boop_rejected", 300, False, [
            (0, {"head": {"location": (0.0, 0.0, 0.0)}}),
            (80, {"head": {"location": (0.0, 0.025, 0.0)}}),
            (300, {"head": {"location": (0.0, 0.0, 0.0)}}),
        ]),
        ("tired", 2000, True, [
            (0, {"neck": {"rotation": (0.20, 0.0, 0.0)}, "head": {"rotation": (0.24, 0.0, -0.03)}, "ear_L": {"rotation": (0.0, 0.10, 0.0)}, "ear_R": {"rotation": (0.0, -0.10, 0.0)}}),
            (1000, {"neck": {"rotation": (0.24, 0.0, 0.0)}, "head": {"rotation": (0.28, 0.0, 0.03)}}),
            (2000, {"neck": {"rotation": (0.20, 0.0, 0.0)}, "head": {"rotation": (0.24, 0.0, -0.03)}}),
        ]),
        ("dirty", 900, False, [
            (0, {"chest": {"rotation": (0.0, 0.0, 0.0)}}),
            (225, {"chest": {"rotation": (0.0, 0.0, -0.16)}, "head": {"rotation": (0.0, 0.0, 0.12)}}),
            (450, {"chest": {"rotation": (0.0, 0.0, 0.16)}, "head": {"rotation": (0.0, 0.0, -0.12)}}),
            (675, {"chest": {"rotation": (0.0, 0.0, -0.10)}, "head": {"rotation": (0.0, 0.0, 0.08)}}),
            (900, {"chest": {"rotation": (0.0, 0.0, 0.0)}, "head": {"rotation": (0.0, 0.0, 0.0)}}),
        ]),
        ("death_rest", 1000, False, [
            (0, {"pelvis": {"location": (0.0, 0.0, 0.0)}}),
            (1000, {"pelvis": {"location": (0.0, 0.0, -0.46), "rotation": (0.22, 0.0, 0.0)}, "spine": {"rotation": (0.24, 0.0, 0.0)}, "head": {"rotation": (0.42, 0.0, 0.0)}, "ear_L": {"rotation": (0.0, 0.10, 0.0)}, "ear_R": {"rotation": (0.0, -0.10, 0.0)}}),
        ]),
    ]

    manifest = []
    for name, duration_ms, loop, keys in clips:
        create_action(armature, name, duration_ms, keys)
        manifest.append({
            "name": name,
            "durationMs": duration_ms,
            "loop": loop,
            "rootMotion": False,
            "simulationMutation": False,
            "presentationOnly": True,
        })

    create_morph_action("Jack_Eye_L", "idle", "Blink", 3000, [(0, 0), (1450, 0), (1500, 1), (1560, 0), (3000, 0)])
    create_morph_action("Jack_Eye_R", "idle", "Blink", 3000, [(0, 0), (1450, 0), (1500, 1), (1560, 0), (3000, 0)])
    create_morph_action("Jack_Tongue", "feed", "Tongue_Out", 2200, [(0, 0), (900, 0), (1250, 1), (1550, 0), (2200, 0)])
    for clip_name, duration in (("boop_comfortable", 700), ("boop_need", 800), ("boop_rejected", 300)):
        create_morph_action("Jack_Nose", clip_name, "Nose_Compress", duration, [(0, 0), (80, 1), (200, 0), (duration, 0)])
    create_morph_action("Jack_MuzzleWedge", "boop_comfortable", "Smile", 700, [(0, 0), (200, 0), (420, 1), (700, 0)])
    create_morph_action("Jack_Mouth", "boop_comfortable", "Mouth_Open", 700, [(0, 0), (200, 0), (420, 0.7), (700, 0)])
    return manifest


def render_hero_views(camera: bpy.types.Object, armature: bpy.types.Object) -> None:
    armature.animation_data.use_nla = False
    reset_pose(armature)
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.cycles.use_denoising = True
    bpy.context.scene.render.resolution_x = 2048
    bpy.context.scene.render.resolution_y = 2048
    views = {
        "front": ((0.0, -7.3, 2.35), (0.0, -0.10, 1.38), 3.55),
        "side": ((7.2, -0.15, 2.35), (0.0, -0.05, 1.38), 3.55),
        "three-quarter": ((5.0, -5.8, 2.75), (0.0, -0.05, 1.38), 3.65),
        "rear": ((0.0, 7.5, 2.45), (0.0, 0.10, 1.38), 3.55),
    }
    for name, (location, target, ortho_scale) in views.items():
        camera.location = location
        camera.data.ortho_scale = ortho_scale
        base.look_at(camera, target)
        bpy.context.scene.render.filepath = str(EVIDENCE_DIR / f"jack-hero-{name}.png")
        bpy.ops.render.render(write_still=True)
    armature.animation_data.use_nla = True


def write_rig_manifest(mapping: dict[str, str], armature: bpy.types.Object) -> None:
    controls = {
        "bones": [bone.name for bone in armature.data.bones],
        "rigidWeightMap": mapping,
        "morphTargets": {
            "Jack_Nose": ["Nose_Compress"],
            "Jack_Eye_L": ["Blink"],
            "Jack_Eye_R": ["Blink"],
            "Jack_Tongue": ["Tongue_Out"],
            "Jack_MuzzleWedge": ["Smile"],
            "Jack_Mouth": ["Mouth_Open"],
        },
        "rootMotionGameplay": False,
        "presentationOnly": True,
    }
    (RIG_DIR / "jack-rig.json").write_text(json.dumps(controls, indent=2) + "\n", encoding="utf-8")


def optimize_mesh_groups() -> None:
    """Join rigid non-morph meshes by material while preserving vertex groups."""
    protected = {
        "Jack_Nose",
        "Jack_Eye_L",
        "Jack_Eye_R",
        "Jack_Tongue",
        "Jack_MuzzleWedge",
        "Jack_Mouth",
    }
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in list(base.MODEL_OBJECTS):
        if obj.name in protected or obj.data.shape_keys is not None:
            continue
        material_name = obj.material_slots[0].material.name if obj.material_slots and obj.material_slots[0].material else "unassigned"
        groups.setdefault(material_name, []).append(obj)

    for material_name, objects in groups.items():
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        safe_material = material_name.removeprefix("Jack_").replace(" ", "_")
        active.name = f"Jack_Merged_{safe_material}"

    base.MODEL_OBJECTS.clear()
    base.MODEL_OBJECTS.extend(
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.get("assetRole") == "jack-character"
    )


def export_character(armature: bpy.types.Object, clips: list[dict]) -> None:
    source_path = SOURCE_DIR / "jack-character.blend"
    glb_path = EXPORT_DIR / "jack-character.glb"
    gltf_path = EXPORT_DIR / "jack-character.gltf"
    clip_manifest_path = ANIMATION_DIR / "clip-manifest.json"

    clip_manifest = {
        "schemaVersion": 1,
        "fps": FPS,
        "presentationOnly": True,
        "simulationMutation": False,
        "rootMotionGameplay": False,
        "exactPolicies": {"playMs": 3000, "cleanMs": 1500, "cleanPhasesMs": [0, 375, 750, 1125, 1500]},
        "clips": clips,
    }
    clip_manifest_path.write_text(json.dumps(clip_manifest, indent=2) + "\n", encoding="utf-8")

    scene = bpy.context.scene
    scene["assetName"] = "Baby Jack hero character"
    scene["status"] = "hero-refinement-required"
    scene["presentationOnly"] = True
    scene["simulationMutation"] = False
    scene["rootMotionGameplay"] = False
    scene.render.fps = FPS
    bpy.ops.wm.save_as_mainfile(filepath=str(source_path), check_existing=False)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in base.MODEL_OBJECTS:
        obj.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    common = dict(
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_morph=True,
        export_morph_animation=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
        export_bake_animation=False,
        export_force_sampling=False,
    )
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", **common)
    bpy.ops.export_scene.gltf(filepath=str(gltf_path), export_format="GLTF_SEPARATE", **common)

    metrics = {
        "schemaVersion": 1,
        "asset": "Baby Jack hero character",
        "status": "hero-refinement-required",
        "triangles": base.triangle_count(),
        "heroTriangleTarget": {"min": 8000, "max": 14000},
        "materials": len({slot.material.name for obj in base.MODEL_OBJECTS for slot in obj.material_slots if slot.material}),
        "optimizedMeshPrimitives": len(base.MODEL_OBJECTS),
        "imageTextures": 0,
        "bones": len(armature.data.bones),
        "morphTargets": 6,
        "clipsExpected": len(clips),
        "clipNamesExpected": [clip["name"] for clip in clips],
        "glbBytes": glb_path.stat().st_size,
        "gltfBytes": gltf_path.stat().st_size,
        "binBytes": (EXPORT_DIR / "jack-character.bin").stat().st_size,
        "presentationOnly": True,
        "simulationMutation": False,
        "rootMotionGameplay": False,
        "privateReferencesEmbedded": False,
        "blenderVersion": bpy.app.version_string,
    }
    (ASSET_ROOT / "hero-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    base.MODEL_OBJECTS.clear()
    base.reset_scene()
    hero_geometry.build()
    build_facial_controls()
    armature = build_armature()
    mapping = bind_rigid_weights(armature)
    clips = build_clips(armature)
    write_rig_manifest(mapping, armature)
    optimize_mesh_groups()
    camera = base.setup_stage()
    render_hero_views(camera, armature)
    export_character(armature, clips)
    print(json.dumps({"status": "ok", "triangles": base.triangle_count(), "clips": len(clips)}))


if __name__ == "__main__":
    main()
