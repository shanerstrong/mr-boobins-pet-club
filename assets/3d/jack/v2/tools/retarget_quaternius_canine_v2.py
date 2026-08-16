"""Retarget Quaternius CC0 canine actions onto Jack's canonical V2 rig.

The Repair-B source remains untouched.  This script creates additive Repair-C
and replaces only selected placeholder actions with sampled quadruped motion.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


FPS = 30
IDENTITY = Quaternion((1.0, 0.0, 0.0, 0.0))

MAPPING = {
    # Quaternius Body is the in-place presentation control; Back is the first
    # deforming pelvis/spine bone and is therefore the correct Jack Hips donor.
    "Hips": ("Back", 0.92),
    "chest": ("Torso2", 0.86),
    "head": ("Head", 0.88),
    "headend": ("Head", 0.18),
    "earend": ("Ear2.L", 0.55),
    "R_earend": ("Ear2.R", 0.55),
    "frontleg": ("FrontShoulder.L", 0.90),
    "frontleg0": ("FrontUpperLeg.L", 1.0),
    "frontleg1": ("FrontLowerLeg.L", 1.0),
    "frontleg2": ("FrontLowerLeg.L", 0.12),
    "R_frontleg": ("FrontShoulder.R", 0.90),
    "R_frontleg0": ("FrontUpperLeg.R", 1.0),
    "R_frontleg1": ("FrontLowerLeg.R", 1.0),
    "R_frontleg2": ("FrontLowerLeg.R", 0.12),
    "backleg": ("BackShoulder.L", 0.88),
    "backleg0": ("BackLeg.L", 1.0),
    "backleg1": ("BackUpperLeg.L", 1.0),
    "backleg2": ("BackLowerLeg.L", 0.92),
    "R_backleg": ("BackShoulder.R", 0.88),
    "R_backleg0": ("BackLeg.R", 1.0),
    "R_backleg1": ("BackUpperLeg.R", 1.0),
    "R_backleg2": ("BackLowerLeg.R", 0.92),
    "tail": ("Tail1", 0.72),
    "tailstart": ("Tail2", 0.78),
    "tail1": ("Tail3", 0.84),
    "tail2": ("Tail4", 0.90),
    "tail3": ("Tail5", 0.96),
}

# (source action, source start fraction, source end fraction,
#  output start fraction, output end fraction)
RECIPES = {
    "idle": [("Idle", 0.0, 0.90, 0.0, 1.0)],
    "walk": [("Walk", 0.0, 1.0, 0.0, 1.0)],
    "run": [("Gallop", 0.0, 1.0, 0.0, 1.0)],
    "play": [("Gallop_Jump", 0.0, 1.0, 0.0, 0.46), ("Jump_ToIdle", 0.0, 1.0, 0.46, 0.78), ("Idle_2", 0.0, 0.20, 0.78, 1.0)],
    "clean_reaction": [("Idle_HitReact_Left", 0.0, 1.0, 0.0, 0.48), ("Idle_HitReact_Right", 0.0, 1.0, 0.48, 0.90), ("Idle", 0.0, 0.08, 0.90, 1.0)],
    "dirty": [("Idle_HitReact_Left", 0.0, 1.0, 0.0, 0.46), ("Idle_HitReact_Right", 0.0, 1.0, 0.46, 0.92), ("Idle", 0.0, 0.04, 0.92, 1.0)],
    "celebration_happy_hop": [("Jump_ToIdle", 0.0, 1.0, 0.0, 0.78), ("Idle_2", 0.0, 0.12, 0.78, 1.0)],
}

# The gameplay/export root remains fixed.  These values transfer the donor's
# Body translation to Jack's internal Hips presentation bone so weight shifts,
# crouches and rests survive retargeting without creating root motion.
TRANSLATION_POLICY = {
    "idle": (0.35, (0.0, 0.0, 1.0)),
    "walk": (0.45, (0.0, 0.0, 1.0)),
    "run": (0.45, (0.0, 0.0, 1.0)),
    "feed": (0.75, (1.0, 1.0, 1.0)),
    "play": (0.48, (0.45, 0.45, 1.0)),
    "clean_reaction": (0.55, (1.0, 1.0, 1.0)),
    "tired": (0.55, (0.5, 0.5, 1.0)),
    "dirty": (0.55, (1.0, 1.0, 1.0)),
    "death_rest": (1.10, (1.0, 1.0, 1.0)),
    "training_attention": (0.45, (0.5, 0.5, 1.0)),
    "training_treat_eat": (0.75, (1.0, 1.0, 1.0)),
    "celebration_happy_hop": (0.48, (0.45, 0.45, 1.0)),
}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--donor", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.rotation_quaternion = IDENTITY.copy()
        bone.scale = Vector((1.0, 1.0, 1.0))


def local_pose_delta(bone: bpy.types.PoseBone) -> Quaternion:
    rest = bone.bone.matrix_local
    pose = bone.matrix
    if bone.parent:
        rest = bone.parent.bone.matrix_local.inverted_safe() @ rest
        pose = bone.parent.matrix.inverted_safe() @ pose
    rest_rotation = rest.to_quaternion().normalized()
    pose_rotation = pose.to_quaternion().normalized()
    return (rest_rotation.inverted() @ pose_rotation).normalized()


def root_pose_delta(
    source_bone: bpy.types.PoseBone,
    target_bone: bpy.types.PoseBone,
) -> Quaternion:
    """Map a root-bone armature-space delta into the target rest basis."""
    source_rest = source_bone.bone.matrix_local.to_quaternion().normalized()
    source_pose = source_bone.matrix.to_quaternion().normalized()
    armature_delta = (source_pose @ source_rest.inverted()).normalized()
    target_rest = target_bone.bone.matrix_local.to_quaternion().normalized()
    return (target_rest.inverted() @ armature_delta @ target_rest).normalized()


def append_donor(path: Path) -> tuple[bpy.types.Object, list[bpy.types.Action]]:
    before_actions = set(bpy.data.actions)
    with bpy.data.libraries.load(str(path), link=False) as (available, loaded):
        loaded.objects = list(available.objects)
        loaded.actions = list(available.actions)
    donor = next(obj for obj in loaded.objects if obj and obj.type == "ARMATURE")
    bpy.context.collection.objects.link(donor)
    donor.hide_render = True
    donor.hide_set(True)
    actions = [action for action in bpy.data.actions if action not in before_actions]
    return donor, actions


def segment_for_fraction(recipe: list[tuple], fraction: float) -> tuple:
    for segment in recipe:
        if fraction <= segment[4] + 1e-8:
            return segment
    return recipe[-1]


def sample_source(
    donor: bpy.types.Object,
    action: bpy.types.Action,
    fraction: float,
) -> None:
    donor.animation_data_create()
    donor.animation_data.action = action
    start, end = action.frame_range
    frame = start + (end - start) * max(0.0, min(1.0, fraction))
    bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
    bpy.context.view_layer.update()


def body_translation(donor: bpy.types.Object) -> Vector:
    """Return the evaluated Body translation delta in donor armature space."""
    body = donor.pose.bones["Body"]
    return body.matrix.to_translation() - body.bone.matrix_local.to_translation()


def key_target_pose(
    target: bpy.types.Object,
    frame: int,
    donor: bpy.types.Object,
    body_delta: Vector,
    translation_scale: float,
    translation_axes: tuple[float, float, float],
) -> None:
    reset_pose(target)
    for target_name, (source_name, strength) in MAPPING.items():
        source_bone = donor.pose.bones[source_name]
        target_bone = target.pose.bones[target_name]
        if target_name == "Hips":
            delta = root_pose_delta(source_bone, target_bone)
        else:
            delta = local_pose_delta(source_bone)
        target_bone.rotation_quaternion = IDENTITY.slerp(delta, strength)
    desired_armature_delta = Vector(
        (
            body_delta.x * translation_axes[0],
            body_delta.y * translation_axes[1],
            body_delta.z * translation_axes[2],
        )
    ) * translation_scale
    hips = target.pose.bones["Hips"]
    # PoseBone.location is expressed in the rest-bone basis.  Converting here
    # avoids the old axis-sign guess and keeps this motion below jack_root.
    hips.location = hips.bone.matrix_local.to_quaternion().inverted() @ desired_armature_delta
    for bone in target.pose.bones:
        bone.keyframe_insert("location", frame=frame, group=bone.name)
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
        bone.keyframe_insert("scale", frame=frame, group=bone.name)


def make_action(
    target: bpy.types.Object,
    donor: bpy.types.Object,
    source_actions: dict[str, bpy.types.Action],
    clip: dict,
    recipe: list[tuple],
) -> bpy.types.Action:
    old = bpy.data.actions.get(clip["name"])
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(clip["name"])
    action.use_fake_user = True
    action["duration_ms"] = clip["durationMs"]
    action["loop"] = clip["loop"]
    action["in_place"] = True
    action["root_motion_gameplay"] = False
    action["simulation_mutation"] = False
    action["direct_humanoid_animation"] = False
    action["source"] = "Quaternius Ultimate Animated Animal Pack (CC0), retargeted and repaired in Blender"
    target.animation_data_create()
    target.animation_data.action = action
    end_frame = round(clip["durationMs"] * FPS / 1000)
    translation_scale, translation_axes = TRANSLATION_POLICY[clip["name"]]
    segment_baselines: dict[tuple[str, float], Vector] = {}
    for source_name, source_start, _source_end, _output_start, _output_end in recipe:
        key = (source_name, source_start)
        if key not in segment_baselines:
            sample_source(donor, source_actions[source_name], source_start)
            segment_baselines[key] = body_translation(donor).copy()
    for frame in range(0, end_frame + 1):
        fraction = frame / end_frame if end_frame else 0.0
        source_name, source_start, source_end, output_start, output_end = segment_for_fraction(recipe, fraction)
        local_fraction = 0.0 if output_end == output_start else (fraction - output_start) / (output_end - output_start)
        source_fraction = source_start + (source_end - source_start) * local_fraction
        sample_source(donor, source_actions[source_name], source_fraction)
        body_delta = body_translation(donor) - segment_baselines[(source_name, source_start)]
        key_target_pose(
            target,
            frame,
            donor,
            body_delta,
            translation_scale,
            translation_axes,
        )
    if clip["loop"]:
        source_name, source_start, _source_end, _output_start, _output_end = recipe[0]
        sample_source(donor, source_actions[source_name], source_start)
        key_target_pose(
            target,
            end_frame,
            donor,
            Vector((0.0, 0.0, 0.0)),
            translation_scale,
            translation_axes,
        )
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"
    return action


def evaluated_min_z(mesh: bpy.types.Object) -> float:
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(graph)
    return min((evaluated.matrix_world @ vertex.co).z for vertex in evaluated.data.vertices)


def repair_floor(target: bpy.types.Object, mesh: bpy.types.Object, action: bpy.types.Action) -> dict:
    target.animation_data.action = action
    corrected = 0
    worst_before = 0.0
    worst_after = 0.0
    for frame in range(0, int(round(action.frame_range[1])) + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        before = evaluated_min_z(mesh)
        worst_before = min(worst_before, before)
        if before < -0.0005:
            hips = target.pose.bones["Hips"]
            after = before
            for _ in range(5):
                hips.location.z += after * 1.6
                bpy.context.view_layer.update()
                after = evaluated_min_z(mesh)
                if after >= -0.0005:
                    break
            hips.keyframe_insert("location", frame=frame, group=hips.name)
            corrected += 1
        worst_after = min(worst_after, evaluated_min_z(mesh))
    return {
        "correctedFrames": corrected,
        "worstBeforeMeters": round(worst_before, 6),
        "worstAfterMeters": round(worst_after, 6),
    }


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    donor_path = Path(args.donor).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))

    bpy.ops.wm.open_mainfile(filepath=str(input_path), load_ui=False)
    target = bpy.data.objects["Jack_Quadruped_Rig"]
    mesh = bpy.data.objects["Jack_Baby_Mesh"]
    donor, appended_actions = append_donor(donor_path)
    source_actions = {action.name: action for action in appended_actions}
    required = {segment[0] for recipe in RECIPES.values() for segment in recipe}
    missing = sorted(required - set(source_actions))
    if missing:
        raise RuntimeError(f"Missing donor actions: {missing}; loaded={sorted(source_actions)}")

    clips = {clip["name"]: clip for clip in manifest["clips"]}
    built = []
    floor = {}
    for name, recipe in RECIPES.items():
        action = make_action(target, donor, source_actions, clips[name], recipe)
        floor[name] = repair_floor(target, mesh, action)
        built.append(action)

    target.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(0)
    bpy.data.objects.remove(donor, do_unlink=True)
    for action in appended_actions:
        if action.name in bpy.data.actions:
            bpy.data.actions.remove(action)

    scene = bpy.context.scene
    scene.name = "Jack_Baby_Quadruped_V2_Repair_C_Quaternius"
    scene["asset_version"] = "2.2.0-repair-c-quaternius"
    scene["animation_quality_status"] = "retargeted-proof-pending-visual-approval"
    scene["quaternius_license"] = "CC0-1.0"
    scene["root_motion_gameplay"] = False
    scene["simulation_mutation"] = False
    scene["direct_humanoid_animation"] = False
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)

    action_names = sorted(action.name for action in bpy.data.actions if action.name != "walking_meshy_baseline")
    report = {
        "schemaVersion": 1,
        "status": "retargeted-proof-pending-visual-approval",
        "input": input_path.name,
        "donor": donor_path.name,
        "output": output_path.name,
        "blenderVersion": bpy.app.version_string,
        "retargetedClips": sorted(RECIPES),
        "retargetedClipCount": len(RECIPES),
        "totalClipCount": len(action_names),
        "actionNames": action_names,
        "floorRepair": floor,
        "rootMotionGameplay": False,
        "simulationMutation": False,
        "directHumanoidAnimation": False,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
