"""Render phone-review/fallback stills directly from a Jack runtime GLB.

This small deterministic software renderer uses the embedded base-color map,
mesh normals, and morph positions.  It is intentionally independent of the
application and is only for static evidence/fallback images; Blender remains
the authority for final deformation and animation review.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw


COMPONENT_FORMATS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_size != len(data):
        raise ValueError("Invalid GLB 2.0 header")
    chunks = {}
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks[kind] = data[offset : offset + length]
        offset += length
    return json.loads(chunks[0x4E4F534A].decode("utf-8").rstrip(" \t\r\n\0")), chunks[0x004E4942]


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


def vector_add(left, right):
    return tuple(left[i] + right[i] for i in range(3))


def vector_sub(left, right):
    return tuple(left[i] - right[i] for i in range(3))


def vector_scale(vector, scale):
    return tuple(value * scale for value in vector)


def dot(left, right):
    return sum(left[i] * right[i] for i in range(3))


def cross(left, right):
    return (
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    )


def normalized(vector):
    length = math.sqrt(dot(vector, vector))
    if length <= 1e-12:
        return (0.0, 0.0, 0.0)
    return tuple(value / length for value in vector)


def embedded_image(document: dict, binary: bytes, image_index: int) -> Image.Image:
    image = document["images"][image_index]
    view = document["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    data = binary[start : start + view["byteLength"]]
    loaded = Image.open(BytesIO(data))
    loaded.load()
    return loaded.convert("RGB")


def morph_positions(document: dict, binary: bytes, primitive: dict, condition: str):
    positions = [tuple(row) for row in accessor_values(document, binary, primitive["attributes"]["POSITION"])]
    names = document["meshes"][0].get("extras", {}).get("targetNames", [])
    weights = {name: 0.0 for name in names}
    if condition == "hungry":
        weights["condition_hungry"] = 1.0
    elif condition == "starving":
        weights["condition_hungry"] = 1.0
        weights["condition_starving"] = 1.0
    for name, target in zip(names, primitive.get("targets", [])):
        weight = weights.get(name, 0.0)
        if weight == 0.0:
            continue
        deltas = accessor_values(document, binary, target["POSITION"])
        positions = [
            vector_add(position, vector_scale(delta, weight))
            for position, delta in zip(positions, deltas)
        ]
    return positions


def render(
    document: dict,
    binary: bytes,
    *,
    view_name: str,
    condition: str,
    output: Path,
    size: int,
) -> dict[str, object]:
    primitive = document["meshes"][0]["primitives"][0]
    positions = morph_positions(document, binary, primitive, condition)
    normals = accessor_values(document, binary, primitive["attributes"]["NORMAL"])
    uvs = accessor_values(document, binary, primitive["attributes"]["TEXCOORD_0"])
    indices = [int(row[0]) for row in accessor_values(document, binary, primitive["indices"])]
    material = document["materials"][primitive["material"]]
    texture_index = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    source_index = document["textures"][texture_index]["source"]
    texture = embedded_image(document, binary, source_index)
    texture_pixels = texture.load()

    target = (0.0, 0.64, -0.08)
    cameras = {
        "front": (0.0, 0.72, 3.25),
        "rear": (0.0, 0.72, -3.25),
        "side": (3.25, 0.72, -0.08),
        "three-quarter": (2.35, 1.05, 2.55),
    }
    camera = cameras[view_name]
    forward = normalized(vector_sub(target, camera))
    right = normalized(cross(forward, (0.0, 1.0, 0.0)))
    up = normalized(cross(right, forward))
    ortho_scale = 1.56
    supersample = 2
    canvas_size = size * supersample

    transparent = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(transparent, "RGBA")
    shadow_center = (canvas_size // 2, int(canvas_size * 0.885))
    shadow_width = int(canvas_size * (0.16 if view_name in {"front", "rear"} else 0.24))
    draw.ellipse(
        (
            shadow_center[0] - shadow_width,
            shadow_center[1] - int(canvas_size * 0.024),
            shadow_center[0] + shadow_width,
            shadow_center[1] + int(canvas_size * 0.024),
        ),
        fill=(16, 24, 38, 70),
    )

    projected = []
    for point in positions:
        relative = vector_sub(point, target)
        px = dot(relative, right) / ortho_scale
        py = dot(relative, up) / ortho_scale
        depth = dot(vector_sub(point, camera), forward)
        projected.append(
            (
                (0.5 + px) * canvas_size,
                (0.5 - py) * canvas_size,
                depth,
            )
        )

    light = normalized((-0.35, 0.75, 0.85))
    triangles = []
    for offset in range(0, len(indices), 3):
        triangle_indices = indices[offset : offset + 3]
        p0, p1, p2 = (positions[index] for index in triangle_indices)
        face_normal = normalized(cross(vector_sub(p1, p0), vector_sub(p2, p0)))
        centroid = tuple((p0[axis] + p1[axis] + p2[axis]) / 3.0 for axis in range(3))
        if dot(face_normal, vector_sub(camera, centroid)) <= 0.0:
            continue
        screen = [projected[index] for index in triangle_indices]
        if any(depth <= 0 for _x, _y, depth in screen):
            continue
        triangle_uvs = [uvs[index] for index in triangle_indices]
        barycentric_samples = (
            (1 / 3, 1 / 3, 1 / 3),
            (0.60, 0.20, 0.20),
            (0.20, 0.60, 0.20),
            (0.20, 0.20, 0.60),
            (0.45, 0.45, 0.10),
            (0.45, 0.10, 0.45),
            (0.10, 0.45, 0.45),
        )
        sampled = []
        for barycentric in barycentric_samples:
            uv = tuple(
                sum(triangle_uvs[corner][axis] * barycentric[corner] for corner in range(3))
                for axis in range(2)
            )
            u = max(0.0, min(1.0, uv[0]))
            v = max(0.0, min(1.0, uv[1]))
            tx = int(u * (texture.width - 1))
            # glTF texture coordinates use the image's upper-left origin.
            ty = int(v * (texture.height - 1))
            sampled.append(texture_pixels[tx, ty])
        usable = [color for color in sampled if sum(color) > 36]
        colors = usable or sampled
        base = tuple(int(sum(color[channel] for color in colors) / len(colors)) for channel in range(3))
        vertex_normal = normalized(
            tuple(sum(normals[index][axis] for index in triangle_indices) / 3.0 for axis in range(3))
        )
        brightness = 0.62 + 0.38 * max(0.0, dot(vertex_normal, light))
        color = tuple(max(0, min(255, int(channel * brightness))) for channel in base) + (255,)
        triangles.append(
            (
                sum(point[2] for point in screen) / 3.0,
                [(point[0], point[1]) for point in screen],
                color,
            )
        )

    for _depth, polygon, color in sorted(triangles, key=lambda row: row[0], reverse=True):
        draw.polygon(polygon, fill=color)
    transparent = transparent.resize((size, size), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    transparent.save(output, format="PNG", optimize=True)
    return {
        "view": view_name,
        "condition": condition,
        "file": output.name,
        "width": size,
        "height": size,
        "drawnTriangles": len(triangles),
        "transparentBackground": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--age", choices=("baby", "teen", "adult"), required=True)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    document, binary = parse_glb(Path(args.glb).resolve())
    output_dir = Path(args.output_dir).resolve()
    rows = []
    for view_name in ("front", "side", "three-quarter", "rear"):
        rows.append(
            render(
                document,
                binary,
                view_name=view_name,
                condition="healthy",
                output=output_dir / f"{args.age}-healthy-{view_name}.png",
                size=args.size,
            )
        )
    for condition in ("hungry", "starving"):
        rows.append(
            render(
                document,
                binary,
                view_name="three-quarter",
                condition=condition,
                output=output_dir / f"{args.age}-{condition}.png",
                size=args.size,
            )
        )
    report = {
        "schemaVersion": 1,
        "status": "rendered-pending-human-visual-review",
        "renderer": "deterministic PIL triangle/texture fallback renderer",
        "authoritativeForAnimationDeformation": False,
        "age": args.age,
        "renders": rows,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
