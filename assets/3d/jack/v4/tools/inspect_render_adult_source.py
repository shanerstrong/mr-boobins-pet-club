"""Import and render a fixed-view board of the preserved Meshy adult source.

This is a cheap likeness checkpoint. It makes a new Blender source and report,
but does not bind a rig, author animation, or include reference photographs.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--board", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, 0.65)))


def snapshot(source: bpy.types.Object, name: str) -> bpy.types.Object:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    mesh.transform(source.matrix_world)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def main() -> None:
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
    candidates = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and len(obj.data.vertices) > 1000]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one character mesh, found {[obj.name for obj in candidates]}")
    source = candidates[0]
    source.name = "Jack_Adult_V4_Reference_Mesh"
    low, high = bounds(source)
    dimensions = high - low
    ground_delta = -low.z
    source.location.z += ground_delta
    bpy.context.view_layer.update()
    low, high = bounds(source)
    dimensions = high - low

    scene = bpy.context.scene
    scene.name = "Jack_Adult_V4_Reference_Checkpoint"
    scene["asset_version"] = "4.0.0-adult-reference-a"
    scene["status"] = "exploratory-static-likeness"
    scene["private_references_embedded"] = False
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False

    output_blend = Path(args.blend).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend), compress=True)

    source.hide_render = True
    views = (
        ("front", Vector((0.0, -3.2, 0.66))),
        ("side", Vector((3.2, 0.0, 0.66))),
        ("three-quarter", Vector((2.45, -2.45, 0.85))),
    )
    spacing = 1.48
    created: list[bpy.types.Object] = []
    for index, (name, _camera) in enumerate(views):
        obj = snapshot(source, f"View_{name}")
        # Front remains in source orientation. Side and 3/4 are object rotations
        # so one orthographic board camera can compare all views consistently.
        obj.rotation_euler[2] = (0.0, math.pi * 0.5, math.pi * 0.25)[index]
        bpy.context.view_layer.update()
        item_low, item_high = bounds(obj)
        obj.location.x += index * spacing - ((item_low.x + item_high.x) * 0.5)
        obj.location.z += -item_low.z
        bpy.context.view_layer.update()
        created.append(obj)

    floor_mat = bpy.data.materials.new("V4_Floor")
    floor_mat.diffuse_color = (0.045, 0.055, 0.073, 1.0)
    floor_mat.use_nodes = True
    floor_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    floor_bsdf.inputs["Base Color"].default_value = floor_mat.diffuse_color
    floor_bsdf.inputs["Roughness"].default_value = 0.82
    bpy.ops.mesh.primitive_plane_add(size=7.0, location=(spacing, 0.0, -0.006))
    bpy.context.object.data.materials.append(floor_mat)

    add_area("V4_Key", (-3.0, -3.5, 4.3), 1050.0, 3.2)
    add_area("V4_Fill", (4.5, -1.5, 2.4), 720.0, 3.0)
    add_area("V4_Rim", (1.5, 3.5, 3.4), 850.0, 2.6)

    created_bounds = [bounds(obj) for obj in created]
    board_low = Vector(tuple(min(item[0][axis] for item in created_bounds) for axis in range(3)))
    board_high = Vector(tuple(max(item[1][axis] for item in created_bounds) for axis in range(3)))
    board_center = (board_low + board_high) * 0.5
    board_dimensions = board_high - board_low
    camera_data = bpy.data.cameras.new("V4_Board_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(board_dimensions.z, board_dimensions.x / 2.0) * 1.12
    camera = bpy.data.objects.new("V4_Board_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (board_center.x, -7.0, board_center.z)
    point_at(camera, Vector((board_center.x, 0.0, board_center.z)))
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("V4_World")
    scene.world.color = (0.012, 0.017, 0.026)
    scene.view_settings.look = "AgX - Medium High Contrast"
    board = Path(args.board).resolve()
    board.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(board)
    bpy.ops.render.render(write_still=True)

    source.data.calc_loop_triangles()
    report = {
        "schemaVersion": 1,
        "status": "rendered-pending-human-likeness-review",
        "blenderVersion": bpy.app.version_string,
        "input": Path(args.input).name,
        "outputBlend": output_blend.name,
        "outputBoard": board.name,
        "vertexCount": len(source.data.vertices),
        "triangleCount": len(source.data.loop_triangles),
        "materialCount": len(source.material_slots),
        "shapeKeys": [key.name for key in source.data.shape_keys.key_blocks] if source.data.shape_keys else [],
        "boundsMin": [round(value, 7) for value in low],
        "boundsMax": [round(value, 7) for value in high],
        "dimensions": [round(value, 7) for value in dimensions],
        "privateReferencesEmbedded": False,
        "rigBound": False,
        "animationCount": 0,
        "views": [name for name, _ in views],
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
