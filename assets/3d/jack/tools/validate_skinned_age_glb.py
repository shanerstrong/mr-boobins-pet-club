"""Deterministically validate one Jack interchangeable age-skin GLB."""

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
    "MAT4": 16,
}
REQUIRED_ANCHORS = {
    "jack_root",
    "head",
    "nose_visual",
    "hit_nose",
    "mouth_anchor",
    "collar",
    "tag",
    "tail_base",
    "paw_front_l",
    "paw_front_r",
}


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("GLB is too short")
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_size != len(data):
        raise ValueError("Invalid GLB 2.0 header")
    chunks: dict[int, bytes] = {}
    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks[chunk_type] = data[offset : offset + chunk_length]
        offset += chunk_length
    return (
        json.loads(chunks[0x4E4F534A].decode("utf-8").rstrip(" \t\r\n\0")),
        chunks.get(0x004E4942, b""),
    )


def accessor_values(document: dict, binary: bytes, accessor_index: int) -> list[tuple[float, ...]]:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    fmt, component_size = COMPONENT_FORMATS[accessor["componentType"]]
    components = TYPE_COMPONENTS[accessor["type"]]
    element_size = component_size * components
    stride = view.get("byteStride", element_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return [
        struct.unpack_from("<" + fmt * components, binary, start + index * stride)
        for index in range(accessor["count"])
    ]


def png_size(document: dict, binary: bytes, image: dict) -> tuple[int, int] | None:
    if image.get("mimeType") != "image/png" or "bufferView" not in image:
        return None
    view = document["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    data = binary[start : start + view["byteLength"]]
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def canonical_ibm_hash(values: list[tuple[float, ...]]) -> str:
    canonical = json.dumps(
        [[round(value, 9) for value in row] for row in values],
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--age", choices=("baby", "teen", "adult"), required=True)
    parser.add_argument("--glb", required=True)
    parser.add_argument("--rig-contract", required=True)
    parser.add_argument("--asset-manifest", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    path = Path(args.glb).resolve()
    document, binary = parse_glb(path)
    rig = json.loads(Path(args.rig_contract).read_text(encoding="utf-8"))
    manifest = json.loads(Path(args.asset_manifest).read_text(encoding="utf-8"))
    failures: list[str] = []

    meshes = document.get("meshes", [])
    if len(meshes) != 1 or len(meshes[0].get("primitives", [])) != 1:
        failures.append("exactly one rendered mesh primitive is required")
        primitive = {}
    else:
        primitive = meshes[0]["primitives"][0]
    attributes = primitive.get("attributes", {})
    for required in ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"):
        if required not in attributes:
            failures.append(f"missing vertex attribute {required}")

    position_values = accessor_values(document, binary, attributes["POSITION"]) if "POSITION" in attributes else []
    vertex_count = len(position_values)
    bounds_min = [min(row[axis] for row in position_values) for axis in range(3)] if position_values else []
    bounds_max = [max(row[axis] for row in position_values) for axis in range(3)] if position_values else []
    if bounds_min and not math.isclose(bounds_min[1], 0.0, abs_tol=1e-6):
        failures.append(f"ground contact is y={bounds_min[1]:.8f}, expected 0")
    if bounds_max and not math.isclose(bounds_max[1], 1.30, abs_tol=1e-5):
        failures.append(f"normalized height is {bounds_max[1]:.8f}, expected 1.30")

    triangle_count = 0
    if "indices" in primitive:
        triangle_count = document["accessors"][primitive["indices"]]["count"] // 3
        if not 8000 <= triangle_count <= 14000:
            failures.append(f"triangle count {triangle_count} is outside 8k-14k")

    nodes = document.get("nodes", [])
    node_index = {node.get("name"): index for index, node in enumerate(nodes)}
    missing_anchors = sorted(REQUIRED_ANCHORS - set(node_index))
    if missing_anchors:
        failures.append(f"missing semantic anchors: {missing_anchors}")
    root_node = nodes[node_index["jack_root"]] if "jack_root" in node_index else {}
    transform_keys = {"translation", "rotation", "scale", "matrix"} & set(root_node)
    if transform_keys:
        failures.append(f"jack_root must use implicit identity transform, found {sorted(transform_keys)}")
    hit_nose = nodes[node_index["hit_nose"]].get("extras", {}) if "hit_nose" in node_index else {}
    if not (
        hit_nose.get("invisible") is True
        and hit_nose.get("minimumProjectedTargetCssPixels") == 56
        and hit_nose.get("uiOwnsAdditionalScreenSpacePadding") is True
    ):
        failures.append("hit_nose projection/padding contract is incomplete")

    skins = document.get("skins", [])
    joint_names: list[str] = []
    ibm_hash = None
    if len(skins) != 1:
        failures.append("exactly one shared skin is required")
    else:
        skin = skins[0]
        joint_names = [nodes[index].get("name") for index in skin.get("joints", [])]
        if joint_names != rig["bones"]:
            failures.append("joint order differs from jack-rig.json")
        ibm_values = accessor_values(document, binary, skin["inverseBindMatrices"])
        ibm_hash = canonical_ibm_hash(ibm_values)
        expected_hash = manifest["sharedRig"]["inverseBindMatrixSha256"]
        if ibm_hash != expected_hash:
            failures.append("inverse-bind hash differs from the canonical shared rig")

    weight_sum_min = None
    weight_sum_max = None
    max_influences = 0
    invalid_joint_indices = 0
    if "JOINTS_0" in attributes and "WEIGHTS_0" in attributes:
        joints = accessor_values(document, binary, attributes["JOINTS_0"])
        weights = accessor_values(document, binary, attributes["WEIGHTS_0"])
        sums = [sum(row) for row in weights]
        weight_sum_min = min(sums)
        weight_sum_max = max(sums)
        max_influences = max(sum(1 for value in row if value > 1e-6) for row in weights)
        invalid_joint_indices = sum(
            1 for row in joints for index in row if int(index) < 0 or int(index) >= len(joint_names)
        )
        if any(not math.isclose(total, 1.0, abs_tol=1e-5) for total in sums):
            failures.append("skin weights do not sum to one")
        if max_influences > 4:
            failures.append("a vertex has more than four nonzero influences")
        if invalid_joint_indices:
            failures.append(f"{invalid_joint_indices} joint indices are out of range")

    targets = primitive.get("targets", [])
    target_names = meshes[0].get("extras", {}).get("targetNames", []) if meshes else []
    required_morphs = rig["requiredMorphTargetsPerSkin"]
    morph_rows = []
    if target_names != required_morphs or len(targets) != len(required_morphs):
        failures.append("morph target names/order differ from jack-rig.json")
    else:
        for name, target in zip(target_names, targets):
            values = accessor_values(document, binary, target["POSITION"])
            affected = sum(1 for row in values if any(abs(value) > 1e-6 for value in row))
            maximum_delta = max(math.sqrt(sum(value * value for value in row)) for row in values)
            if len(values) != vertex_count or affected == 0 or maximum_delta <= 0:
                failures.append(f"{name}: empty or mismatched morph target")
            morph_rows.append(
                {
                    "name": name,
                    "affectedVertices": affected,
                    "maximumDeltaMeters": round(maximum_delta, 7),
                }
            )

    material_count = len(document.get("materials", []))
    if material_count > manifest["materialContract"]["maxRenderedPrimitivesPerSkin"]:
        failures.append("material count exceeds the rendered-primitive budget")
    material_roles = (
        document.get("materials", [{}])[0].get("extras", {}).get("roles", [])
        if material_count
        else []
    )
    if material_roles != list(manifest["materialContract"]["roles"]):
        failures.append("material semantic roles differ from the asset manifest")

    texture_rows = []
    decoded_bytes = 0
    for image in document.get("images", []):
        size = png_size(document, binary, image)
        if size is None:
            failures.append(f"unable to inspect embedded image {image.get('name')}")
            continue
        width, height = size
        decoded = width * height * 4
        decoded_bytes += decoded
        texture_rows.append({"name": image.get("name"), "width": width, "height": height, "decodedBytes": decoded})
        if max(width, height) > manifest["materialContract"]["primaryTextureMax"]:
            failures.append(f"texture {image.get('name')} exceeds the 2K edge budget")
    if decoded_bytes > manifest["materialContract"]["decodedTextureMemoryMaxBytes"]:
        failures.append(
            f"decoded texture memory {decoded_bytes} exceeds "
            f"{manifest['materialContract']['decodedTextureMemoryMaxBytes']}"
        )

    if document.get("animations"):
        failures.append("age skin duplicates animations instead of using the shared library")
    scene_extras = document.get("scenes", [{}])[0].get("extras", {})
    presentation_ok = (
        scene_extras.get("presentation_only") is True
        and scene_extras.get("simulation_mutation") is False
        and scene_extras.get("root_motion_gameplay") is False
        and scene_extras.get("animations_stored_once") is True
    )
    if not presentation_ok:
        failures.append("scene presentation-only contract is incomplete")
    serialized = json.dumps(document)
    if "codex-remote-attachments" in serialized or "mshaner84" in serialized or "C:\\\\Users\\\\Mark" in serialized:
        failures.append("GLB contains a private/user-specific path or account identifier")

    report = {
        "schemaVersion": 1,
        "status": "pass-structural-pending-visual-review" if not failures else "fail",
        "age": args.age,
        "glb": path.name,
        "glbBytes": path.stat().st_size,
        "triangleCount": triangle_count,
        "vertexCount": vertex_count,
        "boundsMin": [round(value, 7) for value in bounds_min],
        "boundsMax": [round(value, 7) for value in bounds_max],
        "jointCount": len(joint_names),
        "inverseBindMatrixSha256": ibm_hash,
        "maximumInfluencesPerVertex": max_influences,
        "weightSumMin": weight_sum_min,
        "weightSumMax": weight_sum_max,
        "invalidJointIndices": invalid_joint_indices,
        "morphCount": len(targets),
        "morphs": morph_rows,
        "semanticAnchors": sorted(REQUIRED_ANCHORS),
        "materialCount": material_count,
        "textureCount": len(texture_rows),
        "textures": texture_rows,
        "decodedTextureBytes": decoded_bytes,
        "animationCount": len(document.get("animations", [])),
        "presentationContract": presentation_ok,
        "visualReviewRequired": True,
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
