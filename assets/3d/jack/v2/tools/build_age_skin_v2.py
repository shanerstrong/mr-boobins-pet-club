"""Bind an existing Jack age mesh to the canonical V2 quadruped skeleton.

The source mesh is recovered from the already-built V1 skin GLB so its
materials and condition/facial morphs survive.  V1 skin weights are
consolidated onto the exact 27-bone Meshy quadruped skeleton; no humanoid
animation is imported or applied.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


GROUP_MAP = {
    "root": "Hips", "pelvis": "Hips", "spine_01": "Hips",
    "spine_02": "chest", "chest": "chest", "neck_01": "chest",
    "neck_02": "head", "head": "head", "muzzle": "headend", "jaw": "headend",
    "ear_L_base": "R_earend", "ear_L_tip": "R_earend",
    "ear_R_base": "earend", "ear_R_tip": "earend",
    "scapula_L": "R_frontleg", "upper_arm_L": "R_frontleg0",
    "forearm_L": "R_frontleg1", "wrist_L": "R_frontleg1",
    "front_paw_L": "R_frontleg2", "front_toe_L": "R_frontleg2",
    "scapula_R": "frontleg", "upper_arm_R": "frontleg0",
    "forearm_R": "frontleg1", "wrist_R": "frontleg1",
    "front_paw_R": "frontleg2", "front_toe_R": "frontleg2",
    "thigh_L": "R_backleg", "shin_L": "R_backleg0", "hock_L": "R_backleg1",
    "rear_paw_L": "R_backleg2", "rear_toe_L": "R_backleg2",
    "thigh_R": "backleg", "shin_R": "backleg0", "hock_R": "backleg1",
    "rear_paw_R": "backleg2", "rear_toe_R": "backleg2",
    "tail_01": "tail", "tail_02": "tailstart", "tail_03": "tail1",
}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical", required=True)
    parser.add_argument("--source-skin", required=True)
    parser.add_argument("--reference-mesh", default="Jack_Baby_Mesh")
    parser.add_argument("--alignment-mesh")
    parser.add_argument("--age", choices=("teen", "adult"), required=True)
    parser.add_argument("--weight-source", choices=("mapped", "nearest"), default="nearest")
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def detach_keep_world(obj: bpy.types.Object) -> None:
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = world


def remove_imported_objects(imported: set[bpy.types.Object], keep: bpy.types.Object) -> None:
    detach_keep_world(keep)
    for obj in list(imported):
        if obj != keep and obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)


def align_to_canonical(mesh: bpy.types.Object, reference: bpy.types.Object) -> dict[str, object]:
    ref_min, ref_max = world_bounds(reference)
    src_min, src_max = world_bounds(mesh)
    ref_dimensions = ref_max - ref_min
    src_dimensions = src_max - src_min
    # Match the shared rig's longitudinal span and height. Preserve the
    # teen/adult source width so the mature skins remain visibly leaner.
    scale = Vector((1.0, ref_dimensions.y / src_dimensions.y, ref_dimensions.z / src_dimensions.z))
    mesh.scale = Vector((mesh.scale.x * scale.x, mesh.scale.y * scale.y, mesh.scale.z * scale.z))
    bpy.context.view_layer.update()
    scaled_min, scaled_max = world_bounds(mesh)
    translation = Vector((
        ((ref_min.x + ref_max.x) - (scaled_min.x + scaled_max.x)) * 0.5,
        ((ref_min.y + ref_max.y) - (scaled_min.y + scaled_max.y)) * 0.5,
        ref_min.z - scaled_min.z,
    ))
    mesh.location += translation
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mesh.select_set(False)
    final_min, final_max = world_bounds(mesh)
    return {
        "sourceBoundsMin": [round(value, 7) for value in src_min],
        "sourceBoundsMax": [round(value, 7) for value in src_max],
        "axisScale": [round(value, 7) for value in scale],
        "translation": [round(value, 7) for value in translation],
        "alignedBoundsMin": [round(value, 7) for value in final_min],
        "alignedBoundsMax": [round(value, 7) for value in final_max],
    }


def remap_weights(mesh: bpy.types.Object, target_bones: set[str]) -> dict[str, object]:
    old_names = {group.index: group.name for group in mesh.vertex_groups}
    captured: list[dict[str, float]] = []
    for vertex in mesh.data.vertices:
        merged: dict[str, float] = {}
        for assignment in vertex.groups:
            source_name = old_names[assignment.group]
            if source_name == "tail_04":
                # Split the final source segment over the two final Meshy tail
                # joints so tip motion remains tapered rather than rigid.
                targets = (("tail2", 0.48), ("tail3", 0.52))
            else:
                mapped = GROUP_MAP.get(source_name)
                targets = ((mapped, 1.0),) if mapped else ()
            for target, factor in targets:
                if target in target_bones:
                    merged[target] = merged.get(target, 0.0) + assignment.weight * factor
        ranked = sorted(merged.items(), key=lambda item: item[1], reverse=True)[:4]
        total = sum(weight for _, weight in ranked)
        captured.append({name: weight / total for name, weight in ranked} if total > 1e-8 else {})

    mesh.vertex_groups.clear()
    groups = {name: mesh.vertex_groups.new(name=name) for name in sorted(target_bones)}
    zero_weight = 0
    maximum_influences = 0
    for vertex, weights in zip(mesh.data.vertices, captured, strict=True):
        if not weights:
            zero_weight += 1
            continue
        maximum_influences = max(maximum_influences, len(weights))
        for name, weight in weights.items():
            groups[name].add([vertex.index], weight, "REPLACE")
    used = sorted(name for name, group in groups.items() if any(group.index == item.group for vertex in mesh.data.vertices for item in vertex.groups))
    return {
        "zeroWeightVertices": zero_weight,
        "maximumInfluencesPerVertex": maximum_influences,
        "usedBoneCount": len(used),
        "usedBones": used,
    }


def normalize_existing_weights(mesh: bpy.types.Object) -> dict[str, object]:
    group_names = {group.index: group.name for group in mesh.vertex_groups}
    group_indices = {group.name: group.index for group in mesh.vertex_groups}
    captured: list[list[tuple[int, float]]] = []
    for vertex in mesh.data.vertices:
        world = mesh.matrix_world @ vertex.co
        assignments = [entry for entry in vertex.groups if entry.weight > 0.0001]
        has_non_tail_weight = any(
            not group_names[entry.group].startswith("tail") for entry in assignments
        )
        ranked = sorted(
            (
                (entry.group, entry.weight)
                for entry in assignments
                if not (
                # Nearest-surface transfer can see the hanging tail as the
                # closest Baby surface to a rear paw. Tail influence below the
                # Teen ankle is anatomical cross-talk and caused the observed
                # 2.3 cm floor spike in sit/wake/up.
                    group_names[entry.group].startswith("tail")
                    and world.z < 0.15
                    and abs(world.x) > 0.07
                    and has_non_tail_weight
                )
            ),
            key=lambda item: item[1],
            reverse=True,
        )[:4]
        if world.z < 0.15 and world.y > 0.15 and abs(world.x) > 0.07:
            prefix = "R_" if world.x < 0.0 else ""
            # Match the validated Baby rear-sole distribution measured at its
            # floor-contact vertex: distal 0.7355, middle 0.2131, proximal
            # 0.0514. This prevents long Teen toes from folding through y=0.
            ranked = [
                (group_indices[f"{prefix}backleg2"], 0.7355375),
                (group_indices[f"{prefix}backleg1"], 0.2130698),
                (group_indices[f"{prefix}backleg0"], 0.0513927),
            ]
        total = sum(weight for _, weight in ranked)
        captured.append([(index, weight / total) for index, weight in ranked] if total > 1e-8 else [])
    for vertex in mesh.data.vertices:
        for assignment in list(vertex.groups):
            mesh.vertex_groups[assignment.group].remove([vertex.index])
    zero_weight = 0
    maximum_influences = 0
    for vertex, weights in zip(mesh.data.vertices, captured, strict=True):
        if not weights:
            zero_weight += 1
            continue
        maximum_influences = max(maximum_influences, len(weights))
        for group_index, weight in weights:
            mesh.vertex_groups[group_index].add([vertex.index], weight, "REPLACE")
    used = sorted(
        group.name for group in mesh.vertex_groups
        if any(group.index == assignment.group for vertex in mesh.data.vertices for assignment in vertex.groups)
    )
    return {
        "zeroWeightVertices": zero_weight,
        "maximumInfluencesPerVertex": maximum_influences,
        "usedBoneCount": len(used),
        "usedBones": used,
    }


def transfer_nearest_weights(
    mesh: bpy.types.Object,
    reference: bpy.types.Object,
    target_bones: set[str],
) -> dict[str, object]:
    mesh.vertex_groups.clear()
    for name in sorted(target_bones):
        mesh.vertex_groups.new(name=name)
    source_armatures = [modifier for modifier in reference.modifiers if modifier.type == "ARMATURE"]
    source_visibility = [modifier.show_viewport for modifier in source_armatures]
    for modifier in source_armatures:
        modifier.show_viewport = False
    bpy.context.view_layer.update()
    transfer = mesh.modifiers.new("V2 Nearest Surface Weights", "DATA_TRANSFER")
    transfer.object = reference
    transfer.use_vert_data = True
    transfer.data_types_verts = {"VGROUP_WEIGHTS"}
    transfer.vert_mapping = "POLYINTERP_NEAREST"
    transfer.layers_vgroup_select_src = "ALL"
    transfer.layers_vgroup_select_dst = "NAME"
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    mesh.select_set(False)
    for modifier, visible in zip(source_armatures, source_visibility, strict=True):
        modifier.show_viewport = visible
    bpy.context.view_layer.update()
    return normalize_existing_weights(mesh)


def shorten_rear_paw_overhang(mesh: bpy.types.Object) -> dict[str, object]:
    """Bring long mature toes back over the Baby-rig distal joint.

    The Teen source's rear toe reaches about 15 cm farther behind the shared
    V2 joint than the Baby sole. Under sit/up rotation that lever arm clips the
    floor even with correct distal weighting. Compress only the low, lateral
    rear-paw overhang; preserve every shape-key delta by moving all keys by the
    same per-vertex amount.
    """
    inverse = mesh.matrix_world.inverted()
    affected: list[tuple[int, Vector]] = []
    for vertex in mesh.data.vertices:
        world = mesh.matrix_world @ vertex.co
        if world.z < 0.22 and world.y > 0.15 and abs(world.x) > 0.07:
            repaired_y = 0.15 + (world.y - 0.15) * 0.60
            repaired_world = Vector((world.x, repaired_y, world.z))
            affected.append((vertex.index, inverse @ repaired_world - vertex.co))
    if mesh.data.shape_keys:
        for key in mesh.data.shape_keys.key_blocks:
            for index, delta in affected:
                key.data[index].co += delta
    else:
        for index, delta in affected:
            mesh.data.vertices[index].co += delta
    mesh.data.update()
    return {
        "affectedVertices": len(affected),
        "rearPawPivotY": 0.15,
        "overhangScale": 0.60,
    }


def main() -> None:
    args = parse_args()
    canonical = Path(args.canonical).resolve()
    source_skin = Path(args.source_skin).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(canonical))
    scene = bpy.context.scene
    scene.frame_set(0)
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    reference = bpy.data.objects[args.reference_mesh]
    reference_source_name = reference.name
    alignment_reference = bpy.data.objects[args.alignment_mesh] if args.alignment_mesh else reference
    alignment_source_name = alignment_reference.name
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.view_layer.update()

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source_skin))
    imported = set(bpy.data.objects) - before
    candidates = [obj for obj in imported if obj.type == "MESH" and len(obj.data.vertices) > 1000]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one imported character mesh, found {[obj.name for obj in candidates]}")
    mesh = candidates[0]
    remove_imported_objects(imported, mesh)
    for modifier in list(mesh.modifiers):
        if modifier.type == "ARMATURE":
            mesh.modifiers.remove(modifier)
    alignment = align_to_canonical(mesh, alignment_reference)
    target_bones = {bone.name for bone in rig.data.bones}
    weight_report = (
        transfer_nearest_weights(mesh, reference, target_bones)
        if args.weight_source == "nearest"
        else remap_weights(mesh, target_bones)
    )
    geometry_repair = shorten_rear_paw_overhang(mesh) if args.weight_source == "nearest" else None
    if weight_report["zeroWeightVertices"]:
        raise RuntimeError(f"Unweighted vertices after remap: {weight_report['zeroWeightVertices']}")
    if weight_report["maximumInfluencesPerVertex"] > 4:
        raise RuntimeError("Skin exceeds four influences per vertex")

    mesh.name = f"Jack_{args.age.title()}_Mesh"
    mesh.data.name = f"Jack_{args.age.title()}_Geometry"
    world = mesh.matrix_world.copy()
    mesh.parent = rig
    mesh.matrix_parent_inverse = rig.matrix_world.inverted()
    mesh.matrix_world = world
    modifier = mesh.modifiers.new("Jack V2 Quadruped Skin", "ARMATURE")
    modifier.object = rig
    # Match the canonical Meshy skinning mode. Dual-quaternion/preserve-volume
    # exaggerates the long Teen extremities during rear-up poses.
    modifier.use_deform_preserve_volume = False
    reference.hide_render = True
    reference.hide_set(True)
    reference.name = "V2_Weight_Reference_Source"
    reference.data.name = "V2_Weight_Reference_Source_Geometry"

    scene.name = f"Jack_{args.age.title()}_Quadruped_V2_Transfer_A"
    scene["asset_version"] = f"2.0.0-{args.age}-transfer-a"
    scene["jack_age"] = args.age
    scene["source_skin"] = source_skin.name
    scene["canonical_rig_source"] = canonical.name
    scene["weight_reference_mesh"] = reference_source_name
    scene["alignment_reference_mesh"] = alignment_source_name
    scene["shared_skeleton_exact"] = True
    scene["direct_humanoid_animation"] = False
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["runtime_display_scale_recommendation"] = 1.15 if args.age == "teen" else 1.28
    scene["weight_source"] = args.weight_source
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)

    mesh.data.calc_loop_triangles()
    report = {
        "schemaVersion": 1,
        "status": "transfer-a-created-pending-deformation-validation",
        "age": args.age,
        "source": source_skin.name,
        "canonical": canonical.name,
        "weightReferenceMesh": reference_source_name,
        "alignmentReferenceMesh": alignment_source_name,
        "output": output.name,
        "vertexCount": len(mesh.data.vertices),
        "triangleCount": len(mesh.data.loop_triangles),
        "materialCount": len(mesh.material_slots),
        "shapeKeys": [key.name for key in mesh.data.shape_keys.key_blocks] if mesh.data.shape_keys else [],
        "jointCount": len(rig.data.bones),
        "sharedSkeletonExact": True,
        "directHumanoidAnimation": False,
        "weightSource": args.weight_source,
        "runtimeDisplayScaleRecommendation": scene["runtime_display_scale_recommendation"],
        "alignment": alignment,
        "geometryRepair": geometry_repair,
        "weights": weight_report,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
