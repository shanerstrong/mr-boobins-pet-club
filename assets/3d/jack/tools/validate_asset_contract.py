"""Validate Jack's deterministic asset contract without claiming mesh completion."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


EXPECTED_STAGES = {"baby", "little-puppy", "puppy", "young-dog", "adult"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jack-root", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    jack_root = Path(args.jack_root).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    rig = json.loads((jack_root / manifest["sharedRig"]["contract"]).read_text(encoding="utf-8"))
    clips = json.loads((jack_root / manifest["sharedRig"]["clipManifest"]).read_text(encoding="utf-8"))
    events = json.loads((jack_root / manifest["sharedRig"]["eventManifest"]).read_text(encoding="utf-8"))
    validation_path = (jack_root / manifest["sharedRig"]["validation"]).resolve()
    rig_validation = json.loads(validation_path.read_text(encoding="utf-8"))

    failures: list[str] = []
    stage_mapping = manifest["stageToSkin"]
    if set(stage_mapping) != EXPECTED_STAGES:
        failures.append("stageToSkin must cover exactly the five existing growth stages")

    skin_ids = {skin["id"] for skin in manifest["skins"]}
    if skin_ids != {"baby", "teen", "adult"}:
        failures.append("skin set must be exactly baby, teen, adult")
    if set(stage_mapping.values()) != skin_ids:
        failures.append("every skin must be referenced by stageToSkin")

    for skin in manifest["skins"]:
        mapped = {stage for stage, skin_id in stage_mapping.items() if skin_id == skin["id"]}
        if mapped != set(skin["growthStages"]):
            failures.append(f"{skin['id']}: growthStages disagree with stageToSkin")
        actual_available = (jack_root / skin["runtimeGlb"]).exists()
        if actual_available != skin["available"]:
            failures.append(f"{skin['id']}: available flag disagrees with runtime GLB presence")

    lod_policy = manifest["lodPolicy"]
    desktop_policy = lod_policy["desktop"]
    desktop_inventory_path = jack_root / desktop_policy["sourceInventory"]
    desktop_inventory = json.loads(desktop_inventory_path.read_text(encoding="utf-8"))
    desktop_masters = {master["age"]: master for master in desktop_inventory["masters"]}
    if set(desktop_masters) != skin_ids:
        failures.append("desktop source inventory must cover exactly baby, teen, adult")
    if not desktop_policy.get("remoteMastersPreserved", False):
        failures.append("desktop master preservation has not been recorded")
    for skin in manifest["skins"]:
        master = desktop_masters.get(skin["id"])
        if master is None:
            continue
        expected_master = str(Path(master["plannedMasterPath"]).as_posix()).removeprefix("../")
        expected_runtime = str(Path(master["plannedRuntimePath"]).as_posix()).removeprefix("../")
        if expected_master != skin["desktopSourceGlb"]:
            failures.append(f"{skin['id']}: desktop master path differs from inventory")
        if expected_runtime != skin["desktopRuntimeGlb"]:
            failures.append(f"{skin['id']}: desktop runtime path differs from inventory")
        if master["triangleCount"] <= skin["triangleBudget"]["max"]:
            failures.append(f"{skin['id']}: desktop master is not higher resolution than mobile")
    desktop_master_paths = [jack_root / skin["desktopSourceGlb"] for skin in manifest["skins"]]
    desktop_runtime_paths = [jack_root / skin["desktopRuntimeGlb"] for skin in manifest["skins"]]
    if desktop_policy.get("localMasterBytesAvailable", False) != all(
        path.exists() for path in desktop_master_paths
    ):
        failures.append("desktop localMasterBytesAvailable disagrees with master-file presence")
    if desktop_policy.get("available", False) != all(path.exists() for path in desktop_runtime_paths):
        failures.append("desktop available flag disagrees with runtime LOD presence")

    if manifest["morphContract"] != rig["requiredMorphTargetsPerSkin"]:
        failures.append("morph contract differs from jack-rig.json")
    if list(manifest["materialContract"]["roles"]) != rig["materialSlots"]:
        failures.append("material role order differs from jack-rig.json")

    expected_clip_names = [clip["name"] for clip in clips["clips"]]
    validated_clip_names = [clip["name"] for clip in rig_validation["clips"]]
    if expected_clip_names != validated_clip_names:
        failures.append("validated clips differ from clip-manifest.json")
    if manifest["sharedRig"]["clipCount"] != len(expected_clip_names):
        failures.append("shared rig clipCount is incorrect")
    if list(events["clips"]) != expected_clip_names:
        failures.append("animation event manifest clip names/order differ from clip-manifest.json")
    expected_clips_by_name = {clip["name"]: clip for clip in clips["clips"]}
    for name, event_clip in events["clips"].items():
        expected = expected_clips_by_name.get(name)
        if expected is None:
            continue
        if event_clip["durationMs"] != expected["durationMs"] or event_clip["loop"] != expected["loop"]:
            failures.append(f"{name}: event duration/loop differs from clip-manifest.json")
    play_markers = {marker["name"]: marker["timeMs"] for marker in events["clips"]["play"]["markers"]}
    if play_markers != {"start": 0, "complete": 3000}:
        failures.append("play event markers must be exactly 0ms and 3000ms")
    clean_markers = {
        marker["name"]: marker["timeMs"]
        for marker in events["clips"]["clean_reaction"]["markers"]
    }
    if clean_markers != {
        "water": 0,
        "washout": 400,
        "shake": 800,
        "sparkle": 1150,
        "complete": 1500,
    }:
        failures.append("clean_reaction event markers differ from the exact four-phase policy")
    if not (
        events["presentationOnly"] is True
        and events["simulationMutation"] is False
        and events["rootMotionGameplay"] is False
    ):
        failures.append("animation event manifest grants forbidden authority")
    if manifest["adapterClipContract"]["required"] != expected_clip_names:
        failures.append("adapter clip contract differs from clip-manifest.json")
    if manifest["semanticAnchorContract"]["required"] != rig["requiredSemanticAnchors"]:
        failures.append("semantic anchor contract differs from jack-rig.json")
    if manifest["sharedRig"]["boneCount"] != rig_validation["jointCount"]:
        failures.append("shared rig boneCount is incorrect")
    if manifest["sharedRig"]["inverseBindMatrixSha256"] != rig_validation["inverseBindMatrixSha256"]:
        failures.append("canonical inverse-bind hash differs from rig validation")
    if rig_validation["status"] != "pass":
        failures.append("shared rig validation is not passing")

    animation_path = jack_root / manifest["sharedRig"]["animationExport"]
    if not animation_path.exists():
        failures.append("shared animation GLB is missing")
    elif animation_path.stat().st_size >= 3_500_000:
        failures.append("shared animation GLB exceeds the practical 3.5 MB target")

    if not (
        manifest["presentationOnly"] is True
        and manifest["simulationMutation"] is False
        and manifest["rootMotionGameplay"] is False
    ):
        failures.append("top-level presentation-only contract is invalid")
    runtime = manifest["runtimeContract"]
    forbidden_true = [
        "assetAdvancesTime",
        "assetChangesNeeds",
        "assetChangesGrowth",
        "assetChangesCareEffects",
        "assetChangesPersistence",
        "assetSelectsAudio",
    ]
    if any(runtime[key] for key in forbidden_true):
        failures.append("runtime contract grants forbidden simulation authority")

    missing_outputs = [skin["runtimeGlb"] for skin in manifest["skins"] if not skin["available"]]
    missing_outputs.extend(
        skin["source"]
        for skin in manifest["skins"]
        if not skin.get("editableSourceAvailable", False)
    )
    if not manifest["sharedRig"].get("editableSourceMatchesExport", False):
        missing_outputs.append(
            "source/jack-shared-rig-animations.blend (resave for 16-clip adapter contract)"
        )
    fallback = manifest["fallbackContract"]
    fallback_available = fallback.get("availableBySkin", {})
    if set(fallback_available) != skin_ids:
        failures.append("fallback availableBySkin must cover exactly baby, teen, adult")
    for skin_id in sorted(skin_ids):
        paths = [
            (jack_root / fallback[key].format(skin=skin_id)).resolve()
            for key in ("healthyPattern", "hungryPattern", "starvingPattern")
        ]
        actual_available = all(path.exists() for path in paths)
        if fallback_available.get(skin_id, False) != actual_available:
            failures.append(f"{skin_id}: fallback availability disagrees with file presence")
        if not actual_available:
            missing_outputs.append(f"fallback render set ({skin_id})")
    if fallback["available"] != all(fallback_available.get(skin_id, False) for skin_id in skin_ids):
        failures.append("fallback available flag disagrees with per-skin availability")
    missing_outputs.extend(
        skin["desktopSourceGlb"]
        for skin in manifest["skins"]
        if not (jack_root / skin["desktopSourceGlb"]).exists()
    )
    missing_outputs.extend(
        skin["desktopRuntimeGlb"]
        for skin in manifest["skins"]
        if not (jack_root / skin["desktopRuntimeGlb"]).exists()
    )

    report = {
        "schemaVersion": 1,
        "status": "contract-pass-package-incomplete" if not failures else "fail",
        "contractValid": not failures,
        "packageComplete": not failures and not missing_outputs,
        "stageToSkin": stage_mapping,
        "skinCount": len(manifest["skins"]),
        "sharedBoneCount": manifest["sharedRig"]["boneCount"],
        "sharedClipCount": manifest["sharedRig"]["clipCount"],
        "morphCountPerSkin": len(manifest["morphContract"]),
        "materialRoleCount": len(manifest["materialContract"]["roles"]),
        "desktopMastersRemotelyPreserved": desktop_policy["remoteMastersPreserved"],
        "desktopMasterCount": len(desktop_masters),
        "desktopLocalMasterBytesAvailable": desktop_policy["localMasterBytesAvailable"],
        "desktopRuntimeAvailable": desktop_policy["available"],
        "sharedAnimationBytes": animation_path.stat().st_size if animation_path.exists() else None,
        "missingOutputs": missing_outputs,
        "failures": failures,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
