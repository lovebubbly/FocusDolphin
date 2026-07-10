# FocusWhale V3 Happy Source Generation

- Generated: 2026-07-10 KST
- Generator: OpenAI built-in `image_gen`
- Visual references: `assets/sprites/focuswhale-atlas.png` and `assets/sprites/generated/v3/idle-source.png`
- Selected result: idle-geometry-corrected second pass (`exec-4b199e08-9a63-4658-818f-753745e2e19e.png`)
- Deliverable: `happy-source.png` (4 columns x 5 rows, 20 poses)
- Rows: pearl/egg, baby whale, juvenile whale, blue whale, star whale
- Columns: smile begins, attached fin/spout lift and rise, joyful peak, settle
- Background: exact opaque `RGB(255, 0, 255)`; magenta-field pixels were deterministically normalized with `R >= 150`, `B >= 150`, `G <= 130`, `R - G >= 60`, and `B - G >= 60`, without removing chroma, adding transparency, slicing cells, or assembling an atlas.
- QA: exactly 20 isolated connected components; scale and registration track the approved idle source; the loop reads through expression, attached fin/spout posture, and body rise/settle; star markings appear only on stage 4; no crown, grid, text, shadow, detached effect, or cropped pose is present.
