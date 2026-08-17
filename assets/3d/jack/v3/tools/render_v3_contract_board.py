"""Render one sparse 4x2 board of Jack V3's highest-risk contract poses."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


SIDE_VIEW_ROTATION = Matrix(
    ((0.0, 0.0, 1.0), (-1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
).to_quaternion() @ Quaternion((0.0, 0.0, 1.0), math.pi)

POSES = (
    ("walk", 0.25, "walk"),
    ("run", 0.50, "run"),
    ("feed", 0.52, "feed/eat"),
    ("death_rest", 1.00, "rest/death"),
    ("training_sit", 0.85, "sit"),
    ("training_paw", 0.72, "paw"),
    ("training_up", 0.72, "up"),
    ("celebration_goofy_shimmy", 0.42, "shimmy"),
)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    scene = bpy.context.scene
    rig = bpy.data.objects["Jack_Quadruped_Rig_V3"]
    rig.animation_data_create()
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    source_meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]

    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "paint.sl"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.display.shading.curvature_ridge_factor = 1.7
    scene.display.shading.curvature_valley_factor = 1.3
    scene.display.shading.background_type = "VIEWPORT"
    scene.display.shading.background_color = (0.025, 0.035, 0.055)
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"

    columns = (-2.025, -0.675, 0.675, 2.025)
    rows = (1.25, 0.0)
    for index, (name, fraction, label_text) in enumerate(POSES):
        action = bpy.data.actions[name]
        rig.animation_data.action = action
        slots = getattr(action, "slots", None)
        if slots:
            rig.animation_data.action_slot_handle = slots[0].handle
        start, end = action.frame_range
        frame = start + (end - start) * fraction
        scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        parts = []
        for source in source_meshes:
            evaluated = source.evaluated_get(depsgraph)
            mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
            mesh.transform(source.matrix_world)
            part = bpy.data.objects.new(f"Pose_{name}_{source.name}", mesh)
            bpy.context.collection.objects.link(part)
            part.matrix_world.identity()
            parts.append(part)
        low, high = object_bounds(parts)
        height = max(high.z - low.z, 0.001)
        length = max(high.y - low.y, 0.001)
        scale = min(0.80 / height, 1.05 / length)
        for part in parts:
            part.scale *= scale
        bpy.context.view_layer.update()
        low, high = object_bounds(parts)
        column = index % 4
        row = index // 4
        target_y = columns[column]
        target_z = rows[row]
        shift_y = target_y - ((low.y + high.y) * 0.5)
        shift_z = target_z - low.z
        for part in parts:
            part.location.y += shift_y
            part.location.z += shift_z

        curve = bpy.data.curves.new(f"Label_{name}", "FONT")
        curve.body = label_text
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.088
        label = bpy.data.objects.new(f"Label_{name}", curve)
        bpy.context.collection.objects.link(label)
        label.location = (-0.51, target_y, target_z + 0.94)
        label.rotation_mode = "QUATERNION"
        label.rotation_quaternion = SIDE_VIEW_ROTATION

    for source in source_meshes:
        source.hide_render = True
    rig.hide_render = True

    camera_data = bpy.data.cameras.new("Contract_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 5.60
    camera = bpy.data.objects.new("Contract_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-7.0, 0.0, 1.0)
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = SIDE_VIEW_ROTATION
    scene.camera = camera

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print({"output": str(output), "poses": [pose[0] for pose in POSES]})


if __name__ == "__main__":
    main()
