"""Render one representative Baby Jack deformation pose for every shared clip.

The input is a QA-only GLB that deterministically composes Baby with the
external shared animation channels. Production keeps the library external.
The output is review evidence only and never changes application state.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


FPS = 30
SAMPLE_FRACTIONS = {
    "idle": 0.50,
    "tail_wag": 0.25,
    "feed": 0.38,
    "sleep": 0.50,
    "wake": 0.50,
    "play": 0.34,
    "clean_reaction": 0.64,
    "boop_comfortable": 0.48,
    "boop_need_hunger": 0.55,
    "boop_need_energy": 0.55,
    "boop_need_hygiene": 0.55,
    "boop_need_happiness": 0.55,
    "boop_rejected": 0.48,
    "tired": 0.50,
    "dirty": 0.50,
    "death_rest": 0.86,
}

MORPHS_BY_CLIP = {
    "feed": {"mouth_open": 0.45, "tongue_out": 0.80},
    "sleep": {"blink": 1.0},
    "boop_comfortable": {"nose_compress": 0.70, "smile": 0.55},
    "boop_need_hunger": {"nose_compress": 0.45},
    "boop_need_energy": {"nose_compress": 0.45, "lids_tired": 0.55},
    "boop_need_hygiene": {"nose_compress": 0.45},
    "boop_need_happiness": {"nose_compress": 0.45},
    "boop_rejected": {"nose_compress": 1.0},
    "tired": {"lids_tired": 1.0},
    "death_rest": {"blink": 1.0},
}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--age", choices=("baby", "teen", "adult"), default="baby")
    parser.add_argument("--skin-glb")
    parser.add_argument("--baby-glb", help="Backward-compatible alias for --skin-glb when --age=baby.")
    parser.add_argument("--clip-manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument(
        "--clips",
        default="",
        help="Optional comma-separated clip subset for focused QA rerenders.",
    )
    parser.add_argument("--no-render", action="store_true", help="Measure poses without writing PNG renders.")
    parser.add_argument(
        "--reuse-existing",
        action="store_true",
        help="Measure every pose but reuse already-rendered PNG evidence.",
    )
    args = parser.parse_args(forwarded)
    if not args.skin_glb and not args.baby_glb:
        parser.error("one of --skin-glb or --baby-glb is required")
    if args.skin_glb and args.baby_glb:
        parser.error("use only one of --skin-glb or --baby-glb")
    return args


ARGS = parse_args()


def add_area_light(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0.0, -0.05, 0.68)) - light.location).to_track_quat("-Z", "Y").to_euler()


def setup_review_scene() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Deformation_Review_World")
    scene.world.color = (0.018, 0.024, 0.034)

    floor_material = bpy.data.materials.new("Deformation_Review_Floor")
    floor_material.diffuse_color = (0.06, 0.08, 0.11, 1.0)
    bpy.ops.mesh.primitive_plane_add(size=7.0, location=(0.0, 0.0, -0.003))
    floor = bpy.context.object
    floor.name = "Deformation_Review_Floor"
    floor.data.materials.append(floor_material)

    add_area_light("Deformation_Key", (-2.4, -3.0, 3.3), 850.0, 2.4)
    add_area_light("Deformation_Fill", (2.6, -1.4, 2.0), 500.0, 2.2)
    add_area_light("Deformation_Rim", (0.4, 3.0, 2.7), 700.0, 2.0)

    camera_data = bpy.data.cameras.new("Deformation_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.72
    camera = bpy.data.objects.new("Deformation_Review_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (-2.4, -2.8, 1.22)
    camera.rotation_euler = (Vector((0.0, -0.04, 0.68)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    return camera


def reset_pose(rig: bpy.types.Object, meshes: list[bpy.types.Object]) -> None:
    rig.animation_data_create()
    rig.animation_data.use_nla = False
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        # glTF imports rotation animation as quaternion F-curves.  Forcing XYZ
        # here silently ignored every rotation channel while still applying
        # translations, which made rest poses look like the dog sank through
        # the floor.  Keep the imported representation active for honest QA.
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)
    for mesh in meshes:
        if mesh.data.shape_keys is None:
            continue
        for key in mesh.data.shape_keys.key_blocks:
            if key.name != "Basis":
                key.value = 0.0


def set_morphs(meshes: list[bpy.types.Object], values: dict[str, float]) -> None:
    for mesh in meshes:
        if mesh.data.shape_keys is None:
            continue
        for name, value in values.items():
            key = mesh.data.shape_keys.key_blocks.get(name)
            if key is not None:
                key.value = value


def evaluated_bounds(
    meshes: list[bpy.types.Object],
) -> tuple[list[float], list[float], dict[str, float], dict[str, list[dict[str, float]]]]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points: list[Vector] = []
    samples: list[tuple[Vector, bpy.types.Object, int]] = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        evaluated_mesh = evaluated.to_mesh()
        try:
            for vertex in evaluated_mesh.vertices:
                point = evaluated.matrix_world @ vertex.co
                points.append(point)
                samples.append((point, obj, vertex.index))
        finally:
            evaluated.to_mesh_clear()
    minimum = [min(point[index] for point in points) for index in range(3)]
    maximum = [max(point[index] for point in points) for index in range(3)]
    ordered_z = sorted(point.z for point in points)
    quantiles = {}
    for label, fraction in (("p00", 0.0), ("p01", 0.01), ("p05", 0.05), ("p10", 0.10), ("p50", 0.50)):
        index = min(len(ordered_z) - 1, round((len(ordered_z) - 1) * fraction))
        quantiles[label] = round(ordered_z[index], 6)
    bottom_bones = {}
    for label in ("p01", "p05"):
        threshold = quantiles[label]
        weights: dict[str, float] = {}
        for point, obj, vertex_index in samples:
            if point.z > threshold:
                continue
            source_vertex = obj.data.vertices[vertex_index]
            for assignment in source_vertex.groups:
                group_name = obj.vertex_groups[assignment.group].name
                weights[group_name] = weights.get(group_name, 0.0) + assignment.weight
        bottom_bones[label] = [
            {"bone": name, "weight": round(weight, 4)}
            for name, weight in sorted(weights.items(), key=lambda item: item[1], reverse=True)[:8]
        ]
    return minimum, maximum, quantiles, bottom_bones


def main() -> None:
    skin_glb = Path(ARGS.skin_glb or ARGS.baby_glb).resolve()
    output_dir = Path(ARGS.output_dir).resolve()
    report_path = Path(ARGS.report).resolve()
    manifest = json.loads(Path(ARGS.clip_manifest).read_text(encoding="utf-8"))
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    objects_before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(skin_glb))
    imported = [obj for obj in bpy.data.objects if obj not in objects_before]
    rigs = [obj for obj in imported if obj.type == "ARMATURE"]
    imported_meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(rigs) != 1 or not imported_meshes:
        raise RuntimeError(f"Expected one imported armature and at least one mesh; got {len(rigs)} / {len(imported_meshes)}")
    rig = rigs[0]
    rig.name = f"Jack_{ARGS.age.title()}_Deformation_Rig"
    meshes = [
        mesh
        for mesh in imported_meshes
        if any(modifier.type == "ARMATURE" and modifier.object == rig for modifier in mesh.modifiers)
    ]
    if not meshes:
        raise RuntimeError(f"Imported {ARGS.age.title()} GLB has no mesh bound to its armature")
    required_bones = {bone.name for bone in rig.data.bones}
    if len(required_bones) != 40:
        raise RuntimeError(f"Expected 40 {ARGS.age.title()} bones; found {len(required_bones)}")

    setup_review_scene()
    selected_names = {name.strip() for name in ARGS.clips.split(",") if name.strip()}
    results = []
    for clip in manifest["clips"]:
        name = clip["name"]
        if selected_names and name not in selected_names:
            continue
        action = bpy.data.actions.get(name)
        if action is None:
            raise RuntimeError(f"Missing editable action {name}")
        reset_pose(rig, meshes)
        rig.animation_data.action = action
        duration_frames = clip["durationMs"] * FPS / 1000.0
        frame = duration_frames * SAMPLE_FRACTIONS[name]
        frame_floor = math.floor(frame)
        bpy.context.scene.frame_set(frame_floor, subframe=frame - frame_floor)
        set_morphs(meshes, MORPHS_BY_CLIP.get(name, {}))
        bpy.context.view_layer.update()
        minimum, maximum, height_quantiles, bottom_bones = evaluated_bounds(meshes)
        output = output_dir / f"{ARGS.age}-{name}.png"
        if not ARGS.no_render and not (ARGS.reuse_existing and output.exists()):
            bpy.context.scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
        root = rig.pose.bones.get("root")
        root_location = list(root.location) if root is not None else None
        diagnostic_bones = {}
        for bone_name in ("pelvis", "chest", "head"):
            bone = rig.pose.bones.get(bone_name)
            if bone is None:
                continue
            diagnostic_bones[bone_name] = {
                "headArmature": [round(value, 6) for value in bone.head],
                "tailArmature": [round(value, 6) for value in bone.tail],
                "rotationQuaternion": [round(value, 6) for value in bone.rotation_quaternion],
            }
        results.append(
            {
                "clip": name,
                "durationMs": clip["durationMs"],
                "sampleFrame": round(frame, 3),
                "sampleTimeMs": round(frame / FPS * 1000.0, 3),
                "render": None if ARGS.no_render else output.name,
                "boundsMin": [round(value, 6) for value in minimum],
                "boundsMax": [round(value, 6) for value in maximum],
                "belowGroundMeters": round(max(0.0, -minimum[2]), 6),
                "heightQuantilesMeters": height_quantiles,
                "bottomInfluenceSummary": bottom_bones,
                "rootLocation": [round(value, 9) for value in root_location] if root_location else None,
                "diagnosticBones": diagnostic_bones,
                "morphs": MORPHS_BY_CLIP.get(name, {}),
            }
        )

    full_clip_set = len(results) == len(manifest["clips"])
    rest_clips = {"sleep", "wake", "death_rest"}
    standing_contact_ok = all(
        pose["belowGroundMeters"] <= 0.005
        for pose in results
        if pose["clip"] not in rest_clips
    )
    rest_contact_ok = all(
        pose["belowGroundMeters"] <= 0.15
        for pose in results
        if pose["clip"] in rest_clips
    )
    root_invariant = all(
        pose["rootLocation"] == [0.0, 0.0, 0.0]
        for pose in results
    )
    measured_pass = full_clip_set and standing_contact_ok and rest_contact_ok and root_invariant
    report = {
        "schemaVersion": 1,
        "status": (
            "focused-render-pending-human-deformation-review"
            if selected_names
            else ("measured-pass" if measured_pass else "measured-fail")
        ),
        "blenderVersion": bpy.app.version_string,
        "skin": ARGS.age,
        "sourceGlb": skin_glb.name,
        "animatedPreviewGlb": skin_glb.name,
        "productionAnimationsRemainExternal": True,
        "jointCount": len(required_bones),
        "skinnedMeshes": [mesh.name for mesh in meshes],
        "excludedImportedMeshes": [mesh.name for mesh in imported_meshes if mesh not in meshes],
        "clipCount": len(results),
        "presentationOnly": True,
        "simulationMutation": False,
        "rootMotionGameplay": False,
        "acceptance": {
            "fullClipSet": full_clip_set,
            "standingContactMaximumMeters": 0.005,
            "standingContactPass": standing_contact_ok,
            "restContactMaximumMeters": 0.15,
            "restContactPass": rest_contact_ok,
            "rootInvariantPass": root_invariant,
            "visualReviewRequired": True,
        },
        "poses": results,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"JACK_DEFORMATION_EVIDENCE_COMPLETE age={ARGS.age} clips={len(results)}")


main()
