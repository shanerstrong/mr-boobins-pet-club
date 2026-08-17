"""Build an additive Jack prototype on the native Quaternius shepherd rig."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix


KEEP_COMPONENTS = {0, 2, 3, 5, 6}
EYE_COMPONENTS = {2, 3}
PUPIL_COMPONENTS = {5, 6}


def parse_args() -> argparse.Namespace:
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--components", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(forwarded)


def make_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def parent_to_bone(obj: bpy.types.Object, rig: bpy.types.Object, bone_name: str) -> None:
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def skin_to_bone(obj: bpy.types.Object, rig: bpy.types.Object, bone_name: str) -> None:
    """Bind rigid identity geometry through the armature instead of bone parenting.

    The FBX actions contain bone scale channels; direct bone parenting therefore
    exaggerates accessory scale, while the armature modifier correctly applies
    the imported inverse bind relationship.
    """
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "OBJECT"
    obj.matrix_world = world
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    modifier = obj.modifiers.new(name="Jack_V3_Armature", type="ARMATURE")
    modifier.object = rig


def make_anchor(name: str, rig: bpy.types.Object, bone: str, location: tuple[float, float, float]) -> bpy.types.Object:
    anchor = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(anchor)
    anchor.empty_display_type = "PLAIN_AXES"
    anchor.empty_display_size = 0.04
    anchor.location = location
    parent_to_bone(anchor, rig, bone)
    return anchor


def main() -> None:
    args = parse_args()
    source = Path(args.blend).resolve()
    component_report = json.loads(Path(args.components).resolve().read_text(encoding="utf-8"))
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()

    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    rig = bpy.data.objects["AnimalArmature"]
    body = bpy.data.objects["GermanShepherd"]
    body.name = "Jack_V3_Body"
    body.data.name = "Jack_V3_Body_Mesh"

    components = {item["componentIndex"]: set(item["vertexIndices"]) for item in component_report["components"]}
    unwanted = set().union(*(vertices for index, vertices in components.items() if index not in KEEP_COMPONENTS))

    fur = make_material("Jack_Fur_White", (0.91, 0.88, 0.82, 1.0), 0.74)
    eye = make_material("Jack_Eye_Charcoal", (0.055, 0.045, 0.05, 1.0), 0.24)
    pupil = make_material("Jack_Eye_Depth", (0.012, 0.010, 0.014, 1.0), 0.18)
    nose_mat = make_material("Jack_Nose_Mauve_Charcoal", (0.20, 0.13, 0.16, 1.0), 0.30)
    collar_mat = make_material("Jack_Collar_Blue", (0.055, 0.28, 0.52, 1.0), 0.48)
    tag_mat = make_material("Jack_Tag_Brass", (0.62, 0.38, 0.10, 1.0), 0.38)
    tongue_mat = make_material("Jack_Tongue_Mauve", (0.58, 0.25, 0.34, 1.0), 0.46)

    body.data.materials.clear()
    for material in (fur, eye, pupil):
        body.data.materials.append(material)
    for polygon in body.data.polygons:
        vertices = set(polygon.vertices)
        if any(vertices.issubset(components[index]) for index in EYE_COMPONENTS):
            polygon.material_index = 1
        elif any(vertices.issubset(components[index]) for index in PUPIL_COMPONENTS):
            polygon.material_index = 2
        else:
            polygon.material_index = 0

    # Flatten the donor's spherical cartoon eyes into Jack's darker almond read.
    for component_index, scale in ((2, (1.10, 0.42, 0.48)), (3, (1.10, 0.42, 0.48)), (5, (1.08, 0.40, 0.55)), (6, (1.08, 0.40, 0.55))):
        indices = components[component_index]
        center = sum((body.data.vertices[index].co for index in indices), body.data.vertices[next(iter(indices))].co * 0.0) / len(indices)
        for index in indices:
            offset = body.data.vertices[index].co - center
            offset.x *= scale[0]
            offset.y *= scale[1]
            offset.z *= scale[2]
            body.data.vertices[index].co = center + offset

    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for vertex in body.data.vertices:
        vertex.select = vertex.index in unwanted
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    body.select_set(False)

    # Jack's nose is a deliberate oversized identity feature.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0.0, -0.705, 0.724))
    nose = bpy.context.object
    nose.name = "nose_visual"
    nose.scale = (0.100, 0.052, 0.062)
    nose.data.materials.append(nose_mat)
    skin_to_bone(nose, rig, "Head")

    bpy.ops.mesh.primitive_torus_add(major_radius=0.126, minor_radius=0.015, major_segments=20, minor_segments=6, location=(0.0, -0.326, 0.655), rotation=(1.5707963, 0.0, 0.0))
    collar = bpy.context.object
    collar.name = "collar"
    collar.data.materials.append(collar_mat)
    skin_to_bone(collar, rig, "Neck1")

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(-0.045, -0.390, 0.535))
    tag = bpy.context.object
    tag.name = "tag"
    tag.scale = (0.042, 0.016, 0.052)
    tag.data.materials.append(tag_mat)
    skin_to_bone(tag, rig, "Neck1")

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0.0, -0.735, 0.634))
    tongue = bpy.context.object
    tongue.name = "tongue_visual"
    tongue.scale = (0.036, 0.050, 0.022)
    tongue.data.materials.append(tongue_mat)
    skin_to_bone(tongue, rig, "Head")

    root = bpy.data.objects.new("jack_root", None)
    bpy.context.collection.objects.link(root)
    rig.parent = root
    rig.name = "Jack_Quadruped_Rig_V3"

    make_anchor("head", rig, "Head", (0.0, -0.55, 0.77))
    make_anchor("mouth_anchor", rig, "Head", (0.0, -0.748, 0.66))
    make_anchor("tail_base", rig, "Tail1", (0.0, 0.50, 0.51))
    make_anchor("paw_front_l", rig, "FrontLowerLeg.L", (0.13, -0.39, 0.035))
    make_anchor("paw_front_r", rig, "FrontLowerLeg.R", (-0.13, -0.39, 0.035))
    make_anchor("hit_nose", rig, "Head", (0.0, -0.78, 0.724))
    bpy.data.objects["hit_nose"].hide_render = True
    bpy.data.objects["hit_nose"]["screenTargetCssPixels"] = 56

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 101
    scene.render.fps = 30
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), check_existing=False)

    body.data.calc_loop_triangles()
    report = {
        "schemaVersion": 1,
        "status": "prototype-built",
        "source": source.name,
        "output": output.name,
        "license": "CC-BY-3.0",
        "attribution": "German Shepard by Quaternius (poly.pizza), CC BY 3.0",
        "removedAccessoryComponentCount": len(components) - len(KEEP_COMPONENTS),
        "bodyTriangles": len(body.data.loop_triangles),
        "boneCount": len(rig.data.bones),
        "actionCount": len(bpy.data.actions),
        "identityAdditions": ["nose_visual", "tongue_visual", "collar", "tag"],
        "stableAnchors": ["jack_root", "head", "nose_visual", "hit_nose", "mouth_anchor", "collar", "tag", "tail_base", "paw_front_l", "paw_front_r"],
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
