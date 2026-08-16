"""Build and render the review-gated Baby Jack proportion blockout.

Run from the repository root with Blender 4.5 LTS:
    blender --background --factory-startup --python assets/3d/jack/tools/build_blockout.py

The script uses no private reference files and no third-party assets.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[4]
ASSET_ROOT = ROOT / "assets" / "3d" / "jack"
SOURCE_DIR = ASSET_ROOT / "source"
EXPORT_DIR = ASSET_ROOT / "exports"
EVIDENCE_DIR = ROOT / "evidence" / "3d-jack"

for directory in (SOURCE_DIR, EXPORT_DIR, EVIDENCE_DIR):
    directory.mkdir(parents=True, exist_ok=True)


PALETTE = {
    "fur_light": "#F4F0E5",
    "fur_shade": "#D9DEE0",
    "ear_interior": "#D99B9C",
    "nose_base": "#4A343B",
    "nose_highlight": "#7C555D",
    "eye": "#241F24",
    "tongue": "#E78F9A",
    "mouth": "#4B2930",
    "tooth": "#FFF8E8",
    "collar": "#3D78A8",
    "tag": "#D5A44D",
    "ground": "#D6D0C7",
}


def hex_rgba(value: str) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) / 255.0 for index in (0, 2, 4)) + (1.0,)


def material(name: str, color: str, roughness: float = 0.72, metallic: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = hex_rgba(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


MATERIALS = {
    name: material(f"Jack_{name}", color, metallic=0.35 if name == "tag" else 0.0)
    for name, color in PALETTE.items()
}

MODEL_OBJECTS: list[bpy.types.Object] = []


def apply_scale(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def finish_object(obj: bpy.types.Object, name: str, mat_name: str, model: bool = True) -> bpy.types.Object:
    obj.name = name
    obj.data.materials.append(MATERIALS[mat_name])
    obj["assetRole"] = "jack-character" if model else "evidence-stage"
    if model:
        MODEL_OBJECTS.append(obj)
    return obj


def ico(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], mat_name: str, subdivisions: int = 2) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location)
    obj = bpy.context.object
    obj.scale = scale
    apply_scale(obj)
    return finish_object(obj, name, mat_name)


def cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat_name: str,
    vertices: int = 10,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=midpoint)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(delta.normalized())
    return finish_object(obj, name, mat_name)


def wedge(
    name: str,
    center_x: float,
    base_z: float,
    top_z: float,
    width: float,
    front_y: float,
    back_y: float,
    mat_name: str,
) -> bpy.types.Object:
    half = width * 0.5
    verts = [
        (center_x - half, front_y, base_z),
        (center_x + half, front_y, base_z),
        (center_x, front_y, top_z),
        (center_x - half, back_y, base_z),
        (center_x + half, back_y, base_z),
        (center_x, back_y, top_z),
    ]
    faces = [
        (0, 1, 2),
        (5, 4, 3),
        (0, 3, 4, 1),
        (1, 4, 5, 2),
        (2, 5, 3, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_object(obj, name, mat_name)


def ear_pyramid(
    name: str,
    center_x: float,
    base_z: float,
    top_z: float,
    width: float,
    front_y: float,
    back_y: float,
    mat_name: str,
    tip_x: float | None = None,
) -> bpy.types.Object:
    half = width * 0.5
    tip_y = (front_y + back_y) * 0.5
    tip_x = center_x if tip_x is None else tip_x
    verts = [
        (center_x - half, front_y, base_z),
        (center_x + half, front_y, base_z),
        (center_x + half, back_y, base_z),
        (center_x - half, back_y, base_z),
        (tip_x, tip_y, top_z),
    ]
    faces = [(0, 1, 2, 3), (0, 4, 1), (1, 4, 2), (2, 4, 3), (3, 4, 0)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_object(obj, name, mat_name)


def muzzle_wedge(name: str, mat_name: str) -> bpy.types.Object:
    # Broad at the cheeks and narrower at the nose for Jack's long shepherd wedge.
    verts = [
        (-0.48, -0.69, 1.72),
        (0.48, -0.69, 1.72),
        (0.48, -0.69, 2.07),
        (-0.48, -0.69, 2.07),
        (-0.27, -1.25, 1.76),
        (0.27, -1.25, 1.76),
        (0.27, -1.25, 2.03),
        (-0.27, -1.25, 2.03),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (3, 2, 6, 7), (1, 5, 6, 2), (0, 3, 7, 4)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_object(obj, name, mat_name)


def torus(name: str, location: tuple[float, float, float], major_radius: float, minor_radius: float, scale_y: float, mat_name: str) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=16,
        minor_segments=6,
        location=location,
    )
    obj = bpy.context.object
    obj.scale.y = scale_y
    apply_scale(obj)
    return finish_object(obj, name, mat_name)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def build_jack(detail: str = "blockout") -> None:
    hero = detail == "hero"
    major_sub = 4 if hero else 2
    medium_sub = 3 if hero else 2
    small_sub = 2 if hero else 1
    cylinder_sides = 14 if hero else 10
    # Lean shepherd-like baby torso, deep front chest, and compact haunches.
    body_scale = (0.50, 0.82, 0.60) if hero else (0.53, 0.90, 0.64)
    chest_scale = (0.55, 0.52, 0.66) if hero else (0.57, 0.55, 0.68)
    ico("Jack_Body", (0.0, 0.18, 1.08), body_scale, "fur_light", major_sub)
    ico("Jack_Chest", (0.0, -0.35, 1.18), chest_scale, "fur_light", major_sub)
    ico("Jack_Neck", (0.0, -0.30, 1.59), (0.46, 0.46, 0.55), "fur_shade", medium_sub)
    ico("Jack_Haunch_L", (-0.38, 0.62, 0.76), (0.30, 0.38, 0.46), "fur_light", medium_sub)
    ico("Jack_Haunch_R", (0.38, 0.62, 0.76), (0.30, 0.38, 0.46), "fur_light", medium_sub)

    # Sturdy legs and approximately 115% paws.
    leg_specs = (
        ("Front_L", -0.39, -0.38, -0.56),
        ("Front_R", 0.39, -0.38, -0.56),
        ("Rear_L", -0.42, 0.59, 0.48),
        ("Rear_R", 0.42, 0.59, 0.48),
    )
    for label, x, y, paw_y in leg_specs:
        cylinder_between(f"Jack_Leg_{label}", (x, y, 0.26), (x, y, 0.91), 0.155, "fur_shade", cylinder_sides)
        ico(f"Jack_Paw_{label}", (x, paw_y, 0.16), (0.23, 0.30, 0.145), "fur_light", medium_sub)
        if hero:
            for toe_index, toe_x in enumerate((-0.105, 0.0, 0.105), start=1):
                ico(
                    f"Jack_Toe_{label}_{toe_index}",
                    (x + toe_x, paw_y - 0.205, 0.19),
                    (0.070, 0.080, 0.040),
                    "fur_shade",
                    small_sub,
                )

    # Head and long split wedge muzzle.
    cranium_scale = (0.50, 0.51, 0.46) if hero else (0.52, 0.50, 0.49)
    ico("Jack_Cranium", (0.0, -0.44, 2.06), cranium_scale, "fur_light", major_sub)
    muzzle_wedge("Jack_MuzzleWedge", "fur_light")
    cheek_scale = (0.33, 0.36, 0.23) if hero else (0.35, 0.34, 0.245)
    ico("Jack_Cheek_L", (-0.25, -0.89, 1.85), cheek_scale, "fur_light", medium_sub)
    ico("Jack_Cheek_R", (0.25, -0.89, 1.85), cheek_scale, "fur_light", medium_sub)

    # Upright ears with minor asymmetry and separate warm interiors.
    ear_pyramid("Jack_Ear_L", -0.31, 2.18, 2.85, 0.42, -0.57, -0.27, "fur_light", tip_x=-0.39)
    ear_pyramid("Jack_Ear_R", 0.31, 2.16, 2.80, 0.40, -0.57, -0.28, "fur_light", tip_x=0.39)
    wedge("Jack_EarInner_L", -0.31, 2.25, 2.72, 0.24, -0.575, -0.55, "ear_interior")
    wedge("Jack_EarInner_R", 0.31, 2.23, 2.67, 0.22, -0.575, -0.55, "ear_interior")

    # Narrow almond eye construction: flattened dark forms with a restrained catchlight.
    for side, x in (("L", -0.225), ("R", 0.225)):
        eye = ico(f"Jack_Eye_{side}", (x, -0.958, 2.115), (0.140, 0.025, 0.055), "eye", medium_sub)
        eye.rotation_euler.y = math.radians(-8 if side == "L" else 8)
        ico(f"Jack_EyeLight_{side}", (x - 0.030, -0.982, 2.13), (0.020, 0.010, 0.016), "tooth", small_sub)

    # Dominant mauve-charcoal Boop target and warm likeness highlight.
    nose_scale = (0.30, 0.18, 0.17) if hero else (0.25, 0.205, 0.225)
    nose_y = -1.36 if hero else -1.385
    ico("Jack_Nose", (0.0, nose_y, 1.94), nose_scale, "nose_base", major_sub)
    ico("Jack_NoseHighlight", (-0.100, -1.532 if hero else -1.579, 2.00 if hero else 2.025), (0.070, 0.012, 0.025), "nose_highlight", small_sub)
    ico("Jack_Nostril_L", (-0.125 if hero else -0.105, -1.536 if hero else -1.583, 1.915), (0.050, 0.012, 0.028), "eye", small_sub)
    ico("Jack_Nostril_R", (0.125 if hero else 0.105, -1.536 if hero else -1.583, 1.915), (0.050, 0.012, 0.028), "eye", small_sub)

    # Friendly open smile, tongue, and small restrained teeth.
    mouth_scale = (0.30, 0.14, 0.205) if hero else (0.34, 0.15, 0.245)
    tongue_scale = (0.135, 0.060, 0.160) if hero else (0.17, 0.075, 0.18)
    ico("Jack_Mouth", (0.0, -1.105, 1.67), mouth_scale, "mouth", medium_sub)
    ico("Jack_Tongue", (0.0, -1.225, 1.55), tongue_scale, "tongue", medium_sub)
    tooth_top = 1.76 if hero else 1.80
    tooth_width = 0.055 if hero else 0.08
    wedge("Jack_Tooth_L", -0.17, 1.69, tooth_top, tooth_width, -1.254, -1.20, "tooth")
    wedge("Jack_Tooth_R", 0.17, 1.69, tooth_top, tooth_width, -1.254, -1.20, "tooth")

    # Continuity markers: blue collar and original simple brass disk tag.
    torus("Jack_Collar", (0.0, -0.35, 1.56), 0.48, 0.055, 0.90, "collar")
    cylinder_between("Jack_TagLoop", (0.0, -0.735, 1.49), (0.0, -0.985, 1.28), 0.025, "tag", cylinder_sides)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24 if hero else 16, radius=0.12, depth=0.035, location=(0.0, -1.00, 1.18), rotation=(math.radians(90), 0.0, 0.0))
    finish_object(bpy.context.object, "Jack_Tag", "tag")

    # Tapered resting tail with a single readable bend.
    if hero:
        tail = [
            ("Base_1", (0.18, 0.90, 1.15), (0.30, 1.10, 1.22), 0.13),
            ("Base_2", (0.30, 1.10, 1.22), (0.42, 1.31, 1.20), 0.12),
            ("Mid_1", (0.42, 1.31, 1.20), (0.53, 1.49, 1.13), 0.105),
            ("Mid_2", (0.53, 1.49, 1.13), (0.62, 1.67, 1.01), 0.088),
            ("Tip", (0.62, 1.67, 1.01), (0.68, 1.84, 0.88), 0.060),
        ]
        for label, start, end, radius in tail:
            cylinder_between(f"Jack_Tail_{label}", start, end, radius, "fur_light", cylinder_sides)
    else:
        cylinder_between("Jack_Tail_Base", (0.18, 0.90, 1.15), (0.38, 1.27, 1.24), 0.13, "fur_light", cylinder_sides)
        cylinder_between("Jack_Tail_Mid", (0.38, 1.27, 1.24), (0.58, 1.58, 1.08), 0.105, "fur_light", cylinder_sides)
        cylinder_between("Jack_Tail_Tip", (0.58, 1.58, 1.08), (0.68, 1.84, 0.88), 0.07, "fur_light", 8)

    for obj in MODEL_OBJECTS:
        obj["presentationOnly"] = True
        obj["rootMotionGameplay"] = False
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = False


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_stage() -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.015))
    ground = finish_object(bpy.context.object, "Evidence_Ground", "ground", model=False)

    bpy.ops.object.light_add(type="AREA", location=(-3.2, -4.0, 6.5))
    key = bpy.context.object
    key.name = "Evidence_Key"
    key.data.energy = 520
    key.data.shape = "DISK"
    key.data.size = 4.0
    look_at(key, (0.0, 0.0, 1.2))

    bpy.ops.object.light_add(type="AREA", location=(4.0, -1.5, 3.4))
    fill = bpy.context.object
    fill.name = "Evidence_Fill"
    fill.data.energy = 260
    fill.data.size = 3.5
    look_at(fill, (0.0, 0.0, 1.3))

    bpy.ops.object.light_add(type="AREA", location=(0.0, 4.0, 4.8))
    rim = bpy.context.object
    rim.name = "Evidence_Rim"
    rim.data.energy = 380
    rim.data.size = 3.0
    look_at(rim, (0.0, 0.3, 1.4))

    bpy.ops.object.camera_add(location=(0.0, -7.3, 2.35))
    camera = bpy.context.object
    camera.name = "Evidence_Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.55
    camera.data.lens = 58
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    # Headless Windows sandboxes may expose no Eevee-compatible compute shader.
    # Cycles CPU is deterministic and keeps the evidence independent of GPU support.
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.color_depth = "8"
    scene.world.color = (0.055, 0.055, 0.07)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35
    scene.render.filepath = str(EVIDENCE_DIR / "jack-blockout-front.png")
    ground.visible_glossy = False
    return camera


def render_views(camera: bpy.types.Object) -> None:
    views = {
        "front": ((0.0, -7.3, 2.35), (0.0, -0.10, 1.38), 3.55),
        "side": ((7.2, -0.15, 2.35), (0.0, -0.05, 1.38), 3.55),
        "three-quarter": ((5.0, -5.8, 2.75), (0.0, -0.05, 1.38), 3.65),
        "rear": ((0.0, 7.5, 2.45), (0.0, 0.10, 1.38), 3.55),
    }
    for name, (location, target, ortho_scale) in views.items():
        camera.location = location
        camera.data.ortho_scale = ortho_scale
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(EVIDENCE_DIR / f"jack-blockout-{name}.png")
        bpy.ops.render.render(write_still=True)


def triangle_count() -> int:
    total = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in MODEL_OBJECTS:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def export_and_measure() -> None:
    source_path = SOURCE_DIR / "jack-blockout.blend"
    export_path = EXPORT_DIR / "jack-blockout.glb"
    bpy.context.scene["assetName"] = "Baby Jack blockout"
    bpy.context.scene["status"] = "likeness-review-pending"
    bpy.context.scene["presentationOnly"] = True
    bpy.context.scene["privateReferencesEmbedded"] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(source_path), check_existing=False)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in MODEL_OBJECTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = MODEL_OBJECTS[0]
    bpy.ops.export_scene.gltf(
        filepath=str(export_path),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
    )

    metrics = {
        "schemaVersion": 1,
        "asset": "Baby Jack static proportion blockout",
        "status": "likeness-review-pending",
        "units": "meters",
        "standingHeight": 2.85,
        "headHeightIncludingEars": 1.03,
        "headHeightPercent": round(1.03 / 2.85 * 100, 1),
        "standingHeightInHeadLengths": round(2.85 / 1.03, 2),
        "headDepth": 1.65,
        "muzzleProjection": 0.78,
        "muzzleProjectionPercent": round(0.78 / 1.65 * 100, 1),
        "muzzleWidth": 1.20,
        "noseWidth": 0.50,
        "noseToMuzzleWidthPercent": round(0.50 / 1.20 * 100, 1),
        "pawScalePercentOfNeutral": 115,
        "triangles": triangle_count(),
        "materials": len({slot.material.name for obj in MODEL_OBJECTS for slot in obj.material_slots if slot.material}),
        "imageTextures": 0,
        "glbBytes": export_path.stat().st_size,
        "heroTriangleTarget": {"min": 8000, "max": 14000, "appliesAfterRefinement": True},
        "privateReferencesEmbedded": False,
        "presentationOnly": True,
        "rootMotionGameplay": False,
        "renderResolution": [1024, 1024],
        "views": ["front", "side", "three-quarter", "rear"],
        "generator": "assets/3d/jack/tools/build_blockout.py",
        "blenderVersion": bpy.app.version_string,
    }
    (ASSET_ROOT / "blockout-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    reset_scene()
    # Materials were created before reset and remain referenced by this module.
    build_jack()
    camera = setup_stage()
    render_views(camera)
    export_and_measure()
    print(json.dumps({"status": "ok", "root": os.fspath(ROOT), "triangles": triangle_count()}))


if __name__ == "__main__":
    main()
