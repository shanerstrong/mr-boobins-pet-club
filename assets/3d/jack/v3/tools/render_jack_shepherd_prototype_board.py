"""Render the sparse Jack V3 prototype animation board."""

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
    ("Idle", 0.00, "idle"),
    ("Walk", 0.25, "walk"),
    ("Run", 0.50, "run"),
    ("Eating", 0.48, "eat"),
    ("Run_Jump", 0.45, "jump/play"),
    ("Death", 1.00, "rest/death"),
)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def action_for(short_name: str) -> bpy.types.Action:
    preferred = f"AnimalArmature|{short_name}"
    if preferred in bpy.data.actions:
        return bpy.data.actions[preferred]
    return min((action for action in bpy.data.actions if action.name.endswith(f"|{short_name}")), key=lambda action: len(action.name))


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
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"

    x_columns = (-1.65, 0.0, 1.65)
    z_rows = (1.35, 0.0)
    snapshots: list[bpy.types.Object] = []
    for index, (short_name, fraction, label_text) in enumerate(POSES):
        action = action_for(short_name)
        rig.animation_data.action = action
        slots = getattr(action, "slots", None)
        if slots:
            rig.animation_data.action_slot_handle = slots[0].handle
        start, end = action.frame_range
        frame = start + (end - start) * fraction
        scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        pose_parts = []
        for source in source_meshes:
            evaluated = source.evaluated_get(depsgraph)
            mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
            mesh.transform(source.matrix_world)
            snapshot = bpy.data.objects.new(f"Pose_{short_name}_{source.name}", mesh)
            bpy.context.collection.objects.link(snapshot)
            snapshot.matrix_world.identity()
            pose_parts.append(snapshot)
            snapshots.append(snapshot)
        low, high = object_bounds(pose_parts)
        scale = 0.86 / max(high.z - low.z, 0.001)
        for part in pose_parts:
            part.scale *= scale
        bpy.context.view_layer.update()
        low, high = object_bounds(pose_parts)
        column = index % 3
        row = index // 3
        target_y = x_columns[column]
        target_z = z_rows[row]
        shift_y = target_y - ((low.y + high.y) * 0.5)
        shift_z = target_z - low.z
        for part in pose_parts:
            part.location.y += shift_y
            part.location.z += shift_z

        curve = bpy.data.curves.new(f"Label_{short_name}", "FONT")
        curve.body = label_text
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.095
        label = bpy.data.objects.new(f"Label_{short_name}", curve)
        bpy.context.collection.objects.link(label)
        label.location = (-0.52, target_y, target_z + 1.02)
        label.rotation_mode = "QUATERNION"
        label.rotation_quaternion = SIDE_VIEW_ROTATION

    for source in source_meshes:
        source.hide_render = True
    rig.hide_render = True

    camera_data = bpy.data.cameras.new("Prototype_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 4.65
    camera = bpy.data.objects.new("Prototype_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-7.0, 0.0, 1.05)
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
