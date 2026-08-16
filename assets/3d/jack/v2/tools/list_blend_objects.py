"""Print a compact object inventory for a Jack Blender source."""
import argparse
import json
import sys
from pathlib import Path
import bpy

forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--blend", required=True)
args = parser.parse_args(forwarded)
bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
print(json.dumps([
    {"name": obj.name, "type": obj.type, "parent": obj.parent.name if obj.parent else None,
     "hidden": obj.hide_get(), "render": obj.hide_render}
    for obj in bpy.context.scene.objects
], indent=2))
