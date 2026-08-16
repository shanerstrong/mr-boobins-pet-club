"""Inspect a third-party Blender animation donor without modifying it."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    args = parse_args()
    source = Path(args.blend).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)

    actions = []
    for action in sorted(bpy.data.actions, key=lambda item: item.name.lower()):
        start, end = action.frame_range
        actions.append({
            "name": action.name,
            "frameStart": round(float(start), 4),
            "frameEnd": round(float(end), 4),
            "durationFrames": round(float(end - start), 4),
            "fCurveCount": len(action.fcurves),
        })

    armatures = []
    donor_rigs = []
    for obj in sorted(
        (item for item in bpy.data.objects if item.type == "ARMATURE"),
        key=lambda item: item.name.lower(),
    ):
        armatures.append({
            "object": obj.name,
            "boneCount": len(obj.data.bones),
            "bones": [bone.name for bone in obj.data.bones],
        })
        donor_rigs.append(obj)

    motion_ranges = {}
    pose_samples = {}
    if donor_rigs and donor_rigs[0].pose.bones.get("Body"):
        rig = donor_rigs[0]
        rig.animation_data_create()
        rest = rig.pose.bones["Body"].bone.matrix_local.to_translation()
        for action in bpy.data.actions:
            rig.animation_data.action = action
            low = Vector((float("inf"),) * 3)
            high = Vector((float("-inf"),) * 3)
            start, end = action.frame_range
            for frame in range(int(start), int(end) + 1):
                bpy.context.scene.frame_set(frame)
                bpy.context.view_layer.update()
                delta = rig.pose.bones["Body"].matrix.to_translation() - rest
                low = Vector(tuple(min(low[i], delta[i]) for i in range(3)))
                high = Vector(tuple(max(high[i], delta[i]) for i in range(3)))
            motion_ranges[action.name] = {
                "bodyTranslationMin": [round(value, 6) for value in low],
                "bodyTranslationMax": [round(value, 6) for value in high],
            }
            samples = []
            for fraction in (0.0, 0.5, 1.0):
                sample_frame = start + (end - start) * fraction
                bpy.context.scene.frame_set(int(sample_frame), subframe=sample_frame % 1.0)
                bpy.context.view_layer.update()
                bones = {}
                for bone_name in ("Body", "Back", "Torso", "Torso2", "Torso3", "Head"):
                    bone = rig.pose.bones.get(bone_name)
                    if bone:
                        euler = bone.matrix.to_euler("XYZ")
                        bones[bone_name] = [round(value, 6) for value in euler]
                samples.append({"fraction": fraction, "armatureEulerRadians": bones})
            pose_samples[action.name] = samples

    report = {
        "schemaVersion": 1,
        "status": "inspected-read-only",
        "source": source.name,
        "sourceBytes": source.stat().st_size,
        "sourceSha256": sha256(source),
        "blenderVersion": bpy.app.version_string,
        "sceneFps": bpy.context.scene.render.fps,
        "armatures": armatures,
        "actionCount": len(actions),
        "actions": actions,
        "motionRanges": motion_ranges,
        "poseSamples": pose_samples,
    }
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
