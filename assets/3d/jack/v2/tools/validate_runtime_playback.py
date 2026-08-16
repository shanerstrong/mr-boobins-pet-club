"""Round-trip the all-clips GLB and exercise every animation in Blender."""

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
    parser.add_argument("--glb", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def positions(mesh: bpy.types.Object) -> list[tuple[float, float, float]]:
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    matrix = evaluated.matrix_world
    return [tuple(matrix @ vertex.co) for vertex in evaluated.data.vertices]


def main() -> None:
    args = parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = max(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda obj: len(obj.vertex_groups),
    )
    root = bpy.data.objects.get("jack_root")
    expected = {clip["name"] for clip in manifest["clips"]}
    actual = {action.name for action in bpy.data.actions}
    clips = []
    for clip in manifest["clips"]:
        action = bpy.data.actions[clip["name"]]
        rig.animation_data_create()
        rig.animation_data.action = action
        start, end = action.frame_range
        frames = tuple(start + (end - start) * fraction for fraction in (0.0, 0.25, 0.5, 0.75, 1.0))
        samples = []
        finite = True
        for frame in frames:
            bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
            current = positions(mesh)
            finite = finite and all(math.isfinite(value) for position in current for value in position)
            samples.append(current)
        maximum_delta = max(
            math.dist(first, current)
            for sample_positions in samples[1:]
            for first, current in zip(samples[0], sample_positions, strict=True)
        )
        passed = finite and maximum_delta >= 0.00005
        clips.append({
            "name": clip["name"],
            "status": "pass" if passed else "fail",
            "frameRange": [round(start, 4), round(end, 4)],
            "finite": finite,
            "firstToSampleMaximumVertexDelta": round(maximum_delta, 6),
        })
    root_identity = bool(root and root.matrix_world.is_identity)
    report = {
        "schemaVersion": 1,
        "status": "pass" if actual == expected and root_identity and all(item["status"] == "pass" for item in clips) else "fail",
        "source": Path(args.glb).name,
        "blenderVersion": bpy.app.version_string,
        "clipCount": len(actual),
        "clipNamesExact": actual == expected,
        "rootIdentity": root_identity,
        "meshVertices": len(mesh.data.vertices),
        "clips": clips,
    }
    output = Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "clipCount": report["clipCount"],
        "failures": [item["name"] for item in clips if item["status"] != "pass"],
    }, indent=2))


if __name__ == "__main__":
    main()
