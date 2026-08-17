"""Report disconnected mesh islands in the imported shepherd source."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    obj = bpy.data.objects["GermanShepherd"]
    mesh = obj.data
    adjacency: dict[int, set[int]] = defaultdict(set)
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)

    unseen = set(range(len(mesh.vertices)))
    components = []
    while unseen:
        seed = min(unseen)
        queue = deque([seed])
        vertices = set()
        while queue:
            current = queue.popleft()
            if current not in unseen:
                continue
            unseen.remove(current)
            vertices.add(current)
            queue.extend(adjacency[current] & unseen)
        points = [obj.matrix_world @ mesh.vertices[index].co for index in vertices]
        polygons = [poly for poly in mesh.polygons if set(poly.vertices).issubset(vertices)]
        material_counts: dict[str, int] = defaultdict(int)
        for poly in polygons:
            name = obj.material_slots[poly.material_index].material.name if obj.material_slots else "none"
            material_counts[name] += max(len(poly.vertices) - 2, 1)
        groups: dict[str, int] = defaultdict(int)
        for index in vertices:
            for membership in mesh.vertices[index].groups:
                if membership.weight > 0.01:
                    groups[obj.vertex_groups[membership.group].name] += 1
        low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
        high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
        components.append({
            "vertexCount": len(vertices),
            "triangleCount": sum(max(len(poly.vertices) - 2, 1) for poly in polygons),
            "boundsMin": [round(value, 6) for value in low],
            "boundsMax": [round(value, 6) for value in high],
            "dimensions": [round(high[i] - low[i], 6) for i in range(3)],
            "dominantGroups": sorted(groups.items(), key=lambda item: (-item[1], item[0]))[:8],
            "materials": dict(material_counts),
            "vertexIndices": sorted(vertices),
        })
    components.sort(key=lambda item: (-item["triangleCount"], item["boundsMin"]))
    for index, component in enumerate(components):
        component["componentIndex"] = index

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {"schemaVersion": 1, "componentCount": len(components), "components": components}
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "componentCount": len(components),
        "summary": [{key: item[key] for key in ("componentIndex", "vertexCount", "triangleCount", "boundsMin", "boundsMax", "dominantGroups")} for item in components],
    }, indent=2))


if __name__ == "__main__":
    main()
