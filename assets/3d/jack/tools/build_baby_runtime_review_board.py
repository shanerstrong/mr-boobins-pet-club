from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[4]
FALLBACK = ROOT / "evidence" / "3d-jack" / "fallback"
MESHY = ROOT / "evidence" / "3d-jack" / "meshy"
OUTPUT = ROOT / "evidence" / "3d-jack" / "jack-baby-runtime-likeness-gate.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(name, size=size)


def rounded_panel(canvas: Image.Image, box: tuple[int, int, int, int], fill: str) -> None:
    ImageDraw.Draw(canvas).rounded_rectangle(box, radius=32, fill=fill)


def place_image(
    canvas: Image.Image,
    path: Path,
    box: tuple[int, int, int, int],
    crop_alpha: bool = False,
) -> None:
    source = Image.open(path).convert("RGBA")
    if crop_alpha:
        alpha_box = source.getchannel("A").getbbox()
        if alpha_box:
            source = source.crop(alpha_box)
    width = box[2] - box[0]
    height = box[3] - box[1]
    source.thumbnail((width, height), Image.Resampling.LANCZOS)
    x = box[0] + (width - source.width) // 2
    y = box[1] + (height - source.height) // 2
    canvas.alpha_composite(source, (x, y))


def main() -> None:
    board = Image.new("RGBA", (1440, 2600), "#F3EEE5")
    draw = ImageDraw.Draw(board)

    draw.text((76, 65), "BABY JACK — LIKENESS GATE", font=font(68, True), fill="#2C2530")
    draw.text(
        (78, 152),
        "SMOOTH DESKTOP MASTER + ACTUAL MOBILE RUNTIME GLB",
        font=font(31, True),
        fill="#4B78A6",
    )

    rounded_panel(board, (70, 235, 1370, 1000), "#242329")
    draw.text((108, 270), "DESKTOP MASTER SOURCE", font=font(34, True), fill="#FFFFFF")
    draw.text((108, 320), "1,937,286 triangles • preserved in private Meshy", font=font(25), fill="#D9D4DF")
    place_image(
        board,
        MESHY / "baby-high-master-three-quarter.png",
        (105, 370, 770, 955),
    )
    desktop_notes = [
        "This is the smooth source quality.",
        "Desktop derives a ~60K runtime LOD.",
        "It keeps the same face, body, collar,",
        "tag, skeleton, morphs and clips.",
        "The 1.94M source is preserved—not",
        "shipped directly to players.",
    ]
    for index, line in enumerate(desktop_notes):
        draw.text((790, 430 + index * 62), line, font=font(29, index == 0), fill="#F2EDF3")

    draw.text((76, 1055), "ACTUAL MOBILE RUNTIME GLB — 9,744 TRIANGLES", font=font(38, True), fill="#2C2530")
    draw.text(
        (78, 1110),
        "Use these four views to judge proportions. Faceting is intentionally mobile-only.",
        font=font(25),
        fill="#625968",
    )

    tiles = [
        ("THREE-QUARTER", "baby-healthy-three-quarter.png", (70, 1170, 710, 1750)),
        ("FRONT", "baby-healthy-front.png", (730, 1170, 1370, 1750)),
        ("SIDE", "baby-healthy-side.png", (70, 1780, 710, 2320)),
        ("REAR", "baby-healthy-rear.png", (730, 1780, 1370, 2320)),
    ]
    for label, filename, box in tiles:
        rounded_panel(board, box, "#FFFDFC")
        draw.text((box[0] + 28, box[1] + 24), label, font=font(27, True), fill="#4B414D")
        place_image(
            board,
            FALLBACK / filename,
            (box[0] + 40, box[1] + 78, box[2] - 40, box[3] - 32),
            crop_alpha=True,
        )

    rounded_panel(board, (70, 2350, 1370, 2530), "#E8E0D5")
    draw.text((105, 2380), "STATIC APPROVAL SCOPE", font=font(28, True), fill="#2C2530")
    draw.text(
        (105, 2427),
        "Approve face • Baby age read • silhouette • paws • collar • tag",
        font=font(27),
        fill="#534A56",
    )
    draw.text(
        (105, 2474),
        "Deformation, condition morph strength and action previews follow this gate.",
        font=font(24, True),
        fill="#7A3E4A",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    board.convert("RGB").save(OUTPUT, quality=94, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
