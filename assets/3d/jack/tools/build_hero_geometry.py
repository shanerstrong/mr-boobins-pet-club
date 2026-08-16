"""Connected, silhouette-led geometry for the Baby Jack hero asset.

This module deliberately avoids the blockout's stack of high-resolution spheres.
The hero is built from longitudinal cross sections so polygons follow the forms
that define Jack: long shepherd muzzle, deep chest, tapered limbs, planted paws,
upright ear bowls, and one continuous tail.
"""

from __future__ import annotations

import math

import bpy

import build_blockout as base


def _mesh_object(name: str, verts: list[tuple[float, float, float]], faces: list[tuple[int, ...]], material: str) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    base.finish_object(obj, name, material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def _apply_modifier(obj: bpy.types.Object, modifier: bpy.types.Modifier) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def _subdivide(obj: bpy.types.Object, levels: int) -> None:
    modifier = obj.modifiers.new(name="Silhouette subdivision", type="SUBSURF")
    modifier.subdivision_type = "CATMULL_CLARK"
    modifier.levels = levels
    modifier.render_levels = levels
    _apply_modifier(obj, modifier)


def tube_y(
    name: str,
    rings: list[tuple[float, float, float, float, float]],
    material: str,
    segments: int = 24,
    subdivide: int = 0,
) -> bpy.types.Object:
    """Build a capped organic tube along Y.

    Rings are (center_x, y, center_z, radius_x, radius_z). The first and last
    rings collapse modestly under subdivision, creating continuous end forms.
    """
    verts: list[tuple[float, float, float]] = []
    for cx, y, cz, rx, rz in rings:
        for index in range(segments):
            angle = math.tau * index / segments
            verts.append((cx + rx * math.cos(angle), y, cz + rz * math.sin(angle)))
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(rings) - 1):
        start = ring_index * segments
        next_start = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((start + index, start + nxt, next_start + nxt, next_start + index))
    faces.append(tuple(reversed(range(segments))))
    last = (len(rings) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    obj = _mesh_object(name, verts, faces, material)
    if subdivide:
        _subdivide(obj, subdivide)
    return obj


def tube_z(
    name: str,
    rings: list[tuple[float, float, float, float, float]],
    material: str,
    segments: int = 18,
) -> bpy.types.Object:
    """Build a tapered limb along Z from (x, y, z, radius_x, radius_y)."""
    verts: list[tuple[float, float, float]] = []
    for cx, cy, z, rx, ry in rings:
        for index in range(segments):
            angle = math.tau * index / segments
            verts.append((cx + rx * math.cos(angle), cy + ry * math.sin(angle), z))
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(rings) - 1):
        start = ring_index * segments
        next_start = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((start + index, start + nxt, next_start + nxt, next_start + index))
    faces.append(tuple(reversed(range(segments))))
    last = (len(rings) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return _mesh_object(name, verts, faces, material)


def rounded_box(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: str) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=location)
    obj = bpy.context.object
    obj.scale = scale
    base.apply_scale(obj)
    base.finish_object(obj, name, material)
    bevel = obj.modifiers.new(name="Integrated paw rounding", type="BEVEL")
    bevel.width = 0.095
    bevel.segments = 4
    _apply_modifier(obj, bevel)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def almond(name: str, center: tuple[float, float, float], width: float, height: float, depth: float, material: str) -> bpy.types.Object:
    """Create a pointed, convex almond lens facing the review camera."""
    cx, cy, cz = center
    segments = 20
    verts: list[tuple[float, float, float]] = []
    for y in (cy + depth * 0.35, cy - depth):
        for index in range(segments):
            angle = math.tau * index / segments
            x = cx + width * math.cos(angle)
            # Sharper corners than an ellipse, with enough upper-lid volume.
            sine = math.sin(angle)
            z = cz + height * sine * (0.62 + 0.38 * abs(sine))
            verts.append((x, y, z))
    verts.extend([(cx, cy + depth * 0.55, cz), (cx, cy - depth, cz)])
    front_center = segments * 2
    back_center = front_center + 1
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((front_center, index, nxt))
        faces.append((back_center, segments + nxt, segments + index))
        faces.append((index, segments + index, segments + nxt, nxt))
    return _mesh_object(name, verts, faces, material)


def rounded_nose() -> bpy.types.Object:
    """Broad triangular-rounded nose with an organic bridge and front plane."""
    rings = [
        (0.0, -1.285, 1.945, 0.225, 0.145),
        (0.0, -1.405, 1.930, 0.275, 0.175),
        (0.0, -1.500, 1.910, 0.245, 0.150),
    ]
    obj = tube_y("Jack_Nose", rings, "nose_base", segments=24, subdivide=1)
    return obj


