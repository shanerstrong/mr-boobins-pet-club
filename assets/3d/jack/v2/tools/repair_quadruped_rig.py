"""Create repair-A from the preserved Meshy quadruped source.

The pass normalizes scale and ground contact, removes Meshy's non-deforming
helper from the working scene, normalizes skin weights, creates the stable root
and semantic anchors, and derives restrained in-place walk/run baselines from
Meshy's quadruped Walking action. The original downloaded GLBs remain intact.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


TARGET_HEIGHT_METERS = 1.0
SAMPLE_FRAMES = (0.0, 6.0, 12.0, 18.0, 24.0)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
    )


def evaluated_world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    corners = [evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
    )


def normalize_weights(mesh_obj: bpy.types.Object) -> dict[str, int | float]:
    normalized = 0
    maximum_influences = 0
    zero_weight = 0
    for vertex in mesh_obj.data.vertices:
        influences = [(entry.group, entry.weight) for entry in vertex.groups if entry.weight > 0.0001]
        maximum_influences = max(maximum_influences, len(influences))
        total = sum(weight for _, weight in influences)
        if total <= 1e-8:
            zero_weight += 1
            continue
        if abs(total - 1.0) > 0.00001:
            for group_index, weight in influences:
                mesh_obj.vertex_groups[group_index].add([vertex.index], weight / total, "REPLACE")
            normalized += 1
    return {
        "verticesNormalized": normalized,
        "maximumInfluencesPerVertex": maximum_influences,
        "zeroWeightVertices": zero_weight,
    }


def capture_baseline(rig: bpy.types.Object, action: bpy.types.Action) -> dict[float, dict[str, tuple]]:
    rig.animation_data_create()
    rig.animation_data.action = action
    captured: dict[float, dict[str, tuple]] = {}
    for frame in SAMPLE_FRAMES:
        bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
        captured[frame] = {}
        for bone in rig.pose.bones:
            bone.rotation_mode = "QUATERNION"
            captured[frame][bone.name] = (
                bone.location.copy(),
                bone.rotation_quaternion.copy(),
                bone.scale.copy(),
            )
    return captured


def factor_for_bone(name: str, locomotion: str) -> float:
    if name in {"Hips", "chest", "head", "headend", "earend", "R_earend"}:
        return 0.18 if locomotion == "walk" else 0.28
    if name.startswith("tail"):
        return 0.32 if locomotion == "walk" else 0.45
    if "leg" in name:
        distal = name.endswith("2")
        middle = name.endswith("0") or name.endswith("1")
        if locomotion == "walk":
            return 0.34 if distal else (0.40 if middle else 0.44)
        return 0.48 if distal else (0.56 if middle else 0.62)
    return 0.25


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
        bone.scale = Vector((1.0, 1.0, 1.0))


def build_locomotion_action(
    rig: bpy.types.Object,
    captured: dict[float, dict[str, tuple]],
    name: str,
    output_frames: tuple[float, ...],
) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action["loop"] = True
    action["in_place"] = True
    action["source"] = "Meshy quadruped Walking baseline; restrained Blender derivative"
    action["direct_humanoid_animation"] = False
    rig.animation_data.action = action
    identity = Quaternion((1.0, 0.0, 0.0, 0.0))
    for source_frame, output_frame in zip(SAMPLE_FRAMES, output_frames, strict=True):
        reset_pose(rig)
        for bone in rig.pose.bones:
            source_location, source_rotation, source_scale = captured[source_frame][bone.name]
            factor = factor_for_bone(bone.name, name)
            bone.location = source_location * factor
            if bone.name == "Hips":
                bone.location = Vector((0.0, 0.0, 0.0))
            bone.rotation_quaternion = identity.slerp(source_rotation, factor)
            bone.scale = Vector((1.0, 1.0, 1.0)).lerp(source_scale, factor)
            bone.keyframe_insert("location", frame=output_frame, group=bone.name)
            bone.keyframe_insert("rotation_quaternion", frame=output_frame, group=bone.name)
            bone.keyframe_insert("scale", frame=output_frame, group=bone.name)
    reset_pose(rig)
    for curve in getattr(action, "fcurves", []):
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
    return action


def bone_world_position(rig: bpy.types.Object, bone_name: str, tail: bool = False) -> Vector:
    bone = rig.data.bones[bone_name]
    local = bone.tail_local if tail else bone.head_local
    return rig.matrix_world @ local


def add_anchor(
    root: bpy.types.Object,
    rig: bpy.types.Object,
    name: str,
    bone_name: str,
    *,
    tail: bool = False,
    display_size: float = 0.025,
    display_type: str = "PLAIN_AXES",
) -> bpy.types.Object:
    anchor = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(anchor)
    anchor.empty_display_type = display_type
    anchor.empty_display_size = display_size
    anchor.hide_render = True
    anchor["semantic_anchor"] = True
    anchor["presentation_only"] = True
    world_position = bone_world_position(rig, bone_name, tail=tail)
    anchor.parent = rig
    anchor.parent_type = "BONE"
    anchor.parent_bone = bone_name
    anchor.matrix_world.translation = world_position
    return anchor


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    character = max(meshes, key=lambda obj: len(obj.vertex_groups))
    helpers = [obj for obj in meshes if obj != character]
    baseline = next(iter(bpy.data.actions))
    baseline.name = "walking_meshy_baseline"
    baseline.use_fake_user = True

    captured = capture_baseline(rig, baseline)
    weight_report = normalize_weights(character)
    if weight_report["maximumInfluencesPerVertex"] > 4:
        raise RuntimeError("Meshy source exceeds four influences per vertex")
    if weight_report["zeroWeightVertices"]:
        raise RuntimeError("Character mesh contains unweighted vertices")

    for helper in helpers:
        bpy.data.objects.remove(helper, do_unlink=True)
    rig.name = "Jack_Quadruped_Rig"
    rig.data.name = "Jack_Quadruped_Skeleton"
    character.name = "Jack_Baby_Mesh"
    character.data.name = "Jack_Baby_Geometry"

    rig.animation_data.action = baseline
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    initial_min, initial_max = evaluated_world_bounds(character)
    initial_height = initial_max.z - initial_min.z
    normalization_scale = TARGET_HEIGHT_METERS / initial_height
    rig.scale *= normalization_scale
    bpy.context.view_layer.update()
    scaled_min, _ = evaluated_world_bounds(character)
    rig.location.z -= scaled_min.z
    bpy.context.view_layer.update()

    root = bpy.data.objects.new("jack_root", None)
    bpy.context.collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.12
    root["presentation_only"] = True
    root["simulation_mutation"] = False
    root["root_motion_gameplay"] = False
    rig.parent = root

    anchors = [
        add_anchor(root, rig, "nose_visual", "headend", tail=True, display_size=0.018),
        add_anchor(root, rig, "hit_nose", "headend", tail=True, display_size=0.08, display_type="CUBE"),
        add_anchor(root, rig, "mouth_anchor", "headend", tail=True, display_size=0.022),
        add_anchor(root, rig, "collar", "chest", tail=True, display_size=0.03),
        add_anchor(root, rig, "tag", "chest", tail=True, display_size=0.022),
        add_anchor(root, rig, "tail_base", "tail", display_size=0.03),
        add_anchor(root, rig, "paw_front_l", "frontleg2", tail=True, display_size=0.025),
        add_anchor(root, rig, "paw_front_r", "R_frontleg2", tail=True, display_size=0.025),
    ]
    for anchor in anchors:
        anchor["export_node"] = True
    bpy.data.objects["hit_nose"]["minimum_screen_target_css_pixels"] = 56

    walk = build_locomotion_action(rig, captured, "walk", SAMPLE_FRAMES)
    run = build_locomotion_action(rig, captured, "run", (0.0, 4.5, 9.0, 13.5, 18.0))
    walk["duration_seconds"] = 0.8
    run["duration_seconds"] = 0.6
    rig.animation_data.action = walk

    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    repair_min, repair_max = evaluated_world_bounds(character)
    repair_height = repair_max.z - repair_min.z
    correction_scale = TARGET_HEIGHT_METERS / repair_height
    rig.scale *= correction_scale
    bpy.context.view_layer.update()
    corrected_min, _ = evaluated_world_bounds(character)
    rig.location.z -= corrected_min.z
    normalization_scale *= correction_scale
    bpy.context.view_layer.update()

    scene = bpy.context.scene
    scene.name = "Jack_Baby_Quadruped_V2_Repair_A"
    scene.render.fps = 30
    scene.frame_start = 0
    scene.frame_end = 24
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["asset_version"] = "2.0.0-repair-a"
    scene["source_pipeline"] = "Meshy Quadruped Dog Smart Rig; Blender repair A"
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["root_motion_gameplay"] = False
    scene["direct_humanoid_animation_allowed"] = False
    scene["deformation_repair_status"] = "walk-run-restrained-baseline"
    scene["meshy_helper_removed"] = True
    scene["normalization_scale"] = normalization_scale

    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    final_min, final_max = evaluated_world_bounds(character)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)

    report = {
        "schemaVersion": 1,
        "status": "repair-a",
        "input": source.name,
        "output": output.name,
        "blenderVersion": bpy.app.version_string,
        "boneCount": len(rig.data.bones),
        "actions": [walk.name, run.name, baseline.name],
        "normalizationScale": round(normalization_scale, 6),
        "postActionCorrectionScale": round(correction_scale, 6),
        "normalizedBoundsMin": [round(value, 6) for value in final_min],
        "normalizedBoundsMax": [round(value, 6) for value in final_max],
        "groundContactZ": round(final_min.z, 6),
        "rootIdentity": (
            root.location.length <= 0.000001
            and root.rotation_euler.to_matrix().is_identity
            and all(abs(value - 1.0) <= 0.000001 for value in root.scale)
        ),
        "semanticAnchors": sorted(anchor.name for anchor in anchors) + ["head", "jack_root"],
        "meshyHelperRemoved": True,
        "rootMotionGameplay": False,
        "directHumanoidAnimation": False,
        "weights": weight_report,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
