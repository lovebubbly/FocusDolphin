import { STORAGE_KEYS, getTyped } from "../shared/storage";
import type { Session, SiteList, TempAllow } from "../shared/types";
import {
  domainMatches,
  normalizeDomain,
  sanitizeHttpReturnUrl,
  shouldBlockDomain
} from "../background/rules";
import { normalizePetState } from "../pet/defaultState";
import { mountPet } from "../pet/renderer";
import { LatestRequestGuard } from "../shared/latestRequest";
import { translate, type SupportedLocale } from "../shared/i18n";
import { siteListDisplayName } from "../shared/siteLists";
import overlayStyles from "../styles/overlay.css?inline";

const OVERLAY_ID = "focuswhale-soft-overlay";
const URL_CHANGED_EVENT = "focuswhale:url-changed";
const PRETENDARD_FONT_URL = extensionAssetUrl("assets/PretendardVariable.woff2");

let countdownTimer: number | undefined;
let sessionExpiryTimer: number | undefined;
let previouslyFocused: HTMLElement | null = null;
let inertedBody: { element: HTMLElement; wasInert: boolean } | null = null;

export { LatestRequestGuard as LatestEvaluationGuard } from "../shared/latestRequest";

export interface SoftCountdownSnapshot {
  remainingSeconds: number;
  label: string;
  disabled: boolean;
}

export function softCountdownSnapshot(
  deadlineMs: number,
  now = Date.now(),
  localeOverride?: SupportedLocale
): SoftCountdownSnapshot {
  const remainingSeconds = Math.max(0, Math.ceil((deadlineMs - now) / 1_000));
  return {
    remainingSeconds,
    label: remainingSeconds > 0
      ? translate("softContinueCountdown", String(remainingSeconds), localeOverride)
      : translate("commonContinue", undefined, localeOverride),
    disabled: remainingSeconds > 0
  };
}

export function leaveSoftOverlayForFocus(
  cleanup: () => void,
  navigate: (target: string) => void
): void {
  cleanup();
  navigate("about:blank");
}

const evaluationGuard = new LatestRequestGuard();

if (typeof chrome !== "undefined" && typeof window !== "undefined") {
  void evaluateSessionSurface();
  installNavigationHooks();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      (areaName === "local" && (changes.activeSession || changes.tempAllows)) ||
      (areaName === "sync" && (changes.siteLists || changes.settings))
    ) {
      void evaluateSessionSurface();
    }
  });

  window.addEventListener(URL_CHANGED_EVENT, () => {
    void evaluateSessionSurface();
  });

  window.addEventListener("popstate", () => {
    void evaluateSessionSurface();
  });
}

async function evaluateSessionSurface(): Promise<void> {
  const evaluationToken = evaluationGuard.begin();
  clearSessionExpiryTimer();
  const session = (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  if (!evaluationGuard.isCurrent(evaluationToken)) {
    return;
  }

  if (!isActiveSession(session)) {
    removeOverlay();
    return;
  }

  sessionExpiryTimer = window.setTimeout(() => {
    if (evaluationGuard.isCurrent(evaluationToken)) {
      void evaluateSessionSurface();
    }
  }, Math.max(1_000, session.endsAt - Date.now()));

  const hostname = normalizeDomain(window.location.hostname);
  if (!hostname || (session.intensity === "soft" && isSoftAllowedForPage(session.id, hostname))) {
    removeOverlay();
    return;
  }

  const [siteLists, tempAllows, settings, storedPetState] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.siteLists),
    getTyped("local", STORAGE_KEYS.local.tempAllows),
    getTyped("sync", STORAGE_KEYS.sync.settings),
    getTyped("sync", STORAGE_KEYS.sync.petState)
  ]);
  if (!evaluationGuard.isCurrent(evaluationToken)) {
    return;
  }
  if (!isActiveSession(session)) {
    clearSessionExpiryTimer();
    removeOverlay();
    return;
  }
  const siteList = siteLists?.find((candidate) => candidate.id === session.listId);
  if (!siteList || hasActiveTempAllow(hostname, tempAllows ?? [], session.id)) {
    removeOverlay();
    return;
  }

  if (shouldBlockDomain(hostname, siteList)) {
    if (session.intensity === "soft") {
      showOverlay(
        session,
        siteList,
        hostname,
        clampOverlaySeconds(settings?.softOverlaySeconds),
        normalizePetState(storedPetState)
      );
      return;
    }

    redirectToBlockedPage(hostname);
    return;
  }

  removeOverlay();
}

