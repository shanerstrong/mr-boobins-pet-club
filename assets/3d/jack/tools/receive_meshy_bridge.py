"""Receive one model from Meshy's official Blender DCC Bridge.

Run from Blender's UI process, for example:

    blender.exe --python receive_meshy_bridge.py -- \
        --skin baby --blend-path ... --glb-path ... --marker-path ...

The script deliberately accepts a single transfer, records deterministic source
metadata, saves the editable scene and a raw GLB, then exits.  It does not call
Meshy's generation API or mutate application/runtime state.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
import traceback
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    forwarded = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--skin", required=True, choices=("baby", "teen", "adult"))
    parser.add_argument("--blend-path", required=True)
    parser.add_argument("--glb-path", required=True)
    parser.add_argument("--marker-path", required=True)
    parser.add_argument("--timeout-seconds", type=int, default=300)
    parser.add_argument("--settle-seconds", type=float, default=3.0)
    return parser.parse_args(forwarded)


ARGS = parse_args()
STARTED_AT = time.monotonic()
LAST_SIGNATURE: tuple[tuple[str, int, int], ...] | None = None
STABLE_SINCE: float | None = None
FINISHED = False


def output_path(value: str) -> Path:
    path = Path(value).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


BLEND_PATH = output_path(ARGS.blend_path)
GLB_PATH = output_path(ARGS.glb_path)
MARKER_PATH = output_path(ARGS.marker_path)


def write_marker(status: str, **extra: object) -> None:
    payload = {
        "schemaVersion": 1,
        "status": status,
        "skin": ARGS.skin,
        "blendPath": str(BLEND_PATH),
        "glbPath": str(GLB_PATH),
        "elapsedSeconds": round(time.monotonic() - STARTED_AT, 3),
        **extra,
    }
    MARKER_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.images,
    ):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)


def mesh_objects() -> list[bpy.types.Object]:
    return sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda obj: obj.name,
    )


def mesh_signature() -> tuple[tuple[str, int, int], ...]:
    return tuple(
        (obj.name, len(obj.data.vertices), len(obj.data.polygons))
        for obj in mesh_objects()
    )


def world_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    corners = [obj.matrix_world @ corner for obj in objects for corner in obj.bound_box]
    minimum = [min(corner[index] for corner in corners) for index in range(3)]
    maximum = [max(corner[index] for corner in corners) for index in range(3)]
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "size": [round(maximum[i] - minimum[i], 6) for i in range(3)],
    }


def collect_metrics(objects: list[bpy.types.Object]) -> dict[str, object]:
    triangles = 0
    vertices = 0
    polygons = 0
    object_rows = []
    material_names: set[str] = set()

    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        object_triangles = len(mesh.loop_triangles)
        triangles += object_triangles
        vertices += len(mesh.vertices)
        polygons += len(mesh.polygons)
        object_rows.append(
            {
                "name": obj.name,
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
                "triangles": object_triangles,
                "materials": [slot.material.name for slot in obj.material_slots if slot.material],
            }
        )
        material_names.update(
            slot.material.name for slot in obj.material_slots if slot.material
        )

    images = []
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        if image.source == "VIEWER":
            continue
        images.append(
            {
                "name": image.name,
                "width": int(image.size[0]),
                "height": int(image.size[1]),
                "packed": image.packed_file is not None,
                "source": image.source,
            }
        )

    return {
        "objectCount": len(objects),
        "vertices": vertices,
        "polygons": polygons,
        "triangles": triangles,
        "materialCount": len(material_names),
        "materials": sorted(material_names),
        "imageCount": len(images),
        "images": images,
        "boundsMeters": world_bounds(objects),
        "objects": object_rows,
    }


def normalize_names(objects: list[bpy.types.Object]) -> None:
    prefix = f"Jack_{ARGS.skin.capitalize()}"
    for index, obj in enumerate(objects, start=1):
        suffix = "Body" if len(objects) == 1 else f"Part_{index:02d}"
        obj.name = f"{prefix}_{suffix}"
        obj.data.name = f"{obj.name}_Mesh"


def export_scene(objects: list[bpy.types.Object]) -> dict[str, object]:
    normalize_names(objects)
    bpy.context.scene["jack_skin"] = ARGS.skin
    bpy.context.scene["source_pipeline"] = "Meshy official Blender DCC Bridge 0.6.1"
    bpy.context.scene["simulation_authority"] = "none-presentation-only"

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )

    metrics = collect_metrics(objects)
    metrics["blendBytes"] = BLEND_PATH.stat().st_size
    metrics["glbBytes"] = GLB_PATH.stat().st_size
    metrics["finiteBounds"] = all(
        math.isfinite(value)
        for values in metrics["boundsMeters"].values()
        for value in values
    )
    return metrics


def finish_success(objects: list[bpy.types.Object]) -> None:
    global FINISHED
    FINISHED = True
    metrics = export_scene(objects)
    write_marker("complete", metrics=metrics)
    print(f"JACK_MESHY_BRIDGE_COMPLETE {ARGS.skin} {GLB_PATH}", flush=True)
    bpy.ops.wm.quit_blender()


def finish_failure(message: str) -> None:
    global FINISHED
    if FINISHED:
        return
    FINISHED = True
    write_marker("failed", error=message)
    print(f"JACK_MESHY_BRIDGE_FAILED {ARGS.skin}: {message}", flush=True)
    bpy.ops.wm.quit_blender()


def poll_import() -> float | None:
    global LAST_SIGNATURE, STABLE_SINCE
    if FINISHED:
        return None

    try:
        elapsed = time.monotonic() - STARTED_AT
        if elapsed > ARGS.timeout_seconds:
            finish_failure(f"No stable mesh received within {ARGS.timeout_seconds} seconds")
            return None

        signature = mesh_signature()
        if not signature:
            return 0.5

        if signature != LAST_SIGNATURE:
            LAST_SIGNATURE = signature
            STABLE_SINCE = time.monotonic()
            return 0.5

        if STABLE_SINCE is None or time.monotonic() - STABLE_SINCE < ARGS.settle_seconds:
            return 0.5

        finish_success(mesh_objects())
        return None
    except Exception:
        finish_failure(traceback.format_exc())
        return None


def main() -> None:
    clear_scene()
    write_marker("waiting", port=5324)
    result = bpy.ops.meshy.bridge_start()
    if "RUNNING_MODAL" not in result:
        raise RuntimeError(f"Meshy bridge did not enter modal state: {result}")
    bpy.app.timers.register(poll_import, first_interval=0.5, persistent=True)
    print(f"JACK_MESHY_BRIDGE_WAITING {ARGS.skin} http://127.0.0.1:5324", flush=True)


try:
    main()
except Exception:
    finish_failure(traceback.format_exc())
