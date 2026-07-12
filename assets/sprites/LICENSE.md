# Focus Dolphin Sprite Atlas

`focusdolphin-atlas.png` is the runtime sprite atlas for the Focus Dolphin pet. The current v4 sheets were generated specifically for this repository with the built-in Codex `$imagegen` skill on 2026-07-12, then processed locally into a transparent `4 x 20` atlas with 192 px cells. It is a native high-density assembly, not an AI-upscaled derivative of the earlier whale atlas.

The four generated source sheets each use a `4 x 5` layout: four animation frames across and five additive growth stages down. Their moods are `idle`, `happy`, `focus`, and `celebrate`. The art direction is a polished 2D bottlenose-dolphin mascot in a teal-blue palette, with a visible rostrum and dorsal fin, on a flat chroma-key background. The sheets contain no text, watermark, punishment, decline, or death imagery.

Generation records, selected outputs, and transparent assembly inputs:

- `assets/sprites/generated/v4/idle-generation.md`, `idle-source.png`, and `idle-transparent.png`
- `assets/sprites/generated/v4/happy-generation.md`, `happy-source.png`, and `happy-transparent.png`
- `assets/sprites/generated/v4/focus-generation.md`, `focus-source.png`, and `focus-transparent.png`
- `assets/sprites/generated/v4/celebrate-generation.md`, `celebrate-source.png`, and `celebrate-transparent.png`

Each source sheet was converted locally to its adjacent `*-transparent.png` chroma-key-cleaned input. `scripts/assemble-focusdolphin-atlas.py` then deterministically split, scaled, centered, baseline-aligned, and packed those sheets into the runtime atlas. The machine-readable QA and SHA-256 provenance record is `assets/sprites/atlas-report.json`; it records dimensions, byte sizes, and hashes for the four generated source sheets, four transparent assembly inputs, and final atlas.

The extension icon set, store icon, and Chrome promotional tile are deterministically derived from the stage 3 idle frame in this atlas by `scripts/generate-focusdolphin-icons.py`. The script supplies only a project-authored teal badge/background, sizing, and shadow; it introduces no external artwork, logo, or font.

The v4 dolphin sheets do not incorporate third-party source artwork. Use and distribution of generated outputs remain subject to the repository's top-level all-rights-reserved notice and the applicable OpenAI terms; no separate third-party sprite license was introduced. The earlier v3 whale sheets remain only as historical generation records and are not packaged by the runtime build.

`focuswhale-placeholder.svg` is kept as an older project-authored fallback/reference asset and is no longer used by the runtime renderer. Its original CC0-style public-domain dedication remains in force; the repository's later all-rights-reserved notice does not revoke that exception.

Future sprite replacements should record their generation/source path, prompt summary, processing steps, deterministic QA report, checksum, and license assumptions here before use.
