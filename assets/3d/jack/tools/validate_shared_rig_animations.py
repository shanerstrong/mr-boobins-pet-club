"""Deterministically validate Jack's shared skeleton/animation GLB."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path


COMPONENT_FORMATS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_COMPONENTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", required=True)
    parser.add_argument("--rig-contract", required=True)
    parser.add_argument("--clip-manifest", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args()


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("GLB is too short")
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_size != len(data):
        raise ValueError("Invalid GLB 2.0 header")
    offset = 12
    chunks: dict[int, bytes] = {}
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks[chunk_type] = data[offset : offset + chunk_length]
        offset += chunk_length
    document = json.loads(chunks[0x4E4F534A].decode("utf-8").rstrip(" \t\r\n\0"))
    return document, chunks.get(0x004E4942, b"")


def accessor_values(document: dict, binary: bytes, accessor_index: int) -> list[tuple[float, ...]]:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    fmt, component_size = COMPONENT_FORMATS[accessor["componentType"]]
    components = TYPE_COMPONENTS[accessor["type"]]
    element_size = component_size * components
    stride = view.get("byteStride", element_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    values = []
    for index in range(accessor["count"]):
        values.append(struct.unpack_from("<" + fmt * components, binary, start + index * stride))
    return values


def nearly_equal(left: float, right: float, tolerance: float = 1e-6) -> bool:
    return math.isclose(left, right, rel_tol=0.0, abs_tol=tolerance)


def main() -> None:
    args = parse_args()
    glb_path = Path(args.glb).resolve()
    report_path = Path(args.report).resolve()
    rig = json.loads(Path(args.rig_contract).read_text(encoding="utf-8"))
    manifest = json.loads(Path(args.clip_manifest).read_text(encoding="utf-8"))
    document, binary = parse_glb(glb_path)

    failures: list[str] = []
    nodes = document.get("nodes", [])
    node_by_name = {node.get("name"): index for index, node in enumerate(nodes)}
    missing_bones = [name for name in rig["bones"] if name not in node_by_name]
    if missing_bones:
        failures.append(f"Missing bones: {missing_bones}")

    root_index = node_by_name.get("root")
    parent_indices: dict[int, int] = {}
    for parent_index, node in enumerate(nodes):
        for child_index in node.get("children", []):
            parent_indices[child_index] = parent_index
    parent_by_bone = {
        name: (
            nodes[parent_indices[node_by_name[name]]].get("name")
            if node_by_name.get(name) in parent_indices
            and nodes[parent_indices[node_by_name[name]]].get("name") in rig["bones"]
            else None
        )
        for name in rig["bones"]
        if name in node_by_name
    }

    skins = document.get("skins", [])
    joint_names: list[str] = []
    inverse_bind_hash = None
    if skins:
        joint_names = [nodes[index].get("name") for index in skins[0].get("joints", [])]
        accessor_index = skins[0].get("inverseBindMatrices")
        if accessor_index is not None:
            matrices = accessor_values(document, binary, accessor_index)
            canonical = json.dumps(
                [[round(value, 9) for value in row] for row in matrices],
                separators=(",", ":"),
            ).encode("utf-8")
            inverse_bind_hash = hashlib.sha256(canonical).hexdigest()
    expected_clips = {clip["name"]: clip for clip in manifest["clips"]}
    actual_animations = {animation.get("name"): animation for animation in document.get("animations", [])}
    if set(actual_animations) != set(expected_clips):
        failures.append(
            f"Clip set mismatch: actual={sorted(actual_animations)} expected={sorted(expected_clips)}"
        )

    clip_rows = []
    for name, expected in expected_clips.items():
        animation = actual_animations.get(name)
        if animation is None:
            continue
        times = []
        root_ok = True
        for sampler in animation.get("samplers", []):
            values = accessor_values(document, binary, sampler["input"])
            times.extend(value[0] for value in values)
        duration_seconds = max(times, default=0.0) - min(times, default=0.0)
        expected_seconds = expected["durationMs"] / 1000.0
        duration_ok = nearly_equal(duration_seconds, expected_seconds, 1e-5)
        if not duration_ok:
            failures.append(
                f"{name}: duration {duration_seconds:.6f}s != {expected_seconds:.6f}s"
            )

        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            if target.get("node") != root_index:
                continue
            path = target.get("path")
            sampler = animation["samplers"][channel["sampler"]]
            values = accessor_values(document, binary, sampler["output"])
            if path == "translation":
                root_ok = root_ok and all(all(nearly_equal(value, 0.0) for value in row) for row in values)
            elif path == "rotation":
                root_ok = root_ok and all(
                    nearly_equal(row[0], 0.0)
                    and nearly_equal(row[1], 0.0)
                    and nearly_equal(row[2], 0.0)
                    and nearly_equal(abs(row[3]), 1.0)
                    for row in values
                )
        if not root_ok:
            failures.append(f"{name}: root transform changed")
        clip_rows.append(
            {
                "name": name,
                "expectedDurationMs": expected["durationMs"],
                "actualDurationMs": round(duration_seconds * 1000.0, 4),
                "durationExact": duration_ok,
                "rootInvariant": root_ok,
            }
        )

    scene_extras = (document.get("scenes") or [{}])[0].get("extras", {})
    presentation_contract_ok = (
        scene_extras.get("presentation_only") is True
        and scene_extras.get("simulation_mutation") is False
        and scene_extras.get("root_motion_gameplay") is False
    )
    if not presentation_contract_ok:
        failures.append("Scene extras do not preserve the presentation-only contract")
    if "Mark" in json.dumps(document) or "codex-remote-attachments" in json.dumps(document):
        failures.append("GLB contains a user/private absolute path")

    report = {
        "schemaVersion": 1,
        "status": "pass" if not failures else "fail",
        "glb": glb_path.name,
        "glbBytes": glb_path.stat().st_size,
        "nodeCount": len(nodes),
        "boneCountExpected": len(rig["bones"]),
        "missingBones": missing_bones,
        "skinCount": len(skins),
        "jointCount": len(joint_names),
        "jointNames": joint_names,
        "parentByBone": parent_by_bone,
        "inverseBindMatrixSha256": inverse_bind_hash,
        "meshCount": len(document.get("meshes", [])),
        "clipCount": len(actual_animations),
        "clips": clip_rows,
        "rootTolerance": 1e-6,
        "presentationContract": presentation_contract_ok,
        "failures": failures,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
