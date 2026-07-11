import { STORAGE_KEYS, getTyped } from "../../shared/storage";
import { translate } from "../../shared/i18n";
import type { Session } from "../../shared/types";
import { normalizeDomain, sanitizeHttpReturnUrl } from "../../background/rules";
import { normalizePetState } from "../../pet/defaultState";
import { mountPet } from "../../pet/renderer";

type RuntimeResponse<T = unknown> = { ok: true } & T | { ok: false; error?: string };
type LocaleOverride = "ko" | "en";
type BlockedRuntimeState = {
  activeSession: Session | null;
  pendingEmergency: { sessionId: string; dueAt: number } | null;
};
type MediumActionState =
  | { kind: "friction"; sessionId: string; availableAt: number; intent: string }
  | { kind: "requesting"; sessionId: string; intent: string }
  | { kind: "failure"; sessionId: string; intent: string }
  | { kind: "success"; sessionId: string };

export interface BlockedPagePresentation {
  heading: string;
  remaining: string;
}

export interface TemporaryAllowCountdown {
  available: boolean;
  visualText: string;
  announcement: string;
}

const app = typeof document === "undefined" ? null : document.getElementById("app");
const originalUrl = typeof window === "undefined" ? null : originalHttpUrlFromHash(window.location.hash);
const domain = typeof window === "undefined"
  ? translate("blockedCurrentSite")
  : (originalUrl ? normalizeDomain(new URL(originalUrl).hostname) : "")
    || normalizeDomain(new URLSearchParams(window.location.search).get("d") ?? "")
    || translate("blockedCurrentSite");
let refreshQueue = Promise.resolve();
let remainingTimer: number | undefined;
let actionTimer: number | undefined;
let tempAllowRequestInFlight = false;
let mediumActionState: MediumActionState | null = null;

if (typeof document !== "undefined") {
  document.documentElement.lang = translate("appLocale");
  document.title = translate("blockedDocumentTitle");
}

if (app) {
  void bootstrapBlockedPage();
}

async function bootstrapBlockedPage(): Promise<void> {
  try {
    await sendRuntime({ type: "RECORD_BLOCKED_ATTEMPT", payload: { domain } });
  } catch {
    // A failed analytics write must not prevent the user from leaving the blocked page.
  }
  queueRefresh();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (shouldRefreshBlockedPage(changes, areaName)) {
      queueRefresh();
    }
  });
}

function queueRefresh(): void {
  refreshQueue = refreshQueue.then(refreshBlockedPage).catch((error: unknown) => {
    if (app) {
      app.textContent = error instanceof Error
        ? localizeBlockedRuntimeError(error.message, "blockedLoadFailed")
        : translate("blockedLoadFailed");
    }
  });
}

export function shouldRefreshBlockedPage(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): boolean {
  return areaName === "local"
    && (hasOwn(changes, STORAGE_KEYS.local.activeSession) || hasOwn(changes, "pendingEmergency"));
}

async function refreshBlockedPage(): Promise<void> {
  if (!app) {
    return;
  }

  const state = await sendRuntime<{ state: BlockedRuntimeState }>({ type: "GET_STATE" });

  if (!state.ok) {
    clearPageTimers();
    app.className = "grid min-h-screen place-items-center bg-base-200 px-4 py-6 text-base-content sm:p-8";
    app.innerHTML = baseMarkup(null, false);
    await mountBlockedPet();
    renderStateUnavailable();
    return;
  }

  const session = state.state.activeSession;
  const pendingEmergency = state.state.pendingEmergency;

  if (!shouldPreserveTemporaryAllowView(mediumActionState?.sessionId ?? null, session)) {
    mediumActionState = null;
  }

  clearPageTimers();
  app.className = "grid min-h-screen place-items-center bg-base-200 px-4 py-6 text-base-content sm:p-8";
  app.innerHTML = baseMarkup(session, true);
  await mountBlockedPet();
  wireRemainingTime(session);

  if (!session || session.status !== "active") {
    renderNoSession();
    return;
  }

  if (session.intensity === "medium") {
    renderMedium(session);
    return;
  }

  if (session.intensity === "hard") {
    renderHard(session, pendingEmergency);
    return;
  }

  renderSoftFallback();
}

async function mountBlockedPet(): Promise<void> {
  const slot = document.getElementById("pet-slot");
  if (!slot) {
    return;
  }

  const storedPetState = await getTyped("sync", STORAGE_KEYS.sync.petState).catch(() => undefined);
  mountPet(slot, normalizePetState(storedPetState), "focus");
}

