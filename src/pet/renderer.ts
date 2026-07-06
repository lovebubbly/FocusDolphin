import spriteManifestData from "../../assets/sprites/manifest.json";
import type { PetState } from "../shared/types";

export type PetMood = "idle" | "happy";

interface SpriteAnimation {
  row: number;
  frames: number;
  durationMs: number;
}

interface SpriteManifest {
  image: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  stages: Record<string, Record<PetMood, SpriteAnimation>>;
}

const SPRITE_IMAGE_URL = new URL("../../assets/sprites/focuswhale-atlas.png", import.meta.url).toString();
const SPRITE_MANIFEST = normalizeSpriteManifest(spriteManifestData);

function ensurePetStyles(): void {
  if (document.querySelector("style[data-focuswhale-pet]")) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.focuswhalePet = "true";
  style.textContent = `
    .fw-pet {
      display: inline-grid;
      place-items: center;
      width: var(--fw-frame-w);
      height: var(--fw-frame-h);
      overflow: hidden;
      flex: 0 0 auto;
    }

    .fw-pet__sprite {
      width: var(--fw-frame-w);
      height: var(--fw-frame-h);
      background-image: var(--fw-image);
      background-repeat: no-repeat;
      background-size: var(--fw-sheet-w) var(--fw-sheet-h);
      background-position: 0 var(--fw-row-offset);
      animation: fw-pet-swim var(--fw-duration) steps(var(--fw-frames)) infinite;
    }

    @keyframes fw-pet-swim {
      from { background-position-x: 0; }
      to { background-position-x: var(--fw-end-x); }
    }

    @media (prefers-reduced-motion: reduce) {
      .fw-pet__sprite {
        animation: none;
      }
    }
  `;
  document.head.append(style);
}

function applyManifest(root: HTMLElement, sprite: HTMLElement, manifest: SpriteManifest, state: PetState, mood: PetMood): void {
  const stage = manifest.stages[String(state.stage)] ?? manifest.stages["0"];
  const animation = stage[mood] ?? stage.idle;
  const customProperties: Record<string, string> = {
    "--fw-frame-w": `${manifest.frameWidth}px`,
    "--fw-frame-h": `${manifest.frameHeight}px`,
    "--fw-sheet-w": `${manifest.frameWidth * manifest.columns}px`,
    "--fw-sheet-h": `${manifest.frameHeight * manifest.rows}px`,
    "--fw-image": `url("${manifest.image}")`,
    "--fw-row-offset": `${animation.row * manifest.frameHeight * -1}px`,
    "--fw-duration": `${animation.durationMs}ms`,
    "--fw-frames": String(animation.frames),
    "--fw-end-x": `${animation.frames * manifest.frameWidth * -1}px`
  };

  for (const [property, value] of Object.entries(customProperties)) {
    root.style.setProperty(property, value);
    sprite.style.setProperty(property, value);
  }
}

export function mountPet(el: HTMLElement, state: PetState, mood: PetMood = "idle"): void {
  ensurePetStyles();
  el.replaceChildren();
  el.classList.add("fw-pet");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `FocusWhale pet stage ${state.stage} ${mood}`);

  const sprite = document.createElement("div");
  sprite.className = "fw-pet__sprite";
  el.append(sprite);

  applyManifest(el, sprite, SPRITE_MANIFEST, state, mood);
}

function normalizeSpriteManifest(value: unknown): SpriteManifest {
  const candidate = value as Omit<SpriteManifest, "image"> & { image?: string };

  if (!candidate || typeof candidate !== "object" || !candidate.stages) {
    return {
      image: SPRITE_IMAGE_URL,
      frameWidth: 96,
      frameHeight: 96,
      columns: 4,
      rows: 10,
      stages: {
        "0": { idle: { row: 0, frames: 4, durationMs: 1200 }, happy: { row: 5, frames: 4, durationMs: 900 } },
        "1": { idle: { row: 1, frames: 4, durationMs: 1200 }, happy: { row: 6, frames: 4, durationMs: 900 } },
        "2": { idle: { row: 2, frames: 4, durationMs: 1200 }, happy: { row: 7, frames: 4, durationMs: 900 } },
        "3": { idle: { row: 3, frames: 4, durationMs: 1200 }, happy: { row: 8, frames: 4, durationMs: 900 } },
        "4": { idle: { row: 4, frames: 4, durationMs: 1200 }, happy: { row: 9, frames: 4, durationMs: 900 } }
      }
    };
  }

  return {
    image: SPRITE_IMAGE_URL,
    frameWidth: candidate.frameWidth,
    frameHeight: candidate.frameHeight,
    columns: candidate.columns,
    rows: candidate.rows,
    stages: candidate.stages
  };
}
