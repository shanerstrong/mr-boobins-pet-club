"""Build one deterministic Jack age-skin GLB around the canonical shared rig.

The script consumes an already-approved optimized Meshy GLB and the canonical
animation-only GLB.  It normalizes the mesh, adds four-influence skin weights,
adds the required presentation morph targets, and embeds the exact shared rest
skeleton/inverse-bind matrices.  Animation clips stay external and are not
duplicated into each age file.

This is a local binary transformation.  It does not call Meshy, spend credits,
touch application state, or change simulation/persistence behavior.
"""

from __future__ import annotations

import argparse
import ast
import copy
import hashlib
import json
import math
import struct
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image


MORPH_NAMES = [
    "condition_hungry",
    "condition_starving",
    "blink",
    "lids_tired",
    "nose_compress",
    "smile",
    "mouth_open",
    "tongue_out",
]
MATERIAL_ROLES = [
    "fur",
    "ear",
    "eyes",
    "nose",
    "mouth_tongue",
    "collar",
    "tag",
    "condition_dirty",
]
TARGET_HEIGHT = 1.30
TARGET_CENTER_Z = -0.08

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--age", choices=("baby", "teen", "adult"), required=True)
    parser.add_argument("--input-glb", required=True)
    parser.add_argument("--rig-glb", required=True)
    parser.add_argument("--rig-builder", required=True)
    parser.add_argument("--rig-contract", required=True)
    parser.add_argument("--output-glb", required=True)
    parser.add_argument("--metrics", required=True)
    return parser.parse_args()


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path.name}: GLB is too short")
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_size != len(data):
        raise ValueError(f"{path.name}: invalid GLB 2.0 header")
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
    return [
        struct.unpack_from("<" + fmt * components, binary, start + index * stride)
        for index in range(accessor["count"])
    ]