def ear_shell(name: str, center_x: float, tip_x: float, base_z: float, top_z: float) -> bpy.types.Object:
    """Thick, gently bowed shepherd ear with a readable inner bowl."""
    height = top_z - base_z
    outline = [
        (-0.235, 0.00),
        (-0.215, 0.18),
        (-0.155, 0.43),
        (tip_x - center_x, 1.00),
        (0.145, 0.44),
        (0.215, 0.19),
        (0.235, 0.00),
    ]
    front_y = -0.515
    back_y = -0.295
    verts: list[tuple[float, float, float]] = []
    for y in (front_y, back_y):
        for dx, fraction in outline:
            bow = 0.035 * math.sin(math.pi * fraction)
            verts.append((center_x + dx, y + (-bow if y == front_y else bow), base_z + fraction * height))
    count = len(outline)
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, count + index, count + nxt, nxt))
    obj = _mesh_object(name, verts, faces, "fur_light")
    bevel = obj.modifiers.new(name="Ear edge softness", type="BEVEL")
    bevel.width = 0.025
    bevel.segments = 3
    _apply_modifier(obj, bevel)
    return obj


def inner_ear(name: str, center_x: float, tip_x: float, base_z: float, top_z: float) -> bpy.types.Object:
    height = top_z - base_z
    verts = [
        (center_x - 0.135, -0.545, base_z + 0.05),
        (center_x - 0.105, -0.558, base_z + 0.28 * height),
        (tip_x, -0.550, top_z - 0.12),
        (center_x + 0.100, -0.558, base_z + 0.28 * height),
        (center_x + 0.135, -0.545, base_z + 0.05),
    ]
    return _mesh_object(name, verts, [(0, 1, 2, 3, 4)], "ear_interior")


