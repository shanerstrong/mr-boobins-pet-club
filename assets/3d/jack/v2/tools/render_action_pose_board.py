"""Render one compact 4x2 board of the highest-risk Jack V2 poses."""

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
    ("training_sit", 0.85, "sit"),
    ("training_paw", 0.52, "paw"),
    ("training_up", 0.60, "up"),
    ("feed", 0.48, "feed"),
    ("sleep", 0.50, "sleep"),
    ("death_rest", 1.00, "rest"),
    ("celebration_happy_hop", 0.42, "hop"),
    ("celebration_goofy_shimmy", 0.25, "shimmy"),
)

LOCOMOTION_POSES = tuple(
    (action, fraction, f"{action} {int(fraction * 100):02d}%")
    for action in ("walk", "run", "feed", "play")
    for fraction in (0.0, 0.25, 0.50, 0.75)
)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mesh-name", default="Jack_Baby_Mesh")
    parser.add_argument("--mode", choices=("risk", "locomotion"), default="risk")
    return parser.parse_args(forwarded)


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
    )


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_light(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, 1.0)))


def make_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.72
    return mat


def main() -> None:
    args = parse_args()
    poses = LOCOMOTION_POSES if args.mode == "locomotion" else POSES
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    scene = bpy.context.scene
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    source = bpy.data.objects[args.mesh_name]
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 2560 if args.mode == "locomotion" else 1280
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Pose_Board_World")
    scene.world.color = (0.015, 0.021, 0.032)

    x_columns = (-2.025, -0.675, 0.675, 2.025)
    z_rows = (3.90, 2.60, 1.30, 0.0) if args.mode == "locomotion" else (1.30, 0.0)
    snapshots = []
    labels = []
    metrics = []
    rig.animation_data.action = bpy.data.actions["idle"]
    scene.frame_set(0)
    neutral_evaluated = source.evaluated_get(bpy.context.evaluated_depsgraph_get())
    neutral_corners = [source.matrix_world @ Vector(corner) for corner in neutral_evaluated.bound_box]
    neutral_height = max(point.z for point in neutral_corners) - min(point.z for point in neutral_corners)
    common_scale = 0.88 / neutral_height
    for index, (action_name, fraction, label_text) in enumerate(poses):
        action = bpy.data.actions[action_name]
        rig.animation_data.action = action
        frame = action.frame_range[0] + (action.frame_range[1] - action.frame_range[0]) * fraction
        scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        mesh.transform(source.matrix_world)
        snapshot = bpy.data.objects.new(f"Pose_{action_name}", mesh)
        bpy.context.collection.objects.link(snapshot)
        snapshot.matrix_world.identity()
        before_min, before_max = bounds(snapshot)
        snapshot.scale *= common_scale
        bpy.context.view_layer.update()
        after_min, after_max = bounds(snapshot)
        col = index % 4
        row = index // 4
        target_y = x_columns[col]
        target_z = z_rows[row]
        snapshot.location.y += target_y - ((after_min.y + after_max.y) * 0.5)
        snapshot.location.z += target_z - after_min.z
        bpy.context.view_layer.update()
        final_min, final_max = bounds(snapshot)
        snapshots.append(snapshot)
        metrics.append({
            "action": action_name,
            "frame": round(frame, 3),
            "height": round(final_max.z - final_min.z, 4),
            "ground": round(final_min.z - target_z, 4),
        })

        curve = bpy.data.curves.new(f"Label_{action_name}", "FONT")
        curve.body = label_text
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.095
        curve.extrude = 0.001
        label = bpy.data.objects.new(f"Label_{action_name}", curve)
        bpy.context.collection.objects.link(label)
        label.location = (-0.55, target_y, target_z + 1.00)
        label.rotation_mode = "QUATERNION"
        label.rotation_quaternion = SIDE_VIEW_ROTATION
        labels.append(label)

    source.hide_render = True
    rig.hide_render = True
    root = bpy.data.objects.get("jack_root")
    if root:
        root.hide_render = True

    floor_mat = make_material("Pose_Board_Floor", (0.045, 0.057, 0.078, 1.0))
    for row_z in z_rows:
        bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, row_z - 0.006))
        floor = bpy.context.object
        floor.data.materials.append(floor_mat)
        # The upper display shelf must not shadow the entire lower review row.
        floor.visible_shadow = False
    label_mat = make_material("Pose_Board_Label", (0.78, 0.88, 1.0, 1.0))
    for label in labels:
        label.data.materials.append(label_mat)

    add_light("Pose_Key", (-4.0, -3.0, 4.5), 1000.0, 3.2)
    add_light("Pose_Fill", (-3.0, 4.0, 2.8), 700.0, 2.8)
    add_light("Pose_Rim", (3.0, 0.0, 3.6), 850.0, 2.6)

    camera_data = bpy.data.cameras.new("Pose_Board_Camera")
    camera_data.type = "ORTHO"
    # The fixed side-view quaternion maps the world-Y board span to the
    # camera's vertical dimension, so the scale must cover the full 4-column
    # span (matching the proven locomotion-board framing).
    camera_data.ortho_scale = 6.10 if args.mode == "locomotion" else 5.45
    camera = bpy.data.objects.new("Pose_Board_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-7.0, 0.0, 1.95 if args.mode == "locomotion" else 1.05)
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = SIDE_VIEW_ROTATION
    scene.camera = camera
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print({"output": str(output), "poses": metrics})


if __name__ == "__main__":
    main()
