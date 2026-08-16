"""Render one consolidated four-pose board from the Meshy Walking baseline."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector


SIDE_VIEW_ROTATION = Matrix(
    (
        (0.0, 0.0, 1.0),
        (-1.0, 0.0, 0.0),
        (0.0, 1.0, 0.0),
    )
).to_quaternion() @ Quaternion((0.0, 0.0, 1.0), math.pi)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--diagnostic-only", action="store_true")
    return parser.parse_args(forwarded)


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
    )


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def area_light(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, 0.48)))


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.7) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def main() -> None:
    args = parse_args()
    blend = Path(args.blend).resolve()
    output = Path(args.output).resolve()
    if not blend.exists():
        raise FileNotFoundError(blend)
    bpy.ops.wm.open_mainfile(filepath=str(blend))

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Walk_Board_World")
    scene.world.color = (0.018, 0.024, 0.035)

    source = bpy.data.objects.get("Jack_Baby_Mesh")
    if source is None:
        raise RuntimeError("Jack_Baby_Mesh not found")
    frames = (0, 6, 12, 18)
    offsets = (-2.025, -0.675, 0.675, 2.025)
    snapshots: list[bpy.types.Object] = []
    frame_metrics: list[dict[str, object]] = []
    for frame, offset in zip(frames, offsets, strict=True):
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        mesh.transform(source.matrix_world)
        snapshot = bpy.data.objects.new(f"Walk_Frame_{frame:02d}", mesh)
        bpy.context.collection.objects.link(snapshot)
        snapshot.matrix_world.identity()
        bpy.context.view_layer.update()
        before_min, before_max = bounds(snapshot)
        height = before_max.z - before_min.z
        if height <= 1e-8:
            raise RuntimeError(f"Frame {frame} has no height")
        snapshot.scale *= 1.0 / height
        bpy.context.view_layer.update()
        after_min, after_max = bounds(snapshot)
        snapshot.location.y += offset - ((after_min.y + after_max.y) * 0.5)
        snapshot.location.z -= after_min.z
        bpy.context.view_layer.update()
        final_min, final_max = bounds(snapshot)
        frame_metrics.append(
            {
                "frame": frame,
                "inputHeight": round(height, 6),
                "normalizedHeight": round(final_max.z - final_min.z, 6),
                "boundsMin": [round(value, 4) for value in final_min],
                "boundsMax": [round(value, 4) for value in final_max],
            }
        )
        snapshots.append(snapshot)

    source.hide_render = True
    source.hide_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE" or obj.name.startswith("Meshy_Helper"):
            obj.hide_render = True
            obj.hide_set(True)

    floor_mat = material("Walk_Board_Floor", (0.052, 0.064, 0.086, 1.0), 0.85)
    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0.0, 0.0, -0.006))
    floor = bpy.context.object
    floor.data.materials.append(floor_mat)

    label_mat = material("Walk_Board_Label", (0.80, 0.88, 1.0, 1.0), 0.55)
    all_min = Vector(tuple(min(bounds(obj)[0][axis] for obj in snapshots) for axis in range(3)))
    all_max = Vector(tuple(max(bounds(obj)[1][axis] for obj in snapshots) for axis in range(3)))
    label_x = all_min.x - 0.12
    label_z = all_max.z + 0.10
    for frame, offset in zip(frames, offsets, strict=True):
        curve = bpy.data.curves.new(f"Label_{frame:02d}", "FONT")
        curve.body = f"frame {frame:02d}"
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.105
        curve.extrude = 0.001
        label = bpy.data.objects.new(f"Label_{frame:02d}", curve)
        bpy.context.collection.objects.link(label)
        label.location = (label_x, offset, label_z)
        label.rotation_mode = "QUATERNION"
        label.rotation_quaternion = SIDE_VIEW_ROTATION
        label.data.materials.append(label_mat)

    area_light("Walk_Key", (-4.0, -3.5, 4.2), 900.0, 3.0)
    area_light("Walk_Fill", (-3.2, 3.8, 2.2), 650.0, 2.6)
    area_light("Walk_Rim", (3.0, 0.0, 3.2), 800.0, 2.4)

    camera_data = bpy.data.cameras.new("Walk_Board_Camera")
    camera_data.type = "ORTHO"
    board_height = (all_max.z - all_min.z) + 0.32
    board_width = (all_max.y - all_min.y) + 0.24
    aspect = scene.render.resolution_x / scene.render.resolution_y
    camera_data.ortho_scale = max(board_width, board_height * aspect) * 1.06
    camera = bpy.data.objects.new("Walk_Board_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    center_y = (all_min.y + all_max.y) * 0.5
    center_z = ((all_min.z + all_max.z) * 0.5) + 0.06
    camera.location = (-6.0, center_y, center_z)
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = SIDE_VIEW_ROTATION
    scene.camera = camera
    bpy.context.view_layer.update()

    projected = [
        world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
        for obj in snapshots
        for corner in obj.bound_box
    ]
    projection_bounds = {
        "x": [round(min(value.x for value in projected), 4), round(max(value.x for value in projected), 4)],
        "y": [round(min(value.y for value in projected), 4), round(max(value.y for value in projected), 4)],
        "z": [round(min(value.z for value in projected), 4), round(max(value.z for value in projected), 4)],
    }

    if args.diagnostic_only:
        print(
            {
                "frames": frame_metrics,
                "combinedMin": [round(value, 4) for value in all_min],
                "combinedMax": [round(value, 4) for value in all_max],
                "orthoScale": round(camera_data.ortho_scale, 4),
                "projectionBounds": projection_bounds,
            }
        )
        return

    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(
        {
            "output": str(output),
            "frames": frame_metrics,
            "snapshotCount": len(snapshots),
            "orthoScale": round(camera_data.ortho_scale, 4),
            "projectionBounds": projection_bounds,
        }
    )


if __name__ == "__main__":
    main()
