"""Build a bounded static adult-Jack likeness candidate from the Meshy source.

The edits are coordinate-region proportion changes only. Existing topology,
UVs, materials, and textures are retained. No rig or animation is added.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--board", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--variant", choices=("a", "b", "c", "d"), default="a")
    parser.add_argument("--skip-board", action="store_true")
    return parser.parse_args(forwarded)


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def band(value: float, low: float, full_low: float, full_high: float, high: float) -> float:
    if value <= low or value >= high:
        return 0.0
    if full_low <= value <= full_high:
        return 1.0
    if value < full_low:
        return smoothstep((value - low) / (full_low - low))
    return smoothstep((high - value) / (high - full_high))


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, 0.75)))


def snapshot(source: bpy.types.Object, name: str) -> bpy.types.Object:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    mesh.transform(source.matrix_world)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def apply_likeness(mesh: bpy.types.Object, variant: str) -> dict[str, object]:
    stronger = variant in {"b", "c", "d"}
    head_width_factor = 0.09 if stronger else 0.075
    muzzle_length_factor = 0.105
    muzzle_width_factor = 0.075 if stronger else 0.065
    nose_length_factor = 0.15 if stronger else 0.12
    nose_width_factor = 0.24 if stronger else 0.16
    nose_height_factor = 0.10 if stronger else 0.07
    ear_width_factor = 0.10 if stronger else 0.035
    ear_height_factor = 0.09 if stronger else 0.045
    hindquarter_width_factor = 0.075 if stronger else 0.045
    paw_x_reduction = 0.22 if stronger else 0.13
    paw_y_reduction = 0.18 if stronger else 0.11
    tail_length_factor = 0.19 if stronger else 0.16
    tail_drop_factor = 0.12 if stronger else 0.09
    tail_width_factor = 0.22 if stronger else 0.08
    inverse = mesh.matrix_world.inverted()
    maximum_delta = 0.0
    affected = 0
    region_counts = {name: 0 for name in (
        "head_width", "muzzle", "nose", "ears", "torso", "tuck",
        "hindquarters", "paws", "tail",
    )}
    for vertex in mesh.data.vertices:
        original = mesh.matrix_world @ vertex.co
        revised = original.copy()

        head_width = smoothstep((-original.y - 0.34) / 0.28) * band(original.z, 1.18, 1.30, 1.66, 1.78)
        if head_width > 0.001:
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 + head_width_factor * head_width)
            region_counts["head_width"] += 1

        muzzle = smoothstep((-original.y - 0.50) / 0.32) * band(original.z, 1.20, 1.28, 1.58, 1.68)
        if muzzle > 0.001:
            revised.y = -0.50 + (revised.y + 0.50) * (1.0 + muzzle_length_factor * muzzle)
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 + muzzle_width_factor * muzzle)
            region_counts["muzzle"] += 1

        nose = smoothstep((-original.y - 0.78) / 0.12) * band(original.z, 1.30, 1.36, 1.50, 1.57)
        if nose > 0.001:
            revised.y = -0.78 + (revised.y + 0.78) * (1.0 + nose_length_factor * nose)
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 + nose_width_factor * nose)
            revised.z = 1.43 + (revised.z - 1.43) * (1.0 + nose_height_factor * nose)
            region_counts["nose"] += 1

        ears = smoothstep((original.z - 1.62) / 0.18) * smoothstep((-original.y - 0.28) / 0.18)
        if ears > 0.001:
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 + ear_width_factor * ears)
            revised.z = 1.62 + (revised.z - 1.62) * (1.0 - ear_height_factor * ears)
            region_counts["ears"] += 1

        torso = band(original.y, -0.50, -0.38, 0.48, 0.62) * band(original.z, 0.48, 0.60, 1.30, 1.43)
        if torso > 0.001:
            revised.y = 0.04 + (revised.y - 0.04) * (1.0 + 0.045 * torso)
            region_counts["torso"] += 1

        tuck = band(original.y, -0.05, 0.04, 0.34, 0.44) * band(original.z, 0.52, 0.60, 0.84, 0.96)
        tuck *= 1.0 - smoothstep((abs(original.x) - 0.12) / 0.12)
        if tuck > 0.001:
            revised.z += 0.050 * tuck
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 - 0.035 * tuck)
            region_counts["tuck"] += 1

        hindquarters = band(original.y, 0.18, 0.28, 0.52, 0.64) * band(original.z, 0.48, 0.62, 1.16, 1.32)
        if hindquarters > 0.001:
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 + hindquarter_width_factor * hindquarters)
            revised.y = 0.22 + (revised.y - 0.22) * (1.0 + 0.035 * hindquarters)
            region_counts["hindquarters"] += 1

        paw_height = 1.0 - smoothstep((original.z - 0.12) / 0.16)
        paw_side = smoothstep((abs(original.x) - 0.075) / 0.08)
        paw = paw_height * paw_side
        if paw > 0.001:
            x_pivot = 0.18 if original.x >= 0.0 else -0.18
            y_pivot = -0.39 if original.y < 0.0 else 0.43
            revised.x = x_pivot + (revised.x - x_pivot) * (1.0 - paw_x_reduction * paw)
            revised.y = y_pivot + (revised.y - y_pivot) * (1.0 - paw_y_reduction * paw)
            region_counts["paws"] += 1

        tail_center = 1.0 - smoothstep((abs(original.x) - 0.08) / 0.10)
        tail = smoothstep((original.y - 0.47) / 0.24) * band(original.z, 0.25, 0.34, 1.05, 1.18) * tail_center
        if tail > 0.001:
            revised.y = 0.48 + (revised.y - 0.48) * (1.0 + tail_length_factor * tail)
            revised.z = 1.04 + (revised.z - 1.04) * (1.0 + tail_drop_factor * tail)
            revised.x = -0.008 + (revised.x + 0.008) * (1.0 + tail_width_factor * tail)
            region_counts["tail"] += 1

        delta = (revised - original).length
        if delta > 0.000001:
            vertex.co = inverse @ revised
            maximum_delta = max(maximum_delta, delta)
            affected += 1
    mesh.data.update()
    return {
        "affectedVertices": affected,
        "maximumVertexDeltaMeters": round(maximum_delta, 7),
        "regionVertexCounts": region_counts,
        "parameters": {
            "headWidthMaximum": round(1.0 + head_width_factor, 3),
            "muzzleLengthMaximum": round(1.0 + muzzle_length_factor, 3),
            "noseWidthMaximum": round(1.0 + nose_width_factor, 3),
            "earHeightMinimum": round(1.0 - ear_height_factor, 3),
            "torsoLengthMaximum": 1.045,
            "tuckLiftMaximumMeters": 0.05,
            "hindquarterWidthMaximum": round(1.0 + hindquarter_width_factor, 3),
            "pawPlanarScaleMinimum": [round(1.0 - paw_x_reduction, 3), round(1.0 - paw_y_reduction, 3)],
            "tailLengthMaximum": round(1.0 + tail_length_factor, 3),
            "tailWidthMaximum": round(1.0 + tail_width_factor, 3),
        },
    }


def make_identity_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return material


def assign_identity_materials(mesh: bpy.types.Object, variant: str) -> dict[str, int]:
    if variant in {"a", "d"}:
        return {"nosePolygons": 0, "eyePolygons": 0}
    nose_material = make_identity_material("Jack_Nose_Mauve_Charcoal", (0.070, 0.050, 0.060, 1.0), 0.46 if variant == "c" else 0.36)
    mesh.data.materials.append(nose_material)
    nose_index = len(mesh.data.materials) - 1
    eye_index = None
    if variant == "b":
        eye_material = make_identity_material("Jack_Eyes_Dark_Almond", (0.012, 0.010, 0.014, 1.0), 0.22)
        mesh.data.materials.append(eye_material)
        eye_index = len(mesh.data.materials) - 1
    nose_polygons = 0
    eye_polygons = 0
    for polygon in mesh.data.polygons:
        center = mesh.matrix_world @ polygon.center
        nose_limit = -0.885 if variant == "c" else -0.845
        nose_width = 0.125 if variant == "c" else 0.145
        if center.y < nose_limit and 1.35 < center.z < 1.52 and abs(center.x + 0.008) < nose_width:
            polygon.material_index = nose_index
            nose_polygons += 1
            continue
        eye_x = abs(center.x + 0.008)
        if eye_index is not None and 0.072 < eye_x < 0.175 and -0.655 < center.y < -0.455 and 1.515 < center.z < 1.655:
            polygon.material_index = eye_index
            eye_polygons += 1
    mesh.data.update()
    return {"nosePolygons": nose_polygons, "eyePolygons": eye_polygons}


def render_board(source: bpy.types.Object, output: Path) -> None:
    scene = bpy.context.scene
    source.hide_render = True
    rotations = (0.0, math.pi * 0.5, math.pi * 0.25)
    names = ("front", "side", "three-quarter")
    spacing = 2.05
    created = []
    for index, (name, rotation) in enumerate(zip(names, rotations, strict=True)):
        obj = snapshot(source, f"Candidate_{name}")
        obj.rotation_euler[2] = rotation
        bpy.context.view_layer.update()
        low, high = bounds(obj)
        obj.location.x += index * spacing - ((low.x + high.x) * 0.5)
        obj.location.z += -low.z
        bpy.context.view_layer.update()
        created.append(obj)

    floor_mat = bpy.data.materials.new("V4_Candidate_Floor")
    floor_mat.diffuse_color = (0.045, 0.055, 0.073, 1.0)
    floor_mat.use_nodes = True
    floor_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    floor_bsdf.inputs["Base Color"].default_value = floor_mat.diffuse_color
    floor_bsdf.inputs["Roughness"].default_value = 0.82
    bpy.ops.mesh.primitive_plane_add(size=9.0, location=(spacing, 0.0, -0.006))
    bpy.context.object.data.materials.append(floor_mat)
    add_area("V4_Candidate_Key", (-3.0, -3.5, 4.3), 1050.0, 3.2)
    add_area("V4_Candidate_Fill", (5.0, -1.5, 2.6), 720.0, 3.0)
    add_area("V4_Candidate_Rim", (2.0, 3.5, 3.6), 850.0, 2.6)

    created_bounds = [bounds(obj) for obj in created]
    low = Vector(tuple(min(item[0][axis] for item in created_bounds) for axis in range(3)))
    high = Vector(tuple(max(item[1][axis] for item in created_bounds) for axis in range(3)))
    center = (low + high) * 0.5
    dimensions = high - low
    camera_data = bpy.data.cameras.new("V4_Candidate_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(dimensions.z, dimensions.x / 2.0) * 1.12
    camera = bpy.data.objects.new("V4_Candidate_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (center.x, -7.5, center.z)
    point_at(camera, Vector((center.x, 0.0, center.z)))
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("V4_Candidate_World")
    scene.world.color = (0.012, 0.017, 0.026)
    scene.view_settings.look = "AgX - Medium High Contrast"
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.input).resolve()), load_ui=False)
    source = bpy.data.objects["Jack_Adult_V4_Reference_Mesh"]
    variant_label = args.variant.upper()
    source.name = f"Jack_Adult_V4_Candidate_{variant_label}_Mesh"
    before_low, before_high = bounds(source)
    source.data.calc_loop_triangles()
    before_metrics = {
        "vertices": len(source.data.vertices),
        "triangles": len(source.data.loop_triangles),
        "materials": len(source.material_slots),
        "materialNames": [slot.material.name for slot in source.material_slots if slot.material],
        "boundsMin": [round(value, 7) for value in before_low],
        "boundsMax": [round(value, 7) for value in before_high],
    }
    correction = apply_likeness(source, args.variant)
    identity_materials = assign_identity_materials(source, args.variant)
    after_low, after_high = bounds(source)
    source.data.calc_loop_triangles()
    after_metrics = {
        "vertices": len(source.data.vertices),
        "triangles": len(source.data.loop_triangles),
        "materials": len(source.material_slots),
        "materialNames": [slot.material.name for slot in source.material_slots if slot.material],
        "boundsMin": [round(value, 7) for value in after_low],
        "boundsMax": [round(value, 7) for value in after_high],
    }
    scene = bpy.context.scene
    scene.name = f"Jack_Adult_V4_Candidate_{variant_label}"
    scene["asset_version"] = f"4.0.0-adult-candidate-{args.variant}"
    scene["status"] = "exploratory-static-likeness"
    scene["reference_set"] = "2026-08-16 adult Jack Photos 1-10; local-only"
    scene["private_references_embedded"] = False
    scene["rig_bound"] = False
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    board = Path(args.board).resolve()
    if not args.skip_board:
        render_board(source, board)
    report = {
        "schemaVersion": 1,
        "status": "exploratory-pending-mark-likeness-review",
        "blenderVersion": bpy.app.version_string,
        "input": Path(args.input).name,
        "output": output.name,
        "board": None if args.skip_board else board.name,
        "before": before_metrics,
        "after": after_metrics,
        "correction": correction,
        "identityMaterials": identity_materials,
        "topologyPreserved": before_metrics["vertices"] == after_metrics["vertices"] and before_metrics["triangles"] == after_metrics["triangles"],
        "sourceMaterialsRetained": set(before_metrics["materialNames"]).issubset(after_metrics["materialNames"]),
        "privateReferencesEmbedded": False,
        "rigBound": False,
        "animationCount": 0,
        "runtimeCandidate": False,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
