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
import { playMotion } from "../shared/motion";
import {
  getUiLocale,
  initializeUiLocale,
  setUiLocalePreference,
  translate,
  type SupportedLocale
} from "../shared/i18n";
import { siteListDisplayName } from "../shared/siteLists";
import { sendMessage } from "../shared/messaging";
import overlayStyles from "../styles/overlay.css?inline";

const OVERLAY_ID = "focuswhale-soft-overlay";
const URL_CHANGED_EVENT = "focuswhale:url-changed";
const PRETENDARD_FONT_URL = extensionAssetUrl("assets/PretendardVariable.woff2");
const RUNTIME_OVERLAY_STYLES = rewriteOverlayAssetUrls(
  normalizeOverlayRemUnits(overlayStyles),
  PRETENDARD_FONT_URL
);

let countdownTimer: number | undefined;
let countdownDeadlineMs: number | undefined;
let sessionExpiryTimer: number | undefined;
let previouslyFocused: HTMLElement | null = null;
let inertedBody: { element: HTMLElement; wasInert: boolean } | null = null;
const softAllowedPages = new Set<string>();

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
  void initializeUiLocale().then(() => evaluateSessionSurface());
  installNavigationHooks();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEYS.sync.uiLocale]) {
      setUiLocalePreference(changes[STORAGE_KEYS.sync.uiLocale]?.newValue);
    }
    if (
      (areaName === "local" && (changes.activeSession || changes.tempAllows)) ||
      (areaName === "sync" && (changes.uiLocale || changes.siteLists || changes.settings))
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
  if (!hostname) {
    removeOverlay();
    return;
  }
  if (session.intensity === "soft" && await isSoftAllowedForPage(session.id, hostname)) {
    if (!evaluationGuard.isCurrent(evaluationToken)) {
      return;
    }
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
      updateOverlayLocalization(existingOverlay, siteList, hostname);
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
    <div id="focuswhale-dialog" lang="${getUiLocale()}" data-theme="${theme}" class="fixed inset-0 z-[2147483647] grid min-h-screen w-screen place-items-center bg-base-300/80 p-7 text-base-content" role="dialog" aria-modal="true" aria-labelledby="focuswhale-title" aria-describedby="focuswhale-description">
      <section class="card w-full max-w-md border border-primary/15 bg-base-100 text-base-content shadow-2xl">
        <div class="card-body items-center gap-4 text-center">
          <div class="grid h-24 w-24 place-items-center rounded-full bg-base-200">
            <div id="focuswhale-pet" class="grid place-items-center" aria-hidden="true"></div>
          </div>
          <span id="checkin-badge" class="badge badge-primary badge-soft hidden" role="status" aria-live="polite" aria-hidden="true">${escapeHtml(translate("softCheckInComplete"))}</span>
          <p id="focuswhale-context" class="text-xs font-bold text-primary">${escapeHtml(siteListDisplayName(siteList))} · ${escapeHtml(hostname)}</p>
          <h1 id="focuswhale-title" class="text-2xl font-black">${escapeHtml(translate("softPauseTitle"))}</h1>
          <p id="focuswhale-description" class="text-sm leading-6 text-base-content/65">${escapeHtml(translate("softPauseDescription"))}</p>
          <div class="grid w-full gap-2 sm:grid-cols-2">
            <button class="btn btn-primary min-h-11" id="back-button" type="button">${escapeHtml(translate("commonReturnToFocus"))}</button>
            <button class="btn btn-soft min-h-11" id="continue-button" type="button" aria-live="off" disabled>${escapeHtml(translate("softContinueCountdown", String(waitSeconds)))}</button>
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
  const checkinBadge = shadow.getElementById("checkin-badge") as HTMLElement;
  const continueButton = shadow.getElementById("continue-button") as HTMLButtonElement;
  const backButton = shadow.getElementById("back-button") as HTMLButtonElement;
  if (petSlot) {
    mountPet(petSlot, petState, "focus");
  }
  playMotion(shadow.querySelector("#focuswhale-dialog > section"), "hero");

  backButton.addEventListener("click", () => {
    evaluationGuard.invalidate();
    leaveSoftOverlayForFocus(removeOverlay, (target) => window.location.replace(target));
  });

  continueButton.addEventListener("click", async () => {
    evaluationGuard.invalidate();
    await rememberSoftAllowed(session.id, hostname);
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
  startCountdown(continueButton, checkinBadge, waitSeconds);
}

function updateOverlayLocalization(host: HTMLElement, siteList: SiteList, hostname: string): void {
  const shadow = host.shadowRoot;
  if (!shadow) {
    return;
  }

  const dialog = shadow.getElementById("focuswhale-dialog");
  const context = shadow.getElementById("focuswhale-context");
  const title = shadow.getElementById("focuswhale-title");
  const description = shadow.getElementById("focuswhale-description");
  const checkinBadge = shadow.getElementById("checkin-badge");
  const backButton = shadow.getElementById("back-button") as HTMLButtonElement | null;
  const continueButton = shadow.getElementById("continue-button") as HTMLButtonElement | null;
  if (!dialog || !context || !title || !description || !checkinBadge || !backButton || !continueButton) {
    return;
  }

  dialog.lang = getUiLocale();
  context.textContent = `${siteListDisplayName(siteList)} · ${hostname}`;
  title.textContent = translate("softPauseTitle");
  description.textContent = translate("softPauseDescription");
  checkinBadge.textContent = translate("softCheckInComplete");
  backButton.textContent = translate("commonReturnToFocus");

  const snapshot = softCountdownSnapshot(countdownDeadlineMs ?? Date.now());
  continueButton.disabled = snapshot.disabled;
  continueButton.setAttribute("aria-live", snapshot.disabled ? "off" : "polite");
  continueButton.textContent = snapshot.label;
  checkinBadge.classList.toggle("hidden", snapshot.disabled);
  checkinBadge.setAttribute("aria-hidden", String(snapshot.disabled));
}

function runtimeOverlayStyles(): string {
  return RUNTIME_OVERLAY_STYLES;
}

export function normalizeOverlayRemUnits(styles: string, pixelsPerRem = 16): string {
  if (!Number.isFinite(pixelsPerRem) || pixelsPerRem <= 0) {
    return styles;
  }

  // Shadow DOM isolates selectors, but rem units still use the host page's root font size.
  return styles.replace(/(-?(?:\d+(?:\.\d+)?|\.\d+))rem\b/g, (_match, value: string) => {
    const pixels = Number.parseFloat(value) * pixelsPerRem;
    return `${Number(pixels.toFixed(4))}px`;
  });
}

export function rewriteOverlayAssetUrls(styles: string, pretendardUrl: string): string {
  return styles.replace(
    /url\((?:"|')?[^)'" ]*PretendardVariable(?:-[^)'" ]+)?\.woff2(?:"|')?\)/g,
    `url("${pretendardUrl}")`
  );
}

function startCountdown(button: HTMLButtonElement, readyBadge: HTMLElement, seconds: number): void {
  window.clearInterval(countdownTimer);
  countdownTimer = undefined;
  const deadlineMs = Date.now() + Math.max(0, seconds) * 1_000;
  countdownDeadlineMs = deadlineMs;
  let wasReady = false;
  const update = () => {
    const snapshot = softCountdownSnapshot(deadlineMs);
    button.disabled = snapshot.disabled;
    button.setAttribute("aria-live", snapshot.disabled ? "off" : "polite");
    button.textContent = snapshot.label;
    readyBadge.classList.toggle("hidden", snapshot.disabled);
    readyBadge.setAttribute("aria-hidden", String(snapshot.disabled));
    const becameReady = !snapshot.disabled && !wasReady;
    wasReady = !snapshot.disabled;
    if (becameReady) {
      playMotion(readyBadge, "success");
    }
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
  countdownDeadlineMs = undefined;
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

async function rememberSoftAllowed(sessionId: string, hostname: string): Promise<void> {
  softAllowedPages.add(softAllowKey(sessionId, hostname));
  try {
    await sendMessage({ type: "SET_SOFT_ALLOW", payload: { sessionId, hostname } });
  } catch {
    // The current document remains allowed even if ephemeral cross-navigation storage is unavailable.
  }
}

async function isSoftAllowedForPage(sessionId: string, hostname: string): Promise<boolean> {
  const key = softAllowKey(sessionId, hostname);
  if (softAllowedPages.has(key)) {
    return true;
  }

  try {
    const response = await sendMessage({ type: "GET_SOFT_ALLOW", payload: { sessionId, hostname } });
    if (response.ok && response.allowed) {
      softAllowedPages.add(key);
      return true;
    }
  } catch {
    // Fall back to document memory when the background is temporarily unavailable.
  }
  return false;
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
