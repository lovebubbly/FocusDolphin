#!/usr/bin/env python3
"""Build extension and store icons from the documented high-density pet atlas."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ATLAS_PATH = ROOT / "assets" / "sprites" / "focusdolphin-atlas.png"
MANIFEST_PATH = ROOT / "assets" / "sprites" / "manifest.json"
PUBLIC_ICON_DIR = ROOT / "public" / "icons"
STORE_ASSET_DIR = ROOT / "store-assets"
ICON_SIZES = (16, 32, 48, 128)


def extract_mascot() -> Image.Image:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    cell_width = int(manifest["frameWidth"])
    cell_height = int(manifest["frameHeight"])
    row = int(manifest["stages"]["3"]["idle"]["row"])
    atlas = Image.open(ATLAS_PATH).convert("RGBA")
    frame = atlas.crop((0, row * cell_height, cell_width, (row + 1) * cell_height))
    bounds = frame.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("The selected mascot frame contains no visible pixels.")
    return frame.crop(bounds)


def gradient_badge(size: int) -> Image.Image:
    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    field = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(field)
    for y in range(size):
        ratio = y / max(1, size - 1)
        color = (
            round(166 + (46 - 166) * ratio),
            round(231 + (133 - 231) * ratio),
            round(237 + (143 - 237) * ratio),
            255,
        )
        draw.line(((0, y), (size, y)), fill=color)

    padding = max(1, round(size * 0.055))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse(
        (padding, padding, size - padding - 1, size - padding - 1), fill=255
    )
    field.putalpha(mask)
    badge.alpha_composite(field)

    rim = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(rim).ellipse(
        (padding, padding, size - padding - 1, size - padding - 1),
        outline=(23, 84, 98, 170),
        width=max(1, size // 32),
    )
    badge.alpha_composite(rim)
    return badge


def place_mascot(canvas: Image.Image, mascot: Image.Image, scale: float) -> None:
    target_width = round(canvas.width * scale)
    target_height = round(target_width * mascot.height / mascot.width)
    height_limit = round(canvas.height * 0.78)
    if target_height > height_limit:
        target_height = height_limit
        target_width = round(target_height * mascot.width / mascot.height)

    resized = mascot.resize((target_width, target_height), Image.Resampling.LANCZOS)
    x = (canvas.width - target_width) // 2
    y = min(round(canvas.height * 0.18), canvas.height - target_height)

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_alpha = resized.getchannel("A").filter(
        ImageFilter.GaussianBlur(max(0.5, canvas.width / 80))
    )
    shadow_offset = max(1, canvas.width // 32)
    shadow.paste(
        (8, 42, 55, 92),
        (x, min(canvas.height - target_height, y + shadow_offset)),
        shadow_alpha,
    )
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(resized, (x, y))


def build_icons(mascot: Image.Image) -> None:
    PUBLIC_ICON_DIR.mkdir(parents=True, exist_ok=True)
    for size in ICON_SIZES:
        icon = gradient_badge(size)
        place_mascot(icon, mascot, 0.88 if size <= 32 else 0.84)
        icon.save(PUBLIC_ICON_DIR / f"focusdolphin-{size}.png", optimize=True)

    store_icon = Image.open(PUBLIC_ICON_DIR / "focusdolphin-128.png")
    store_icon.save(STORE_ASSET_DIR / "focusdolphin-icon-128.png", optimize=True)


def build_promo(mascot: Image.Image) -> None:
    promo = Image.new("RGBA", (440, 280), (40, 127, 137, 255))
    glow = Image.new("RGBA", promo.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((108, 28, 332, 252), fill=(169, 232, 246, 48))
    promo.alpha_composite(glow)
    place_mascot(promo, mascot, 0.39)
    promo.convert("RGB").save(
        STORE_ASSET_DIR / "chrome-small-promo-440x280.png", optimize=True
    )


def main() -> None:
    mascot = extract_mascot()
    build_icons(mascot)
    build_promo(mascot)


if __name__ == "__main__":
    main()
