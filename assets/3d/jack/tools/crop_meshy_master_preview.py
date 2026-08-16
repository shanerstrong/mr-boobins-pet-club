from argparse import ArgumentParser
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--crop", nargs=4, type=int, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"), required=True)
    args = parser.parse_args()

    source_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    source = Image.open(source_path).convert("RGB")
    output = source.crop(tuple(args.crop))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(output_path, quality=95, optimize=True)
    print(output_path)


if __name__ == "__main__":
    main()
