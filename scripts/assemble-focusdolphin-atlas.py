#!/usr/bin/env python3
"""Assemble four generated 4x5 mood sheets into the Focus Dolphin 4x20 atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


MOODS = ("idle", "happy", "focus", "celebrate")
STAGE_TARGETS = (96, 120, 140, 156, 168)
FRAME_SIZE = 192
SAFE_MARGIN = 12
SOURCE_PADDING = 4


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    for mood in MOODS:
        parser.add_argument(f"--{mood}", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args()


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()


def occupied_bands(image: Image.Image, axis: str) -> list[tuple[int, int]]:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    length = image.width if axis == "x" else image.height
    cross_length = image.height if axis == "x" else image.width
    occupied = [
        any(
            (pixels[index, cross] if axis == "x" else pixels[cross, index]) > 8
            for cross in range(cross_length)
        )
        for index in range(length)
    ]

    bands: list[tuple[int, int]] = []
    start: int | None = None
    for index, visible in enumerate([*occupied, False]):
        if visible and start is None:
            start = index
        elif not visible and start is not None:
            bands.append((start, index))
            start = None
    return bands


def padded_bands(
    bands: list[tuple[int, int]],
    *,
    expected: int,
    limit: int,
    path: Path,
    axis: str,
) -> list[tuple[int, int]]:
    if len(bands) != expected:
        raise ValueError(
            f"{path} has {len(bands)} occupied {axis}-bands; expected {expected}: {bands}"
        )

    padded = [
        (max(0, start - SOURCE_PADDING), min(limit, end + SOURCE_PADDING))
        for start, end in bands
    ]
    if any(current[1] > following[0] for current, following in zip(padded, padded[1:])):
        raise ValueError(f"{path} has overlapping padded {axis}-bands: {padded}")
    return padded


def split_sheet(path: Path) -> list[list[Image.Image]]:
    sheet = Image.open(path).convert("RGBA")
    x_bands = padded_bands(
        occupied_bands(sheet, "x"),
        expected=4,
        limit=sheet.width,
        path=path,
        axis="x",
    )
    y_bands = padded_bands(
        occupied_bands(sheet, "y"),
        expected=5,
        limit=sheet.height,
        path=path,
        axis="y",
    )
    rows: list[list[Image.Image]] = []
    for top, bottom in y_bands:
        row: list[Image.Image] = []
        for left, right in x_bands:
            cell = sheet.crop((left, top, right, bottom))
            row.append(cell)
        rows.append(row)
    return rows


def transparent_rgb_count(image: Image.Image) -> int:
    return sum(
        1
        for red, green, blue, alpha in image.get_flattened_data()
        if alpha == 0 and (red != 0 or green != 0 or blue != 0)
    )


def artifact_record(path: Path, *, mood: str, role: str) -> dict[str, object]:
    with Image.open(path) as image:
        dimensions = [image.width, image.height]
        mode = image.mode
    return {
        "mood": mood,
        "role": role,
        "path": path.as_posix(),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bytes": path.stat().st_size,
        "dimensions": dimensions,
        "mode": mode,
    }


def main() -> None:
    args = parse_args()
    input_paths = {mood: getattr(args, mood) for mood in MOODS}
    sources = {mood: split_sheet(path) for mood, path in input_paths.items()}
    source_artifacts: list[dict[str, object]] = []
    for mood, path in input_paths.items():
        original_path = path.with_name(path.name.replace("-transparent.png", "-source.png"))
        if original_path.exists() and original_path != path:
            source_artifacts.append(artifact_record(original_path, mood=mood, role="generated-source"))
        source_artifacts.append(artifact_record(path, mood=mood, role="transparent-input"))
    source_issues: list[str] = []
    source_metrics: list[dict[str, object]] = []

    for mood, stages in sources.items():
        for stage, frames in enumerate(stages):
            for frame, image in enumerate(frames):
                bbox = visible_bbox(image)
                if bbox is None:
                    source_issues.append(f"{mood} stage {stage} frame {frame} is empty")
                    continue
                left, top, right, bottom = bbox
                margins = {
                    "left": left,
                    "top": top,
                    "right": image.width - right,
                    "bottom": image.height - bottom,
                }
                if min(margins.values()) < 2:
                    source_issues.append(
                        f"{mood} stage {stage} frame {frame} touches a source cell edge: {margins}"
                    )
                source_metrics.append({
                    "mood": mood,
                    "stage": stage,
                    "frame": frame,
                    "bbox": bbox,
                    "margins": margins,
                })

    if source_issues:
        raise ValueError("; ".join(source_issues))

    stage_scales: list[float] = []
    for stage, target in enumerate(STAGE_TARGETS):
        boxes = [
            visible_bbox(sources[mood][stage][frame])
            for mood in MOODS
            for frame in range(4)
        ]
        if any(box is None for box in boxes):
            raise ValueError(f"stage {stage} contains an empty frame")
        widths = [box[2] - box[0] for box in boxes if box is not None]
        heights = [box[3] - box[1] for box in boxes if box is not None]
        stage_scales.append(min(target / max(widths), target / max(heights)))

    atlas = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE * len(MOODS) * 5), (0, 0, 0, 0))
    output_metrics: list[dict[str, object]] = []
    output_issues: list[str] = []

    for mood_index, mood in enumerate(MOODS):
        for stage in range(5):
            scale = stage_scales[stage]
            for frame in range(4):
                source = sources[mood][stage][frame]
                bbox = visible_bbox(source)
                assert bbox is not None
                cropped = source.crop(bbox)
                resized = cropped.resize(
                    (
                        max(1, round(cropped.width * scale)),
                        max(1, round(cropped.height * scale)),
                    ),
                    Image.Resampling.LANCZOS,
                )
                frame_canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
                x = (FRAME_SIZE - resized.width) // 2
                y = FRAME_SIZE - SAFE_MARGIN - resized.height
                layer = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
                layer.alpha_composite(resized, (x, y))
                frame_canvas = Image.alpha_composite(frame_canvas, layer)

                output_bbox = visible_bbox(frame_canvas)
                assert output_bbox is not None
                left, top, right, bottom = output_bbox
                margins = {
                    "left": left,
                    "top": top,
                    "right": FRAME_SIZE - right,
                    "bottom": FRAME_SIZE - bottom,
                }
                if min(margins.values()) < SAFE_MARGIN:
                    output_issues.append(
                        f"{mood} stage {stage} frame {frame} violates safe margin: {margins}"
                    )

                row = mood_index * 5 + stage
                atlas.alpha_composite(frame_canvas, (frame * FRAME_SIZE, row * FRAME_SIZE))
                output_metrics.append({
                    "mood": mood,
                    "stage": stage,
                    "frame": frame,
                    "row": row,
                    "bbox": output_bbox,
                    "margins": margins,
                    "scale": round(scale, 6),
                })

    stray_rgb = transparent_rgb_count(atlas)
    if stray_rgb:
        output_issues.append(f"atlas has {stray_rgb} transparent pixels with non-zero RGB")

    report = {
        "ok": not output_issues,
        "contract": {
            "frameWidth": FRAME_SIZE,
            "frameHeight": FRAME_SIZE,
            "columns": 4,
            "rows": len(MOODS) * 5,
            "moods": list(MOODS),
            "stageTargets": list(STAGE_TARGETS),
            "safeMargin": SAFE_MARGIN,
        },
        "sourceMetrics": source_metrics,
        "sourceArtifacts": source_artifacts,
        "outputMetrics": output_metrics,
        "issues": output_issues,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.out, optimize=True)
    report["atlasSha256"] = hashlib.sha256(args.out.read_bytes()).hexdigest()
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if output_issues:
        raise ValueError("; ".join(output_issues))

    print(f"assembled={args.out}")
    print(f"report={args.report}")


if __name__ == "__main__":
    main()