function showOverlay(
  session: Session,
  siteList: SiteList,
  hostname: string,
  waitSeconds: number,
  petState: ReturnType<typeof normalizePetState>
): void {
  const existingOverlay = document.getElementById(OVERLAY_ID);
  if (existingOverlay) {
    const representsCurrentSurface = existingOverlay.dataset.focuswhaleSessionId === session.id
      && existingOverlay.dataset.focuswhaleHostname === hostname
      && existingOverlay.dataset.focuswhaleWaitSeconds === String(waitSeconds);
    if (representsCurrentSurface) {
      return;
    }
    removeOverlay();
  }

  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  host.dataset.focuswhaleSessionId = session.id;
  host.dataset.focuswhaleHostname = hostname;
  host.dataset.focuswhaleWaitSeconds = String(waitSeconds);
  const shadow = host.attachShadow({ mode: "open" });
  const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "focuswhale-dark" : "focuswhale";
  shadow.innerHTML = `
    <style>${runtimeOverlayStyles()}</style>
    <div data-theme="${theme}" class="fixed inset-0 z-[2147483647] grid min-h-screen w-screen place-items-center bg-base-200/80 p-7 text-base-content" role="dialog" aria-modal="true" aria-labelledby="focuswhale-title" aria-describedby="focuswhale-description">
      <section class="card w-full max-w-md bg-base-100 shadow-xl">
        <div class="card-body gap-4">
          <div id="focuswhale-pet" class="mx-auto grid h-24 w-24 place-items-center" aria-hidden="true"></div>
          <p class="text-center text-sm font-semibold text-base-content/80">${escapeHtml(siteListDisplayName(siteList))} · ${escapeHtml(hostname)}</p>
          <h1 id="focuswhale-title" class="text-center text-2xl font-extrabold">${escapeHtml(translate("softPauseTitle"))}</h1>
          <p id="focuswhale-description" class="text-center text-sm text-base-content/80">${escapeHtml(translate("softPauseDescription"))}</p>
          <div class="card-actions justify-center gap-2">
            <button class="btn btn-primary" id="back-button" type="button">${escapeHtml(translate("commonReturnToFocus"))}</button>
            <button class="btn btn-soft shadow-sm" id="continue-button" type="button" aria-live="off" disabled>${escapeHtml(translate("softContinueCountdown", String(waitSeconds)))}</button>
          </div>
        </div>
      </section>
    </div>
  `;

  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (document.body) {
    inertedBody = { element: document.body, wasInert: document.body.inert };
    document.body.inert = true;
  }
  document.documentElement.append(host);
  const petSlot = shadow.getElementById("focuswhale-pet");
  const continueButton = shadow.getElementById("continue-button") as HTMLButtonElement;
  const backButton = shadow.getElementById("back-button") as HTMLButtonElement;
  if (petSlot) {
    mountPet(petSlot, petState, "focus");
  }

  backButton.addEventListener("click", () => {
    evaluationGuard.invalidate();
    leaveSoftOverlayForFocus(removeOverlay, (target) => window.location.replace(target));
  });

  continueButton.addEventListener("click", () => {
    evaluationGuard.invalidate();
    rememberSoftAllowed(session.id, hostname);
    removeOverlay();
  });

  shadow.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = [backButton, continueButton].filter((button) => !button.disabled);
    const currentIndex = focusable.indexOf(shadow.activeElement as HTMLButtonElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  });

  backButton.focus();
  startCountdown(continueButton, waitSeconds);
}

