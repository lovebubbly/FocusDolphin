#!/usr/bin/env python3
"""Create and verify a deterministic browser-store ZIP from dist/."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
FIXED_ZIP_TIMESTAMP = (2026, 1, 1, 0, 0, 0)
EXPECTED_PACKAGE_NAME = "focus-dolphin"
EXPECTED_APP_NAME = "Focus Dolphin \u2014 Website Blocker"
MAX_APP_NAME_LENGTH = 45
MAX_APP_DESCRIPTION_LENGTH = 132
REQUIRED_ENTRIES = {
    "manifest.json",
    "_locales/en/messages.json",
    "_locales/ko/messages.json",
    "licenses/Pretendard-LICENSE.txt",
    "licenses/THIRD-PARTY-NOTICES.txt",
}
FORBIDDEN_NAMES = {".DS_Store", "Thumbs.db"}
FORBIDDEN_SUFFIXES = {".map", ".ts", ".tsx"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_archive_name(relative_path: Path) -> str:
    name = relative_path.as_posix()
    parsed = PurePosixPath(name)
    if parsed.is_absolute() or not name or ".." in parsed.parts:
        raise ValueError(f"Unsafe archive path: {name!r}")
    return name


def collect_dist_files(dist: Path) -> list[tuple[str, Path]]:
    if not dist.is_dir():
        raise FileNotFoundError(f"Build directory does not exist: {dist}")

    files: list[tuple[str, Path]] = []
    for path in sorted(dist.rglob("*"), key=lambda item: item.relative_to(dist).as_posix()):
        if path.is_symlink():
            raise ValueError(f"Symlinks are forbidden in the release package: {path}")
        if path.is_dir():
            continue

        relative = path.relative_to(dist)
        name = safe_archive_name(relative)
        if path.name in FORBIDDEN_NAMES or path.suffix.lower() in FORBIDDEN_SUFFIXES:
            raise ValueError(f"Development artifact is forbidden in the release package: {name}")
        if name.endswith((".test.js", ".spec.js")):
            raise ValueError(f"Test artifact is forbidden in the release package: {name}")
        files.append((name, path))

    names = {name for name, _ in files}
    missing = sorted(REQUIRED_ENTRIES - names)
    if missing:
        raise ValueError(f"Required release entries are missing: {', '.join(missing)}")
    if not files:
        raise ValueError("The release package would be empty")
    return files


def write_archive(path: Path, files: Iterable[tuple[str, Path]]) -> None:
    with zipfile.ZipFile(
        path,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        strict_timestamps=True,
    ) as archive:
        archive.comment = b""
        for name, source in files:
            info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.flag_bits |= 0x800
            archive.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def verify_archive(archive_path: Path, files: list[tuple[str, Path]]) -> None:
    expected_names = [name for name, _ in files]
    expected_by_name = {name: source for name, source in files}

    with zipfile.ZipFile(archive_path, mode="r") as archive:
        if archive.testzip() is not None:
            raise ValueError(f"Archive CRC verification failed: {archive_path}")
        actual_names = archive.namelist()
        if actual_names != expected_names:
            raise ValueError("Archive entry order or contents differ from the sorted dist tree")
        if actual_names.count("manifest.json") != 1 or actual_names[0].startswith("/"):
            raise ValueError("manifest.json must appear exactly once at the archive root")

        for info in archive.infolist():
            safe_archive_name(Path(info.filename))
            if info.is_dir():
                raise ValueError(f"Directory entries are not allowed: {info.filename}")
            if info.date_time != FIXED_ZIP_TIMESTAMP:
                raise ValueError(f"Non-deterministic timestamp on {info.filename}: {info.date_time}")
            source_bytes = expected_by_name[info.filename].read_bytes()
            archived_bytes = archive.read(info.filename)
            if archived_bytes != source_bytes:
                raise ValueError(f"Archive bytes differ from dist: {info.filename}")


def verify_deterministic_bytes(archive_path: Path, files: list[tuple[str, Path]]) -> None:
    with tempfile.TemporaryDirectory(prefix="extension-package-verify-", dir=archive_path.parent) as temp_dir:
        expected = Path(temp_dir) / "expected.zip"
        write_archive(expected, files)
        if archive_path.read_bytes() != expected.read_bytes():
            raise ValueError("Archive bytes differ from the deterministic dist package")


def validate_manifest(dist: Path, package_json: dict[str, object]) -> dict[str, object]:
    manifest = json.loads((dist / "manifest.json").read_text(encoding="utf-8"))
    if package_json.get("name") != EXPECTED_PACKAGE_NAME:
        raise ValueError(f"Release package name must be {EXPECTED_PACKAGE_NAME}")
    if manifest.get("manifest_version") != 3:
        raise ValueError("Only a Manifest V3 package may be released")
    if manifest.get("version") != package_json.get("version"):
        raise ValueError("package.json and manifest.json versions differ")
    if manifest.get("default_locale") != "en":
        raise ValueError("The release manifest must retain English as its default locale")
    if manifest.get("name") != "__MSG_appName__" or manifest.get("description") != "__MSG_appDescription__":
        raise ValueError("Release manifest name and description must use localized message keys")

    for locale in ("en", "ko"):
        catalog_path = dist / "_locales" / locale / "messages.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        app_name = str(catalog.get("appName", {}).get("message", ""))
        description = str(catalog.get("appDescription", {}).get("message", ""))
        if app_name != EXPECTED_APP_NAME:
            raise ValueError(
                f"{locale} public app name must be exactly {EXPECTED_APP_NAME!r}"
            )
        if len(app_name) > MAX_APP_NAME_LENGTH:
            raise ValueError(f"{locale} public app name exceeds {MAX_APP_NAME_LENGTH} characters")
        if not description or len(description) > MAX_APP_DESCRIPTION_LENGTH:
            raise ValueError(
                f"{locale} app description must contain 1-{MAX_APP_DESCRIPTION_LENGTH} characters"
            )
    return manifest


def write_sidecars(
    output: Path,
    files: list[tuple[str, Path]],
    manifest: dict[str, object],
    package_json: dict[str, object],
) -> None:
    artifact_sha = sha256_file(output)
    checksum_path = output.with_suffix(".sha256")
    report_path = output.with_suffix(".package-report.json")

    checksum_path.write_text(f"{artifact_sha}  {output.name}\n", encoding="ascii")
    report = {
        "formatVersion": 1,
        "artifact": output.name,
        "artifactBytes": output.stat().st_size,
        "artifactSha256": artifact_sha,
        "deterministicZipTimestamp": "2026-01-01T00:00:00Z",
        "entryCount": len(files),
        "manifestVersion": manifest["manifest_version"],
        "packageName": package_json["name"],
        "version": manifest["version"],
        "files": [
            {
                "path": name,
                "bytes": source.stat().st_size,
                "sha256": sha256_file(source),
            }
            for name, source in files
        ],
    }
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def default_output(package_json: dict[str, object]) -> Path:
    name = str(package_json["name"])
    version = str(package_json["version"])
    return ROOT / "release" / f"{name}-{version}.zip"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, default=ROOT / "dist")
    parser.add_argument("--out", type=Path)
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify an existing output archive against dist without replacing it",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    package_json = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    dist = args.dist.resolve()
    output = (args.out or default_output(package_json)).resolve()
    files = collect_dist_files(dist)
    manifest = validate_manifest(dist, package_json)

    output.parent.mkdir(parents=True, exist_ok=True)
    if args.verify_only:
        if not output.is_file():
            raise FileNotFoundError(f"Release archive does not exist: {output}")
    else:
        with tempfile.TemporaryDirectory(prefix="extension-package-", dir=output.parent) as temp_dir:
            first = Path(temp_dir) / "first.zip"
            second = Path(temp_dir) / "second.zip"
            write_archive(first, files)
            write_archive(second, files)
            if first.read_bytes() != second.read_bytes():
                raise ValueError("Repeated archive creation was not byte-deterministic")
            verify_archive(first, files)
            temporary_output = output.with_name(f".{output.name}.{os.getpid()}.tmp")
            shutil.copyfile(first, temporary_output)
            temporary_output.replace(output)

    verify_archive(output, files)
    verify_deterministic_bytes(output, files)
    write_sidecars(output, files, manifest, package_json)
    print(f"artifact={output}")
    print(f"bytes={output.stat().st_size}")
    print(f"entries={len(files)}")
    print(f"sha256={sha256_file(output)}")
    print("verified=manifest-v3,required-licenses,sorted-entries,byte-equal-dist,deterministic")


if __name__ == "__main__":
    main()
