import spriteManifestData from "../../assets/sprites/manifest.json";
import type { PetState } from "../shared/types";

export const PET_MOODS = ["idle", "happy", "focus", "celebrate"] as const;
export const PET_STAGE_KEYS = ["0", "1", "2", "3", "4"] as const;

export type PetMood = typeof PET_MOODS[number];

export interface SpriteAnimation {
  row: number;
  frames: number;
  durationMs: number;
}

export interface SpriteManifest {
  image: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  stages: Record<string, Record<PetMood, SpriteAnimation>>;
}

export interface SpriteManifestValidation {
  valid: boolean;
  errors: string[];
}

export interface SpriteSheetDimensions {
  width: number;
  height: number;
}

const SPRITE_BUILD_URL = new URL("../../assets/sprites/focuswhale-atlas.png", import.meta.url).toString();
const SPRITE_IMAGE_URL = extensionAssetUrl("assets/focuswhale-atlas.png", SPRITE_BUILD_URL);
const FALLBACK_ICON_PATH = "icons/focuswhale-128.png";
const PET_STAGE_LABELS: Record<string, string> = {
  "0": "고래알",
  "1": "아기 고래",
  "2": "어린 고래",
  "3": "성장한 고래",
  "4": "별빛 고래"
};
const PET_MOOD_LABELS: Record<PetMood, string> = {
  idle: "쉬는 중",
  happy: "기쁜 상태",
  focus: "집중하는 중",
  celebrate: "축하하는 중"
};
const DEFAULT_MANIFEST: SpriteManifest = {
  image: SPRITE_IMAGE_URL,
  frameWidth: 96,
  frameHeight: 96,
  columns: 4,
  rows: 20,
  stages: {
    "0": defaultStageAnimations(0),
    "1": defaultStageAnimations(1),
    "2": defaultStageAnimations(2),
    "3": defaultStageAnimations(3),
    "4": defaultStageAnimations(4)
  }
};
const SPRITE_MANIFEST = normalizeSpriteManifest(spriteManifestData, SPRITE_IMAGE_URL);

type SpriteLoadState = "loading" | "loaded" | "failed";
interface SpriteLoadRecord {
  state: SpriteLoadState;
  promise: Promise<boolean>;
}

const spriteLoads = new Map<string, SpriteLoadRecord>();

