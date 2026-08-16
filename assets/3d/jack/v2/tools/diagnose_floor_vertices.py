"""Report which rest vertices and weight groups cause lowest posed contact."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--mesh-name", required=True)
    parser.add_argument("--actions", nargs="+", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    mesh = bpy.data.objects[args.mesh_name]
    group_names = {group.index: group.name for group in mesh.vertex_groups}
    results = []
    for action_name in args.actions:
        action = bpy.data.actions[action_name]
        rig.animation_data.action = action
        action_result = {"action": action_name, "samples": []}
        for frame in range(int(math.floor(action.frame_range[0])), int(math.ceil(action.frame_range[1])) + 1):
            bpy.context.scene.frame_set(frame)
            evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            positions = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
            index = min(range(len(positions)), key=lambda item: positions[item].z)
            source_vertex = mesh.data.vertices[index]
            action_result["samples"].append({
                "frame": frame,
                "vertex": index,
                "posed": [round(value, 7) for value in positions[index]],
                "rest": [round(value, 7) for value in mesh.matrix_world @ source_vertex.co],
                "weights": sorted(
                    ({"group": group_names[item.group], "weight": round(item.weight, 7)} for item in source_vertex.groups),
                    key=lambda item: item["weight"],
                    reverse=True,
                ),
            })
        action_result["samples"] = sorted(action_result["samples"], key=lambda item: item["posed"][2])[:5]
        results.append(action_result)
    output = Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"schemaVersion": 1, "actions": results}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(output), "actions": args.actions}, indent=2))


if __name__ == "__main__":
    main()
