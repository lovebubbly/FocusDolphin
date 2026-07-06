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

const MANIFEST_URL = new URL("../../assets/sprites/manifest.json", import.meta.url);
const FALLBACK_IMAGE_URL = new URL("../../assets/sprites/focuswhale-placeholder.svg", import.meta.url).toString();
const FALLBACK_MANIFEST: SpriteManifest = {
  image: FALLBACK_IMAGE_URL,
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

let manifestPromise: Promise<SpriteManifest> | null = null;

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
    }

    .fw-pet__sprite {
      width: var(--fw-frame-w);
      height: var(--fw-frame-h);
      background-image: var(--fw-image);
      background-repeat: no-repeat;
      background-size: var(--fw-sheet-w) var(--fw-sheet-h);
      background-position-y: var(--fw-row-offset);
      image-rendering: pixelated;
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

function applyManifest(sprite: HTMLElement, manifest: SpriteManifest, state: PetState, mood: PetMood): void {
  const stage = manifest.stages[String(state.stage)] ?? manifest.stages["0"];
  const animation = stage[mood] ?? stage.idle;
  const imageUrl = MANIFEST_URL.protocol === "data:"
    ? FALLBACK_IMAGE_URL
    : manifest.image.startsWith("http") || manifest.image.startsWith("data:") || manifest.image.startsWith("/")
    ? manifest.image
    : new URL(manifest.image, MANIFEST_URL).toString();

  sprite.style.setProperty("--fw-frame-w", `${manifest.frameWidth}px`);
  sprite.style.setProperty("--fw-frame-h", `${manifest.frameHeight}px`);
  sprite.style.setProperty("--fw-sheet-w", `${manifest.frameWidth * manifest.columns}px`);
  sprite.style.setProperty("--fw-sheet-h", `${manifest.frameHeight * manifest.rows}px`);
  sprite.style.setProperty("--fw-image", `url("${imageUrl}")`);
  sprite.style.setProperty("--fw-row-offset", `${animation.row * manifest.frameHeight * -1}px`);
  sprite.style.setProperty("--fw-duration", `${animation.durationMs}ms`);
  sprite.style.setProperty("--fw-frames", String(animation.frames));
  sprite.style.setProperty("--fw-end-x", `${animation.frames * manifest.frameWidth * -1}px`);
}

async function loadSpriteManifest(): Promise<SpriteManifest> {
  manifestPromise ??= fetch(MANIFEST_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Sprite manifest failed to load: ${response.status}`);
    }

    return response.json() as Promise<SpriteManifest>;
  });

  return manifestPromise;
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

  applyManifest(sprite, FALLBACK_MANIFEST, state, mood);
  void loadSpriteManifest()
    .then((manifest) => applyManifest(sprite, manifest, state, mood))
    .catch(() => applyManifest(sprite, FALLBACK_MANIFEST, state, mood));
}
