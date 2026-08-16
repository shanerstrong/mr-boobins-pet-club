"""Render one phone-viewable reel of Jack's highest-value animation clips."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


FPS = 30
SIDE_VIEW_ROTATION = Matrix(
    ((0.0, 0.0, 1.0), (-1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
).to_quaternion() @ Quaternion((0.0, 0.0, 1.0), math.pi)
CLIPS = (
    "idle",
    "walk",
    "run",
    "feed",
    "play",
    "training_sit",
    "training_paw",
    "training_up",
    "sleep",
    "death_rest",
)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
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
    point_at(obj, Vector((0.0, 0.0, 0.65)))


def make_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.72
    return material


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    scene = bpy.context.scene
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    rig.animation_data_create()
    rig.animation_data.action = None
    for track in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(track)

    cursor = 1
    gap = 8
    labels = []
    for name in CLIPS:
        action = bpy.data.actions[name]
        start, end = action.frame_range
        duration = max(1.0, end - start)
        track = rig.animation_data.nla_tracks.new()
        track.name = f"Preview_{name}"
        strip = track.strips.new(name, cursor, action)
        strip.action_frame_start = start
        strip.action_frame_end = end
        strip.frame_end = cursor + duration
        strip.extrapolation = "NOTHING"
        strip.blend_type = "REPLACE"

        curve = bpy.data.curves.new(f"Motion_Label_{name}", "FONT")
        curve.body = name.replace("training_", "training: ").replace("_", " ")
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.075
        curve.extrude = 0.001
        label = bpy.data.objects.new(f"Motion_Label_{name}", curve)
        bpy.context.collection.objects.link(label)
        label.location = (-0.58, 0.0, 1.24)
        label.rotation_mode = "QUATERNION"
        label.rotation_quaternion = SIDE_VIEW_ROTATION
        label.hide_render = True
        label.keyframe_insert("hide_render", frame=max(0, cursor - 1))
        label.hide_render = False
        label.keyframe_insert("hide_render", frame=cursor)
        label.keyframe_insert("hide_render", frame=strip.frame_end)
        label.hide_render = True
        label.keyframe_insert("hide_render", frame=strip.frame_end + 1)
        for curve_data in label.animation_data.action.fcurves:
            for point in curve_data.keyframe_points:
                point.interpolation = "CONSTANT"
        labels.append(label)
        cursor = int(math.ceil(strip.frame_end)) + gap

    scene.frame_start = 1
    scene.frame_end = cursor - gap
    scene.render.fps = FPS
    # Workbench is deterministic in the headless Windows environment where
    # Eevee compute shaders are unavailable; it is sufficient for motion QA.
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "paint.sl"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Motion_Reel_World")
    scene.world.color = (0.012, 0.018, 0.028)

    floor_mat = make_material("Motion_Reel_Floor", (0.045, 0.057, 0.078, 1.0))
    label_mat = make_material("Motion_Reel_Label", (0.78, 0.88, 1.0, 1.0))
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, -0.006))
    bpy.context.object.data.materials.append(floor_mat)
    for label in labels:
        label.data.materials.append(label_mat)

    add_light("Motion_Key", (-3.0, -3.0, 4.0), 950.0, 3.0)
    add_light("Motion_Fill", (-2.0, 3.5, 2.5), 650.0, 2.5)
    add_light("Motion_Rim", (3.0, 0.0, 3.0), 800.0, 2.5)

    camera_data = bpy.data.cameras.new("Motion_Reel_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.55
    camera = bpy.data.objects.new("Motion_Reel_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-5.0, 0.0, 0.63)
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = SIDE_VIEW_ROTATION
    scene.camera = camera

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(animation=True)
    print({"output": str(output), "clips": list(CLIPS), "frames": scene.frame_end})


if __name__ == "__main__":
    main()
