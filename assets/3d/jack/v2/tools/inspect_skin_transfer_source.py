"""Inspect a Jack skin or rigged GLB/Blend for V2 transfer planning."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def rounded(values) -> list[float]:
    return [round(float(value), 7) for value in values]


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    report_path = Path(args.report).resolve()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source))
    else:
        bpy.ops.import_scene.gltf(filepath=str(source))
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()

    meshes = []
    for obj in sorted((item for item in bpy.context.scene.objects if item.type == "MESH"), key=lambda item: item.name):
        low, high = bounds(obj)
        obj.data.calc_loop_triangles()
        meshes.append({
            "name": obj.name,
            "parent": obj.parent.name if obj.parent else None,
            "location": rounded(obj.location),
            "rotationEuler": rounded(obj.rotation_euler),
            "scale": rounded(obj.scale),
            "boundsMin": rounded(low),
            "boundsMax": rounded(high),
            "dimensions": rounded(high - low),
            "vertices": len(obj.data.vertices),
            "triangles": len(obj.data.loop_triangles),
            "vertexGroups": sorted(group.name for group in obj.vertex_groups),
            "shapeKeys": [block.name for block in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else [],
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
        })

    armatures = []
    for rig in sorted((item for item in bpy.context.scene.objects if item.type == "ARMATURE"), key=lambda item: item.name):
        armatures.append({
            "name": rig.name,
            "parent": rig.parent.name if rig.parent else None,
            "location": rounded(rig.location),
            "rotationEuler": rounded(rig.rotation_euler),
            "scale": rounded(rig.scale),
            "bones": [
                {
                    "name": bone.name,
                    "parent": bone.parent.name if bone.parent else None,
                    "headLocal": rounded(bone.head_local),
                    "tailLocal": rounded(bone.tail_local),
                }
                for bone in rig.data.bones
            ],
        })

    report = {
        "schemaVersion": 1,
        "source": source.name,
        "meshes": meshes,
        "armatures": armatures,
        "actions": sorted(action.name for action in bpy.data.actions),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "source": source.name,
        "meshCount": len(meshes),
        "armatureCount": len(armatures),
        "report": str(report_path),
    }, indent=2))


if __name__ == "__main__":
    main()
