#!/usr/bin/env python3
"""Regression tests for the deterministic release-packaging boundary."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGER = ROOT / "scripts" / "package-release.py"


class ReleasePackageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="release-package-test-")
        self.root = Path(self.temporary.name)
        self.dist = self.root / "dist"
        self.output = self.root / "candidate.zip"
        self._write_fixture()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write_fixture(self) -> None:
        locale_catalog = json.dumps(
            {
                "appName": {"message": "Focus Dolphin \u2014 Website Blocker"},
                "appDescription": {"message": "A local-first focus assistant."},
            }
        ).encode()
        files = {
            "manifest.json": json.dumps(
                {
                    "manifest_version": 3,
                    "version": "1.0.0",
                    "default_locale": "en",
                    "name": "__MSG_appName__",
                    "description": "__MSG_appDescription__",
                }
            ).encode(),
            "_locales/en/messages.json": locale_catalog,
            "_locales/ko/messages.json": locale_catalog,
            "licenses/Pretendard-LICENSE.txt": b"fixture OFL\n",
            "licenses/THIRD-PARTY-NOTICES.txt": b"fixture notices\n",
            "assets/app.js": b"console.log('fixture');\n",
        }
        for relative, content in files.items():
            path = self.dist / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)

    def _run(self, *extra: str, expect_success: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            [
                sys.executable,
                str(PACKAGER),
                "--dist",
                str(self.dist),
                "--out",
                str(self.output),
                *extra,
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if expect_success and result.returncode != 0:
            self.fail(f"packager failed:\nstdout={result.stdout}\nstderr={result.stderr}")
        if not expect_success and result.returncode == 0:
            self.fail(f"packager unexpectedly succeeded:\nstdout={result.stdout}")
        return result

    def test_archive_is_reproducible_and_reported(self) -> None:
        self._run()
        first = self.output.read_bytes()
        self._run()
        self.assertEqual(self.output.read_bytes(), first)

        digest = hashlib.sha256(first).hexdigest()
        self.assertEqual(
            self.output.with_suffix(".sha256").read_text(encoding="ascii"),
            f"{digest}  candidate.zip\n",
        )
        report = json.loads(self.output.with_suffix(".package-report.json").read_text())
        self.assertEqual(report["artifactSha256"], digest)
        self.assertEqual(report["entryCount"], 6)
        self.assertEqual(report["manifestVersion"], 3)
        self.assertEqual(report["packageName"], "focus-dolphin")

    def test_verify_only_rejects_appended_bytes(self) -> None:
        self._run()
        with self.output.open("ab") as archive:
            archive.write(b"unexpected trailing bytes")
        result = self._run("--verify-only", expect_success=False)
        self.assertIn("deterministic dist package", result.stderr)

    def test_rejects_development_artifacts(self) -> None:
        (self.dist / "assets" / "leak.map").write_text("{}", encoding="utf-8")
        result = self._run(expect_success=False)
        self.assertIn("Development artifact is forbidden", result.stderr)

    def test_rejects_missing_license_notice(self) -> None:
        (self.dist / "licenses" / "THIRD-PARTY-NOTICES.txt").unlink()
        result = self._run(expect_success=False)
        self.assertIn("Required release entries are missing", result.stderr)

    def test_rejects_manifest_version_drift(self) -> None:
        manifest_path = self.dist / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["version"] = "9.9.9"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        result = self._run(expect_success=False)
        self.assertIn("versions differ", result.stderr)

    def test_rejects_stale_public_identity(self) -> None:
        locale_path = self.dist / "_locales" / "en" / "messages.json"
        catalog = json.loads(locale_path.read_text())
        catalog["appName"]["message"] = "FocusWhale"
        locale_path.write_text(json.dumps(catalog), encoding="utf-8")
        result = self._run(expect_success=False)
        self.assertIn("public app name must be exactly", result.stderr)

    def test_rejects_store_description_over_limit(self) -> None:
        locale_path = self.dist / "_locales" / "ko" / "messages.json"
        catalog = json.loads(locale_path.read_text())
        catalog["appDescription"]["message"] = "x" * 133
        locale_path.write_text(json.dumps(catalog), encoding="utf-8")
        result = self._run(expect_success=False)
        self.assertIn("app description must contain 1-132 characters", result.stderr)

    def test_rejects_manifest_locale_key_drift(self) -> None:
        manifest_path = self.dist / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["name"] = "Focus Dolphin"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        result = self._run(expect_success=False)
        self.assertIn("must use localized message keys", result.stderr)

    def test_rejects_symlinks(self) -> None:
        link = self.dist / "assets" / "linked.js"
        try:
            link.symlink_to(self.dist / "assets" / "app.js")
        except (NotImplementedError, OSError) as error:
            self.skipTest(f"symlinks unavailable: {error}")
        result = self._run(expect_success=False)
        self.assertIn("Symlinks are forbidden", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
