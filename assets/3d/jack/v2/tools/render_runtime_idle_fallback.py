"""Render one phone-viewable friendly-idle fallback from the final V2 GLB."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def light(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0, 0, 0.5)))


def main() -> None:
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    character = max(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda obj: len(obj.vertex_groups),
    )
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and obj != character:
            bpy.data.objects.remove(obj, do_unlink=True)
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(22)

    floor_mat = bpy.data.materials.new("Fallback_Floor")
    floor_mat.diffuse_color = (0.055, 0.068, 0.09, 1.0)
    floor_mat.use_nodes = True
    floor_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.84
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0, 0, -0.003))
    bpy.context.object.data.materials.append(floor_mat)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = bpy.data.worlds.new("Fallback_World")
    scene.world.color = (0.012, 0.018, 0.029)
    light("Fallback_Key", (-2.6, -2.4, 3.2), 850, 2.4)
    light("Fallback_Fill", (2.2, -1.0, 1.7), 480, 2.0)
    light("Fallback_Rim", (0.8, 2.8, 2.7), 700, 2.2)

    camera_data = bpy.data.cameras.new("Fallback_Camera")
    camera_data.lens = 66
    camera = bpy.data.objects.new("Fallback_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-2.2, -2.5, 1.35)
    point_at(camera, Vector((0, 0, 0.52)))
    scene.camera = camera
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(str(output))


if __name__ == "__main__":
    main()
