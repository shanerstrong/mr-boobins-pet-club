"""Author Jack's dog-specific V2 action library on the repair-A rig.

This is an additive repair-B pass.  It never edits the preserved Meshy GLBs or
the repair-A blend.  Motions are deliberately restrained and in-place; Meshy's
quadruped walk is the only external motion source, and humanoid motion is never
applied or retargeted.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion, Vector


FPS = 30


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--events", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
        bone.scale = Vector((1.0, 1.0, 1.0))


def merge_pose(*poses: dict) -> dict:
    result: dict = {}
    for pose in poses:
        for bone, values in pose.items():
            target = result.setdefault(bone, {})
            for channel, value in values.items():
                if channel in target:
                    target[channel] = tuple(a + b for a, b in zip(target[channel], value))
                else:
                    target[channel] = tuple(value)
    return result


def mirror_pose(pose: dict, factor: float = -1.0) -> dict:
    mirrored = {}
    for bone, values in pose.items():
        mirrored[bone] = {}
        for channel, value in values.items():
            values_copy = list(value)
            if channel == "rot":
                values_copy[1] *= factor
                values_copy[2] *= factor
            elif channel == "loc":
                values_copy[0] *= factor
            mirrored[bone][channel] = tuple(values_copy)
    return mirrored


def apply_pose(rig: bpy.types.Object, pose: dict) -> None:
    reset_pose(rig)
    for bone_name, values in pose.items():
        bone = rig.pose.bones.get(bone_name)
        if bone is None:
            raise KeyError(f"Missing pose bone: {bone_name}")
        if "rot" in values:
            bone.rotation_quaternion = Euler(
                tuple(math.radians(angle) for angle in values["rot"]), "XYZ"
            ).to_quaternion()
        if "loc" in values:
            bone.location = Vector(values["loc"])
        if "scale" in values:
            bone.scale = Vector(values["scale"])


def key_pose(rig: bpy.types.Object, frame: float, pose: dict) -> None:
    apply_pose(rig, pose)
    for bone in rig.pose.bones:
        bone.keyframe_insert("location", frame=frame, group=bone.name)
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
        bone.keyframe_insert("scale", frame=frame, group=bone.name)


def make_action(
    rig: bpy.types.Object,
    name: str,
    duration_ms: int,
    loop: bool,
    keys: list[tuple[float, dict]],
    source: str = "original Blender dog action",
) -> bpy.types.Action:
    existing = bpy.data.actions.get(name)
    if existing:
        bpy.data.actions.remove(existing)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action["duration_ms"] = duration_ms
    action["loop"] = loop
    action["in_place"] = True
    action["root_motion_gameplay"] = False
    action["simulation_mutation"] = False
    action["direct_humanoid_animation"] = False
    action["source"] = source
    rig.animation_data_create()
    rig.animation_data.action = action
    end = duration_ms * FPS / 1000.0
    for fraction, pose in keys:
        key_pose(rig, end * fraction, pose)
    for curve in getattr(action, "fcurves", []):
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
    reset_pose(rig)
    return action


def retime_action(action: bpy.types.Action, target_end_frame: float) -> None:
    start, current_end = action.frame_range
    span = current_end - start
    if span <= 1e-8:
        raise RuntimeError(f"Action {action.name} has no duration")
    factor = target_end_frame / span
    for curve in getattr(action, "fcurves", []):
        for point in curve.keyframe_points:
            point.co.x = (point.co.x - start) * factor
            point.handle_left.x = (point.handle_left.x - start) * factor
            point.handle_right.x = (point.handle_right.x - start) * factor


def capture_action_pose(
    rig: bpy.types.Object,
    action_name: str,
    frame: float,
    bone_names: tuple[str, ...],
    factor: float,
) -> dict:
    action = bpy.data.actions[action_name]
    rig.animation_data.action = action
    bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame % 1.0)
    captured = {}
    identity = Quaternion((1.0, 0.0, 0.0, 0.0))
    for bone_name in bone_names:
        bone = rig.pose.bones[bone_name]
        euler = identity.slerp(bone.rotation_quaternion, factor).to_euler("XYZ")
        captured[bone_name] = {
            "loc": tuple(value * factor for value in bone.location),
            "rot": tuple(math.degrees(value) for value in euler),
        }
    reset_pose(rig)
    return captured


def pose_library(rig: bpy.types.Object) -> dict[str, dict]:
    hind_names = (
        "backleg", "backleg0", "backleg1", "backleg2",
        "R_backleg", "R_backleg0", "R_backleg1", "R_backleg2",
    )
    all_leg_names = hind_names + (
        "frontleg", "frontleg0", "frontleg1", "frontleg2",
        "R_frontleg", "R_frontleg0", "R_frontleg1", "R_frontleg2",
    )
    meshy_hind_crouch = capture_action_pose(
        rig, "walking_meshy_baseline", 18.0, hind_names, 0.82
    )
    meshy_full_crouch = capture_action_pose(
        rig, "walking_meshy_baseline", 18.0, all_leg_names, 0.72
    )
    neutral: dict = {}
    head_up = {"head": {"rot": (-7, 0, 0)}, "headend": {"rot": (-4, 0, 0)}}
    head_down = {"head": {"rot": (24, 0, 0)}, "headend": {"rot": (14, 0, 0)}}
    head_left = {"head": {"rot": (0, 0, 9)}, "headend": {"rot": (0, 0, 4)}}
    head_right = mirror_pose(head_left)
    blink = {"head": {"rot": (2, 0, 0)}}
    tail_left = {
        "tail": {"rot": (0, 0, 8)}, "tailstart": {"rot": (0, 0, 13)},
        "tail1": {"rot": (0, 0, 16)}, "tail2": {"rot": (0, 0, 12)},
        "tail3": {"rot": (0, 0, 7)},
    }
    tail_right = mirror_pose(tail_left)
    bow = {
        "Hips": {"loc": (0, 0, 0.04)}, "chest": {"loc": (0, 0, 0.055), "rot": (5, 0, 0)},
        "frontleg": {"rot": (-18, 0, 0)}, "frontleg0": {"rot": (-12, 0, 0)},
        "R_frontleg": {"rot": (-18, 0, 0)}, "R_frontleg0": {"rot": (-12, 0, 0)},
        "head": {"rot": (22, 0, 0)},
    }
    sit = merge_pose(meshy_hind_crouch, {
        "Hips": {"loc": (0, 0, 0.18)}, "chest": {"loc": (0, 0, -0.17), "rot": (-4, 0, 0)},
        "head": {"rot": (-4, 0, 0)},
    })
    paw = merge_pose(sit, {
        "R_frontleg": {"rot": (-30, 0, 0)}, "R_frontleg0": {"rot": (35, 0, 0)},
        "R_frontleg1": {"rot": (-28, 0, 0)}, "R_frontleg2": {"rot": (12, 0, 0)},
        "head": {"rot": (0, 0, -5)},
    })
    up = {
        "Hips": {"loc": (0, -0.015, -0.08), "rot": (-44, 0, 0)},
        "chest": {"rot": (15, 0, 0)}, "head": {"rot": (12, 0, 0)},
        "frontleg": {"rot": (-48, 0, 0)}, "frontleg0": {"rot": (48, 0, 0)},
        "frontleg1": {"rot": (-28, 0, 0)},
        "R_frontleg": {"rot": (-48, 0, 0)}, "R_frontleg0": {"rot": (48, 0, 0)},
        "R_frontleg1": {"rot": (-28, 0, 0)},
        "backleg": {"rot": (8, 0, 0)}, "backleg0": {"rot": (8, 0, 0)},
        "R_backleg": {"rot": (8, 0, 0)}, "R_backleg0": {"rot": (8, 0, 0)},
    }
    sleep = merge_pose(meshy_full_crouch, {
        "Hips": {"loc": (0, 0, 0.20), "rot": (0, 0, 7)},
        "chest": {"loc": (0, 0, 0.12), "rot": (10, 0, 8)}, "head": {"rot": (28, 0, 9)},
        "headend": {"rot": (10, 0, 0)},
    })
    return locals()


def build_custom_actions(rig: bpy.types.Object, clips: list[dict]) -> list[bpy.types.Action]:
    p = pose_library(rig)
    n = p["neutral"]
    sequences: dict[str, list[tuple[float, dict]]] = {
        "idle": [(0,n),(.25,p["head_up"]),(.5,n),(.75,p["blink"]),(1,n)],
        "tail_wag": [(0,p["tail_left"]),(.25,n),(.5,p["tail_right"]),(.75,n),(1,p["tail_left"])],
        "feed": [(0,n),(.18,p["head_down"]),(.36,merge_pose(p["head_down"],p["bow"])),(.48,p["bow"]),(.65,merge_pose(p["bow"],p["head_down"])),(.82,p["head_down"]),(1,n)],
        "sleep": [(0,p["sleep"]),(.5,merge_pose(p["sleep"],{"chest":{"scale":(1.0,1.0,1.025)}})),(1,p["sleep"])],
        "wake": [(0,p["sleep"]),(.35,merge_pose(p["sleep"],p["head_up"])),(.78,p["sit"]),(1,n)],
        "play": [(0,n),(.18,p["bow"]),(.35,merge_pose(p["bow"],p["tail_left"])),(.52,merge_pose(p["bow"],p["tail_right"])),(.70,{"Hips":{"loc":(0,0,0.055)},"chest":{"rot":(-5,0,0)}}),(.86,p["tail_left"]),(1,n)],
        "clean_reaction": [(0,n),(.267,p["head_left"]),(.533,p["head_right"]),(.67,merge_pose(p["head_left"],p["tail_right"])),(.767,merge_pose(p["head_right"],p["tail_left"])),(1,n)],
        "boop_comfortable": [(0,n),(.2,p["head_up"]),(.55,merge_pose(p["head_up"],p["tail_left"])),(1,n)],
        "boop_need_hunger": [(0,n),(.45,p["head_down"]),(1,n)],
        "boop_need_energy": [(0,n),(.45,merge_pose(p["head_down"],{"chest":{"rot":(5,0,0)}})),(1,n)],
        "boop_need_hygiene": [(0,n),(.28,p["head_left"]),(.55,p["head_right"]),(1,n)],
        "boop_need_happiness": [(0,n),(.25,p["head_up"]),(.5,p["tail_left"]),(.75,p["tail_right"]),(1,n)],
        "boop_rejected": [(0,n),(.35,p["head_right"]),(.7,p["head_left"]),(1,n)],
        "tired": [(0,p["head_down"]),(.5,merge_pose(p["head_down"],{"chest":{"rot":(4,0,0)}})),(1,p["head_down"])],
        "dirty": [(0,n),(.2,p["head_left"]),(.4,p["head_right"]),(.6,p["head_left"]),(.8,p["head_right"]),(1,n)],
        "death_rest": [(0,n),(.35,p["sit"]),(.72,p["sleep"]),(1,p["sleep"])],
        "training_attention": [(0,n),(.35,p["head_up"]),(.65,merge_pose(p["head_up"],p["head_left"])),(1,p["head_up"])],
        "training_sit": [(0,n),(.66,p["sit"]),(1,p["sit"])],
        "training_paw": [(0,p["sit"]),(.28,p["paw"]),(.60,p["paw"]),(.82,p["sit"]),(1,p["sit"])],
        "training_up": [(0,n),(.30,p["sit"]),(.55,p["up"]),(.72,p["up"]),(.91,p["sit"]),(1,n)],
        "training_treat_receive": [(0,p["head_up"]),(.35,merge_pose(p["head_up"],{"headend":{"rot":(-8,0,0)}})),(.60,merge_pose(p["head_up"],{"headend":{"rot":(10,0,0)}})),(.80,p["head_up"]),(1,n)],
        "training_treat_eat": [(0,p["head_up"]),(.22,merge_pose(p["head_up"],{"headend":{"rot":(7,0,0)}})),(.50,merge_pose(p["head_up"],{"headend":{"rot":(-6,0,0)}})),(.78,merge_pose(p["head_up"],{"headend":{"rot":(6,0,0)}})),(1,n)],
        "celebration_happy_hop": [(0,n),(.25,p["bow"]),(.42,{"Hips":{"loc":(0,0,0.075)},"chest":{"rot":(-7,0,0)}}),(.57,merge_pose(p["tail_left"],{"Hips":{"loc":(0,0,0.02)}})),(.78,p["tail_right"]),(1,n)],
        "celebration_spin_wag": [(0,merge_pose(n,p["tail_left"])),(.25,merge_pose({"Hips":{"rot":(0,0,90)}},p["tail_right"])),(.5,merge_pose({"Hips":{"rot":(0,0,180)}},p["tail_left"])),(.75,merge_pose({"Hips":{"rot":(0,0,270)}},p["tail_right"])),(1,merge_pose({"Hips":{"rot":(0,0,360)}},p["tail_left"]))],
        "celebration_goofy_shimmy": [(0,n),(.25,merge_pose(p["up"],{"chest":{"rot":(0,0,8)},"head":{"rot":(0,0,-7)}})),(.5,merge_pose(p["up"],{"chest":{"rot":(0,0,-8)},"head":{"rot":(0,0,7)}})),(.75,merge_pose(p["up"],{"chest":{"rot":(0,0,8)},"head":{"rot":(0,0,-7)}})),(1,n)],
        "training_return_idle": [(0,p["sit"]),(.55,n),(1,n)],
    }
    built = []
    for clip in clips:
        name = clip["name"]
        if name in {"walk", "run"}:
            action = bpy.data.actions.get(name)
            if not action:
                raise RuntimeError(f"Missing repair-A action {name}")
            retime_action(action, clip["durationMs"] * FPS / 1000.0)
            action["duration_ms"] = clip["durationMs"]
            action["loop"] = clip["loop"]
            built.append(action)
            continue
        built.append(make_action(rig, name, clip["durationMs"], clip["loop"], sequences[name]))
    return built


def action_summary(action: bpy.types.Action) -> dict:
    start, end = action.frame_range
    curves = list(getattr(action, "fcurves", []))
    return {
        "name": action.name,
        "durationMs": int(action.get("duration_ms", round((end - start) / FPS * 1000))),
        "frameStart": round(start, 4),
        "frameEnd": round(end, 4),
        "curveCount": len(curves),
        "keyframeCount": sum(len(curve.keyframe_points) for curve in curves),
        "loop": bool(action.get("loop", False)),
        "inPlace": bool(action.get("in_place", False)),
        "directHumanoidAnimation": bool(action.get("direct_humanoid_animation", False)),
    }


def evaluated_min_z(mesh: bpy.types.Object) -> float:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    matrix = evaluated.matrix_world
    return min((matrix @ vertex.co).z for vertex in evaluated.data.vertices)


def repair_floor_penetration(
    rig: bpy.types.Object,
    mesh: bpy.types.Object,
    actions: list[bpy.types.Action],
) -> dict[str, dict[str, float | int]]:
    report = {}
    for action in actions:
        rig.animation_data.action = action
        start, end = action.frame_range
        worst_before = 0.0
        worst_after = 0.0
        corrected_frames = 0
        for frame in range(int(math.floor(start)), int(math.ceil(end)) + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            before = evaluated_min_z(mesh)
            worst_before = min(worst_before, before)
            if before < -0.0005:
                # Meshy's Hips local +Z maps to Blender world -Z.  Adding the
                # negative penetration depth therefore lifts the complete dog
                # without moving the exported jack_root node.
                hips = rig.pose.bones["Hips"]
                after = before
                for _ in range(4):
                    hips.location.z += after * 1.6
                    bpy.context.view_layer.update()
                    after = evaluated_min_z(mesh)
                    if after >= -0.0005:
                        break
                hips.keyframe_insert("location", frame=frame, group=hips.name)
                corrected_frames += 1
                bpy.context.view_layer.update()
            after = evaluated_min_z(mesh)
            worst_after = min(worst_after, after)
        report[action.name] = {
            "correctedFrames": corrected_frames,
            "worstBeforeMeters": round(worst_before, 6),
            "worstAfterMeters": round(worst_after, 6),
        }
    return report


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    events = json.loads(Path(args.events).read_text(encoding="utf-8"))
    bpy.ops.wm.open_mainfile(filepath=str(input_path))
    rig = bpy.data.objects["Jack_Quadruped_Rig"]
    mesh = bpy.data.objects["Jack_Baby_Mesh"]
    actions = build_custom_actions(rig, manifest["clips"])
    floor_repair = repair_floor_penetration(rig, mesh, actions)
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(0)
    scene = bpy.context.scene
    scene.name = "Jack_Baby_Quadruped_V2_Repair_B"
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = 90
    scene["asset_version"] = "2.0.0-repair-b"
    scene["animation_library_status"] = "authored-pose-validation-pending"
    scene["clip_count"] = len(actions)
    scene["root_motion_gameplay"] = False
    scene["simulation_mutation"] = False
    scene["direct_humanoid_animation_allowed"] = False
    scene["goofy_shimmy_original"] = True
    scene["floor_penetration_repaired"] = True
    scene["event_manifest"] = Path(args.events).name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)

    summaries = [action_summary(action) for action in sorted(actions, key=lambda value: value.name)]
    exact = {"play": 3000, "clean_reaction": 1500}
    exact_ok = all(next(item for item in summaries if item["name"] == name)["durationMs"] == duration for name, duration in exact.items())
    event_names_ok = set(events["clips"]) == {clip["name"] for clip in manifest["clips"]}
    report = {
        "schemaVersion": 1,
        "status": "pass" if exact_ok and event_names_ok and len(actions) == 28 else "fail",
        "input": input_path.name,
        "output": output_path.name,
        "blenderVersion": bpy.app.version_string,
        "fps": FPS,
        "clipCount": len(actions),
        "exactDurationsValid": exact_ok,
        "eventClipParity": event_names_ok,
        "rootMotionGameplay": False,
        "simulationMutation": False,
        "directHumanoidAnimation": False,
        "goofyShimmyOriginal": True,
        "floorPenetrationRepair": floor_repair,
        "actions": summaries,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
