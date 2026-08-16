"""Import, normalize, inspect, and render one approved Meshy age mesh.

This is a deterministic source-ingest step.  It never regenerates a model,
contacts Meshy, authors gameplay state, or changes the application.  The raw
GLB remains unchanged under exports/source; the normalized Blender file is an
editable project source used by the later shared-rig binding step.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import traceback
from pathlib import Path

import bpy
from mathutils import Vector


TARGET_HEIGHT_METERS = 1.30
TARGET_BOUNDS_CENTER_Y = 0.08


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--age", choices=("baby", "teen", "adult"), required=True)
    parser.add_argument("--input-glb", required=True)
    parser.add_argument("--blend-path", required=True)
    parser.add_argument("--report-path", required=True)
    parser.add_argument("--evidence-dir", required=True)
    return parser.parse_args(forwarded)


ARGS = parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    # The Microsoft Store build can expose an unsupported Eevee compute path in
    # background sessions. Cycles CPU is slower but deterministic and avoids
    # depending on a graphics context for source-ingest evidence.
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Review_World")
    scene.world.color = (0.025, 0.030, 0.040)
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def imported_meshes() -> list[bpy.types.Object]:
    return sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda obj: obj.name,
    )


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
    )


def apply_normalization(objects: list[bpy.types.Object]) -> dict[str, object]:
    before_min, before_max = world_bounds(objects)
    height = before_max.z - before_min.z
    if height <= 1e-6:
        raise RuntimeError("Imported mesh has no measurable height")
    scale = TARGET_HEIGHT_METERS / height

    for obj in objects:
        obj.scale *= scale
    bpy.context.view_layer.update()

    scaled_min, scaled_max = world_bounds(objects)
    center_x = (scaled_min.x + scaled_max.x) * 0.5
    center_y = (scaled_min.y + scaled_max.y) * 0.5
    translation = Vector((-center_x, TARGET_BOUNDS_CENTER_Y - center_y, -scaled_min.z))
    for obj in objects:
        obj.location += translation
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.view_layer.update()

    after_min, after_max = world_bounds(objects)
    return {
        "inputBoundsMin": [round(value, 6) for value in before_min],
        "inputBoundsMax": [round(value, 6) for value in before_max],
        "normalizationScale": round(scale, 9),
        "translation": [round(value, 9) for value in translation],
        "normalizedBoundsMin": [round(value, 6) for value in after_min],
        "normalizedBoundsMax": [round(value, 6) for value in after_max],
    }


def mesh_metrics(objects: list[bpy.types.Object]) -> dict[str, object]:
    triangles = 0
    vertices = 0
    polygons = 0
    material_names: list[str] = []
    uv_layers: list[str] = []
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        vertices += len(mesh.vertices)
        polygons += len(mesh.polygons)
        material_names.extend(slot.material.name for slot in obj.material_slots if slot.material)
        uv_layers.extend(layer.name for layer in mesh.uv_layers)

    images = []
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        if image.name == "Render Result":
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
        "vertexCount": vertices,
        "polygonCount": polygons,
        "triangleCount": triangles,
        "materialCount": len(set(material_names)),
        "materials": sorted(set(material_names)),
        "uvLayers": sorted(set(uv_layers)),
        "imageCount": len(images),
        "images": images,
    }


def add_area_light(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    direction = Vector((0.0, 0.08, 0.62)) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_review_scene() -> bpy.types.Object:
    floor_material = bpy.data.materials.new("Review_Floor")
    floor_material.diffuse_color = (0.055, 0.070, 0.095, 1.0)
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.08, -0.002))
    floor = bpy.context.object
    floor.name = "Review_Floor"
    floor.data.materials.append(floor_material)

    add_area_light("Key", (-2.5, -3.2, 4.0), 1000.0, 3.0)
    add_area_light("Fill", (2.8, -1.6, 2.3), 650.0, 2.5)
    add_area_light("Rim", (0.5, 3.1, 3.2), 850.0, 2.2)

    camera_data = bpy.data.cameras.new("Review_Camera")
    camera = bpy.data.objects.new("Review_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.62
    bpy.context.scene.camera = camera
    return camera


def point_camera(camera: bpy.types.Object, location: tuple[float, float, float]) -> None:
    camera.location = location
    target = Vector((0.0, 0.08, 0.64))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_views(age: str, evidence_dir: Path, camera: bpy.types.Object) -> list[str]:
    evidence_dir.mkdir(parents=True, exist_ok=True)
    views = {
        "negative-y": (0.0, -4.0, 0.70),
        "positive-y": (0.0, 4.0, 0.70),
        "side": (4.0, 0.08, 0.70),
        "three-quarter": (-2.8, -2.8, 0.80),
    }
    paths = []
    for name, location in views.items():
        point_camera(camera, location)
        path = evidence_dir / f"jack-{age}-meshy-import-{name}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(path.name)
    return paths


def main() -> None:
    input_glb = Path(ARGS.input_glb).resolve()
    blend_path = Path(ARGS.blend_path).resolve()
    report_path = Path(ARGS.report_path).resolve()
    evidence_dir = Path(ARGS.evidence_dir).resolve()
    if not input_glb.exists():
        raise FileNotFoundError(input_glb)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_glb))
    objects = imported_meshes()
    if not objects:
        raise RuntimeError("Meshy GLB imported without any mesh objects")
    for index, obj in enumerate(objects):
        obj.name = f"Jack_{ARGS.age.title()}_Mesh" if index == 0 else f"Jack_{ARGS.age.title()}_Mesh_{index:02d}"

    normalization = apply_normalization(objects)
    metrics = mesh_metrics(objects)
    camera = setup_review_scene()
    renders = render_views(ARGS.age, evidence_dir, camera)

    scene = bpy.context.scene
    scene["jack_age"] = ARGS.age
    scene["source_pipeline"] = "Meshy Pro optimized GLB; local deterministic normalization"
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["private_references_embedded"] = False
    scene["normalized_height_meters"] = TARGET_HEIGHT_METERS
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)

    report = {
        "schemaVersion": 1,
        "status": "pass",
        "age": ARGS.age,
        "inputGlb": input_glb.name,
        "inputBytes": input_glb.stat().st_size,
        "inputSha256": sha256(input_glb),
        "blenderVersion": bpy.app.version_string,
        **metrics,
        **normalization,
        "renderFiles": renders,
        "blendPath": blend_path.name,
        "blendBytes": blend_path.stat().st_size,
        "presentationOnly": True,
        "simulationMutation": False,
        "privateReferencesEmbedded": False,
        "failures": [],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"JACK_MESHY_SKIN_INSPECT_COMPLETE age={ARGS.age} "
        f"triangles={metrics['triangleCount']}"
    )


try:
    main()
except Exception as error:
    failure_path = Path(ARGS.report_path).resolve()
    failure_path.parent.mkdir(parents=True, exist_ok=True)
    failure_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "status": "fail",
                "age": ARGS.age,
                "error": str(error),
                "traceback": traceback.format_exc(),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    raise
