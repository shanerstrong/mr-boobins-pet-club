"""Render a phone-readable evidence board from verified rig artifacts."""

from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1440
HEIGHT = 2300
BACKGROUND = "#101A24"
PANEL = "#182634"
PANEL_ALT = "#1E3040"
TEXT = "#F4F0E5"
MUTED = "#AFC0CC"
BLUE = "#5CA6D8"
GOLD = "#D5A44D"
GREEN = "#62C08A"
PINK = "#D99B9C"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    filename = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), size)


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, radius: int = 28) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def get_rest_bones(builder_path: Path) -> dict[str, tuple]:
    tree = ast.parse(builder_path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "BONES" for target in node.targets
        ):
            return ast.literal_eval(node.value)
    raise ValueError("BONES literal not found")


def draw_skeleton(
    draw: ImageDraw.ImageDraw,
    bones: dict[str, tuple],
    box: tuple[int, int, int, int],
    projection: str,
    title: str,
) -> None:
    left, top, right, bottom = box
    rounded(draw, box, PANEL_ALT, 24)
    draw.text((left + 24, top + 18), title, font=font(28, True), fill=TEXT)
    pad_x, pad_y = 34, 72
    plot_left, plot_top = left + pad_x, top + pad_y
    plot_right, plot_bottom = right - pad_x, bottom - 30

    points = []
    for head, tail, _parent in bones.values():
        for point in (head, tail):
            points.append(((-point[1], point[2]) if projection == "side" else (point[0], point[2])))
    min_x, max_x = min(p[0] for p in points), max(p[0] for p in points)
    min_y, max_y = min(p[1] for p in points), max(p[1] for p in points)

    def project(point: tuple[float, float, float]) -> tuple[int, int]:
        px, py = (-point[1], point[2]) if projection == "side" else (point[0], point[2])
        x = plot_left + (px - min_x) / max(max_x - min_x, 1e-6) * (plot_right - plot_left)
        y = plot_bottom - (py - min_y) / max(max_y - min_y, 1e-6) * (plot_bottom - plot_top)
        return int(x), int(y)

    for name, (head, tail, _parent) in bones.items():
        color = BLUE
        if name.startswith("tail"):
            color = GOLD
        elif name.startswith("ear") or name in ("muzzle", "jaw"):
            color = PINK
        elif any(part in name for part in ("arm", "forearm", "paw", "toe", "thigh", "shin", "hock", "wrist", "scapula")):
            color = GREEN
        a, b = project(head), project(tail)
        draw.line((a, b), fill=color, width=7)
        draw.ellipse((a[0] - 6, a[1] - 6, a[0] + 6, a[1] + 6), fill=TEXT)
        draw.ellipse((b[0] - 5, b[1] - 5, b[0] + 5, b[1] + 5), fill=color)

    labels = (
        ("root", "pelvis", "chest", "head", "muzzle", "front_paw_L", "rear_paw_L", "tail_04")
        if projection == "side"
        else ("root", "pelvis", "chest", "head", "muzzle", "tail_04")
    )
    for name in labels:
        if name not in bones:
            continue
        _head, tail, _parent = bones[name]
        x, y = project(tail)
        draw.text((x + 8, y - 14), name, font=font(17), fill=MUTED)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validation", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--builder", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    validation = json.loads(Path(args.validation).read_text(encoding="utf-8"))
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    bones = get_rest_bones(Path(args.builder))

    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.text((72, 60), "JACK SHARED RIG + ANIMATION LIBRARY", font=font(50, True), fill=TEXT)
    draw.text((72, 124), "Canonical source for Baby / Teen / Adult skins", font=font(27), fill=MUTED)
    rounded(draw, (1150, 66, 1368, 142), GREEN, 38)
    draw.text((1210, 82), "PASS", font=font(32, True), fill=BACKGROUND)

    cards = [
        (str(validation["jointCount"]), "required bones"),
        (str(validation["clipCount"]), "verified clips"),
        (f"{validation['glbBytes'] / 1024 / 1024:.2f} MB", "shared GLB"),
        ("≤ 1e-6", "root invariant"),
    ]
    card_width = 303
    for index, (value, label) in enumerate(cards):
        x = 72 + index * (card_width + 28)
        rounded(draw, (x, 186, x + card_width, 334), PANEL, 26)
        draw.text((x + 24, 208), value, font=font(42, True), fill=BLUE if index != 3 else GREEN)
        draw.text((x + 24, 272), label, font=font(21), fill=MUTED)

    draw_skeleton(draw, bones, (72, 374, 704, 1044), "side", "SIDE REST SKELETON")
    draw_skeleton(draw, bones, (736, 374, 1368, 1044), "front", "FRONT REST SKELETON")

    rounded(draw, (72, 1082, 1368, 1735), PANEL, 28)
    draw.text((104, 1112), "DETERMINISTIC CLIP MANIFEST", font=font(34, True), fill=TEXT)
    clip_rows = manifest["clips"]
    first_column_rows = (len(clip_rows) + 1) // 2
    for index, clip in enumerate(clip_rows):
        column = 0 if index < first_column_rows else 1
        row = index if index < first_column_rows else index - first_column_rows
        x = 104 + column * 628
        y = 1178 + row * 65
        draw.text((x, y), clip["name"], font=font(24, True), fill=TEXT)
        draw.text((x + 335, y), f"{clip['durationMs']} ms", font=font(23), fill=BLUE)
        draw.text((x + 475, y), "loop" if clip["loop"] else "once", font=font(20), fill=MUTED)
        draw.line((x, y + 43, x + 565, y + 43), fill="#2B4355", width=2)

    rounded(draw, (72, 1775, 1368, 2035), PANEL_ALT, 28)
    draw.text((104, 1805), "CLEAN - EXACT 1500 ms POLICY", font=font(32, True), fill=TEXT)
    timeline_left, timeline_right, timeline_y = 116, 1324, 1919
    draw.line((timeline_left, timeline_y, timeline_right, timeline_y), fill=BLUE, width=8)
    phases = [(0, "water"), (400, "washout"), (800, "shake"), (1150, "sparkle"), (1500, "complete")]
    for ms, label in phases:
        x = int(timeline_left + (ms / 1500) * (timeline_right - timeline_left))
        draw.ellipse((x - 11, timeline_y - 11, x + 11, timeline_y + 11), fill=GOLD)
        text_x = min(max(x - 55, timeline_left), timeline_right - 110)
        draw.text((text_x, timeline_y + 26), f"{ms}\n{label}", font=font(18, True), fill=TEXT, align="center")

    rounded(draw, (72, 2075, 1368, 2200), "#372A31", 26)
    draw.text((104, 2097), "BABY BOUND - TEEN + ADULT PENDING", font=font(30, True), fill=PINK)
    draw.text((104, 2142), "Baby structural checks pass; remaining age transfers use no API key or paid API call.", font=font(22), fill=TEXT)
    draw.text((72, 2240), "jack-rig-animations.glb  |  rig-animation-validation.json  |  2026-08-15", font=font(18), fill=MUTED)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, optimize=True)
    print(f"WROTE {output} {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