def accessor_bytes(document: dict, binary: bytes, accessor_index: int) -> bytes:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    _fmt, component_size = COMPONENT_FORMATS[accessor["componentType"]]
    components = TYPE_COMPONENTS[accessor["type"]]
    element_size = component_size * components
    stride = view.get("byteStride", element_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    if stride == element_size:
        return binary[start : start + accessor["count"] * element_size]
    result = bytearray()
    for index in range(accessor["count"]):
        element_start = start + index * stride
        result.extend(binary[element_start : element_start + element_size])
    return bytes(result)


def extract_bones(path: Path) -> dict[str, tuple[tuple[float, float, float], tuple[float, float, float], str | None]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "BONES" for target in node.targets
        ):
            value = ast.literal_eval(node.value)
            return value
    raise ValueError("Canonical BONES literal was not found in the shared-rig builder")


def blender_to_gltf(point: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = point
    return (x, z, -y)


def point_segment_distance(
    point: tuple[float, float, float],
    start: tuple[float, float, float],
    end: tuple[float, float, float],
) -> float:
    vx, vy, vz = (end[i] - start[i] for i in range(3))
    wx, wy, wz = (point[i] - start[i] for i in range(3))
    length_squared = vx * vx + vy * vy + vz * vz
    if length_squared <= 1e-12:
        return math.sqrt(wx * wx + wy * wy + wz * wz)
    t = max(0.0, min(1.0, (wx * vx + wy * vy + wz * vz) / length_squared))
    dx = point[0] - (start[0] + t * vx)
    dy = point[1] - (start[1] + t * vy)
    dz = point[2] - (start[2] + t * vz)
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def candidate_bones(point: tuple[float, float, float]) -> list[str]:
    x, y, z = point
    side = "L" if x < 0 else "R"
    if y > 1.02 and z > 0.16:
        return [f"ear_{side}_tip", f"ear_{side}_base", "head", "neck_02"]
    if y > 0.77 and z > 0.14:
        return ["muzzle", "jaw", "head", "neck_02", "neck_01", "chest"]
    if z < -0.30 and y > 0.28:
        return ["tail_04", "tail_03", "tail_02", "tail_01", "pelvis", "spine_01"]
    if y < 0.70 and abs(x) > 0.045 and z >= 0.02:
        return [
            f"front_toe_{side}",
            f"front_paw_{side}",
            f"wrist_{side}",
            f"forearm_{side}",
            f"upper_arm_{side}",
            f"scapula_{side}",
            "chest",
        ]
    if y < 0.70 and abs(x) > 0.045 and z < 0.02:
        return [
            f"rear_toe_{side}",
            f"rear_paw_{side}",
            f"hock_{side}",
            f"shin_{side}",
            f"thigh_{side}",
            "pelvis",
        ]
    if y > 0.70:
        return ["neck_02", "neck_01", "chest", "spine_02", "spine_01", "pelvis", "head"]
    return ["chest", "spine_02", "spine_01", "pelvis", "neck_01"]


def build_weights(
    positions: list[tuple[float, float, float]],
    segments: dict[str, tuple[tuple[float, float, float], tuple[float, float, float]]],
    joint_index: dict[str, int],
) -> tuple[list[tuple[int, int, int, int]], list[tuple[float, float, float, float]], dict[str, object]]:
    joints_rows = []
    weights_rows = []
    per_bone_vertices: dict[str, int] = {name: 0 for name in joint_index}
    min_weight = 1.0
    max_weight = 0.0
    for point in positions:
        ranked = []
        for name in candidate_bones(point):
            if name not in segments or name not in joint_index:
                continue
            distance = point_segment_distance(point, *segments[name])
            ranked.append((distance, name))
        ranked.sort(key=lambda row: (row[0], row[1]))
        selected = ranked[:4]
        if not selected:
            raise RuntimeError("No skinning candidate bones for a vertex")
        raw = [1.0 / ((distance + 0.025) ** 2) for distance, _name in selected]
        total = sum(raw)
        normalized = [value / total for value in raw]
        while len(selected) < 4:
            selected.append((0.0, selected[0][1]))
            normalized.append(0.0)
        joint_row = tuple(joint_index[name] for _distance, name in selected)
        weight_row = tuple(normalized)
        joints_rows.append(joint_row)
        weights_rows.append(weight_row)
        for weight, (_distance, name) in zip(weight_row, selected):
            if weight > 1e-6:
                per_bone_vertices[name] += 1
                min_weight = min(min_weight, weight)
                max_weight = max(max_weight, weight)
    used_bones = sorted(name for name, count in per_bone_vertices.items() if count)
    return joints_rows, weights_rows, {
        "usedBoneCount": len(used_bones),
        "usedBones": used_bones,
        "verticesPerBone": {name: per_bone_vertices[name] for name in used_bones},
        "minimumNonzeroWeight": round(min_weight, 9),
        "maximumWeight": round(max_weight, 9),
        "maximumInfluencesPerVertex": 4,
    }


def gaussian(point: tuple[float, float, float], center: tuple[float, float, float], radius: tuple[float, float, float]) -> float:
    squared = sum(((point[index] - center[index]) / radius[index]) ** 2 for index in range(3))
    return math.exp(-2.0 * squared)


def morph_delta(name: str, point: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = point
    if name in {"condition_hungry", "condition_starving"}:
        torso = gaussian(point, (0.0, 0.64, -0.06), (0.28, 0.35, 0.46))
        torso *= min(1.0, max(0.0, (y - 0.22) / 0.22))
        if name == "condition_hungry":
            return (-0.10 * x * torso, 0.012 * torso, -0.040 * (z + 0.06) * torso)
        return (-0.13 * x * torso, 0.022 * torso, -0.060 * (z + 0.06) * torso)
    if name == "blink":
        left = gaussian(point, (-0.092, 0.955, 0.345), (0.072, 0.090, 0.075))
        right = gaussian(point, (0.092, 0.955, 0.345), (0.072, 0.090, 0.075))
        mask = max(left, right)
        return (0.0, (0.955 - y) * 0.78 * mask, 0.0)
    if name == "lids_tired":
        left = gaussian(point, (-0.092, 0.978, 0.345), (0.075, 0.065, 0.078))
        right = gaussian(point, (0.092, 0.978, 0.345), (0.075, 0.065, 0.078))
        return (0.0, -0.038 * max(left, right), 0.003 * max(left, right))
    if name == "nose_compress":
        mask = gaussian(point, (0.0, 0.900, 0.545), (0.095, 0.105, 0.075))
        return (-0.06 * x * mask, 0.0, -0.050 * mask)
    if name == "smile":
        mask = gaussian(point, (0.0, 0.825, 0.455), (0.145, 0.110, 0.105))
        outward = 0.012 if x >= 0 else -0.012
        return (outward * mask, 0.028 * mask * min(1.0, abs(x) / 0.055), 0.004 * mask)
    if name == "mouth_open":
        mask = gaussian(point, (0.0, 0.790, 0.470), (0.120, 0.085, 0.095))
        lower = min(1.0, max(0.0, (0.835 - y) / 0.080))
        return (0.0, -0.055 * mask * lower, 0.010 * mask * lower)
    if name == "tongue_out":
        mask = gaussian(point, (0.0, 0.765, 0.475), (0.075, 0.075, 0.085))
        center = max(0.0, 1.0 - abs(x) / 0.080)
        return (0.0, -0.018 * mask * center, 0.085 * mask * center)
    raise ValueError(name)


def append_blob(binary: bytearray, views: list[dict], data: bytes, *, target: int | None = None) -> int:
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    binary.extend(data)
    view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
    if target is not None:
        view["target"] = target
    views.append(view)
    return len(views) - 1


def resized_png(data: bytes, maximum_edge: int) -> bytes:
    with Image.open(BytesIO(data)) as image:
        image.load()
        if max(image.size) > maximum_edge:
            scale = maximum_edge / max(image.size)
            size = (
                max(1, int(round(image.width * scale))),
                max(1, int(round(image.height * scale))),
            )
            image = image.resize(size, Image.Resampling.LANCZOS)
        output = BytesIO()
        image.save(output, format="PNG", optimize=True, compress_level=9)
        return output.getvalue()


def repack_raw_binary(raw: dict, raw_binary: bytes) -> tuple[list[dict], bytearray, list[dict[str, object]]]:
    image_by_view = {
        image["bufferView"]: image
        for image in raw.get("images", [])
        if image.get("mimeType") == "image/png" and "bufferView" in image
    }
    limits = {
        "Baked_BaseColor": 896,
        "normal": 512,
        "Baked_MetallicRoughness": 512,
    }
    views = copy.deepcopy(raw["bufferViews"])
    output = bytearray()
    texture_rows = []
    for index, (source_view, target_view) in enumerate(zip(raw["bufferViews"], views)):
        start = source_view.get("byteOffset", 0)
        data = raw_binary[start : start + source_view["byteLength"]]
        image = image_by_view.get(index)
        if image is not None:
            limit = limits.get(image.get("name"), 512)
            before_bytes = len(data)
            data = resized_png(data, limit)
            with Image.open(BytesIO(data)) as resized:
                width, height = resized.size
            texture_rows.append(
                {
                    "name": image.get("name"),
                    "maximumEdge": limit,
                    "width": width,
                    "height": height,
                    "sourceBytes": before_bytes,
                    "outputBytes": len(data),
                }
            )
        while len(output) % 4:
            output.append(0)
        target_view["byteOffset"] = len(output)
        target_view["byteLength"] = len(data)
        output.extend(data)
    return views, output, texture_rows


def add_accessor(
    document: dict,
    binary: bytearray,
    data: bytes,
    *,
    component_type: int,
    count: int,
    value_type: str,
    target: int | None = None,
    minimum: list[float] | None = None,
    maximum: list[float] | None = None,
) -> int:
    view_index = append_blob(binary, document["bufferViews"], data, target=target)
    accessor = {
        "bufferView": view_index,
        "componentType": component_type,
        "count": count,
        "type": value_type,
    }
    if minimum is not None:
        accessor["min"] = minimum
    if maximum is not None:
        accessor["max"] = maximum
    document["accessors"].append(accessor)
    return len(document["accessors"]) - 1


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    binary_padded = binary + b"\0" * ((4 - len(binary) % 4) % 4)
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_padded = json_bytes + b" " * ((4 - len(json_bytes) % 4) % 4)
    total = 12 + 8 + len(json_padded) + 8 + len(binary_padded)
    output = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    output.extend(struct.pack("<II", len(json_padded), 0x4E4F534A))
    output.extend(json_padded)
    output.extend(struct.pack("<II", len(binary_padded), 0x004E4942))
    output.extend(binary_padded)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(output)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input_glb).resolve()
    rig_path = Path(args.rig_glb).resolve()
    output_path = Path(args.output_glb).resolve()
    metrics_path = Path(args.metrics).resolve()
    raw, raw_binary = parse_glb(input_path)
    rig, rig_binary = parse_glb(rig_path)
    contract = json.loads(Path(args.rig_contract).read_text(encoding="utf-8"))
    bones = extract_bones(Path(args.rig_builder))

    if len(raw.get("meshes", [])) != 1 or len(raw["meshes"][0].get("primitives", [])) != 1:
        raise ValueError("Age-source GLB must contain exactly one mesh primitive")
    primitive = raw["meshes"][0]["primitives"][0]
    position_accessor_index = primitive["attributes"]["POSITION"]
    raw_positions = accessor_values(raw, raw_binary, position_accessor_index)
    min_x = min(point[0] for point in raw_positions)
    max_x = max(point[0] for point in raw_positions)
    min_y = min(point[1] for point in raw_positions)
    max_y = max(point[1] for point in raw_positions)
    min_z = min(point[2] for point in raw_positions)
    max_z = max(point[2] for point in raw_positions)
    scale = TARGET_HEIGHT / (max_y - min_y)
    center_x = (min_x + max_x) * 0.5
    center_z = (min_z + max_z) * 0.5
    positions = [
        (
            (point[0] - center_x) * scale,
            (point[1] - min_y) * scale,
            (point[2] - center_z) * scale + TARGET_CENTER_Z,
        )
        for point in raw_positions
    ]

    repacked_views, binary, texture_reduction = repack_raw_binary(raw, raw_binary)
    document = {
        key: copy.deepcopy(raw[key])
        for key in ("accessors", "images", "materials", "samplers", "textures")
        if key in raw
    }
    document["bufferViews"] = repacked_views
    document["asset"] = {
        "version": "2.0",
        "generator": "Mr. Boobins deterministic Jack skin builder v1",
        "extras": {
            "source": "approved Meshy Pro optimized GLB",
            "originalAsset": True,
            "privateReferencesEmbedded": False,
        },
    }
    document["extensionsUsed"] = copy.deepcopy(raw.get("extensionsUsed", []))
    if not document["extensionsUsed"]:
        document.pop("extensionsUsed")
    position_accessor = document["accessors"][position_accessor_index]
    position_view = document["bufferViews"][position_accessor["bufferView"]]
    position_start = position_view.get("byteOffset", 0) + position_accessor.get("byteOffset", 0)
    position_stride = position_view.get("byteStride", 12)
    for index, point in enumerate(positions):
        struct.pack_into("<fff", binary, position_start + index * position_stride, *point)
    position_accessor["min"] = [min(point[i] for point in positions) for i in range(3)]
    position_accessor["max"] = [max(point[i] for point in positions) for i in range(3)]

    rig_nodes = copy.deepcopy(rig["nodes"])
    rig_skin = copy.deepcopy(rig["skins"][0])
    joint_names = [rig_nodes[index]["name"] for index in rig_skin["joints"]]
    if joint_names != contract["bones"]:
        raise ValueError("Shared GLB joint order differs from jack-rig.json")
    joint_index = {name: index for index, name in enumerate(joint_names)}
    segments = {
        name: (blender_to_gltf(head), blender_to_gltf(tail))
        for name, (head, tail, _parent) in bones.items()
    }
    joints_rows, weights_rows, weight_metrics = build_weights(positions, segments, joint_index)
    joints_data = b"".join(struct.pack("<BBBB", *row) for row in joints_rows)
    weights_data = b"".join(struct.pack("<ffff", *row) for row in weights_rows)
    joints_accessor = add_accessor(
        document,
        binary,
        joints_data,
        component_type=5121,
        count=len(positions),
        value_type="VEC4",
        target=34962,
    )
    weights_accessor = add_accessor(
        document,
        binary,
        weights_data,
        component_type=5126,
        count=len(positions),
        value_type="VEC4",
        target=34962,
    )

    morph_accessors = []
    morph_metrics = []
    for name in MORPH_NAMES:
        deltas = [morph_delta(name, point) for point in positions]
        data = b"".join(struct.pack("<fff", *delta) for delta in deltas)
        minimum = [min(delta[axis] for delta in deltas) for axis in range(3)]
        maximum = [max(delta[axis] for delta in deltas) for axis in range(3)]
        accessor_index = add_accessor(
            document,
            binary,
            data,
            component_type=5126,
            count=len(positions),
            value_type="VEC3",
            target=34962,
            minimum=minimum,
            maximum=maximum,
        )
        morph_accessors.append(accessor_index)
        affected = sum(1 for delta in deltas if any(abs(value) > 1e-6 for value in delta))
        maximum_delta = max(math.sqrt(sum(value * value for value in delta)) for delta in deltas)
        morph_metrics.append(
            {
                "name": name,
                "affectedVertices": affected,
                "maximumDeltaMeters": round(maximum_delta, 7),
                "min": [round(value, 7) for value in minimum],
                "max": [round(value, 7) for value in maximum],
            }
        )

    ibm_source_index = rig_skin["inverseBindMatrices"]
    ibm_source = rig["accessors"][ibm_source_index]
    ibm_accessor = add_accessor(
        document,
        binary,
        accessor_bytes(rig, rig_binary, ibm_source_index),
        component_type=ibm_source["componentType"],
        count=ibm_source["count"],
        value_type=ibm_source["type"],
    )
    rig_skin["inverseBindMatrices"] = ibm_accessor
    rig_skin["name"] = "Jack_Shared_Rig"
    rig_skin["extras"] = {
        "canonical": True,
        "animationLibrary": "jack-rig-animations.glb",
        "maximumInfluencesPerVertex": 4,
    }

    output_primitive = copy.deepcopy(primitive)
    output_primitive["attributes"]["JOINTS_0"] = joints_accessor
    output_primitive["attributes"]["WEIGHTS_0"] = weights_accessor
    output_primitive["targets"] = [{"POSITION": index} for index in morph_accessors]
    document["meshes"] = [
        {
            "name": f"Jack_{args.age.title()}_Skin",
            "primitives": [output_primitive],
            "weights": [0.0] * len(MORPH_NAMES),
            "extras": {
                "targetNames": MORPH_NAMES,
                "age": args.age,
                "presentationOnly": True,
            },
        }
    ]
    for material in document.get("materials", []):
        material["name"] = "Jack_Surface"
        material["extras"] = {
            "contract": "jack-material-v1",
            "roles": MATERIAL_ROLES,
            "primaryTextureMax": 2048,
        }

    mesh_node_index = len(rig_nodes)
    rig_nodes.append(
        {
            "name": f"Jack_{args.age.title()}_Skin",
            "mesh": 0,
            "skin": 0,
            "extras": {
                "age": args.age,
                "presentationOnly": True,
                "simulationMutation": False,
            },
        }
    )

    node_index_by_name = {node.get("name"): index for index, node in enumerate(rig_nodes)}

    def add_anchor(
        name: str,
        parent_name: str,
        translation: tuple[float, float, float],
        extras: dict[str, object] | None = None,
    ) -> int:
        parent_index = node_index_by_name[parent_name]
        anchor_index = len(rig_nodes)
        anchor = {
            "name": name,
            "translation": list(translation),
            "extras": {
                "semanticAnchor": True,
                "presentationOnly": True,
                "simulationMutation": False,
                **(extras or {}),
            },
        }
        rig_nodes.append(anchor)
        rig_nodes[parent_index].setdefault("children", []).append(anchor_index)
        node_index_by_name[name] = anchor_index
        return anchor_index

    add_anchor("nose_visual", "muzzle", (0.0, 0.18, 0.0))
    add_anchor(
        "hit_nose",
        "muzzle",
        (0.0, 0.18, 0.0),
        {
            "invisible": True,
            "proxyShape": "sphere",
            "radiusMeters": 0.085,
            "minimumProjectedTargetCssPixels": 56,
            "uiOwnsAdditionalScreenSpacePadding": True,
        },
    )
    add_anchor("mouth_anchor", "jaw", (0.0, 0.13, 0.0))
    add_anchor("collar", "neck_01", (0.0, 0.055, 0.0))
    add_anchor("tag", "chest", (0.0, 0.035, 0.055))
    tail_node = rig_nodes[node_index_by_name["tail_01"]]
    add_anchor(
        "tail_base",
        "pelvis",
        tuple(tail_node.get("translation", (0.0, 0.0, 0.0))),
    )
    add_anchor("paw_front_l", "front_paw_L", (0.0, 0.055, 0.0))
    add_anchor("paw_front_r", "front_paw_R", (0.0, 0.055, 0.0))

    jack_root_index = len(rig_nodes)
    rig_nodes.append(
        {
            "name": "jack_root",
            "children": [rig["scenes"][0]["nodes"][0], mesh_node_index],
            "extras": {
                "identityTransformRequired": True,
                "groundContactAxis": "Y",
                "groundContactValue": 0.0,
                "unit": "meter",
                "forwardAxis": "+Z",
                "authoringForwardAxis": "-Y",
                "presentationOnly": True,
                "simulationMutation": False,
            },
        }
    )
    document["nodes"] = rig_nodes
    document["skins"] = [rig_skin]
    document["scenes"] = [
        {
            "name": f"Jack_{args.age.title()}_Skin_Scene",
            "nodes": [jack_root_index],
            "extras": {
                "jack_asset_role": "interchangeable-age-skin",
                "age": args.age,
                "presentation_only": True,
                "simulation_mutation": False,
                "root_motion_gameplay": False,
                "animations_stored_once": True,
                "animation_library": "jack-rig-animations.glb",
                "material_contract": "jack-material-v1",
                "condition_contract": "healthy-hungry-starving-v1",
            },
        }
    ]
    document["scene"] = 0
    document.pop("animations", None)
    write_glb(output_path, document, bytes(binary))

    index_accessor = document["accessors"][output_primitive["indices"]]
    triangle_count = index_accessor["count"] // 3
    metrics = {
        "schemaVersion": 1,
        "status": "built-pending-visual-deformation-review",
        "age": args.age,
        "input": input_path.name,
        "inputSha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
        "output": output_path.name,
        "outputBytes": output_path.stat().st_size,
        "outputSha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
        "vertexCount": len(positions),
        "triangleCount": triangle_count,
        "normalizedBoundsMin": [round(value, 7) for value in position_accessor["min"]],
        "normalizedBoundsMax": [round(value, 7) for value in position_accessor["max"]],
        "jointCount": len(joint_names),
        "jointNames": joint_names,
        "morphCount": len(MORPH_NAMES),
        "morphs": morph_metrics,
        "materialCount": len(document.get("materials", [])),
        "materialRoles": MATERIAL_ROLES,
        "textureReduction": texture_reduction,
        "animationCount": 0,
        "externalAnimationLibrary": "jack-rig-animations.glb",
        "presentationOnly": True,
        "simulationMutation": False,
        "privateReferencesEmbedded": False,
        "weightMetrics": weight_metrics,
    }
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(
        f"JACK_SKIN_BUILD_COMPLETE age={args.age} vertices={len(positions)} "
        f"triangles={triangle_count}"
    )


if __name__ == "__main__":
    main()
