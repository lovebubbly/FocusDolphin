# FocusWhale V3 Idle Source Generation

- Generated: 2026-07-10 KST
- Generator: OpenAI built-in `image_gen`
- Visual reference: `assets/sprites/focuswhale-atlas.png`
- Selected result: geometry-focused third pass (`exec-7b96905b-0e65-4f28-81ed-8bae58538987.png`)
- Deliverable: `idle-source.png` (4 columns x 5 rows, 20 poses)
- Rows: pearl/egg, baby whale, juvenile whale, blue whale, star whale
- Columns: neutral inhale, gentle lift/narrow, soft blink/exhale, reopen/return
- Background: exact opaque `RGB(255, 0, 255)`; magenta-field pixels were deterministically normalized with `R >= 150`, `B >= 150`, `G <= 130`, `R - G >= 60`, and `B - G >= 60`, without removing chroma, adding transparency, slicing cells, or assembling an atlas.
- QA: all 20 conceptual cells contain one complete, isolated mascot with safe padding; identity, scale progression, registration, and idle continuity are coherent; no crown, grid, text, shadow, detached effect, or cropped pose is present.
