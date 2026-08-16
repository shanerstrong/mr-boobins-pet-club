"""Render phone-viewable turntable and exact-duration animation previews."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[4]
EVIDENCE = ROOT / "evidence" / "3d-jack"
ARMATURE = bpy.data.objects["Jack_Rig"]
CAMERA = bpy.data.objects["Evidence_Camera"]
SCENE = bpy.context.scene


def look_at(obj: bpy.types.Object, target=(0.0, -0.05, 1.38)) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_video(width: int, height: int, fps: int, samples: int, filepath: str) -> None:
    SCENE.render.resolution_x = width
    SCENE.render.resolution_y = height
    SCENE.render.resolution_percentage = 100
    SCENE.render.fps = fps
    SCENE.cycles.device = "CPU"
    SCENE.cycles.samples = samples
    SCENE.cycles.use_denoising = False
    SCENE.render.image_settings.file_format = "FFMPEG"
    SCENE.render.ffmpeg.format = "MPEG4"
    SCENE.render.ffmpeg.codec = "H264"
    SCENE.render.ffmpeg.constant_rate_factor = "MEDIUM"
    SCENE.render.ffmpeg.audio_codec = "NONE"
    SCENE.render.filepath = str(EVIDENCE / filepath)


def neutral_pose() -> None:
    ARMATURE.animation_data.use_nla = False
    ARMATURE.animation_data.action = None
    for bone in ARMATURE.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def render_turntable() -> None:
    neutral_pose()
    configure_video(512, 512, 24, 2, "jack-hero-turntable.mp4")
    SCENE.frame_start = 1
    SCENE.frame_end = 36
    CAMERA.animation_data_clear()
    radius = 7.2
    for frame in range(1, 37):
        angle = -math.pi / 2.0 + 2.0 * math.pi * (frame - 1) / 35.0
        CAMERA.location = (radius * math.cos(angle), radius * math.sin(angle), 2.55)
        look_at(CAMERA)
        CAMERA.keyframe_insert("location", frame=frame)
        CAMERA.keyframe_insert("rotation_euler", frame=frame)
    if CAMERA.animation_data and CAMERA.animation_data.action:
        for curve in CAMERA.animation_data.action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = "LINEAR"
    bpy.ops.render.render(animation=True)


def render_clip(action_name: str, frames: int, filename: str) -> None:
    CAMERA.animation_data_clear()
    CAMERA.location = (5.0, -5.8, 2.75)
    CAMERA.data.ortho_scale = 3.65
    look_at(CAMERA)
    neutral_pose()
    ARMATURE.animation_data.action = bpy.data.actions[action_name]
    configure_video(320, 320, 30, 1, filename)
    SCENE.frame_start = 1
    SCENE.frame_end = frames
    bpy.ops.render.render(animation=True)


def main() -> None:
    render_turntable()
    render_clip("play", 90, "jack-play-preview.mp4")
    render_clip("clean", 45, "jack-clean-preview.mp4")
    print("rendered turntable plus exact 3000ms PLAY and 1500ms clean previews")


if __name__ == "__main__":
    main()
