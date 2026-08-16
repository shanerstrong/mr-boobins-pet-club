"""Validate the refined Jack character package without third-party packages."""

from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
ASSET = ROOT / "assets" / "3d" / "jack"
EXPORTS = ASSET / "exports"
EVIDENCE = ROOT / "evidence" / "3d-jack"
GLB = EXPORTS / "jack-character.glb"
GLTF = EXPORTS / "jack-character.gltf"
BIN = EXPORTS / "jack-character.bin"
BLEND = ASSET / "source" / "jack-character.blend"
METRICS = ASSET / "hero-metrics.json"
CLIPS = ASSET / "animations" / "clip-manifest.json"
RIG = ASSET / "rig" / "jack-rig.json"
VIEWS = ["front", "side", "three-quarter", "rear"]


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


def read_glb(path: Path) -> tuple[dict, bytes]:
    with path.open("rb") as handle:
        magic, version, total_length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2 or total_length != path.stat().st_size:
            raise ValueError("invalid GLB 2.0 header")
        json_length, json_type = struct.unpack("<II", handle.read(8))
        if json_type != 0x4E4F534A:
            raise ValueError("first GLB chunk is not JSON")
        document = json.loads(handle.read(json_length).decode("utf-8").rstrip(" \t\r\n\x00"))
        binary_length, binary_type = struct.unpack("<II", handle.read(8))
        if binary_type != 0x004E4942:
            raise ValueError("second GLB chunk is not BIN")
        binary = handle.read(binary_length)
    return document, binary


def read_float_accessor(document: dict, binary: bytes, accessor_index: int) -> list[tuple[float, ...]]:
    accessor = document["accessors"][accessor_index]
    if accessor["componentType"] != 5126:
        raise ValueError("expected float accessor")
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    view = document["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", components * 4)
    values = []
    for index in range(accessor["count"]):
        values.append(struct.unpack_from("<" + "f" * components, binary, offset + index * stride))
    return values


def main() -> int:
    required = [GLB, GLTF, BIN, BLEND, METRICS, CLIPS, RIG] + [EVIDENCE / f"jack-hero-{view}.png" for view in VIEWS]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"missing outputs: {missing}")

    if BLEND.read_bytes()[:7] != b"BLENDER":
        raise ValueError("invalid Blender source header")
    metrics = json.loads(METRICS.read_text(encoding="utf-8"))
    manifest = json.loads(CLIPS.read_text(encoding="utf-8"))
    rig = json.loads(RIG.read_text(encoding="utf-8"))
    document, binary = read_glb(GLB)
    separate = json.loads(GLTF.read_text(encoding="utf-8"))

    accessors = document.get("accessors", [])
    triangles = sum(
        accessors[primitive["indices"]]["count"] // 3
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
        if primitive.get("mode", 4) == 4 and "indices" in primitive
    )
    morph_targets = sum(
        len(primitive.get("targets", []))
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    )
    expected_durations = {clip["name"]: clip["durationMs"] / 1000.0 for clip in manifest["clips"]}
    observed_durations = {}
    for animation in document.get("animations", []):
        bounds = []
        for sampler in animation.get("samplers", []):
            accessor = accessors[sampler["input"]]
            bounds.extend((accessor["min"][0], accessor["max"][0]))
        observed_durations[animation["name"]] = max(bounds) - min(bounds)

    root_node = next(index for index, node in enumerate(document["nodes"]) if node.get("name") == "root")
    root_translation_is_static = True
    for animation in document.get("animations", []):
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            if target.get("node") == root_node and target.get("path") == "translation":
                sampler = animation["samplers"][channel["sampler"]]
                values = read_float_accessor(document, binary, sampler["output"])
                first = values[0]
                if any(any(abs(value[index] - first[index]) > 1e-6 for index in range(3)) for value in values[1:]):
                    root_translation_is_static = False

    checks = {
        "triangleBudget": metrics["heroTriangleTarget"]["min"] <= triangles <= metrics["heroTriangleTarget"]["max"],
        "trianglesMatch": triangles == metrics["triangles"],
        "optimizedPrimitiveCount": len(document.get("meshes", [])) == metrics["optimizedMeshPrimitives"] <= 18,
        "materialsMatch": len(document.get("materials", [])) == metrics["materials"] == 11,
        "noImageTextures": not document.get("images") and not document.get("textures") and metrics["imageTextures"] == 0,
        "singleSkin": len(document.get("skins", [])) == 1,
        "boneCount": len(document["skins"][0]["joints"]) == metrics["bones"] == len(rig["bones"]),
        "morphTargets": morph_targets == metrics["morphTargets"] == 6,
        "clipNames": set(observed_durations) == set(expected_durations) == set(metrics["clipNamesExpected"]),
        "clipDurations": all(math.isclose(observed_durations[name], duration, abs_tol=1e-5) for name, duration in expected_durations.items()),
        "exactPlay": math.isclose(observed_durations["play"], 3.0, abs_tol=1e-5),
        "exactClean": math.isclose(observed_durations["clean"], 1.5, abs_tol=1e-5) and manifest["exactPolicies"]["cleanPhasesMs"] == [0, 375, 750, 1125, 1500],
        "noRootMotion": root_translation_is_static and manifest["rootMotionGameplay"] is False and rig["rootMotionGameplay"] is False,
        "presentationOnly": manifest["presentationOnly"] and metrics["presentationOnly"] and rig["presentationOnly"],
        "noSimulationMutation": manifest["simulationMutation"] is False and metrics["simulationMutation"] is False,
        "privateReferencesNotEmbedded": metrics["privateReferencesEmbedded"] is False,
        "payloadTarget": GLB.stat().st_size == metrics["glbBytes"] and GLB.stat().st_size <= 3_500_000,
        "separateExport": separate["buffers"][0]["uri"] == BIN.name and BIN.stat().st_size == metrics["binBytes"],
        "noCameraOrLightExport": not document.get("cameras") and "KHR_lights_punctual" not in document.get("extensionsUsed", []),
        "allHeroViews1024": all(png_size(EVIDENCE / f"jack-hero-{view}.png") == (1024, 1024) for view in VIEWS),
    }
    failed = [name for name, passed in checks.items() if not passed]
    report = {
        "checks": checks,
        "failed": failed,
        "triangles": triangles,
        "meshPrimitives": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "bones": len(document["skins"][0]["joints"]),
        "morphTargets": morph_targets,
        "animations": observed_durations,
        "glbBytes": GLB.stat().st_size,
    }
    print(json.dumps(report, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"character validation failed: {error}", file=sys.stderr)
        raise
