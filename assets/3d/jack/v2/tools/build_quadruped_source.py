"""Create the additive V2 Blender working source from Meshy's walking GLB.

This is an ingest checkpoint, not the final deformation repair. It preserves
Meshy's skeleton, weights, and Walking action while assigning stable working
names and project metadata.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one armature, found {len(armatures)}")
    if not meshes:
        raise RuntimeError("Expected at least one mesh")

    armature = armatures[0]
    weighted = max(meshes, key=lambda obj: len(obj.vertex_groups))
    helpers = [obj for obj in meshes if obj != weighted]
    armature.name = "Jack_Quadruped_Rig"
    armature.data.name = "Jack_Quadruped_Skeleton"
    weighted.name = "Jack_Baby_Mesh"
    weighted.data.name = "Jack_Baby_Geometry"
    for index, helper in enumerate(sorted(helpers, key=lambda obj: obj.name), start=1):
        helper.name = f"Meshy_Helper_NonDeforming_{index:02d}"
        helper.hide_render = True

    actions = list(bpy.data.actions)
    if len(actions) != 1:
        raise RuntimeError(f"Expected one Meshy action, found {len(actions)}")
    actions[0].name = "walking_meshy_baseline"

    scene = bpy.context.scene
    scene.name = "Jack_Baby_Quadruped_V2"
    scene.render.fps = 24
    scene.frame_start = 0
    scene.frame_end = 24
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["asset_version"] = "2.0.0-development"
    scene["source_pipeline"] = "Meshy Quadruped Dog Smart Rig; Blender repair source"
    scene["meshy_source_file"] = source.name
    scene["presentation_only"] = True
    scene["simulation_mutation"] = False
    scene["root_motion_gameplay"] = False
    scene["deformation_repair_status"] = "pending"
    scene["direct_humanoid_animation_allowed"] = False

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    print(
        {
            "output": str(output),
            "armature": armature.name,
            "bones": len(armature.data.bones),
            "weightedMesh": weighted.name,
            "action": actions[0].name,
        }
    )


if __name__ == "__main__":
    main()
