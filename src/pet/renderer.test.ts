import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import spriteManifestData from "../../assets/sprites/manifest.json";
import {
  PET_MOODS,
  normalizeSpriteManifest,
  validateSpriteManifest,
  validateSpriteSheetGeometry
} from "./renderer";

describe("sprite manifest contract", () => {
  it("accepts the runtime manifest and matches the PNG dimensions", () => {
    const validation = validateSpriteManifest(spriteManifestData);
    const manifest = normalizeSpriteManifest(spriteManifestData, "atlas.png");
    const dimensions = readPngDimensions(resolve(process.cwd(), "assets/sprites/focuswhale-atlas.png"));

    expect(validation).toEqual({ valid: true, errors: [] });
    expect(validateSpriteSheetGeometry(manifest, dimensions)).toEqual({ valid: true, errors: [] });
  });

  it("rejects animations outside the declared rows and columns", () => {
    const invalid = structuredClone(spriteManifestData);
    invalid.stages["4"].happy.row = invalid.rows;
    invalid.stages["4"].happy.frames = invalid.columns + 1;

    const validation = validateSpriteManifest(invalid);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("stages.4.happy.row must be less than rows (20)");
    expect(validation.errors).toContain("stages.4.happy.frames must not exceed columns (4)");
  });

  it("rejects incomplete stages and invalid geometry values", () => {
    const invalid = structuredClone(spriteManifestData) as Record<string, unknown>;
    invalid.frameWidth = 0;
    const stages = invalid.stages as Record<string, unknown>;
    delete stages["2"];

    const validation = validateSpriteManifest(invalid);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("frameWidth must be a positive integer");
    expect(validation.errors).toContain("stages.2 must be an object");
  });

  it("normalizes an invalid manifest to the safe built-in atlas contract", () => {
    const invalid = structuredClone(spriteManifestData);
    invalid.stages["0"].idle.frames = 0;

    const normalized = normalizeSpriteManifest(invalid, "safe-atlas.png");

    expect(normalized.image).toBe("safe-atlas.png");
    expect(normalized).toMatchObject({ frameWidth: 96, frameHeight: 96, columns: 4, rows: 20 });
    expect(normalized.stages["0"].idle).toEqual({ row: 0, frames: 4, durationMs: 1200 });
    expect(Object.keys(normalized.stages["0"])).toEqual(PET_MOODS);
    expect(normalized.stages["4"].focus).toEqual({ row: 14, frames: 4, durationMs: 1000 });
    expect(normalized.stages["4"].celebrate).toEqual({ row: 19, frames: 4, durationMs: 760 });
  });

  it("rejects a decoded image whose dimensions do not match the manifest", () => {
    const manifest = normalizeSpriteManifest(spriteManifestData, "atlas.png");
    const validation = validateSpriteSheetGeometry(manifest, { width: 383, height: 1920 });

    expect(validation).toEqual({
      valid: false,
      errors: ["sprite image width must be 384px, received 383px"]
    });
  });

  it("matches the deterministic atlas assembly report", () => {
    const atlasPath = resolve(process.cwd(), "assets/sprites/focuswhale-atlas.png");
    const reportPath = resolve(process.cwd(), "assets/sprites/atlas-report.json");
    const atlas = readFileSync(atlasPath);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as AtlasAssemblyReport;

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.contract).toMatchObject({
      frameWidth: 96,
      frameHeight: 96,
      columns: 4,
      rows: 20,
      moods: PET_MOODS,
      safeMargin: 6
    });
    expect(report.sourceMetrics).toHaveLength(80);
    expect(report.outputMetrics).toHaveLength(80);

    for (const metric of report.outputMetrics) {
      expect(Math.min(...Object.values(metric.margins))).toBeGreaterThanOrEqual(report.contract.safeMargin);
    }

    expect(createHash("sha256").update(atlas).digest("hex")).toBe(report.atlasSha256);
  });
});

interface AtlasAssemblyReport {
  ok: boolean;
  contract: {
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    moods: string[];
    safeMargin: number;
  };
  sourceMetrics: unknown[];
  outputMetrics: Array<{
    margins: Record<string, number>;
  }>;
  issues: unknown[];
  atlasSha256: string;
}

function readPngDimensions(path: string): { width: number; height: number } {
  const png = readFileSync(path);
  const signature = png.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${path} is not a PNG file`);
  }

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}
