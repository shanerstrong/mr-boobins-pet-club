"""Record donor canine control transforms for reproducible retarget diagnosis."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion


ACTIONS = {
    "Death": [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    "Eating": [0.0, 0.25, 0.5, 0.75, 1.0],
    "Attack": [0.0, 0.25, 0.5, 0.75, 1.0],
    "Gallop_Jump": [0.0, 0.25, 0.5, 0.75, 1.0],
}
BONES = [
    "Body",
    "Back",
    "Torso2",
    "Head",
    "FrontShoulder.L",
    "FrontUpperLeg.L",
    "FrontLowerLeg.L",
    "FrontShoulder.R",
    "FrontUpperLeg.R",
    "FrontLowerLeg.R",
    "BackShoulder.L",
    "BackLeg.L",
    "BackUpperLeg.L",
    "BackLowerLeg.L",
    "BackShoulder.R",
    "BackLeg.R",
    "BackUpperLeg.R",
    "BackLowerLeg.R",
]


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def rounded(values) -> list[float]:
    return [round(float(value), 6) for value in values]


def local_delta(bone: bpy.types.PoseBone) -> Quaternion:
    rest = bone.bone.matrix_local
    pose = bone.matrix
    if bone.parent:
        rest = bone.parent.bone.matrix_local.inverted_safe() @ rest
        pose = bone.parent.matrix.inverted_safe() @ pose
    return (rest.to_quaternion().normalized().inverted() @ pose.to_quaternion().normalized()).normalized()


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    rig = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    rig.animation_data_create()
    samples: dict[str, list[dict]] = {}
    for action_name, fractions in ACTIONS.items():
        action = bpy.data.actions[action_name]
        rig.animation_data.action = action
        start, end = action.frame_range
        action_samples = []
        for fraction in fractions:
            frame = start + (end - start) * fraction
            bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
            bpy.context.view_layer.update()
            bones = {}
            for bone_name in BONES:
                bone = rig.pose.bones[bone_name]
                bones[bone_name] = {
                    "location": rounded(bone.matrix.to_translation()),
                    "rotationWxyz": rounded(bone.matrix.to_quaternion()),
                    "localDeltaWxyz": rounded(local_delta(bone)),
                    "localDeltaEulerXyz": rounded(local_delta(bone).to_euler("XYZ")),
                }
            action_samples.append({"fraction": fraction, "frame": frame, "bones": bones})
        samples[action_name] = action_samples
    payload = {
        "schemaVersion": 1,
        "donor": Path(args.blend).name,
        "rig": rig.name,
        "samples": samples,
    }
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "actions": sorted(samples)}, indent=2))


if __name__ == "__main__":
    main()
