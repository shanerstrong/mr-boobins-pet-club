"""Render local-axis pose adjustments used to author Jack command clips."""

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
AXES = {
    "x": Vector((1.0, 0.0, 0.0)),
    "y": Vector((0.0, 1.0, 0.0)),
    "z": Vector((0.0, 0.0, 1.0)),
}
MODES = {
    "sleep": ("sleep", 0.50, "Hips", (-90, -60, -30, 0, 30, 60, 90)),
    "feed": ("feed", 0.50, "head", (-60, -40, -20, 0, 20, 40, 60)),
    "sit": ("training_sit", 0.85, "Hips", (-90, -60, -30, 0, 30, 60, 90)),
    "paw": ("training_paw", 0.52, "Hips", (-90, -60, -30, 0, 30, 60, 90)),
    "up": ("training_up", 0.60, "Hips", (-90, -60, -30, 0, 30, 60, 90)),
}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", choices=tuple(MODES), required=True)
    parser.add_argument("--axis", choices=tuple(AXES), required=True)
    return parser.parse_args(forwarded)


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
    point_at(obj, Vector((0.0, 0.0, 0.5)))


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
    action_name, fraction, bone_name, angles = MODES[args.mode]
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    scene = bpy.context.scene
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    source = bpy.data.objects["Jack_Baby_Mesh"]
    action = bpy.data.actions[action_name]
    rig.animation_data.action = action
    frame = action.frame_range[0] + (action.frame_range[1] - action.frame_range[0]) * fraction
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 6
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 2240
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Adjustment_World")
    scene.world.color = (0.015, 0.021, 0.032)
    floor_mat = make_material("Adjustment_Floor", (0.045, 0.057, 0.078, 1.0))
    label_mat = make_material("Adjustment_Label", (0.78, 0.88, 1.0, 1.0))
    for index, degrees in enumerate(angles):
        scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
        bone = rig.pose.bones[bone_name]
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = bone.rotation_quaternion @ Quaternion(AXES[args.axis], math.radians(degrees))
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        mesh.transform(source.matrix_world)
        snapshot = bpy.data.objects.new(f"Pose_{degrees:+d}", mesh)
        bpy.context.collection.objects.link(snapshot)
        ys = [(snapshot.matrix_world @ Vector(corner)).y for corner in snapshot.bound_box]
        zs = [(snapshot.matrix_world @ Vector(corner)).z for corner in snapshot.bound_box]
        center_y = (min(ys) + max(ys)) * 0.5
        snapshot.location.y += (index - 3) * 1.18 - center_y
        snapshot.location.z -= min(zs)
        curve = bpy.data.curves.new(f"Label_{degrees:+d}", "FONT")
        curve.body = f"{args.axis.upper()} {degrees:+d}"
        curve.align_x = "CENTER"
        curve.size = 0.075
        label = bpy.data.objects.new(f"Label_{degrees:+d}", curve)
        bpy.context.collection.objects.link(label)
        label.data.materials.append(label_mat)
        label.location = (-0.52, (index - 3) * 1.18, 1.02)
        label.rotation_mode = "QUATERNION"
        label.rotation_quaternion = SIDE_VIEW_ROTATION
    source.hide_render = True
    rig.hide_render = True
    root = bpy.data.objects.get("jack_root")
    if root:
        root.hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0.0, 0.0, -0.006))
    bpy.context.object.data.materials.append(floor_mat)
    add_light("Adjustment_Key", (-4.0, -3.0, 4.5), 900.0, 3.2)
    add_light("Adjustment_Fill", (-3.0, 4.0, 2.8), 650.0, 2.8)
    camera_data = bpy.data.cameras.new("Adjustment_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 8.4
    camera = bpy.data.objects.new("Adjustment_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-7.0, 0.0, 0.55)
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = SIDE_VIEW_ROTATION
    scene.camera = camera
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print({"output": str(output), "action": action_name, "bone": bone_name, "axis": args.axis, "angles": angles})


if __name__ == "__main__":
    main()
