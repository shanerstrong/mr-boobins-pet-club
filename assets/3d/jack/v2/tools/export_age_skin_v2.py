"""Export one V2 age skin plus an all-clips runtime-validation GLB."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy


ANCHORS = (
    "nose_visual", "hit_nose", "mouth_anchor", "collar", "tag",
    "tail_base", "paw_front_l", "paw_front_r",
)


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--age", choices=("teen", "adult"), required=True)
    parser.add_argument("--texture", required=True)
    parser.add_argument("--skin", required=True)
    parser.add_argument("--preview", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def select(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(obj for obj in objects if obj.type == "ARMATURE")


def export(path: Path, objects: list[bpy.types.Object], *, animations: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    select(objects)
    kwargs = {
        "filepath": str(path),
        "export_format": "GLB",
        "use_selection": True,
        "export_yup": True,
        "export_animations": animations,
        "export_skins": True,
        "export_morph": True,
        "export_morph_normal": False,
        "export_morph_tangent": False,
        "export_cameras": False,
        "export_lights": False,
        "export_extras": True,
        "export_texcoords": True,
        "export_normals": True,
        "export_tangents": False,
        "export_materials": "EXPORT",
    }
    if animations:
        kwargs.update({
            "export_animation_mode": "ACTIONS",
            "export_frame_range": False,
            "export_force_sampling": True,
            "export_anim_slide_to_zero": True,
            "export_anim_single_armature": True,
            "export_optimize_animation_size": True,
        })
    bpy.ops.export_scene.gltf(**kwargs)


def main() -> None:
    args = parse_args()
    blend_path = Path(args.blend).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    expected_names = {clip["name"] for clip in manifest["clips"]}
    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    mesh = bpy.data.objects[f"Jack_{args.age.title()}_Mesh"]
    root = bpy.data.objects["jack_root"]
    anchors = [bpy.data.objects[name] for name in ANCHORS]
    if not root.matrix_world.is_identity:
        raise RuntimeError("jack_root must remain identity")

    texture_path = Path(args.texture).resolve()
    mobile_image = bpy.data.images.load(str(texture_path), check_existing=False)
    mobile_image.name = f"jack_{args.age}_basecolor_v2"
    mobile_image.pack()
    if max(mobile_image.size) > 1024:
        raise RuntimeError(
            f"Mobile texture exceeds 1024px: {mobile_image.name} {tuple(mobile_image.size)}"
        )
    replaced_images: set[bpy.types.Image] = set()
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                replaced_images.add(node.image)
                node.image = mobile_image
    for image in replaced_images:
        if image != mobile_image and image.users == 0:
            bpy.data.images.remove(image)
    actual_names = {action.name for action in bpy.data.actions if action.name != "walking_meshy_baseline"}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Export action mismatch; missing={sorted(expected_names-actual_names)}, "
            f"extra={sorted(actual_names-expected_names)}"
        )
    baseline = bpy.data.actions.get("walking_meshy_baseline")
    if baseline:
        bpy.data.actions.remove(baseline)
    rig.animation_data.action = bpy.data.actions["idle"]
    scene = bpy.context.scene
    scene["asset_version"] = f"2.0.0-{args.age}-mobile"
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["root_motion_gameplay"] = False
    scene["direct_humanoid_animation"] = False
    scene["clip_manifest"] = Path(args.manifest).name

    hierarchy = [root, rig, mesh, *anchors]
    skin_path = Path(args.skin).resolve()
    preview_path = Path(args.preview).resolve()
    export(skin_path, hierarchy, animations=False)
    export(preview_path, hierarchy, animations=True)

    mesh.data.calc_loop_triangles()
    images = [
        {"name": image.name, "width": int(image.size[0]), "height": int(image.size[1])}
        for image in bpy.data.images
        if image.name != "Render Result" and image.has_data
    ]
    shape_keys = [key.name for key in mesh.data.shape_keys.key_blocks] if mesh.data.shape_keys else []
    report = {
        "schemaVersion": 1,
        "status": "exported-pending-roundtrip-validation",
        "age": args.age,
        "source": blend_path.name,
        "blenderVersion": bpy.app.version_string,
        "triangleCount": len(mesh.data.loop_triangles),
        "vertexCount": len(mesh.data.vertices),
        "jointCount": len(rig.data.bones),
        "materialCount": len(mesh.material_slots),
        "images": images,
        "decodedTextureBytes": sum(item["width"] * item["height"] * 4 for item in images),
        "shapeKeys": shape_keys,
        "clipCount": len(expected_names),
        "clips": sorted(expected_names),
        "rootIdentity": True,
        "rootMotionGameplay": False,
        "simulationMutation": False,
        "directHumanoidAnimation": False,
        "outputs": [
            {"role": f"{args.age}Mobile", "file": skin_path.name, "bytes": skin_path.stat().st_size, "sha256": sha256(skin_path)},
            {"role": f"{args.age}AllClipsPreview", "file": preview_path.name, "bytes": preview_path.stat().st_size, "sha256": sha256(preview_path)},
        ],
    }
    output = Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
