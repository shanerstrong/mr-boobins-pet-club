"""Import and inspect the free Quaternius German Shepherd FBX.

This creates an additive Blender checkpoint and a deterministic JSON report.
The donor file itself remains untouched.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--fbx", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def triangle_count(obj: bpy.types.Object) -> int:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        return len(mesh.loop_triangles)
    finally:
        evaluated.to_mesh_clear()


def main() -> None:
    args = parse_args()
    source = Path(args.fbx).resolve()
    blend_out = Path(args.blend).resolve()
    report_out = Path(args.report).resolve()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source), automatic_bone_orientation=False)
    bpy.context.view_layer.update()

    meshes = []
    total_triangles = 0
    world_min = [float("inf")] * 3
    world_max = [float("-inf")] * 3
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        triangles = triangle_count(obj)
        total_triangles += triangles
        for corner in obj.bound_box:
            point = obj.matrix_world @ __import__("mathutils").Vector(corner)
            for axis in range(3):
                world_min[axis] = min(world_min[axis], point[axis])
                world_max[axis] = max(world_max[axis], point[axis])
        meshes.append({
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "triangles": triangles,
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "armatureModifiers": [modifier.object.name for modifier in obj.modifiers if modifier.type == "ARMATURE" and modifier.object],
            "shapeKeys": list(obj.data.shape_keys.key_blocks.keys()) if obj.data.shape_keys else [],
        })

    armatures = []
    for obj in sorted((item for item in bpy.data.objects if item.type == "ARMATURE"), key=lambda item: item.name):
        armatures.append({
            "name": obj.name,
            "boneCount": len(obj.data.bones),
            "bones": [bone.name for bone in obj.data.bones],
        })

    actions = []
    for action in sorted(bpy.data.actions, key=lambda item: item.name):
        start, end = action.frame_range
        actions.append({
            "name": action.name,
            "frameStart": round(float(start), 4),
            "frameEnd": round(float(end), 4),
            "durationFrames": round(float(end - start), 4),
            "fCurveCount": len(action.fcurves),
        })

    dimensions = [round(world_max[i] - world_min[i], 6) for i in range(3)] if meshes else [0, 0, 0]
    report = {
        "schemaVersion": 1,
        "status": "imported-and-inspected",
        "source": source.name,
        "sourceBytes": source.stat().st_size,
        "sourceSha256": sha256(source),
        "license": "CC-BY-3.0",
        "sourceUrl": "https://poly.pizza/m/Hssa6NPc6W",
        "blenderVersion": bpy.app.version_string,
        "sceneFps": bpy.context.scene.render.fps,
        "boundsMin": [round(value, 6) for value in world_min] if meshes else [0, 0, 0],
        "boundsMax": [round(value, 6) for value in world_max] if meshes else [0, 0, 0],
        "dimensions": dimensions,
        "meshCount": len(meshes),
        "totalTriangles": total_triangles,
        "meshes": meshes,
        "armatures": armatures,
        "actionCount": len(actions),
        "actions": actions,
    }

    blend_out.parent.mkdir(parents=True, exist_ok=True)
    report_out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_out), check_existing=False)
    report_out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