function baseMarkup(session: Session | null, stateAvailable: boolean): string {
  const presentation = blockedPagePresentation(session, stateAvailable);
  return `
    <section class="card w-full max-w-lg overflow-hidden border border-base-300 bg-base-100 shadow-xl" aria-labelledby="blocked-title">
      <div class="card-body gap-6 p-5 sm:p-7">
        <div class="grid place-items-center">
          <div id="pet-slot" class="rounded-box grid h-28 w-28 place-items-center bg-base-200 ring-1 ring-base-300" aria-hidden="true"></div>
        </div>
        <div class="text-center">
          <p class="text-xs font-bold uppercase">FocusWhale</p>
          <h1 id="blocked-title" class="mt-1 text-3xl font-extrabold">${presentation.heading}</h1>
        </div>
        <dl class="stats stats-vertical w-full overflow-hidden border border-base-300 bg-base-200 shadow-none sm:stats-horizontal">
          <div class="stat min-w-0">
            <dt class="stat-title">${translate("blockedTarget")}</dt>
            <dd class="stat-value break-all whitespace-normal text-base font-semibold leading-snug tabular-nums">${escapeHtml(domain)}</dd>
          </div>
          <div class="stat">
            <dt class="stat-title">${translate("blockedTimeRemaining")}</dt>
            <dd id="remaining-time" class="stat-value text-2xl tabular-nums">${presentation.remaining}</dd>
          </div>
        </dl>
        <div
          id="action-area"
          class="space-y-4 border-t border-base-200 pt-5 motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none"
          role="region"
          aria-label="${translate("blockedActionsAria")}"
          aria-live="polite"
          aria-atomic="false"
          tabindex="-1"
        ></div>
      </div>
    </section>
  `;
}

function renderStateUnavailable(): void {
  setActionArea(`
    <div class="alert alert-warning alert-soft text-sm shadow-none" role="alert"><span>${translate("blockedStateUnavailable")}</span></div>
    <div class="card-actions justify-center gap-2">
      <button id="retry-state-button" type="button" class="btn btn-primary min-h-10">${translate("commonRetry")}</button>
      <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
    </div>
  `, "#retry-state-button");
  document.getElementById("retry-state-button")?.addEventListener("click", queueRefresh);
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

function renderNoSession(): void {
  setActionArea(`
    <div class="alert alert-soft border border-base-300 text-sm shadow-none" role="note"><span>${translate("blockedSessionEndedNotice")}</span></div>
    <div class="card-actions justify-center">
      <button id="exit-button" type="button" class="btn btn-primary min-h-10">${translate("blockedReturnToPreviousPage")}</button>
    </div>
  `, "#exit-button");
  document.getElementById("exit-button")?.addEventListener("click", returnToRequestedPage);
}

function renderSoftFallback(): void {
  setActionArea(`
    <p class="text-center text-sm">${translate("blockedSoftFallback")}</p>
    <div class="card-actions justify-center gap-2">
      <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
    </div>
  `, "#back-button");
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

function renderMedium(session: Session): void {
  if (mediumActionState?.sessionId === session.id) {
    if (mediumActionState.kind === "friction") {
      renderMediumFriction(session, mediumActionState);
    } else if (mediumActionState.kind === "requesting") {
      renderTempAllowRequesting();
    } else if (mediumActionState.kind === "failure") {
      renderTempAllowFailure(mediumActionState.sessionId, mediumActionState.intent);
    } else {
      renderTempAllowSuccess();
    }
    return;
  }

  setActionArea(`
    <p class="text-center text-sm">${translate("blockedMediumPrompt")}</p>
    <div class="card-actions justify-center gap-2">
      <button id="open-anyway-button" type="button" class="btn btn-primary min-h-10">${translate("blockedOpenAnyway")}</button>
      <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
    </div>
  `, "#back-button");

  document.getElementById("back-button")?.addEventListener("click", goBack);
  document.getElementById("open-anyway-button")?.addEventListener("click", () => {
    const waitSeconds = session.snoozeCount === 0 ? 30 : Math.max(30, session.nextSnoozeDelayMin * 60);
    renderMediumFriction(session, {
      kind: "friction",
      sessionId: session.id,
      availableAt: Date.now() + waitSeconds * 1_000,
      intent: ""
    });
  });
}

function renderMediumFriction(
  session: Session,
  state: Extract<MediumActionState, { kind: "friction" }>
): void {
  mediumActionState = state;
  setActionArea(`
    <form id="intent-form" class="space-y-3">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">${translate("blockedIntentLegend")}</legend>
        <input id="intent-input" class="input min-h-10 w-full" name="intent" type="text" maxlength="140" autocomplete="off" required aria-describedby="intent-help" />
        <p id="intent-help" class="label">${translate("blockedIntentHelp")}</p>
      </fieldset>
      <div class="card-actions justify-center gap-2">
        <button id="allow-button" type="submit" class="btn btn-primary min-h-10" aria-label="${translate("blockedTemporaryAllowAria")}" aria-describedby="allow-status" disabled><span id="allow-countdown" aria-hidden="true">${temporaryAllowCountdown(state.availableAt).visualText}</span></button>
        <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
      </div>
      <p id="allow-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    </form>
  `, "#intent-input");

  const form = document.getElementById("intent-form") as HTMLFormElement;
  const input = document.getElementById("intent-input") as HTMLInputElement;
  const allowButton = document.getElementById("allow-button") as HTMLButtonElement;
  const countdown = document.getElementById("allow-countdown") as HTMLElement;
  const status = document.getElementById("allow-status") as HTMLElement;
  input.value = state.intent;
  document.getElementById("back-button")?.addEventListener("click", goBack);

  input.addEventListener("input", () => {
    if (mediumActionState?.kind === "friction" && mediumActionState.sessionId === session.id) {
      mediumActionState = { ...mediumActionState, intent: input.value };
    }
  });
  startButtonCountdown(allowButton, countdown, status, state.availableAt);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!temporaryAllowCountdown(state.availableAt).available) {
      return;
    }
    void submitTemporaryAllow(input.value.trim(), session.id);
  });
}

