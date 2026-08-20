"""Measure posed hind-paw contacts at one named reward-wait marker."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--mesh-name", default="Jack_Baby_Mesh")
    parser.add_argument("--action", required=True)
    parser.add_argument("--seconds", required=True, type=float)
    parser.add_argument("--fps", default=30.0, type=float)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    mesh = bpy.data.objects[args.mesh_name]
    rig.animation_data.action = bpy.data.actions[args.action]
    marker_frame = args.seconds * args.fps
    bpy.context.scene.frame_set(int(math.floor(marker_frame)), subframe=marker_frame % 1.0)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    positions = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    group_names = {group.index: group.name for group in mesh.vertex_groups}
    hind_indices = [
        vertex.index
        for vertex in mesh.data.vertices
        if sum(
            assignment.weight
            for assignment in vertex.groups
            if group_names[assignment.group].startswith("backleg")
            or group_names[assignment.group].startswith("R_backleg")
        )
        >= 0.5
    ]

    def current_hind_minimum() -> float:
        current = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        return min((current.matrix_world @ current.data.vertices[index].co).z for index in hind_indices)

    hips = rig.pose.bones["Hips"]
    original_hips_location = hips.location.copy()
    sensitivity = {}
    for axis in range(3):
        values = {}
        for offset in (-0.05, 0.05):
            hips.location = original_hips_location.copy()
            hips.location[axis] += offset
            bpy.context.view_layer.update()
            values[str(offset)] = round(current_hind_minimum(), 9)
        sensitivity[str(axis)] = values
    hips.location = original_hips_location
    bpy.context.view_layer.update()
    sides = {}
    for side, prefix in (("left", "backleg"), ("right", "R_backleg")):
        candidates = []
        for vertex in mesh.data.vertices:
            hind_weight = sum(
                assignment.weight
                for assignment in vertex.groups
                if group_names[assignment.group].startswith(prefix)
            )
            if hind_weight >= 0.5:
                candidates.append((positions[vertex.index].z, -hind_weight, vertex.index))
        _, neg_weight, index = min(candidates)
        posed = positions[index]
        rest = mesh.matrix_world @ mesh.data.vertices[index].co
        sides[side] = {
            "vertex": index,
            "hindWeight": round(-neg_weight, 7),
            "posedBlenderXyz": [round(float(value), 9) for value in posed],
            "posedGltfXyz": [round(float(posed.x), 9), round(float(posed.z), 9), round(float(-posed.y), 9)],
            "restBlenderXyz": [round(float(value), 9) for value in rest],
        }
    global_index = min(range(len(positions)), key=lambda index: positions[index].z)
    global_groups = sorted(
        (
            {
                "group": group_names[assignment.group],
                "weight": round(assignment.weight, 7),
            }
            for assignment in mesh.data.vertices[global_index].groups
        ),
        key=lambda item: item["weight"],
        reverse=True,
    )
    hips_curve_values = {}
    for curve in rig.animation_data.action.fcurves:
        if curve.data_path == 'pose.bones["Hips"].location':
            hips_curve_values[str(curve.array_index)] = {
                str(frame): round(float(curve.evaluate(frame)), 9)
                for frame in (math.floor(marker_frame), marker_frame, math.ceil(marker_frame))
            }
    payload = {
        "schemaVersion": 1,
        "source": Path(args.blend).name,
        "action": args.action,
        "markerSeconds": args.seconds,
        "markerFrame": marker_frame,
        "hipsLocation": [round(float(value), 9) for value in rig.pose.bones["Hips"].location],
        "hipsLocationCurves": hips_curve_values,
        "hipsTranslationSensitivity": sensitivity,
        "globalMinimum": {
            "vertex": global_index,
            "posedBlenderXyz": [round(float(value), 9) for value in positions[global_index]],
            "groups": global_groups,
        },
        "contacts": sides,
    }
    output = Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
