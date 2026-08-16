"""Create clean Teen/Adult mobile skins from the validated Baby topology.

The exact Baby vertex groups, armature modifier, UVs, material, and skeleton
binding are retained.  Only bounded proportion edits are applied, which keeps
all 28 verified quadruped actions deformation-compatible.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PARAMETERS = {
    "teen": {
        "headScale": 0.94,
        "torsoLength": 1.07,
        "torsoWidth": 0.98,
        "torsoDepth": 1.01,
        "runtimeDisplayScale": 1.15,
    },
    "adult": {
        "headScale": 0.88,
        "torsoLength": 1.12,
        "torsoWidth": 0.96,
        "torsoDepth": 1.02,
        "runtimeDisplayScale": 1.28,
    },
}

HEAD_GROUPS = {"head", "headend", "earend", "R_earend"}
TORSO_GROUPS = {"Hips", "chest"}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical", required=True)
    parser.add_argument("--age", choices=("teen", "adult"), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def weight(vertex: bpy.types.MeshVertex, names: set[str], group_names: dict[int, str]) -> float:
    return min(1.0, sum(item.weight for item in vertex.groups if group_names[item.group] in names))


def weighted_center(
    mesh: bpy.types.Object,
    names: set[str],
    group_names: dict[int, str],
) -> Vector:
    total = 0.0
    center = Vector((0.0, 0.0, 0.0))
    for vertex in mesh.data.vertices:
        influence = weight(vertex, names, group_names)
        if influence > 0.0001:
            center += (mesh.matrix_world @ vertex.co) * influence
            total += influence
    if total <= 1e-8:
        raise RuntimeError(f"No weighted vertices found for {sorted(names)}")
    return center / total


def apply_proportions(mesh: bpy.types.Object, age: str) -> dict[str, object]:
    params = PARAMETERS[age]
    group_names = {group.index: group.name for group in mesh.vertex_groups}
    head_center = weighted_center(mesh, HEAD_GROUPS, group_names)
    torso_center = weighted_center(mesh, TORSO_GROUPS, group_names)
    inverse = mesh.matrix_world.inverted()
    maximum_delta = 0.0
    affected = 0
    for vertex in mesh.data.vertices:
        original_world = mesh.matrix_world @ vertex.co
        revised = original_world.copy()
        torso = weight(vertex, TORSO_GROUPS, group_names)
        head = weight(vertex, HEAD_GROUPS, group_names)
        if torso > 0.0001:
            revised.y = torso_center.y + (revised.y - torso_center.y) * (
                1.0 + (params["torsoLength"] - 1.0) * torso
            )
            revised.x = torso_center.x + (revised.x - torso_center.x) * (
                1.0 + (params["torsoWidth"] - 1.0) * torso
            )
            revised.z = torso_center.z + (revised.z - torso_center.z) * (
                1.0 + (params["torsoDepth"] - 1.0) * torso
            )
        if head > 0.0001:
            factor = 1.0 + (params["headScale"] - 1.0) * head
            revised = head_center + (revised - head_center) * factor
        delta = (revised - original_world).length
        if delta > 0.000001:
            vertex.co = inverse @ revised
            affected += 1
            maximum_delta = max(maximum_delta, delta)
    mesh.data.update()
    return {
        "parameters": params,
        "headPivot": [round(value, 7) for value in head_center],
        "torsoPivot": [round(value, 7) for value in torso_center],
        "affectedVertices": affected,
        "maximumVertexDeltaMeters": round(maximum_delta, 7),
    }


def weight_metrics(mesh: bpy.types.Object) -> dict[str, object]:
    maximum = 0
    zero = 0
    for vertex in mesh.data.vertices:
        influences = [item for item in vertex.groups if item.weight > 0.0001]
        maximum = max(maximum, len(influences))
        if not influences:
            zero += 1
    return {"maximumInfluencesPerVertex": maximum, "zeroWeightVertices": zero}


def main() -> None:
    args = parse_args()
    source = Path(args.canonical).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    baby = bpy.data.objects["Jack_Baby_Mesh"]
    mesh = baby.copy()
    mesh.data = baby.data.copy()
    bpy.context.collection.objects.link(mesh)
    mesh.name = f"Jack_{args.age.title()}_Mesh"
    mesh.data.name = f"Jack_{args.age.title()}_Geometry"
    mesh.matrix_world = baby.matrix_world.copy()
    proportions = apply_proportions(mesh, args.age)
    weights = weight_metrics(mesh)
    if weights["maximumInfluencesPerVertex"] > 4 or weights["zeroWeightVertices"]:
        raise RuntimeError(f"Derived skin weight contract failed: {weights}")
    baby.hide_set(True)
    baby.hide_render = True
    baby.name = "V2_Canonical_Baby_Reference"
    baby.data.name = "V2_Canonical_Baby_Reference_Geometry"

    scene = bpy.context.scene
    scene.name = f"Jack_{args.age.title()}_Quadruped_V2_Derived_A"
    scene["asset_version"] = f"2.0.0-{args.age}-derived-a"
    scene["jack_age"] = args.age
    scene["canonical_mobile_topology"] = "Jack Baby V2"
    scene["external_art_reference"] = f"Jack {args.age.title()} Optimized 10K"
    scene["shared_skeleton_exact"] = True
    scene["direct_humanoid_animation"] = False
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["runtime_display_scale_recommendation"] = PARAMETERS[args.age]["runtimeDisplayScale"]
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)

    low, high = world_bounds(mesh)
    mesh.data.calc_loop_triangles()
    report = {
        "schemaVersion": 1,
        "status": "derived-a-created-pending-deformation-validation",
        "age": args.age,
        "source": source.name,
        "output": output.name,
        "topologySource": "validated Baby V2 mobile topology and weights",
        "externalArtReference": f"Jack {args.age.title()} Optimized 10K",
        "vertexCount": len(mesh.data.vertices),
        "triangleCount": len(mesh.data.loop_triangles),
        "materialCount": len(mesh.material_slots),
        "jointCount": len(bpy.data.objects["Jack_Quadruped_Rig"].data.bones),
        "boundsMin": [round(value, 7) for value in low],
        "boundsMax": [round(value, 7) for value in high],
        "sharedSkeletonExact": True,
        "directHumanoidAnimation": False,
        "runtimeDisplayScaleRecommendation": PARAMETERS[args.age]["runtimeDisplayScale"],
        "proportions": proportions,
        "weights": weights,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
