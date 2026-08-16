"""Read-only Blender inspection for a rigged Jack source file.

The script imports GLB/glTF or FBX into an empty scene and writes a deterministic
JSON report. It does not save a Blender file, edit the source, or render images.
"""

from __future__ import annotations

import argparse
import hashlib
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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def import_source(path: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    suffix = path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False)
    else:
        raise ValueError(f"Unsupported source type: {suffix}")


def mesh_report(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    weighted_vertices = 0
    zero_weight_vertices = 0
    more_than_four_influences = 0
    maximum_influences = 0
    for vertex in mesh.vertices:
        influences = sum(1 for group in vertex.groups if group.weight > 0.0001)
        maximum_influences = max(maximum_influences, influences)
        if influences:
            weighted_vertices += 1
        else:
            zero_weight_vertices += 1
        if influences > 4:
            more_than_four_influences += 1

    armature_modifiers = [
        modifier.object.name if modifier.object else None
        for modifier in obj.modifiers
        if modifier.type == "ARMATURE"
    ]
    world_corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    bounds_min = [min(point[axis] for point in world_corners) for axis in range(3)]
    bounds_max = [max(point[axis] for point in world_corners) for axis in range(3)]
    return {
        "name": obj.name,
        "parent": obj.parent.name if obj.parent else None,
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "materials": sorted(
            slot.material.name for slot in obj.material_slots if slot.material
        ),
        "uvLayers": [layer.name for layer in mesh.uv_layers],
        "vertexGroups": len(obj.vertex_groups),
        "weightedVertices": weighted_vertices,
        "zeroWeightVertices": zero_weight_vertices,
        "maximumInfluencesPerVertex": maximum_influences,
        "verticesOverFourInfluences": more_than_four_influences,
        "armatureModifiers": armature_modifiers,
        "location": [round(value, 6) for value in obj.location],
        "rotationEuler": [round(value, 6) for value in obj.rotation_euler],
        "scale": [round(value, 6) for value in obj.scale],
        "worldBoundsMin": [round(value, 6) for value in bounds_min],
        "worldBoundsMax": [round(value, 6) for value in bounds_max],
        "hideRender": bool(obj.hide_render),
    }


def armature_report(obj: bpy.types.Object) -> dict[str, object]:
    bones = []
    for bone in obj.data.bones:
        bones.append(
            {
                "name": bone.name,
                "parent": bone.parent.name if bone.parent else None,
                "deform": bool(bone.use_deform),
                "connected": bool(bone.use_connect),
                "head": [round(value, 6) for value in bone.head_local],
                "tail": [round(value, 6) for value in bone.tail_local],
            }
        )
    return {
        "name": obj.name,
        "boneCount": len(bones),
        "deformBoneCount": sum(1 for bone in obj.data.bones if bone.use_deform),
        "rootBones": [bone.name for bone in obj.data.bones if bone.parent is None],
        "bones": bones,
    }


def action_report(action: bpy.types.Action) -> dict[str, object]:
    frame_start, frame_end = action.frame_range
    slots = getattr(action, "slots", [])
    channelbag_count = 0
    curve_count = 0
    keyframe_count = 0

    # Blender 4.4+ layered actions.
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for slot in slots:
                try:
                    bag = strip.channelbag(slot)
                except RuntimeError:
                    bag = None
                if bag is None:
                    continue
                channelbag_count += 1
                curves = getattr(bag, "fcurves", [])
                curve_count += len(curves)
                keyframe_count += sum(len(curve.keyframe_points) for curve in curves)

    # Legacy actions remain common in imported FBX/glTF files.
    legacy_curves = getattr(action, "fcurves", [])
    curve_count += len(legacy_curves)
    keyframe_count += sum(len(curve.keyframe_points) for curve in legacy_curves)
    return {
        "name": action.name,
        "frameStart": round(float(frame_start), 4),
        "frameEnd": round(float(frame_end), 4),
        "slotCount": len(slots),
        "channelbagCount": channelbag_count,
        "curveCount": curve_count,
        "keyframeCount": keyframe_count,
    }


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    report_path = Path(args.report).resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    import_source(source)
    meshes = sorted(
        (mesh_report(obj) for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda item: item["name"],
    )
    armatures = sorted(
        (armature_report(obj) for obj in bpy.context.scene.objects if obj.type == "ARMATURE"),
        key=lambda item: item["name"],
    )
    actions = sorted((action_report(action) for action in bpy.data.actions), key=lambda item: item["name"])
    images = sorted(
        ({
            "name": image.name,
            "width": int(image.size[0]),
            "height": int(image.size[1]),
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
        if image.name != "Render Result"),
        key=lambda item: item["name"],
    )

    report = {
        "schemaVersion": 1,
        "status": "pass" if armatures and actions else "source-not-rigged",
        "source": source.name,
        "sourceBytes": source.stat().st_size,
        "sourceSha256": sha256(source),
        "blenderVersion": bpy.app.version_string,
        "sceneFps": bpy.context.scene.render.fps,
        "objectCount": len(bpy.context.scene.objects),
        "meshCount": len(meshes),
        "armatureCount": len(armatures),
        "actionCount": len(actions),
        "triangleCount": sum(int(mesh["triangles"]) for mesh in meshes),
        "materialCount": len({name for mesh in meshes for name in mesh["materials"]}),
        "imageCount": len(images),
        "meshes": meshes,
        "armatures": armatures,
        "actions": actions,
        "images": images,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in (
        "status", "meshCount", "armatureCount", "actionCount", "triangleCount"
    )}, indent=2))


if __name__ == "__main__":
    main()
