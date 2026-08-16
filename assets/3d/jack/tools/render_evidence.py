"""Render fallback poses, topology, and rig evidence from jack-character.blend."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[4]
EVIDENCE = ROOT / "evidence" / "3d-jack"
EVIDENCE.mkdir(parents=True, exist_ok=True)
FPS = 30


def look_at(obj: bpy.types.Object, target=(0.0, -0.05, 1.38)) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def reset_scene_state(armature: bpy.types.Object) -> None:
    armature.animation_data.use_nla = False
    armature.animation_data.action = None
    for bone in armature.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.data.shape_keys:
            keys = obj.data.shape_keys
            if keys.animation_data:
                keys.animation_data.use_nla = False
                keys.animation_data.action = None
            for key in keys.key_blocks:
                if key.name != "Basis":
                    key.value = 0.0
    bpy.context.scene.frame_set(1)


def set_morph(obj_name: str, key_name: str, value: float) -> None:
    bpy.data.objects[obj_name].data.shape_keys.key_blocks[key_name].value = value


def render_pose(armature: bpy.types.Object, camera: bpy.types.Object, filename: str, action: str, time_ms: float, morphs=None) -> None:
    reset_scene_state(armature)
    armature.animation_data.action = bpy.data.actions[action]
    bpy.context.scene.frame_set(1.0 + time_ms / 1000.0 * FPS, subframe=0.0)
    for obj_name, key_name, value in morphs or []:
        set_morph(obj_name, key_name, value)
    camera.location = (5.0, -5.8, 2.75)
    camera.data.ortho_scale = 3.65
    look_at(camera)
    bpy.context.scene.render.filepath = str(EVIDENCE / filename)
    bpy.ops.render.render(write_still=True)


def render_topology(armature: bpy.types.Object, camera: bpy.types.Object) -> None:
    reset_scene_state(armature)
    topology = bpy.data.materials.new("Evidence_Topology")
    topology.diffuse_color = (0.035, 0.055, 0.075, 1.0)
    topology.use_nodes = True
    topology.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.035, 0.055, 0.075, 1.0)
    modifiers = []
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.get("assetRole") != "jack-character":
            continue
        obj.data.materials.append(topology)
        modifier = obj.modifiers.new("Evidence_Wireframe", "WIREFRAME")
        modifier.thickness = 0.003
        modifier.use_replace = False
        modifier.material_offset = len(obj.data.materials) - 1
        modifiers.append((obj, modifier))
    camera.location = (5.0, -5.8, 2.75)
    camera.data.ortho_scale = 3.65
    look_at(camera)
    bpy.context.scene.render.filepath = str(EVIDENCE / "jack-topology-wireframe.png")
    bpy.ops.render.render(write_still=True)
    for obj, modifier in modifiers:
        obj.modifiers.remove(modifier)


def render_rig(armature: bpy.types.Object, camera: bpy.types.Object) -> None:
    reset_scene_state(armature)
    rig_material = bpy.data.materials.new("Evidence_Rig")
    rig_material.diffuse_color = (0.05, 0.45, 0.95, 1.0)
    rig_material.use_nodes = True
    bsdf = rig_material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.05, 0.45, 0.95, 1.0)
    bsdf.inputs["Emission Color"].default_value = (0.01, 0.12, 0.42, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.2
    overlays = []
    for bone in armature.data.bones:
        start = Vector(bone.head_local)
        end = Vector(bone.tail_local)
        delta = end - start
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.022, depth=delta.length, location=(start + end) * 0.5)
        obj = bpy.context.object
        obj.name = f"Evidence_Bone_{bone.name}"
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(delta.normalized())
        obj.data.materials.append(rig_material)
        overlays.append(obj)
    camera.location = (5.0, -5.8, 2.75)
    camera.data.ortho_scale = 3.65
    look_at(camera)
    bpy.context.scene.render.filepath = str(EVIDENCE / "jack-rig-overlay.png")
    bpy.ops.render.render(write_still=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in overlays:
        obj.select_set(True)
    bpy.ops.object.delete()


def main() -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    armature = bpy.data.objects["Jack_Rig"]
    camera = bpy.data.objects["Evidence_Camera"]

    poses = [
        ("fallback-jack-idle.png", "idle", 1500, []),
        ("fallback-jack-feed.png", "feed", 1400, [("Jack_Tongue", "Tongue_Out", 1.0)]),
        ("fallback-jack-sleep.png", "sleep", 1600, []),
        ("fallback-jack-wake.png", "wake", 700, []),
        ("fallback-jack-play.png", "play", 1500, []),
        ("fallback-jack-clean-water.png", "clean", 375, []),
        ("fallback-jack-clean-washout.png", "clean", 750, []),
        ("fallback-jack-clean-shake.png", "clean", 1125, []),
        ("fallback-jack-clean-sparkle.png", "clean", 1500, []),
        ("fallback-jack-boop-comfortable.png", "boop_comfortable", 420, [("Jack_Cheek_L", "Smile", 1.0), ("Jack_Cheek_R", "Smile", 1.0)]),
        ("fallback-jack-boop-need.png", "boop_need", 350, []),
        ("fallback-jack-boop-rejected.png", "boop_rejected", 80, [("Jack_Nose", "Nose_Compress", 1.0)]),
        ("fallback-jack-tired.png", "tired", 1000, [("Jack_Eye_L", "Blink", 0.55), ("Jack_Eye_R", "Blink", 0.55)]),
        ("fallback-jack-dirty.png", "dirty", 450, []),
        ("fallback-jack-death-rest.png", "death_rest", 1000, [("Jack_Eye_L", "Blink", 1.0), ("Jack_Eye_R", "Blink", 1.0)]),
    ]
    for filename, action, time_ms, morphs in poses:
        render_pose(armature, camera, filename, action, time_ms, morphs)
    render_topology(armature, camera)
    render_rig(armature, camera)
    print(f"rendered {len(poses)} fallback poses plus topology and rig evidence")


if __name__ == "__main__":
    main()
