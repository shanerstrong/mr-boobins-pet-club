"""Validate static Jack blockout files without third-party Python packages."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
ASSET = ROOT / "assets" / "3d" / "jack"
EVIDENCE = ROOT / "evidence" / "3d-jack"
GLB = ASSET / "exports" / "jack-blockout.glb"
BLEND = ASSET / "source" / "jack-blockout.blend"
METRICS = ASSET / "blockout-metrics.json"
VIEWS = ["front", "side", "three-quarter", "rear"]


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        signature = handle.read(24)
    if signature[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    return struct.unpack(">II", signature[16:24])


def glb_json(path: Path) -> dict:
    with path.open("rb") as handle:
        magic, version, total_length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2 or total_length != path.stat().st_size:
            raise ValueError("invalid GLB 2.0 header")
        chunk_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise ValueError("first GLB chunk is not JSON")
        return json.loads(handle.read(chunk_length).decode("utf-8").rstrip(" \t\r\n\x00"))


def triangle_count(document: dict) -> int:
    accessors = document.get("accessors", [])
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4 or "indices" not in primitive:
                raise ValueError("expected indexed TRIANGLES primitives")
            total += accessors[primitive["indices"]]["count"] // 3
    return total


def main() -> int:
    required = [GLB, BLEND, METRICS] + [EVIDENCE / f"jack-blockout-{view}.png" for view in VIEWS]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"missing outputs: {missing}")

    with BLEND.open("rb") as handle:
        if handle.read(7) != b"BLENDER":
            raise ValueError("invalid Blender source header")

    metrics = json.loads(METRICS.read_text(encoding="utf-8"))
    document = glb_json(GLB)
    rendered_sizes = {view: png_size(EVIDENCE / f"jack-blockout-{view}.png") for view in VIEWS}
    triangles = triangle_count(document)

    checks = {
        "status": metrics["status"] == "likeness-review-pending",
        "presentationOnly": metrics["presentationOnly"] is True,
        "rootMotionGameplay": metrics["rootMotionGameplay"] is False,
        "privateReferencesEmbedded": metrics["privateReferencesEmbedded"] is False,
        "glbBytesMatch": metrics["glbBytes"] == GLB.stat().st_size,
        "trianglesMatch": metrics["triangles"] == triangles,
        "triangleBudget": triangles < metrics["heroTriangleTarget"]["min"],
        "materialsMatch": metrics["materials"] == len(document.get("materials", [])),
        "noImageTextures": metrics["imageTextures"] == 0 and not document.get("images") and not document.get("textures"),
        "staticExport": not document.get("animations") and not document.get("skins"),
        "noCameraOrLightExport": not document.get("cameras") and "KHR_lights_punctual" not in document.get("extensionsUsed", []),
        "allViews1024": all(size == (1024, 1024) for size in rendered_sizes.values()),
        "glbUnderBlockoutLimit": GLB.stat().st_size < 1_000_000,
    }
    failed = [name for name, passed in checks.items() if not passed]
    report = {
        "checks": checks,
        "failed": failed,
        "triangles": triangles,
        "materials": len(document.get("materials", [])),
        "meshes": len(document.get("meshes", [])),
        "glbBytes": GLB.stat().st_size,
        "renderedSizes": rendered_sizes,
    }
    print(json.dumps(report, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"blockout validation failed: {error}", file=sys.stderr)
        raise