function renderHard(session?: Session, pendingEmergency?: BlockedRuntimeState["pendingEmergency"]): void {
  if (session && pendingEmergency?.sessionId === session.id) {
    renderEmergencyPending(pendingEmergency.dueAt);
    return;
  }

  setActionArea(`
    <div class="alert alert-soft border border-base-300 text-sm shadow-none" role="note"><span>${translate("blockedHardNoTemporaryAllow")}</span></div>
    <p class="text-center text-sm">${translate("blockedEmergencyRule")}</p>
    <div class="card-actions justify-center gap-2">
      <button id="emergency-button" type="button" class="btn btn-error btn-soft min-h-10 text-base-content shadow-sm">${translate("blockedEmergencyRequest")}</button>
      <button id="hard-back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
    </div>
  `, "#hard-back-button");

  document.getElementById("emergency-button")?.addEventListener("click", () => {
    renderEmergencyConfirmation();
  });
  document.getElementById("hard-back-button")?.addEventListener("click", goBack);
}

function renderEmergencyConfirmation(): void {
  setActionArea(`
    <div class="alert alert-warning alert-soft text-sm shadow-none" role="note"><span>${translate("blockedEmergencyConfirmWarning")}</span></div>
    <div class="card-actions justify-center gap-2">
      <button id="confirm-emergency-button" type="button" class="btn btn-error min-h-10 shadow-md">${translate("blockedEmergencySchedule")}</button>
      <button id="cancel-emergency-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedGoBack")}</button>
    </div>
  `, "#cancel-emergency-button");

  document.getElementById("confirm-emergency-button")?.addEventListener("click", () => {
    void requestEmergencyEnd();
  });
  document.getElementById("cancel-emergency-button")?.addEventListener("click", () => renderHard());
}

async function submitTemporaryAllow(intent: string, sessionId: string): Promise<void> {
  if (!intent) {
    const input = document.getElementById("intent-input") as HTMLInputElement | null;
    input?.focus();
    return;
  }

  if (tempAllowRequestInFlight) {
    return;
  }
  tempAllowRequestInFlight = true;
  mediumActionState = { kind: "requesting", sessionId, intent };
  renderTempAllowRequesting();

  const response = await sendRuntime<{ nextSnoozeDelayMin: number; until: number }>({
    type: "REQUEST_TEMP_ALLOW",
    payload: { domain, intent, sessionId }
  });
  tempAllowRequestInFlight = false;
  if (mediumActionState?.kind !== "requesting" || mediumActionState.sessionId !== sessionId) {
    return;
  }
  if (!response.ok) {
    mediumActionState = { kind: "failure", sessionId, intent };
    renderTempAllowFailure(sessionId, intent);
    return;
  }

  mediumActionState = { kind: "success", sessionId };
  renderTempAllowSuccess();
}

