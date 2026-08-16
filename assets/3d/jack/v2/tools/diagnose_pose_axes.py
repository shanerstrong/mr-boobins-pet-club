"""Report how key Meshy bones move landmarks for local-axis test rotations."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion, Vector


def args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def reset(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.location = Vector((0, 0, 0))
        bone.rotation_quaternion = Quaternion((1, 0, 0, 0))
        bone.scale = Vector((1, 1, 1))


def landmarks(rig: bpy.types.Object) -> dict:
    result = {}
    for name in ("Hips", "chest", "head", "frontleg2", "R_frontleg2", "backleg2", "R_backleg2", "tail3"):
        bone = rig.pose.bones[name]
        head = rig.matrix_world @ bone.head
        tail = rig.matrix_world @ bone.tail
        result[name] = {
            "head": [round(value, 5) for value in head],
            "tail": [round(value, 5) for value in tail],
        }
    return result


def main() -> None:
    parsed = args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(parsed.blend).resolve()))
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    rig.animation_data.action = None
    tests = [{"name": "neutral", "landmarks": landmarks(rig)}]
    for bone_name in ("Hips", "chest", "frontleg", "frontleg0", "backleg", "backleg0", "backleg1"):
        for axis in range(3):
            reset(rig)
            angles = [0.0, 0.0, 0.0]
            angles[axis] = math.radians(30.0)
            rig.pose.bones[bone_name].rotation_quaternion = Euler(tuple(angles), "XYZ").to_quaternion()
            bpy.context.view_layer.update()
            tests.append({"name": f"{bone_name}_{'XYZ'[axis]}_30", "landmarks": landmarks(rig)})
    for bone_name in ("Hips", "chest"):
        for axis in range(3):
            reset(rig)
            location = [0.0, 0.0, 0.0]
            location[axis] = 0.01
            rig.pose.bones[bone_name].location = Vector(location)
            bpy.context.view_layer.update()
            tests.append({"name": f"{bone_name}_loc_{'XYZ'[axis]}_001", "landmarks": landmarks(rig)})
    output = Path(parsed.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"tests": tests}, indent=2) + "\n", encoding="utf-8")
    print(str(output))


if __name__ == "__main__":
    main()
