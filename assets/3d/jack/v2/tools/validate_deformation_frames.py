"""Sample every authored frame and reject exploding, non-finite, or below-floor deformation."""

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
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--mesh-name", default="Jack_Baby_Mesh")
    parser.add_argument("--maximum-height", type=float, default=1.35)
    parser.add_argument("--maximum-span", type=float, default=1.75)
    return parser.parse_args(forwarded)


def evaluated_positions(mesh: bpy.types.Object) -> list[tuple[float, float, float]]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    matrix = evaluated.matrix_world
    return [tuple(matrix @ vertex.co) for vertex in evaluated.data.vertices]


def main() -> None:
    args = parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    mesh = bpy.data.objects[args.mesh_name]
    root = bpy.data.objects["jack_root"]
    reports = []
    overall_pass = True
    for clip in manifest["clips"]:
        action = bpy.data.actions[clip["name"]]
        rig.animation_data.action = action
        start, end = action.frame_range
        sampled_frames = sorted(set(range(int(math.floor(start)), int(math.ceil(end)) + 1)) | {int(start), int(end)})
        minimum_z = float("inf")
        maximum_height = 0.0
        minimum_height = float("inf")
        maximum_span = 0.0
        finite = True
        first_positions = None
        last_positions = None
        for frame in sampled_frames:
            bpy.context.scene.frame_set(frame)
            positions = evaluated_positions(mesh)
            finite = finite and all(math.isfinite(value) for position in positions for value in position)
            mins = [min(position[axis] for position in positions) for axis in range(3)]
            maxs = [max(position[axis] for position in positions) for axis in range(3)]
            spans = [maxs[axis] - mins[axis] for axis in range(3)]
            minimum_z = min(minimum_z, mins[2])
            minimum_height = min(minimum_height, spans[2])
            maximum_height = max(maximum_height, spans[2])
            maximum_span = max(maximum_span, *spans)
            if frame == int(start):
                first_positions = positions
            if frame == int(end):
                last_positions = positions
        closure = 0.0
        if clip["loop"] and first_positions and last_positions:
            closure = max(
                math.dist(first, last)
                for first, last in zip(first_positions, last_positions, strict=True)
            )
        passed = (
            finite
            and minimum_z >= -0.005
            and minimum_height >= 0.35
            and maximum_height <= args.maximum_height
            and maximum_span <= args.maximum_span
            and (not clip["loop"] or closure <= 0.002)
        )
        overall_pass = overall_pass and passed
        reports.append({
            "name": clip["name"],
            "status": "pass" if passed else "fail",
            "sampledFrameCount": len(sampled_frames),
            "finite": finite,
            "minimumZ": round(minimum_z, 6),
            "heightRange": [round(minimum_height, 6), round(maximum_height, 6)],
            "maximumSpan": round(maximum_span, 6),
            "loopClosureMaximumVertexDelta": round(closure, 6),
        })
    report = {
        "schemaVersion": 1,
        "status": "pass" if overall_pass else "fail",
        "blenderVersion": bpy.app.version_string,
        "clipCount": len(reports),
        "vertexCount": len(mesh.data.vertices),
        "rootIdentity": root.matrix_world.is_identity,
        "criteria": {
            "finiteVertices": True,
            "floorPenetrationMaximumMeters": 0.005,
            "heightMeters": [0.35, args.maximum_height],
            "maximumAnyAxisSpanMeters": args.maximum_span,
            "loopClosureMaximumVertexDeltaMeters": 0.002,
        },
        "clips": reports,
    }
    if not report["rootIdentity"]:
        report["status"] = "fail"
    output = Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "clipCount": report["clipCount"],
        "failures": [item["name"] for item in reports if item["status"] != "pass"],
    }, indent=2))


if __name__ == "__main__":
    main()
