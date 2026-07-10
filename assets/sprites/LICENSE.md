# FocusWhale Sprite Atlas

`focuswhale-atlas.png` is the runtime sprite atlas for the FocusWhale pet. The current v3 asset was generated with the built-in Codex `$imagegen` skill on 2026-07-10, then processed locally into a transparent `4 x 20` atlas with `96px` cells.

The four generated source sheets each use a `4 x 5` layout: four animation frames across and five growth stages down. Their moods are `idle`, `happy`, `focus`, and `celebrate`. The art direction is a cute polished 2D FocusWhale mascot in a teal-blue palette on a flat chroma-key background, without text, watermark, crown, punishment, decline, or death imagery. Stage 0 is an egg/pearl form; stages 1-4 grow additively into the star-marked adult whale.

Generation records and original outputs:

- `assets/sprites/generated/v3/idle-generation.md` and `idle-source.png`
- `assets/sprites/generated/v3/happy-generation.md` and `happy-source.png`
- `assets/sprites/generated/v3/focus-generation.md` and `focus-source.png`
- `assets/sprites/generated/v3/celebrate-generation.md` and `celebrate-source.png`

Each source sheet was converted to its adjacent `*-transparent.png` file with the Codex image-generation skill's `remove_chroma_key.py` helper using border auto-keying, a soft matte, despill, and transparent/opaque thresholds. `scripts/assemble-focuswhale-atlas.py` then deterministically split, scaled, centered, baseline-aligned, and packed those sheets into the runtime atlas. The machine-readable QA and SHA-256 provenance record is `assets/sprites/atlas-report.json`.

The v3 sheets were generated specifically for this repository and do not incorporate third-party source artwork. Use and distribution of generated outputs remain subject to the repository license and the applicable OpenAI terms; no separate third-party sprite license was introduced.

`focuswhale-placeholder.svg` is kept as an older project-authored fallback/reference asset and is no longer used by the runtime renderer.

Future sprite replacements should record their generation/source path, prompt summary, processing steps, deterministic QA report, checksum, and license assumptions here before use.