export function validateSpriteManifest(value: unknown): SpriteManifestValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["manifest must be an object"] };
  }

  const frameWidth = validatePositiveInteger(value.frameWidth, "frameWidth", errors);
  const frameHeight = validatePositiveInteger(value.frameHeight, "frameHeight", errors);
  const columns = validatePositiveInteger(value.columns, "columns", errors);
  const rows = validatePositiveInteger(value.rows, "rows", errors);

  if (typeof value.image !== "string" || value.image.trim() === "") {
    errors.push("image must be a non-empty string");
  }

  if (!isRecord(value.stages)) {
    errors.push("stages must be an object");
    return { valid: false, errors };
  }

  for (const stageKey of PET_STAGE_KEYS) {
    const stage = value.stages[stageKey];
    if (!isRecord(stage)) {
      errors.push(`stages.${stageKey} must be an object`);
      continue;
    }

    for (const mood of PET_MOODS) {
      const animation = stage[mood];
      const path = `stages.${stageKey}.${mood}`;
      if (!isRecord(animation)) {
        errors.push(`${path} must be an object`);
        continue;
      }

      const row = validateNonNegativeInteger(animation.row, `${path}.row`, errors);
      const frames = validatePositiveInteger(animation.frames, `${path}.frames`, errors);
      validatePositiveInteger(animation.durationMs, `${path}.durationMs`, errors);

      if (row !== null && rows !== null && row >= rows) {
        errors.push(`${path}.row must be less than rows (${rows})`);
      }
      if (frames !== null && columns !== null && frames > columns) {
        errors.push(`${path}.frames must not exceed columns (${columns})`);
      }
    }
  }

  if (frameWidth !== null && frameHeight !== null && columns !== null && rows !== null) {
    const sheetWidth = frameWidth * columns;
    const sheetHeight = frameHeight * rows;
    if (!Number.isSafeInteger(sheetWidth) || !Number.isSafeInteger(sheetHeight)) {
      errors.push("sprite sheet geometry exceeds safe integer bounds");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSpriteSheetGeometry(
  manifest: Pick<SpriteManifest, "frameWidth" | "frameHeight" | "columns" | "rows">,
  dimensions: SpriteSheetDimensions
): SpriteManifestValidation {
  const expectedWidth = manifest.frameWidth * manifest.columns;
  const expectedHeight = manifest.frameHeight * manifest.rows;
  const errors: string[] = [];

  if (!Number.isInteger(dimensions.width) || dimensions.width <= 0) {
    errors.push("sprite image width must be a positive integer");
  } else if (dimensions.width !== expectedWidth) {
    errors.push(`sprite image width must be ${expectedWidth}px, received ${dimensions.width}px`);
  }

  if (!Number.isInteger(dimensions.height) || dimensions.height <= 0) {
    errors.push("sprite image height must be a positive integer");
  } else if (dimensions.height !== expectedHeight) {
    errors.push(`sprite image height must be ${expectedHeight}px, received ${dimensions.height}px`);
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeSpriteManifest(value: unknown, imageUrl = SPRITE_IMAGE_URL): SpriteManifest {
  const validation = validateSpriteManifest(value);
  if (!validation.valid) {
    return cloneManifest(DEFAULT_MANIFEST, imageUrl);
  }

  const candidate = value as Omit<SpriteManifest, "image"> & { image: string };
  return {
    image: imageUrl,
    frameWidth: candidate.frameWidth,
    frameHeight: candidate.frameHeight,
    columns: candidate.columns,
    rows: candidate.rows,
    stages: candidate.stages
  };
}

function ensurePetStyles(styleRoot: Document | ShadowRoot): void {
  if (styleRoot.querySelector("style[data-focuswhale-pet]")) {
    return;
  }

  const ownerDocument = styleRoot instanceof Document ? styleRoot : styleRoot.ownerDocument;
  const style = ownerDocument.createElement("style");
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

    .fw-pet__fallback {
      display: block;
      width: 82%;
      height: 82%;
      object-fit: contain;
    }

    .fw-pet__sprite[hidden],
    .fw-pet__fallback[hidden] {
      display: none;
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
  if (styleRoot instanceof Document) {
    styleRoot.head.append(style);
  } else {
    styleRoot.prepend(style);
  }
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

  for (const [property, propertyValue] of Object.entries(customProperties)) {
    root.style.setProperty(property, propertyValue);
    sprite.style.setProperty(property, propertyValue);
  }
}

export function mountPet(el: HTMLElement, state: PetState, mood: PetMood = "idle"): void {
  const nodeRoot = el.getRootNode();
  const styleRoot = nodeRoot instanceof ShadowRoot ? nodeRoot : el.ownerDocument;
  ensurePetStyles(styleRoot);
  el.replaceChildren();
  el.classList.add("fw-pet");
  el.removeAttribute("aria-hidden");
  el.setAttribute("role", "img");
  const stageLabel = PET_STAGE_LABELS[String(state.stage)] ?? PET_STAGE_LABELS["0"];
  el.setAttribute("aria-label", `FocusWhale 펫, ${stageLabel}, ${PET_MOOD_LABELS[mood]}`);
  el.dataset.petRender = "loading";

  const sprite = el.ownerDocument.createElement("div");
  sprite.className = "fw-pet__sprite";
  sprite.hidden = true;

  const fallback = el.ownerDocument.createElement("img");
  fallback.className = "fw-pet__fallback";
  fallback.src = fallbackIconUrl();
  fallback.alt = "";
  fallback.setAttribute("aria-hidden", "true");
  fallback.draggable = false;

  el.append(sprite, fallback);
  applyManifest(el, sprite, SPRITE_MANIFEST, state, mood);

  const loadRecord = preloadSprite(SPRITE_MANIFEST);
  if (loadRecord.state === "loaded") {
    revealSprite(el, sprite, fallback);
    return;
  }
  if (loadRecord.state === "failed") {
    el.dataset.petRender = "fallback";
    return;
  }

  void loadRecord.promise.then((loaded) => {
    if (sprite.parentElement !== el || fallback.parentElement !== el) {
      return;
    }
    if (loaded) {
      revealSprite(el, sprite, fallback);
    } else {
      el.dataset.petRender = "fallback";
    }
  });
}

function preloadSprite(manifest: SpriteManifest): SpriteLoadRecord {
  const cacheKey = `${manifest.image}:${manifest.frameWidth * manifest.columns}x${manifest.frameHeight * manifest.rows}`;
  const cached = spriteLoads.get(cacheKey);
  if (cached) {
    return cached;
  }

  const record: SpriteLoadRecord = {
    state: "loading",
    promise: Promise.resolve(false)
  };
  record.promise = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const geometry = validateSpriteSheetGeometry(manifest, {
        width: image.naturalWidth,
        height: image.naturalHeight
      });
      record.state = geometry.valid ? "loaded" : "failed";
      resolve(geometry.valid);
    }, { once: true });
    image.addEventListener("error", () => {
      record.state = "failed";
      resolve(false);
    }, { once: true });
    image.src = manifest.image;
  });
  spriteLoads.set(cacheKey, record);
  return record;
}

function revealSprite(root: HTMLElement, sprite: HTMLElement, fallback: HTMLImageElement): void {
  sprite.hidden = false;
  fallback.hidden = true;
  root.dataset.petRender = "sprite";
}

function fallbackIconUrl(): string {
  if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
    return chrome.runtime.getURL(FALLBACK_ICON_PATH);
  }
  return `/${FALLBACK_ICON_PATH}`;
}

function extensionAssetUrl(assetPath: string, builtUrl: string): string {
  if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.getURL !== "function") {
    return builtUrl;
  }

  return chrome.runtime.getURL(assetPath.replace(/^\/+/, ""));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePositiveInteger(value: unknown, path: string, errors: string[]): number | null {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    errors.push(`${path} must be a positive integer`);
    return null;
  }
  return value as number;
}

function validateNonNegativeInteger(value: unknown, path: string, errors: string[]): number | null {
  if (!Number.isInteger(value) || (value as number) < 0) {
    errors.push(`${path} must be a non-negative integer`);
    return null;
  }
  return value as number;
}

function defaultStageAnimations(stage: number): Record<PetMood, SpriteAnimation> {
  return {
    idle: { row: stage, frames: 4, durationMs: 1200 },
    happy: { row: stage + 5, frames: 4, durationMs: 900 },
    focus: { row: stage + 10, frames: 4, durationMs: 1000 },
    celebrate: { row: stage + 15, frames: 4, durationMs: 760 }
  };
}

function cloneStageAnimations(moods: Record<PetMood, SpriteAnimation>): Record<PetMood, SpriteAnimation> {
  return Object.fromEntries(
    PET_MOODS.map((mood) => [mood, { ...moods[mood] }])
  ) as Record<PetMood, SpriteAnimation>;
}

function cloneManifest(manifest: SpriteManifest, imageUrl: string): SpriteManifest {
  return {
    ...manifest,
    image: imageUrl,
    stages: Object.fromEntries(Object.entries(manifest.stages).map(([stage, moods]) => [
      stage,
      cloneStageAnimations(moods)
    ]))
  };
}
