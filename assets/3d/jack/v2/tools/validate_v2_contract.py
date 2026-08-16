"""Validate Jack V2's quadruped contract without touching V1 assets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REQUIRED_MVP = {
    "idle", "walk", "run", "feed", "sleep", "wake", "play",
    "training_attention", "training_sit", "training_paw", "training_up",
    "training_treat_receive", "training_treat_eat",
    "celebration_happy_hop", "celebration_spin_wag",
    "celebration_goofy_shimmy", "training_return_idle",
}

REQUIRED_PET_ROOM = {
    "idle", "tail_wag", "feed", "sleep", "wake", "play",
    "clean_reaction", "boop_comfortable", "boop_need_hunger",
    "boop_need_energy", "boop_need_hygiene", "boop_need_happiness",
    "boop_rejected", "tired", "dirty", "death_rest",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--report", type=Path)
    parser.add_argument("--require-outputs", action="store_true")
    args = parser.parse_args()

    root = args.root.resolve()
    asset = load(root / "asset-manifest-v2.json")
    rig = load(root / asset["contracts"]["rig"])
    clips = load(root / asset["contracts"]["clips"])
    events = load(root / asset["contracts"]["events"])

    failures: list[str] = []
    names = [clip["name"] for clip in clips["clips"]]
    name_set = set(names)
    if len(names) != len(name_set):
        failures.append("duplicate clip names")
    if len(names) != clips["clipCount"]:
        failures.append("clipCount does not match clips array")
    for missing in sorted((REQUIRED_MVP | REQUIRED_PET_ROOM) - name_set):
        failures.append(f"missing required clip: {missing}")
    if set(events["clips"]) != name_set:
        failures.append("event manifest clip set differs from clip manifest")

    by_name = {clip["name"]: clip for clip in clips["clips"]}
    for name, clip in by_name.items():
        if clip["durationMs"] <= 0:
            failures.append(f"{name}: non-positive duration")
        if clip.get("rootMotion") is not False:
            failures.append(f"{name}: root motion must be false")
        event = events["clips"].get(name)
        if event is None:
            continue
        if event["durationMs"] != clip["durationMs"]:
            failures.append(f"{name}: duration differs between manifests")
        marker_times = [marker["timeMs"] for marker in event["markers"]]
        if marker_times != sorted(marker_times):
            failures.append(f"{name}: markers are not chronological")
        if marker_times and marker_times[-1] > clip["durationMs"]:
            failures.append(f"{name}: marker exceeds clip duration")

    if by_name["play"]["durationMs"] != 3000:
        failures.append("play must be exactly 3000ms")
    if by_name["clean_reaction"]["durationMs"] != 1500:
        failures.append("clean_reaction must be exactly 1500ms")

    treat_markers = {
        marker["name"]: marker["timeMs"]
        for marker in events["clips"]["training_treat_receive"]["markers"]
    }
    if treat_markers.get("treat_contact", 10**9) >= treat_markers.get("treat_hidden", -1):
        failures.append("treat_hidden must occur after treat_contact")

    if rig["baselineSkeleton"] != "meshy-quadruped-dog-smart-rig":
        failures.append("rig baseline is not Meshy quadruped Smart Rig")
    if rig["humanoidAnimationPolicy"]["directApplicationAllowed"]:
        failures.append("humanoid direct application must remain disabled")
    for source in rig["motionSources"]:
        if source["motionClass"] != "quadruped":
            failures.append(f"{source['clip']}: non-quadruped motion source")

    missing_outputs: list[str] = []
    for relative in asset["sources"].values():
        if not (root / relative).exists():
            missing_outputs.append(relative)
    for relative in asset["exports"].values():
        if not (root / relative).exists():
            missing_outputs.append(relative)
    for relative in asset.get("validationEvidence", {}).values():
        if not (root / relative).resolve().exists():
            missing_outputs.append(relative)
    completion = asset.get("completion", {})
    for age in ("baby", "teen", "adult"):
        if completion.get(f"{age}Available") is not True:
            failures.append(f"completion flag is false: {age}Available")
    if completion.get("packageComplete") is not True:
        failures.append("completion flag is false: packageComplete")
    if args.require_outputs and missing_outputs:
        failures.extend(f"missing output: {path}" for path in missing_outputs)

    report = {
        "schemaVersion": 1,
        "status": "pass" if not failures else "fail",
        "phase": "contract-only" if missing_outputs else "outputs-present",
        "clipCount": len(names),
        "requiredMvpPresent": REQUIRED_MVP <= name_set,
        "requiredPetRoomPresent": REQUIRED_PET_ROOM <= name_set,
        "meshyQuadrupedBaselineDeclared": rig["baselineSkeleton"] == "meshy-quadruped-dog-smart-rig",
        "humanoidAnimationDirectApplicationAllowed": rig["humanoidAnimationPolicy"]["directApplicationAllowed"],
        "missingOutputs": missing_outputs,
        "failures": failures,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
