"""Build Jack's 28-clip V3 contract on the native Quaternius canine rig.

Native shepherd actions drive the high-risk quadruped motion. Jack's original
Sit/Paw/Up and celebration timing are reverse-retargeted only where the free
donor has no matching behavior. No humanoid animation is used.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


FPS = 30
IDENTITY = Quaternion((1.0, 0.0, 0.0, 0.0))

NATIVE = {
    "idle": "Idle",
    "walk": "Walk",
    "run": "Run",
    "tail_wag": "Idle_2",
    "feed": "Eating",
    "sleep": "Idle_2_HeadLow",
    "wake": "Idle_2",
    "play": "Run_Jump",
    "clean_reaction": "HitReact_Left",
    "boop_comfortable": "Idle_2",
    "boop_need_hunger": "Idle_2_HeadLow",
    "boop_need_energy": "Idle_2_HeadLow",
    "boop_need_hygiene": "HitReact_Left",
    "boop_need_happiness": "Idle_2",
    "boop_rejected": "HitReact_Right",
    "tired": "Idle_2_HeadLow",
    "dirty": "HitReact_Right",
    "death_rest": "Death",
    "training_attention": "Idle",
    "training_treat_eat": "Eating",
    "celebration_happy_hop": "Run_Jump",
    "training_return_idle": "Idle",
}

CUSTOM = {
    "training_sit",
    "training_paw",
    "training_up",
    "training_treat_receive",
    "celebration_spin_wag",
    "celebration_goofy_shimmy",
}

# target V3 bone -> source V2 bone, strength
REVERSE_MAPPING = {
    "Back": ("Hips", 0.88),
    "Torso": ("chest", 0.24),
    "Torso2": ("chest", 0.34),
    "Torso3": ("chest", 0.28),
    "Neck1": ("head", 0.16),
    "Neck2": ("head", 0.18),
    "Neck3": ("head", 0.20),
    "Head": ("head", 0.58),
    "Ear2.L": ("earend", 0.68),
    "Ear2.R": ("R_earend", 0.68),
    "FrontShoulder.L": ("frontleg", 0.94),
    "FrontUpperLeg.L": ("frontleg0", 1.0),
    "FrontLowerLeg.L": ("frontleg1", 1.0),
    "FrontShoulder.R": ("R_frontleg", 0.94),
    "FrontUpperLeg.R": ("R_frontleg0", 1.0),
    "FrontLowerLeg.R": ("R_frontleg1", 1.0),
    "BackShoulder.L": ("backleg", 0.92),
    "BackLeg.L": ("backleg0", 1.0),
    "BackUpperLeg.L": ("backleg1", 1.0),
    "BackLowerLeg.L": ("backleg2", 0.92),
    "BackShoulder.R": ("R_backleg", 0.92),
    "BackLeg.R": ("R_backleg0", 1.0),
    "BackUpperLeg.R": ("R_backleg1", 1.0),
    "BackLowerLeg.R": ("R_backleg2", 0.92),
    "Tail1": ("tail", 0.78),
    "Tail2": ("tailstart", 0.84),
    "Tail3": ("tail1", 0.90),
    "Tail3.001": ("tail2", 0.94),
    "Tail3.002": ("tail3", 0.96),
}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--v2-source", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def set_action(rig: bpy.types.Object, action: bpy.types.Action) -> None:
    rig.animation_data_create()
    rig.animation_data.action = action
    slots = getattr(action, "slots", None)
    if slots:
        rig.animation_data.action_slot_handle = slots[0].handle


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.rotation_quaternion = IDENTITY.copy()
        bone.scale = Vector((1.0, 1.0, 1.0))


def key_pose(rig: bpy.types.Object, frame: int) -> None:
    for bone in rig.pose.bones:
        bone.keyframe_insert("location", frame=frame, group=bone.name)
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
        bone.keyframe_insert("scale", frame=frame, group=bone.name)


def local_pose_delta(bone: bpy.types.PoseBone) -> Quaternion:
    rest = bone.bone.matrix_local
    pose = bone.matrix
    if bone.parent:
        rest = bone.parent.bone.matrix_local.inverted_safe() @ rest
        pose = bone.parent.matrix.inverted_safe() @ pose
    return (rest.to_quaternion().normalized().inverted() @ pose.to_quaternion().normalized()).normalized()


def root_pose_delta(source_bone: bpy.types.PoseBone, target_bone: bpy.types.PoseBone) -> Quaternion:
    source_rest = source_bone.bone.matrix_local.to_quaternion().normalized()
    source_pose = source_bone.matrix.to_quaternion().normalized()
    armature_delta = (source_pose @ source_rest.inverted()).normalized()
    target_rest = target_bone.bone.matrix_local.to_quaternion().normalized()
    return (target_rest.inverted() @ armature_delta @ target_rest).normalized()


def native_action(short_name: str) -> bpy.types.Action:
    preferred = f"AnimalArmature|{short_name}"
    if preferred in bpy.data.actions:
        return bpy.data.actions[preferred]
    matches = [action for action in bpy.data.actions if action.name.endswith(f"|{short_name}") and not action.name.startswith("V2_Source__")]
    if not matches:
        raise KeyError(short_name)
    return min(matches, key=lambda action: len(action.name))


def make_output_action(rig: bpy.types.Object, name: str, end_frame: int, loop: bool) -> bpy.types.Action:
    action = bpy.data.actions.new(name=name)
    action.frame_start = 0
    action.frame_end = end_frame
    action.use_frame_range = True
    action.use_fake_user = True
    action["jack_contract"] = True
    action["loop"] = loop
    set_action(rig, action)
    return action


def build_native(rig: bpy.types.Object, name: str, source: bpy.types.Action, end_frame: int, loop: bool) -> bpy.types.Action:
    output = make_output_action(rig, name, end_frame, loop)
    source_start, source_end = source.frame_range
    captured_first = None
    for frame in range(end_frame + 1):
        fraction = frame / max(end_frame, 1)
        if loop and frame == end_frame:
            fraction = 0.0
        source_frame = source_start + (source_end - source_start) * fraction
        set_action(rig, source)
        bpy.context.scene.frame_set(int(math.floor(source_frame)), subframe=source_frame % 1.0)
        bpy.context.view_layer.update()
        capture = {
            bone.name: (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy())
            for bone in rig.pose.bones
        }
        if frame == 0:
            captured_first = capture
        if loop and frame == end_frame and captured_first is not None:
            capture = captured_first
        set_action(rig, output)
        reset_pose(rig)
        for bone in rig.pose.bones:
            location, rotation, scale = capture[bone.name]
            bone.location = location
            bone.rotation_quaternion = rotation
            bone.scale = scale
        key_pose(rig, frame)
    return output


def build_custom(
    target: bpy.types.Object,
    source_rig: bpy.types.Object,
    name: str,
    source_action: bpy.types.Action,
    end_frame: int,
    loop: bool,
) -> bpy.types.Action:
    output = make_output_action(target, name, end_frame, loop)
    source_start, source_end = source_action.frame_range
    first_capture = None
    for frame in range(end_frame + 1):
        fraction = frame / max(end_frame, 1)
        if loop and frame == end_frame:
            fraction = 0.0
        source_frame = source_start + (source_end - source_start) * fraction
        set_action(source_rig, source_action)
        bpy.context.scene.frame_set(int(math.floor(source_frame)), subframe=source_frame % 1.0)
        bpy.context.view_layer.update()
        reset_pose(target)
        for target_name, (source_name, strength) in REVERSE_MAPPING.items():
            source_bone = source_rig.pose.bones[source_name]
            target_bone = target.pose.bones[target_name]
            delta = root_pose_delta(source_bone, target_bone) if target_name == "Back" else local_pose_delta(source_bone)
            target_bone.rotation_quaternion = IDENTITY.slerp(delta, strength)
        source_hips = source_rig.pose.bones["Hips"]
        source_delta = source_hips.matrix.to_translation() - source_hips.bone.matrix_local.to_translation()
        target_body = target.pose.bones["Body"]
        target_body.location = target_body.bone.matrix_local.to_quaternion().inverted() @ (source_delta * 0.82)
        capture = {
            bone.name: (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy())
            for bone in target.pose.bones
        }
        if frame == 0:
            first_capture = capture
        if loop and frame == end_frame and first_capture is not None:
            capture = first_capture
        set_action(target, output)
        reset_pose(target)
        for bone in target.pose.bones:
            location, rotation, scale = capture[bone.name]
            bone.location = location
            bone.rotation_quaternion = rotation
            bone.scale = scale
        key_pose(target, frame)
    return output


def append_v2_source(path: Path) -> tuple[bpy.types.Object, dict[str, bpy.types.Action]]:
    before = set(bpy.data.actions)
    with bpy.data.libraries.load(str(path), link=False) as (data_from, data_to):
        data_to.objects = [name for name in data_from.objects if name == "Jack_Quadruped_Rig"]
        data_to.actions = [name for name in data_from.actions if name in CUSTOM]
    rig = next(obj for obj in data_to.objects if obj is not None)
    if rig.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(rig)
    loaded = [action for action in bpy.data.actions if action not in before and action.name in CUSTOM]
    actions = {}
    for action in loaded:
        original = action.name
        action.name = f"V2_Source__{original}"
        actions[original] = action
    return rig, actions


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    v2_path = Path(args.v2_source).resolve()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding="utf-8"))
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()

    bpy.ops.wm.open_mainfile(filepath=str(input_path), load_ui=False)
    target = bpy.data.objects["Jack_Quadruped_Rig_V3"]
    for track in target.animation_data.nla_tracks if target.animation_data else []:
        track.mute = True
    source_rig, source_actions = append_v2_source(v2_path)
    for track in source_rig.animation_data.nla_tracks if source_rig.animation_data else []:
        track.mute = True

    built = []
    for clip in manifest["clips"]:
        name = clip["name"]
        end_frame = round(clip["durationMs"] * FPS / 1000)
        loop = bool(clip["loop"])
        if name in CUSTOM:
            action = build_custom(target, source_rig, name, source_actions[name], end_frame, loop)
            source_class = "original-jack-v2-reverse-retargeted-to-native-canine-rig"
        else:
            donor_name = NATIVE[name]
            action = build_native(target, name, native_action(donor_name), end_frame, loop)
            source_class = f"quaternius-native-{donor_name.lower()}"
        action["source_class"] = source_class
        built.append({"name": name, "frames": end_frame, "sourceClass": source_class})

    bpy.data.objects.remove(source_rig, do_unlink=True)
    target.animation_data.action = None
    bpy.context.scene.frame_set(0)
    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), check_existing=False)
    report = {
        "schemaVersion": 1,
        "status": "v3-action-library-built",
        "input": input_path.name,
        "output": output.name,
        "clipCount": len(built),
        "nativeClipCount": len(built) - len(CUSTOM),
        "reverseRetargetedClipCount": len(CUSTOM),
        "directHumanoidAnimation": False,
        "rootMotionGameplay": False,
        "clips": built,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
