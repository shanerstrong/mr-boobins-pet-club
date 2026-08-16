"""Validate Jack V2 GLBs directly from their glTF JSON/binary contracts."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path


REQUIRED_ANCHORS = {
    "jack_root", "head", "nose_visual", "hit_nose", "mouth_anchor",
    "collar", "tag", "tail_base", "paw_front_l", "paw_front_r",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skin", required=True)
    parser.add_argument("--animations", required=True)
    parser.add_argument("--preview", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--events", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--expected-ibm-sha256")
    return parser.parse_args()


def read_glb(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or length != len(raw):
        raise ValueError(f"Invalid GLB header: {path}")
    document = None
    binary = b""
    offset = 12
    while offset < len(raw):
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset : offset + size]
        offset += size
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\0"))
        elif kind == 0x004E4942:
            binary = chunk
    if document is None:
        raise ValueError(f"Missing JSON chunk: {path}")
    return document, binary


def node_map(document: dict) -> dict[str, tuple[int, dict]]:
    return {node.get("name", f"node_{index}"): (index, node) for index, node in enumerate(document.get("nodes", []))}


def animation_durations(document: dict) -> dict[str, float]:
    accessors = document.get("accessors", [])
    durations = {}
    for animation in document.get("animations", []):
        ends = []
        for sampler in animation.get("samplers", []):
            accessor = accessors[sampler["input"]]
            maximum = accessor.get("max", [0.0])[0]
            ends.append(float(maximum))
        durations[animation.get("name", "unnamed")] = max(ends, default=0.0)
    return durations


def texture_sizes(document: dict, binary: bytes) -> list[tuple[int, int]]:
    sizes = []
    for image in document.get("images", []):
        view = document["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        payload = binary[start : start + view["byteLength"]]
        if payload.startswith(b"\x89PNG\r\n\x1a\n"):
            sizes.append(struct.unpack_from(">II", payload, 16))
        else:
            raise ValueError("Jack mobile texture is not a PNG")
    if not sizes:
        raise ValueError("Jack mobile GLB has no embedded texture")
    return sizes


def mesh_triangles(document: dict) -> int:
    count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor = document["accessors"][primitive["indices"]]
            count += accessor["count"] // 3
    return count


def inverse_bind_sha256(document: dict, binary: bytes) -> str:
    accessor = document["accessors"][document["skins"][0]["inverseBindMatrices"]]
    view = document["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    payload = binary[start : start + accessor["count"] * 64]
    return hashlib.sha256(payload).hexdigest()


def main() -> None:
    args = parse_args()
    skin_path = Path(args.skin).resolve()
    animations_path = Path(args.animations).resolve()
    preview_path = Path(args.preview).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    events = json.loads(Path(args.events).read_text(encoding="utf-8"))
    skin, skin_bin = read_glb(skin_path)
    animations, _ = read_glb(animations_path)
    preview, preview_bin = read_glb(preview_path)

    expected = {clip["name"]: clip for clip in manifest["clips"]}
    duration_seconds = animation_durations(preview)
    animation_library_durations = animation_durations(animations)
    names = set(duration_seconds)
    skin_nodes = node_map(skin)
    preview_nodes = node_map(preview)
    missing_anchors = sorted(REQUIRED_ANCHORS - set(preview_nodes))
    root = preview_nodes.get("jack_root", (-1, {}))[1]
    root_identity = (
        root.get("translation", [0, 0, 0]) == [0, 0, 0]
        and root.get("rotation", [0, 0, 0, 1]) == [0, 0, 0, 1]
        and root.get("scale", [1, 1, 1]) == [1, 1, 1]
    )
    root_index = preview_nodes.get("jack_root", (-1, {}))[0]
    root_translation_channels = [
        animation.get("name")
        for animation in preview.get("animations", [])
        for channel in animation.get("channels", [])
        if channel.get("target", {}).get("node") == root_index
        and channel.get("target", {}).get("path") == "translation"
    ]
    hit_nose = preview_nodes.get("hit_nose", (-1, {}))[1]
    hit_nose_invisible = "mesh" not in hit_nose
    textures = texture_sizes(preview, preview_bin)
    ibm_sha256 = inverse_bind_sha256(preview, preview_bin)
    duration_errors = {}
    for name, clip in expected.items():
        actual_ms = duration_seconds.get(name, -1.0) * 1000.0
        tolerance = 0.5 if clip.get("exactDurationRequired") else 34.0
        if abs(actual_ms - clip["durationMs"]) > tolerance:
            duration_errors[name] = {
                "expectedMs": clip["durationMs"],
                "actualMs": round(actual_ms, 3),
                "toleranceMs": tolerance,
            }

    treat = events["treatContactContract"]
    receive_markers = {marker["name"]: marker["timeMs"] for marker in events["clips"]["training_treat_receive"]["markers"]}
    treat_contact_valid = (
        treat["anchor"] in preview_nodes
        and receive_markers.get(treat["marker"]) == 600
        and receive_markers.get(treat["hideMarker"]) == 633
        and receive_markers[treat["hideMarker"]] > receive_markers[treat["marker"]]
        and treat["maximumDistanceMeters"] == 0.01
    )
    triangles = mesh_triangles(skin)
    decoded_texture_bytes = sum(width * height * 4 for width, height in textures)
    checks = {
        "skinHasOneRenderableMesh": len(skin.get("meshes", [])) == 1,
        "animationLibraryHasNoRenderableMesh": len(animations.get("meshes", [])) == 0,
        "previewHasOneRenderableMesh": len(preview.get("meshes", [])) == 1,
        "triangleBudget": 8000 <= triangles <= 14000,
        "jointBudget": len(preview.get("skins", [{}])[0].get("joints", [])) <= 64,
        "materialBudget": len(preview.get("materials", [])) <= 3,
        "textureEdgeBudget": max(max(width, height) for width, height in textures) <= 1024,
        "decodedTextureBudget": decoded_texture_bytes <= 8388608,
        "skinPayloadBudget": skin_path.stat().st_size <= 3670016,
        "animationPayloadBudget": animations_path.stat().st_size <= 3145728,
        "clipNames": names == set(expected) == set(animation_library_durations),
        "clipDurations": not duration_errors,
        "semanticAnchors": not missing_anchors,
        "rootIdentity": root_identity,
        "noRootTranslationChannels": not root_translation_channels,
        "hitNoseInvisible": hit_nose_invisible,
        "treatContactTiming": treat_contact_valid,
        "eventClipParity": set(events["clips"]) == set(expected),
        "inverseBindMatrices": not args.expected_ibm_sha256 or ibm_sha256 == args.expected_ibm_sha256,
    }
    report = {
        "schemaVersion": 1,
        "status": "pass" if all(checks.values()) else "fail",
        "checks": checks,
        "metrics": {
            "triangles": triangles,
            "joints": len(preview.get("skins", [{}])[0].get("joints", [])),
            "materials": len(preview.get("materials", [])),
            "textures": [list(size) for size in textures],
            "texture": list(max(textures, key=lambda size: max(size))),
            "decodedTextureBytes": decoded_texture_bytes,
            "skinBytes": skin_path.stat().st_size,
            "animationBytes": animations_path.stat().st_size,
            "previewBytes": preview_path.stat().st_size,
            "clipCount": len(names),
            "inverseBindMatrixSha256": ibm_sha256,
        },
        "missingAnchors": missing_anchors,
        "durationErrors": duration_errors,
        "rootTranslationChannels": root_translation_channels,
        "treatContact": {
            "anchor": treat["anchor"],
            "contactMs": receive_markers.get(treat["marker"]),
            "hiddenMs": receive_markers.get(treat["hideMarker"]),
            "maximumDistanceMeters": treat["maximumDistanceMeters"],
            "runtimeTreatMustFollowMouthAnchor": True,
        },
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
