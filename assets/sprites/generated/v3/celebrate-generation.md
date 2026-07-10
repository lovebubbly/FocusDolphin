# FocusWhale V3 Celebrate Source Generation

- Generated: 2026-07-10 08:56 KST
- Generator: OpenAI built-in `image_gen`
- Primary visual reference: `assets/sprites/generated/v3/idle-source.png`
- Secondary visual reference: `assets/sprites/focuswhale-atlas.png`
- Selected result: identity-corrected second pass (`exec-06c4fefb-a029-4af4-89be-797a914d939d.png`)
- Deliverable: `celebrate-source.png` (4 columns x 5 rows, 20 poses)
- Rows: pearl/egg, baby whale, juvenile whale, mature blue whale, star whale
- Columns: joyful anticipation, fin lift/body rise, peak celebration, soft settle

## Generation Brief

Create one production celebration source sheet that matches the approved idle
sheet's character identity, rendering, five-stage scale progression, cell
registration, and clean 2D mascot finish. Keep exactly one complete character
in each of 20 conceptual cells on a flat `RGB(255, 0, 255)` field with no visible grid.

The four columns form a compact loop: neutral-low joyful anticipation, a gentle
fin lift and body rise, a peak celebration with smiling eyes, and a soft settle
back toward the first frame. The pearl/egg row remains a compact upright egg in
all four frames, with no tail or side fins; its celebration uses facial changes,
subtle squash-and-stretch, and the attached top sprout. The final row retains
only its subtle gold star body markings.

Hard exclusions: crowns, tiaras, headwear, detached stars, sparkles, confetti,
particles, motion lines, props, accessories, shadows, reflections, gradients,
texture, text, watermarks, cropped anatomy, frame overlap, and extra characters.

## Source Normalization

The generated magenta field was deterministically normalized to exact opaque
`RGB(255, 0, 255)` using the same rule as the approved idle source: `R >= 150`,
`B >= 150`, `G <= 130`, `R - G >= 60`, and `B - G >= 60`. This operation only
normalized the chroma field; it did not remove chroma, add transparency, slice
cells, or assemble a runtime atlas.

## QA

- Dimensions: 1122 x 1402 RGB, matching the approved idle source.
- Layout: exactly 4 columns x 5 rows with one isolated mascot per cell.
- Identity: all five stages remain visually distinct and progress coherently.
- Loop: anticipation, lift, peak, and settle read consistently in every row.
- Safety: all 20 silhouettes remain inside their conceptual cells without crop
  or overlap; outer corners are exact `RGB(255, 0, 255)`.
- Invariants: no crown, detached effect, shadow, prop, grid, or text is present.
- Star stage: gold markings stay attached to the body in every frame.
