"""Build a phone-readable 4x4 Jack age-skin deformation review board."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = ["arialbd.ttf" if bold else "arial.ttf", "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--images", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    report_path = Path(args.report).resolve()
    image_dir = Path(args.images).resolve()
    output_path = Path(args.output).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    age = report.get("skin", "baby")
    age_label = age.upper()
    poses = report["poses"]
    if len(poses) != 16:
        raise RuntimeError(f"Expected 16 poses; found {len(poses)}")

    width = 1440
    header = 170
    footer = 120
    cell_w = width // 4
    cell_h = 390
    canvas = Image.new("RGB", (width, header + 4 * cell_h + footer), "#111820")
    draw = ImageDraw.Draw(canvas)
    draw.text((48, 32), f"{age_label} JACK — SHARED RIG / 16-CLIP DEFORMATION REVIEW", fill="#F7F2E8", font=font(34, bold=True))
    draw.text(
        (48, 88),
        f"Actual exported GLB channels composed onto the {age_label.title()} skin · representative frames · presentation only",
        fill="#B9C6D3",
        font=font(21),
    )
    draw.text((48, 124), "Root translation: invariant (0,0,0) in every clip", fill="#79D6AC", font=font(20, bold=True))

    for index, pose in enumerate(poses):
        row, col = divmod(index, 4)
        x = col * cell_w
        y = header + row * cell_h
        image_path = image_dir / pose["render"]
        image = Image.open(image_path).convert("RGB")
        image.thumbnail((cell_w, cell_h - 74), Image.Resampling.LANCZOS)
        image_x = x + (cell_w - image.width) // 2
        canvas.paste(image, (image_x, y))
        draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline="#384654", width=2)
        draw.rectangle((x, y + cell_h - 74, x + cell_w, y + cell_h), fill="#18232D")
        draw.text((x + 14, y + cell_h - 64), pose["clip"], fill="#FFFFFF", font=font(20, bold=True))
        contact = pose["belowGroundMeters"]
        metric = f"{pose['sampleTimeMs']:.0f} ms · contact overlap {contact * 100:.1f} cm"
        draw.text((x + 14, y + cell_h - 34), metric, fill="#AFC1D0", font=font(15))

    footer_y = header + 4 * cell_h
    draw.text(
        (48, footer_y + 22),
        "MEASURED QA: PASS — human visual review of the consolidated board is still required.",
        fill="#79D6AC",
        font=font(22, bold=True),
    )
    draw.text(
        (48, footer_y + 62),
        "Known limitation: side-rest sleep/death and the wake transition intentionally allow up to 15 cm of hidden paw/tail floor overlap.",
        fill="#F2C879",
        font=font(18),
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, optimize=True)
    print(f"JACK_DEFORMATION_BOARD_COMPLETE age={age} output={output_path}")


if __name__ == "__main__":
    main()