def curved_tail() -> bpy.types.Object:
    centers = [
        (0.12, 0.82, 1.17, 0.145),
        (0.23, 1.03, 1.25, 0.137),
        (0.38, 1.25, 1.25, 0.125),
        (0.51, 1.45, 1.18, 0.110),
        (0.61, 1.63, 1.07, 0.092),
        (0.68, 1.79, 0.92, 0.070),
        (0.71, 1.91, 0.78, 0.035),
    ]
    segments = 18
    verts: list[tuple[float, float, float]] = []
    for cx, cy, cz, radius in centers:
        # Cross sections remain nearly vertical; the many centerline rings make
        # the silhouette continuous instead of a chain of cylinders.
        for index in range(segments):
            angle = math.tau * index / segments
            verts.append((cx + radius * math.cos(angle), cy, cz + radius * math.sin(angle)))
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(centers) - 1):
        start = ring_index * segments
        next_start = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((start + index, start + nxt, next_start + nxt, next_start + index))
    faces.append(tuple(reversed(range(segments))))
    last = (len(centers) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return _mesh_object("Jack_Tail", verts, faces, "fur_light")


def build() -> None:
    # Deep shoulder and chest taper through a 13% narrower waist into the pelvis.
    tube_y(
        "Jack_Body",
        [
            (0.0, 0.92, 1.02, 0.30, 0.39),
            (0.0, 0.72, 1.04, 0.43, 0.50),
            (0.0, 0.43, 1.09, 0.45, 0.54),
            (0.0, 0.15, 1.12, 0.42, 0.57),
            (0.0, -0.10, 1.17, 0.48, 0.62),
            (0.0, -0.34, 1.25, 0.52, 0.62),
            (0.0, -0.52, 1.35, 0.40, 0.50),
        ],
        "fur_light",
        segments=28,
        subdivide=2,
    )
    tube_y(
        "Jack_Neck",
        [(0.0, -0.22, 1.43, 0.40, 0.42), (0.0, -0.34, 1.62, 0.43, 0.45), (0.0, -0.38, 1.83, 0.39, 0.39)],
        "fur_shade",
        segments=24,
        subdivide=1,
    )

    # One forehead-to-muzzle form. Muzzle begins near y=-0.72; the nose front
    # at -1.50 gives a measured projection of ~49% of total head depth.
    tube_y(
        "Jack_MuzzleWedge",
        [
            (0.0, 0.02, 2.10, 0.22, 0.27),
            (0.0, -0.16, 2.14, 0.37, 0.39),
            (0.0, -0.36, 2.14, 0.49, 0.45),
            (0.0, -0.56, 2.08, 0.52, 0.41),
            (0.0, -0.72, 2.00, 0.60, 0.32),
            (0.0, -0.89, 1.96, 0.48, 0.25),
            (0.0, -1.06, 1.94, 0.38, 0.205),
            (0.0, -1.21, 1.94, 0.30, 0.175),
            (0.0, -1.31, 1.94, 0.245, 0.155),
        ],
        "fur_light",
        segments=32,
        subdivide=1,
    )

    # Tapered legs overlap the connected torso at the shoulder/hip and resolve
    # into one planted rounded paw per limb—no detached toe marbles.
    leg_specs = (
        ("Front_L", -0.37, -0.36, -0.56),
        ("Front_R", 0.37, -0.36, -0.56),
        ("Rear_L", -0.40, 0.60, 0.44),
        ("Rear_R", 0.40, 0.60, 0.44),
    )
    for label, x, y, paw_y in leg_specs:
        rear = label.startswith("Rear")
        tube_z(
            f"Jack_Leg_{label}",
            [
                (x, y, 1.02, 0.19 if rear else 0.17, 0.20),
                (x, y, 0.75, 0.16, 0.17),
                (x, y - (0.025 if rear else 0.0), 0.48, 0.135, 0.145),
                (x, y - (0.055 if rear else 0.0), 0.18, 0.115, 0.125),
            ],
            "fur_shade",
        )
        rounded_box(f"Jack_Paw_{label}", (x, paw_y, 0.13), (0.235, 0.315, 0.13), "fur_light")

    ear_shell("Jack_Ear_L", -0.31, -0.40, 2.22, 2.88)
    ear_shell("Jack_Ear_R", 0.31, 0.39, 2.20, 2.82)
    inner_ear("Jack_EarInner_L", -0.31, -0.38, 2.24, 2.82)
    inner_ear("Jack_EarInner_R", 0.31, 0.38, 2.22, 2.76)

    almond("Jack_Eye_L", (-0.235, -0.848, 2.145), 0.145, 0.060, 0.032, "eye")
    almond("Jack_Eye_R", (0.235, -0.848, 2.145), 0.145, 0.060, 0.032, "eye")
    # Small embedded catchlights read at phone size without becoming pellets.
    almond("Jack_EyeLight_L", (-0.275, -0.880, 2.164), 0.025, 0.015, 0.008, "tooth")
    almond("Jack_EyeLight_R", (0.195, -0.880, 2.164), 0.025, 0.015, 0.008, "tooth")

    rounded_nose()
    almond("Jack_Nostril_L", (-0.105, -1.554, 1.916), 0.052, 0.026, 0.010, "eye")
    almond("Jack_Nostril_R", (0.105, -1.554, 1.916), 0.052, 0.026, 0.010, "eye")
    # One restrained highlight plane replaces the former floating bead.
    almond("Jack_NoseHighlight", (-0.085, -1.558, 1.986), 0.060, 0.018, 0.006, "nose_highlight")

    almond("Jack_Mouth", (0.0, -1.268, 1.735), 0.285, 0.125, 0.035, "mouth")
    almond("Jack_Tongue", (0.0, -1.304, 1.665), 0.135, 0.085, 0.026, "tongue")
    # Side teeth stay subordinate to the smile and never form front fangs.
    base.wedge("Jack_Tooth_L", -0.205, 1.725, 1.790, 0.045, -1.308, -1.273, "tooth")
    base.wedge("Jack_Tooth_R", 0.205, 1.725, 1.790, 0.045, -1.308, -1.273, "tooth")

    base.torus("Jack_Collar", (0.0, -0.34, 1.58), 0.455, 0.045, 0.88, "collar")
    base.cylinder_between("Jack_TagLoop", (0.0, -0.735, 1.51), (0.0, -0.925, 1.33), 0.020, "tag", 14)
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.105, depth=0.030, location=(0.0, -0.955, 1.255), rotation=(math.radians(90), 0.0, 0.0))
    base.finish_object(bpy.context.object, "Jack_Tag", "tag")
    curved_tail()

    # Fur is matte; eyes and nose retain enough response to read as living tissue.
    for mat_name, roughness, specular in (
        ("eye", 0.24, 0.62),
        ("nose_base", 0.34, 0.52),
        ("nose_highlight", 0.30, 0.48),
        ("fur_light", 0.76, 0.25),
        ("fur_shade", 0.82, 0.20),
    ):
        bsdf = base.MATERIALS[mat_name].node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = roughness
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = specular

    for obj in base.MODEL_OBJECTS:
        obj["presentationOnly"] = True
        obj["rootMotionGameplay"] = False
