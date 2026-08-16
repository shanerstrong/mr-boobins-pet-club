"""Compose one skin GLB with the external shared animation GLB for QA only.

The production contract keeps animations external. This deterministic merge is
an evidence artifact that proves the exported channels can target the skin's
same-name joints without changing either source GLB.
"""

from __future__ import annotations

import argparse
import copy
import json
import struct
from pathlib import Path


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise ValueError(f"{path.name}: invalid GLB 2.0 header")
    offset = 12
    chunks: dict[int, bytes] = {}
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks[chunk_type] = data[offset : offset + length]
        offset += length
    document = json.loads(chunks[JSON_CHUNK].decode("utf-8").rstrip(" \t\r\n\0"))
    return document, chunks.get(BIN_CHUNK, b"")


def aligned(data: bytes, pad: bytes = b"\0") -> bytes:
    return data + pad * ((-len(data)) % 4)


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    binary = aligned(binary)
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = aligned(json.dumps(document, separators=(",", ":")).encode("utf-8"), b" ")
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    payload = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    payload.extend(struct.pack("<II", len(json_bytes), JSON_CHUNK))
    payload.extend(json_bytes)
    payload.extend(struct.pack("<II", len(binary), BIN_CHUNK))
    payload.extend(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skin-glb", required=True)
    parser.add_argument("--animation-glb", required=True)
    parser.add_argument("--output-glb", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    skin_path = Path(args.skin_glb).resolve()
    animation_path = Path(args.animation_glb).resolve()
    output_path = Path(args.output_glb).resolve()
    report_path = Path(args.report).resolve()
    skin, skin_binary = parse_glb(skin_path)
    animation, animation_binary = parse_glb(animation_path)

    skin_nodes_by_name = {
        node["name"]: index
        for index, node in enumerate(skin.get("nodes", []))
        if "name" in node
    }
    animation_nodes = animation.get("nodes", [])
    missing_targets: set[str] = set()

    skin_binary = aligned(skin_binary)
    binary_offset = len(skin_binary)
    combined_binary = skin_binary + animation_binary
    view_base = len(skin.get("bufferViews", []))
    accessor_base = len(skin.get("accessors", []))
    skin.setdefault("bufferViews", [])
    skin.setdefault("accessors", [])

    for view in animation.get("bufferViews", []):
        copied = copy.deepcopy(view)
        copied["buffer"] = 0
        copied["byteOffset"] = copied.get("byteOffset", 0) + binary_offset
        skin["bufferViews"].append(copied)
    for accessor in animation.get("accessors", []):
        copied = copy.deepcopy(accessor)
        if "bufferView" in copied:
            copied["bufferView"] += view_base
        if "sparse" in copied:
            copied["sparse"]["indices"]["bufferView"] += view_base
            copied["sparse"]["values"]["bufferView"] += view_base
        skin["accessors"].append(copied)

    composed_animations = []
    for source_animation in animation.get("animations", []):
        composed = copy.deepcopy(source_animation)
        for sampler in composed.get("samplers", []):
            sampler["input"] += accessor_base
            sampler["output"] += accessor_base
        for channel in composed.get("channels", []):
            source_index = channel["target"]["node"]
            source_name = animation_nodes[source_index].get("name")
            if source_name not in skin_nodes_by_name:
                missing_targets.add(source_name or f"node-{source_index}")
                continue
            channel["target"]["node"] = skin_nodes_by_name[source_name]
        composed_animations.append(composed)

    if missing_targets:
        raise RuntimeError(f"Skin is missing animation targets: {sorted(missing_targets)}")
    skin["animations"] = composed_animations
    skin.setdefault("extras", {})["qa_animation_composition_only"] = True
    skin["extras"]["production_animations_remain_external"] = True
    write_glb(output_path, skin, combined_binary)

    report = {
        "schemaVersion": 1,
        "status": "pass",
        "skin": skin_path.name,
        "animationLibrary": animation_path.name,
        "output": output_path.name,
        "outputBytes": output_path.stat().st_size,
        "nodeCount": len(skin.get("nodes", [])),
        "clipCount": len(composed_animations),
        "clipNames": [item.get("name") for item in composed_animations],
        "targetNamesResolved": True,
        "productionAnimationsRemainExternal": True,
        "presentationOnly": True,
        "simulationMutation": False,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
