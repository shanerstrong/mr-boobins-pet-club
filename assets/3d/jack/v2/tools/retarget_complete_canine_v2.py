"""Build the complete Jack V2.3 canine-motion action set.

This additive pass preserves the V2.2 retargeter and its outputs.  It reuses
the same CC0 Quaternius canine donor and replaces every remaining generic
placeholder action with bounded samples from genuine quadruped motion.  The
three command actions use restrained donor poses so their silhouettes remain
readable without reintroducing the rejected full-body procedural motion.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


BASE_PATH = Path(__file__).with_name("retarget_quaternius_canine_v2.py")
BASE_SPEC = importlib.util.spec_from_file_location("retarget_quaternius_canine_v2", BASE_PATH)
if BASE_SPEC is None or BASE_SPEC.loader is None:
    raise RuntimeError(f"Unable to load the V2.2 retargeter from {BASE_PATH}")
base = importlib.util.module_from_spec(BASE_SPEC)
BASE_SPEC.loader.exec_module(base)


COMPLETE_RECIPES = {
    "tail_wag": [("Idle_2", 0.05, 0.70, 0.0, 1.0)],
    "feed": [("Eating", 0.0, 1.0, 0.0, 1.0)],
    "sleep": [("Death", 0.0, 1.0, 0.0, 1.0)],
    "wake": [("Death", 1.0, 0.0, 0.0, 1.0)],
    "boop_comfortable": [("Idle_2", 0.08, 0.34, 0.0, 1.0)],
    "boop_need_hunger": [("Eating", 0.0, 0.24, 0.0, 1.0)],
    "boop_need_energy": [("Idle_2_HeadLow", 0.18, 0.46, 0.0, 1.0)],
    "boop_need_hygiene": [("Idle_HitReact_Left", 0.0, 1.0, 0.0, 1.0)],
    "boop_need_happiness": [("Jump_ToIdle", 0.08, 0.58, 0.0, 1.0)],
    "boop_rejected": [("Attack", 0.0, 0.30, 0.0, 1.0)],
    "tired": [("Idle_2_HeadLow", 0.0, 0.92, 0.0, 1.0)],
    "death_rest": [("Death", 0.0, 1.0, 0.0, 1.0)],
    "training_attention": [("Idle_2", 0.0, 0.24, 0.0, 1.0)],
    "training_sit": [("Death", 0.0, 0.28, 0.0, 0.72), ("Death", 0.28, 0.31, 0.72, 1.0)],
    "training_paw": [("Attack", 0.0, 0.25, 0.0, 0.72), ("Attack", 0.25, 0.28, 0.72, 1.0)],
    "training_up": [("Gallop_Jump", 0.0, 0.38, 0.0, 0.64), ("Gallop_Jump", 0.38, 0.42, 0.64, 1.0)],
    "training_treat_receive": [("Jump_ToIdle", 0.0, 0.34, 0.0, 1.0)],
    "training_treat_eat": [("Eating", 0.0, 1.0, 0.0, 1.0)],
    "celebration_spin_wag": [("Gallop", 0.0, 1.0, 0.0, 0.72), ("Idle_2", 0.0, 0.18, 0.72, 1.0)],
    "celebration_goofy_shimmy": [("Idle_HitReact_Left", 0.0, 1.0, 0.0, 0.34), ("Idle_HitReact_Right", 0.0, 1.0, 0.34, 0.68), ("Jump_ToIdle", 0.0, 0.42, 0.68, 1.0)],
    "training_return_idle": [("Idle", 0.0, 0.20, 0.0, 1.0)],
}


COMPLETE_TRANSLATION_POLICY = {
    "tail_wag": (0.35, (0.0, 0.0, 1.0)),
    "wake": (0.82, (1.0, 1.0, 1.0)),
    "sleep": (1.05, (1.0, 1.0, 1.0)),
    "boop_comfortable": (0.30, (0.35, 0.35, 1.0)),
    "boop_need_hunger": (0.62, (1.0, 1.0, 1.0)),
    "boop_need_energy": (0.48, (0.45, 0.45, 1.0)),
    "boop_need_hygiene": (0.48, (0.65, 0.65, 1.0)),
    "boop_need_happiness": (0.42, (0.40, 0.40, 1.0)),
    "boop_rejected": (0.38, (0.35, 0.35, 1.0)),
    "training_sit": (0.72, (0.35, 0.35, 1.0)),
    "training_paw": (0.40, (0.25, 0.25, 1.0)),
    "training_up": (0.44, (0.30, 0.30, 1.0)),
    "training_treat_receive": (0.42, (0.35, 0.35, 1.0)),
    "celebration_spin_wag": (0.38, (0.0, 0.0, 1.0)),
    "celebration_goofy_shimmy": (0.42, (0.40, 0.40, 1.0)),
    "training_return_idle": (0.30, (0.0, 0.0, 1.0)),
}


base.RECIPES.update(COMPLETE_RECIPES)
base.TRANSLATION_POLICY.update(COMPLETE_TRANSLATION_POLICY)


ORIGINAL_MAKE_ACTION = base.make_action
AXES = {
    "x": Vector((1.0, 0.0, 0.0)),
    "y": Vector((0.0, 1.0, 0.0)),
    "z": Vector((0.0, 0.0, 1.0)),
}


def smoothstep(value: float) -> float:
    bounded = max(0.0, min(1.0, value))
    return bounded * bounded * (3.0 - (2.0 * bounded))


def semantic_weight(action_name: str, fraction: float) -> float:
    if action_name == "feed":
        return math.sin(math.pi * fraction) ** 1.35
    if action_name == "wake":
        return 1.0 - smoothstep(fraction / 0.88)
    if action_name in {"sleep", "death_rest"}:
        return smoothstep(fraction / 0.78)
    if action_name.startswith("training_"):
        return smoothstep(fraction / 0.68)
    return 0.0


SEMANTIC_OVERLAYS = {
    # The donor Eating cycle provides the real canine crouch; the bounded head
    # arc makes the intent legible without changing the clip timing.
    "feed": ("head", "x", 60.0),
    # Death supplies the canine fold.  A restrained pitch settles the imported
    # silhouette onto its side instead of leaving the torso visually upright.
    "sleep": ("Hips", "x", 30.0),
    "wake": ("Hips", "x", 30.0),
    "death_rest": ("Hips", "x", 30.0),
    # Command actions retain donor limb motion and add one stable, readable
    # body cue rather than rebuilding the full pose procedurally.
    "training_sit": ("Hips", "z", 82.0),
    "training_paw": ("Hips", "y", 24.0),
    "training_up": ("Hips", "x", -58.0),
}

IDLE_BLEND_BONES = {
    "training_sit": (
        "frontleg",
        "frontleg0",
        "frontleg1",
        "frontleg2",
        "R_frontleg",
        "R_frontleg0",
        "R_frontleg1",
        "R_frontleg2",
    ),
    "training_paw": (
        "R_frontleg",
        "R_frontleg0",
        "R_frontleg1",
        "R_frontleg2",
    ),
}


def idle_rotations(target: bpy.types.Object, bone_names: tuple[str, ...]) -> dict[str, Quaternion]:
    current_action = target.animation_data.action
    target.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    rotations = {name: target.pose.bones[name].rotation_quaternion.copy() for name in bone_names}
    target.animation_data.action = current_action
    return rotations


def apply_semantic_overlay(
    target: bpy.types.Object,
    action: bpy.types.Action,
    clip: dict,
) -> None:
    overlay = SEMANTIC_OVERLAYS.get(clip["name"])
    if overlay is None:
        return
    bone_name, axis_name, degrees = overlay
    target.animation_data.action = action
    end_frame = round(clip["durationMs"] * base.FPS / 1000)
    bone = target.pose.bones[bone_name]
    bone.rotation_mode = "QUATERNION"
    blend_names = IDLE_BLEND_BONES.get(clip["name"], ())
    neutral_rotations = idle_rotations(target, blend_names)
    for frame in range(0, end_frame + 1):
        target.animation_data.action = action
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        fraction = frame / end_frame if end_frame else 0.0
        weight = semantic_weight(clip["name"], fraction)
        delta = Quaternion(AXES[axis_name], math.radians(degrees) * weight)
        bone.rotation_quaternion = bone.rotation_quaternion @ delta
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
        if clip["name"] == "training_up":
            tail = target.pose.bones["tail"]
            tail.rotation_mode = "QUATERNION"
            tail.rotation_quaternion = tail.rotation_quaternion @ Quaternion(
                AXES["x"],
                math.radians(-100.0) * weight,
            )
            tail.keyframe_insert("rotation_quaternion", frame=frame, group=tail.name)
        for blend_name in blend_names:
            blend_bone = target.pose.bones[blend_name]
            blend_bone.rotation_quaternion = blend_bone.rotation_quaternion.slerp(
                neutral_rotations[blend_name],
                weight,
            )
            blend_bone.keyframe_insert("rotation_quaternion", frame=frame, group=blend_name)
    action["semantic_overlay"] = f"{bone_name}:{axis_name}:{degrees:g}deg"
    action["source"] = (
        "Quaternius Ultimate Animated Animal Pack (CC0), retargeted and "
        "repaired in Blender with a bounded semantic readability pass"
    )
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"


def make_complete_action(
    target: bpy.types.Object,
    donor: bpy.types.Object,
    source_actions: dict[str, bpy.types.Action],
    clip: dict,
    recipe: list[tuple],
) -> bpy.types.Action:
    action = ORIGINAL_MAKE_ACTION(target, donor, source_actions, clip, recipe)
    apply_semantic_overlay(target, action, clip)
    return action


base.make_action = make_complete_action


if __name__ == "__main__":
    base.main()