function runtimeOverlayStyles(): string {
  return rewriteOverlayAssetUrls(overlayStyles, PRETENDARD_FONT_URL);
}

export function rewriteOverlayAssetUrls(styles: string, pretendardUrl: string): string {
  return styles.replace(
    /url\((?:"|')?[^)'" ]*PretendardVariable(?:-[^)'" ]+)?\.woff2(?:"|')?\)/g,
    `url("${pretendardUrl}")`
  );
}

function startCountdown(button: HTMLButtonElement, seconds: number): void {
  window.clearInterval(countdownTimer);
  countdownTimer = undefined;
  const deadlineMs = Date.now() + Math.max(0, seconds) * 1_000;
  const update = () => {
    const snapshot = softCountdownSnapshot(deadlineMs);
    button.disabled = snapshot.disabled;
    button.setAttribute("aria-live", snapshot.disabled ? "off" : "polite");
    button.textContent = snapshot.label;
    if (!snapshot.disabled && countdownTimer !== undefined) {
      window.clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
    return snapshot;
  };

  const initial = update();
  if (initial.disabled) {
    countdownTimer = window.setInterval(update, 1_000);
  }
}

function removeOverlay(): void {
  if (countdownTimer !== undefined) {
    window.clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    restoreDocumentInteractivity();
    return;
  }

  overlay.remove();
  restoreDocumentInteractivity();
  previouslyFocused?.focus();
  previouslyFocused = null;
}

function restoreDocumentInteractivity(): void {
  if (!inertedBody) {
    return;
  }

  inertedBody.element.inert = inertedBody.wasInert;
  inertedBody = null;
}

export function clampOverlaySeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10;
  }

  return Math.min(60, Math.max(3, Math.round(value)));
}

function installNavigationHooks(): void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    window.dispatchEvent(new Event(URL_CHANGED_EVENT));
    return result;
  };

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event(URL_CHANGED_EVENT));
    return result;
  };
}

function redirectToBlockedPage(hostname: string): void {
  removeOverlay();
  const blockedUrl = buildBlockedPageRedirectUrl(
    chrome.runtime.getURL("src/pages/blocked/index.html"),
    hostname,
    window.location.href
  );

  if (window.location.href !== blockedUrl) {
    window.location.replace(blockedUrl);
  }
}

export function buildBlockedPageRedirectUrl(
  blockedPageUrl: string,
  hostname: string,
  pageUrl: string | undefined
): string {
  const returnUrl = sanitizeHttpReturnUrl(pageUrl);
  const destination = `${blockedPageUrl}?d=${encodeURIComponent(hostname)}`;
  return returnUrl ? `${destination}#${returnUrl}` : destination;
}

function isActiveSession(session: Session | null): session is Session {
  return Boolean(session && session.status === "active" && session.endsAt > Date.now());
}

function hasActiveTempAllow(hostname: string, tempAllows: TempAllow[], sessionId: string): boolean {
  return tempAllows.some((entry) => (
    entry.sessionId === sessionId
    && entry.until > Date.now()
    && domainMatches(hostname, entry.domain)
  ));
}

function rememberSoftAllowed(sessionId: string, hostname: string): void {
  window.sessionStorage.setItem(softAllowKey(sessionId, hostname), "true");
}

function isSoftAllowedForPage(sessionId: string, hostname: string): boolean {
  return window.sessionStorage.getItem(softAllowKey(sessionId, hostname)) === "true";
}

function softAllowKey(sessionId: string, hostname: string): string {
  return `focuswhale:soft-allowed:${sessionId}:${hostname}`;
}

function clearSessionExpiryTimer(): void {
  if (sessionExpiryTimer !== undefined) {
    window.clearTimeout(sessionExpiryTimer);
    sessionExpiryTimer = undefined;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function extensionAssetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, "");
  if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.getURL !== "function") {
    return normalizedPath;
  }

  return chrome.runtime.getURL(normalizedPath);
}