function renderTempAllowRequesting(): void {
  setActionArea(`
    <div class="alert alert-soft border border-base-300 text-sm shadow-none" role="status"><span>${translate("blockedTemporaryAllowApplying")}</span></div>
    <div class="card-actions justify-center">
      <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
    </div>
  `, "#back-button");
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

export function tempAllowFailureMarkup(localeOverride?: LocaleOverride): string {
  return `
    <div class="alert alert-error alert-soft text-sm shadow-none" role="alert"><span>${translate("blockedTemporaryAllowFailed", undefined, localeOverride)}</span></div>
    <div class="card-actions justify-center gap-2">
      <button id="retry-allow-button" type="button" class="btn btn-primary min-h-10">${translate("commonRetry", undefined, localeOverride)}</button>
      <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus", undefined, localeOverride)}</button>
    </div>
  `;
}

function renderTempAllowFailure(sessionId: string, intent: string): void {
  setActionArea(tempAllowFailureMarkup(), "#retry-allow-button");
  document.getElementById("retry-allow-button")?.addEventListener("click", () => {
    void submitTemporaryAllow(intent, sessionId);
  });
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

function renderTempAllowSuccess(): void {
  setActionArea(`
    <p class="text-center text-sm">${translate("blockedTemporaryAllowSuccess")}</p>
    <div class="card-actions justify-center gap-2">
      <button id="continue-button" type="button" class="btn btn-primary min-h-10">${translate("commonContinue")}</button>
    </div>
  `, "#continue-button");
  document.getElementById("continue-button")?.addEventListener("click", returnToRequestedPage);
}

async function requestEmergencyEnd(): Promise<void> {
  const response = await sendRuntime<{ emergencyDueAt?: number }>({ type: "END_SESSION", payload: { reason: "emergency" } });
  if (!response.ok) {
    setActionArea(`
      <div class="alert alert-warning alert-soft text-sm shadow-none" role="alert"><span>${escapeHtml(localizeBlockedRuntimeError(response.error, "blockedEmergencySaveFailed"))}</span></div>
      <div class="card-actions justify-center gap-2">
        <button id="back-button" type="button" class="btn btn-soft min-h-10 shadow-sm">${translate("blockedReturnToFocus")}</button>
      </div>
    `, "#back-button");
    document.getElementById("back-button")?.addEventListener("click", goBack);
    return;
  }

  renderEmergencyPending(response.emergencyDueAt ?? Date.now() + 5 * 60_000);
}

function renderEmergencyPending(dueAt: number): void {
  setActionArea(`
    <p class="text-center text-sm">${translate("blockedEmergencyPending")}</p>
    <div id="emergency-countdown" class="text-center text-4xl font-extrabold tabular-nums" role="timer" aria-live="off">${formatCountdown(Math.ceil((dueAt - Date.now()) / 1_000))}</div>
  `);

  const countdown = document.getElementById("emergency-countdown");
  if (countdown) {
    startDeadlineCountdown(countdown, dueAt);
  }
}

function wireRemainingTime(session: Session | null): void {
  if (!session) {
    return;
  }

  remainingTimer = window.setInterval(() => {
    const remaining = document.getElementById("remaining-time");
    if (remaining) {
      remaining.textContent = formatRemaining(session.endsAt);
    }
  }, 1_000);
}

function startButtonCountdown(
  button: HTMLButtonElement,
  countdown: HTMLElement,
  status: HTMLElement,
  availableAt: number
): void {
  const update = () => {
    const snapshot = temporaryAllowCountdown(availableAt);
    countdown.textContent = snapshot.visualText;
    if (snapshot.available) {
      clearActionTimer();
      button.disabled = false;
      status.textContent = snapshot.announcement;
    }
    return snapshot.available;
  };

  if (update()) {
    return;
  }
  actionTimer = window.setInterval(update, 1_000);
}

function startDeadlineCountdown(element: HTMLElement, dueAt: number): void {
  const update = () => {
    const remaining = Math.max(0, Math.ceil((dueAt - Date.now()) / 1_000));
    element.textContent = remaining > 0 ? formatCountdown(remaining) : translate("blockedEmergencyEnding");
    return remaining;
  };

  update();
  actionTimer = window.setInterval(() => {
    if (update() <= 0) {
      clearActionTimer();
    }
  }, 1_000);
}

function clearPageTimers(): void {
  if (remainingTimer !== undefined) {
    window.clearInterval(remainingTimer);
    remainingTimer = undefined;
  }
  clearActionTimer();
}

function clearActionTimer(): void {
  if (actionTimer !== undefined) {
    window.clearInterval(actionTimer);
    actionTimer = undefined;
  }
}

async function sendRuntime<T>(message: unknown): Promise<RuntimeResponse<T>> {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message);
    if (!response || typeof response !== "object" || !("ok" in response) || typeof response.ok !== "boolean") {
      return { ok: false, error: translate("blockedInvalidExtensionResponse") };
    }
    return response as RuntimeResponse<T>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function setActionArea(markup: string, focusSelector?: string): void {
  const actionArea = document.getElementById("action-area");
  if (actionArea) {
    clearActionTimer();
    actionArea.innerHTML = markup;
    const focusTarget = focusSelector
      ? actionArea.querySelector<HTMLElement>(focusSelector)
      : actionArea;

    if (prefersReducedMotion()) {
      focusTarget?.focus({ preventScroll: true });
      return;
    }

    actionArea.classList.add("translate-y-1", "opacity-0");
    window.requestAnimationFrame(() => {
      actionArea.classList.remove("translate-y-1", "opacity-0");
      focusTarget?.focus({ preventScroll: true });
    });
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function goBack(): void {
  window.location.replace("about:blank");
}

function returnToRequestedPage(): void {
  if (originalUrl) {
    window.location.replace(originalUrl);
    return;
  }

  goBack();
}

export function originalHttpUrlFromHash(hash: string): string | null {
  const candidate = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!candidate) {
    return null;
  }

  return sanitizeHttpReturnUrl(candidate);
}

export function blockedPagePresentation(
  session: Session | null,
  stateAvailable: boolean,
  now = Date.now(),
  localeOverride?: LocaleOverride
): BlockedPagePresentation {
  if (!stateAvailable) {
    return {
      heading: translate("blockedHeadingStateUnavailable", undefined, localeOverride),
      remaining: translate("blockedRemainingCheckNeeded", undefined, localeOverride)
    };
  }

  if (session?.status === "active") {
    return {
      heading: translate("blockedHeadingSessionActive", undefined, localeOverride),
      remaining: formatRemaining(session.endsAt, now)
    };
  }

  return {
    heading: translate("blockedHeadingSessionEnded", undefined, localeOverride),
    remaining: translate("blockedRemainingNoSession", undefined, localeOverride)
  };
}

export function shouldPreserveTemporaryAllowView(actionSessionId: string | null, session: Session | null): boolean {
  return Boolean(
    actionSessionId
    && session?.id === actionSessionId
    && session.status === "active"
    && session.intensity === "medium"
  );
}

export function temporaryAllowCountdown(
  availableAt: number,
  now = Date.now(),
  localeOverride?: LocaleOverride
): TemporaryAllowCountdown {
  const remainingSeconds = Math.max(0, Math.ceil((availableAt - now) / 1_000));
  if (remainingSeconds === 0) {
    return {
      available: true,
      visualText: translate("blockedTemporaryAllowFiveMinutes", undefined, localeOverride),
      announcement: translate("blockedTemporaryAllowAvailableAnnouncement", undefined, localeOverride)
    };
  }

  return {
    available: false,
    visualText: formatCountdown(remainingSeconds),
    announcement: ""
  };
}

function formatRemaining(endsAt: number, now = Date.now()): string {
  return formatCountdown(Math.max(0, Math.ceil((endsAt - now) / 1_000)));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function localizeBlockedRuntimeError(error: string | undefined, fallbackKey: string): string {
  const keyByMessage: Record<string, string> = {
    "A valid domain is required for temporary allow.": "blockedErrorInvalidDomain",
    "Temporary allow requires an intent of 1 to 140 characters.": "blockedErrorInvalidIntent",
    "Temporary allow requires the matching active medium session.": "blockedErrorNoMatchingMediumSession",
    "The requested domain is not blocked by the active session.": "blockedErrorDomainNotBlocked",
    "Emergency end is only available during an active hard session.": "blockedErrorEmergencyUnavailable",
    "\uc774\ubc88 \uc8fc \ube44\uc0c1 \uc885\ub8cc \uc694\uccad\uc740 \uc774\ubbf8 \uc0ac\uc6a9\ud588\uc2b5\ub2c8\ub2e4.": "blockedErrorEmergencyAlreadyUsed",
    "This action requires a top-level FocusWhale blocked-page tab.": "blockedErrorTopLevelPageRequired",
    "This action requires the FocusWhale blocked page.": "blockedErrorBlockedPageRequired"
  };
  const key = error ? keyByMessage[error] : undefined;
  if (key) {
    return translate(key);
  }

  return error === translate("blockedInvalidExtensionResponse") ? error : translate(fallbackKey);
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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
