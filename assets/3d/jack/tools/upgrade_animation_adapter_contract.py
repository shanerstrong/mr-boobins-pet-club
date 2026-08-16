"""Upgrade the verified 13-clip GLB to the locked 16-clip adapter contract.

The operation only renames the cleaning clip and exposes four semantic need
names that reuse the already-authored, already-verified boop-need motion.  The
copies share existing animation accessors, so no animation samples or root
transforms are changed and no clip data is duplicated in the binary buffer.
"""

from __future__ import annotations

import argparse
import copy
import json
import struct
from pathlib import Path


ORDER = [
    "idle",
    "tail_wag",
    "feed",
    "sleep",
    "wake",
    "play",
    "clean_reaction",
    "boop_comfortable",
    "boop_need_hunger",
    "boop_need_energy",
    "boop_need_hygiene",
    "boop_need_happiness",
    "boop_rejected",
    "tired",
    "dirty",
    "death_rest",
]


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_size != len(data):
        raise ValueError("Invalid GLB 2.0 header")
    chunks: dict[int, bytes] = {}
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks[kind] = data[offset : offset + length]
        offset += length
    return json.loads(chunks[0x4E4F534A].decode("utf-8").rstrip(" \t\r\n\0")), chunks[0x004E4942]


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    json_bytes = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    output = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    output.extend(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    output.extend(json_bytes)
    output.extend(struct.pack("<II", len(binary), 0x004E4942))
    output.extend(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    document, binary = parse_glb(Path(args.input).resolve())
    existing = {animation["name"]: animation for animation in document.get("animations", [])}
    if "clean" not in existing or "boop_need" not in existing:
        raise ValueError("Input GLB is not the verified 13-clip source library")

    upgraded = {name: copy.deepcopy(animation) for name, animation in existing.items()}
    clean = upgraded.pop("clean")
    clean["name"] = "clean_reaction"
    clean.setdefault("extras", {})["adapterSemantic"] = "clean_reaction"
    upgraded["clean_reaction"] = clean

    need_source = upgraded.pop("boop_need")
    for need in ("hunger", "energy", "hygiene", "happiness"):
        animation = copy.deepcopy(need_source)
        animation["name"] = f"boop_need_{need}"
        animation.setdefault("extras", {}).update(
            {
                "adapterSemantic": f"boop_need_{need}",
                "motionSource": "boop_need_verified_v1",
                "presentationOnly": True,
                "simulationMutation": False,
            }
        )
        upgraded[animation["name"]] = animation

    if set(upgraded) != set(ORDER):
        raise ValueError(f"Upgraded clip set differs from locked adapter contract: {sorted(upgraded)}")
    document["animations"] = [upgraded[name] for name in ORDER]
    scene_extras = document["scenes"][0].setdefault("extras", {})
    scene_extras.update(
        {
            "clip_manifest": "assets/3d/jack/animations/clip-manifest.json",
            "animation_event_manifest": "assets/3d/jack/animations/animation-event-manifest.json",
            "adapter_contract_version": 2,
            "clip_count": len(ORDER),
            "presentation_only": True,
            "simulation_mutation": False,
            "root_motion_gameplay": False,
        }
    )
    document["asset"].setdefault("extras", {})["adapterContractUpgrade"] = (
        "semantic aliases only; motion samples unchanged"
    )
    write_glb(Path(args.output).resolve(), document, binary)
    print(f"JACK_ANIMATION_ADAPTER_UPGRADE_COMPLETE clips={len(ORDER)}")


if __name__ == "__main__":
    main()
