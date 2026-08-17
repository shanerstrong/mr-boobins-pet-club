"""Bind the approved Meshy Jack skin to the native Quaternius canine rig."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


GROUP_MAP = {
    "Hips": "Back",
    "chest": "Torso2",
    "head": "Head",
    "headend": "Head",
    "earend": "Ear2.L",
    "R_earend": "Ear2.R",
    "frontleg": "FrontShoulder.L",
    "frontleg0": "FrontUpperLeg.L",
    "frontleg1": "FrontLowerLeg.L",
    "frontleg2": "FrontLowerLeg.L",
    "R_frontleg": "FrontShoulder.R",
    "R_frontleg0": "FrontUpperLeg.R",
    "R_frontleg1": "FrontLowerLeg.R",
    "R_frontleg2": "FrontLowerLeg.R",
    "backleg": "BackShoulder.L",
    "backleg0": "BackLeg.L",
    "backleg1": "BackUpperLeg.L",
    "backleg2": "BackLowerLeg.L",
    "R_backleg": "BackShoulder.R",
    "R_backleg0": "BackLeg.R",
    "R_backleg1": "BackUpperLeg.R",
    "R_backleg2": "BackLowerLeg.R",
    "tail": "Tail1",
    "tailstart": "Tail2",
    "tail1": "Tail3",
    "tail2": "Tail3.001",
    "tail3": "Tail3.002",
}

ANCHORS = {
    "head": ("Head", (0.0, -0.55, 0.76)),
    "nose_visual": ("Head", (0.0, -0.70, 0.68)),
    "hit_nose": ("Head", (0.0, -0.71, 0.68)),
    "mouth_anchor": ("Head", (0.0, -0.68, 0.61)),
    "collar": ("Neck1", (0.0, -0.32, 0.62)),
    "tag": ("Neck1", (0.0, -0.36, 0.53)),
    "tail_base": ("Tail1", (0.0, 0.49, 0.51)),
    "paw_front_l": ("FrontLowerLeg.L", (0.13, -0.40, 0.03)),
    "paw_front_r": ("FrontLowerLeg.R", (-0.13, -0.40, 0.03)),
}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--native-rig", required=True)
    parser.add_argument("--meshy-source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def append_meshy(path: Path) -> tuple[bpy.types.Object, bpy.types.Object]:
    with bpy.data.libraries.load(str(path), link=False) as (data_from, data_to):
        data_to.objects = [name for name in data_from.objects if name in {"Jack_Baby_Mesh", "Jack_Quadruped_Rig"}]
    loaded = {obj.name: obj for obj in data_to.objects if obj is not None}
    for obj in loaded.values():
        if obj.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(obj)
    return loaded["Jack_Baby_Mesh"], loaded["Jack_Quadruped_Rig"]


def copy_weights(source: bpy.types.Object, target: bpy.types.Object) -> None:
    target.vertex_groups.clear()
    target_groups = {name: target.vertex_groups.new(name=name) for name in sorted(set(GROUP_MAP.values()))}
    source_group_names = {group.index: group.name for group in source.vertex_groups}
    for vertex in source.data.vertices:
        accumulated: dict[str, float] = {}
        for membership in vertex.groups:
            source_name = source_group_names[membership.group]
            target_name = GROUP_MAP.get(source_name)
            if target_name:
                accumulated[target_name] = accumulated.get(target_name, 0.0) + membership.weight
        total = sum(accumulated.values())
        if total <= 0.0:
            accumulated = {"Back": 1.0}
            total = 1.0
        for target_name, weight in accumulated.items():
            target_groups[target_name].add([vertex.index], weight / total, "REPLACE")


def add_anchor_bones(rig: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (parent_name, world_location) in ANCHORS.items():
        if rig.data.edit_bones.get(name):
            continue
        parent = rig.data.edit_bones[parent_name]
        head = rig.matrix_world.inverted() @ Vector(world_location)
        bone = rig.data.edit_bones.new(name)
        bone.head = head
        bone.tail = head + Vector((0.0, 0.0, 0.03 / max(rig.scale.z, 0.0001)))
        bone.parent = parent
        bone.use_connect = False
        bone.use_deform = False
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)


def main() -> None:
    args = parse_args()
    native_path = Path(args.native_rig).resolve()
    meshy_path = Path(args.meshy_source).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()

    bpy.ops.wm.open_mainfile(filepath=str(native_path), load_ui=False)
    native_rig = bpy.data.objects["AnimalArmature"]
    donor_mesh = bpy.data.objects["GermanShepherd"]
    meshy_mesh, meshy_rig = append_meshy(meshy_path)
    meshy_rig.data.pose_position = "REST"
    bpy.context.view_layer.update()

    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = meshy_mesh.evaluated_get(depsgraph)
    baked_mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    baked_mesh.transform(meshy_mesh.matrix_world)
    # Match the donor rig's long shepherd proportions while preserving the
    # approved Meshy likeness and texture topology.
    baked_mesh.transform(Matrix.Diagonal((0.86, 1.39, 0.876, 1.0)))
    baked_mesh.transform(Matrix.Translation(Vector((0.0, 0.02, -0.0015))))
    body = bpy.data.objects.new("Jack_V3_Body", baked_mesh)
    bpy.context.collection.objects.link(body)
    copy_weights(meshy_mesh, body)
    modifier = body.modifiers.new(name="Jack_V3_Native_Canine_Rig", type="ARMATURE")
    modifier.object = native_rig
    body.parent = native_rig
    body.matrix_parent_inverse = native_rig.matrix_world.inverted_safe()

    bpy.data.objects.remove(meshy_mesh, do_unlink=True)
    bpy.data.objects.remove(meshy_rig, do_unlink=True)
    bpy.data.objects.remove(donor_mesh, do_unlink=True)

    root = bpy.data.objects.new("jack_root", None)
    bpy.context.collection.objects.link(root)
    native_rig.parent = root
    native_rig.name = "Jack_Quadruped_Rig_V3"
    add_anchor_bones(native_rig)

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.fps = 30
    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), check_existing=False)

    baked_mesh.calc_loop_triangles()
    report = {
        "schemaVersion": 1,
        "status": "meshy-skin-bound-to-native-canine-rig",
        "nativeRigSource": native_path.name,
        "meshySkinSource": meshy_path.name,
        "output": output.name,
        "triangles": len(baked_mesh.loop_triangles),
        "vertices": len(baked_mesh.vertices),
        "boneCount": len(native_rig.data.bones),
        "weightedBoneGroups": sorted(group.name for group in body.vertex_groups),
        "semanticAnchorBones": sorted(ANCHORS),
        "axisScaleApplied": [0.86, 1.39, 0.876],
        "directHumanoidAnimation": False,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
