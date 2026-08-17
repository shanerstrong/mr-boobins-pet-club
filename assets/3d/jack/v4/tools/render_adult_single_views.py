"""Render uncropped neutral front, side, and three-quarter V4 stills."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--mesh", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--stem", required=True)
    return parser.parse_args(forwarded)


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location: tuple[float, float, float], target: Vector, energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    scene = bpy.context.scene
    source = bpy.data.objects[args.mesh]
    for obj in list(scene.objects):
        if obj != source and obj.type in {"CAMERA", "LIGHT", "FONT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    source.hide_render = False
    source.hide_set(False)
    low, high = bounds(source)
    center = (low + high) * 0.5
    height = high.z - low.z

    floor_mat = bpy.data.materials.new("V4_Single_View_Floor")
    floor_mat.diffuse_color = (0.045, 0.055, 0.073, 1.0)
    floor_mat.use_nodes = True
    floor_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    floor_bsdf.inputs["Base Color"].default_value = floor_mat.diffuse_color
    floor_bsdf.inputs["Roughness"].default_value = 0.82
    bpy.ops.mesh.primitive_plane_add(size=7.0, location=(center.x, center.y, low.z - 0.006))
    floor = bpy.context.object
    floor.data.materials.append(floor_mat)
    add_area("V4_Single_Key", (-3.0, -3.5, 4.3), center, 1050.0, 3.2)
    add_area("V4_Single_Fill", (4.0, -1.5, 2.6), center, 720.0, 3.0)
    add_area("V4_Single_Rim", (1.5, 3.5, 3.6), center, 850.0, 2.6)

    camera_data = bpy.data.cameras.new("V4_Single_View_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 1.14
    camera = bpy.data.objects.new("V4_Single_View_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("V4_Single_View_World")
    scene.world.color = (0.012, 0.017, 0.026)
    scene.view_settings.look = "AgX - Medium High Contrast"
    distance = height * 3.6
    cameras = {
        "front": Vector((center.x, center.y - distance, center.z)),
        "side": Vector((center.x + distance, center.y, center.z)),
        "three-quarter": Vector((center.x + distance * 0.72, center.y - distance * 0.72, center.z + height * 0.08)),
    }
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, location in cameras.items():
        camera.location = location
        point_at(camera, center)
        scene.render.filepath = str(output_dir / f"{args.stem}-{name}.png")
        bpy.ops.render.render(write_still=True)
    print({"status": "rendered", "views": list(cameras), "outputDir": str(output_dir)})


if __name__ == "__main__":
    main()
