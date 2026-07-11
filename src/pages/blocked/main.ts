import { STORAGE_KEYS, getTyped } from "../../shared/storage";
import { translate } from "../../shared/i18n";
import type { Session } from "../../shared/types";
import { normalizeDomain, sanitizeHttpReturnUrl } from "../../background/rules";
import { normalizePetState } from "../../pet/defaultState";
import { mountPet, type PetMood } from "../../pet/renderer";

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

export interface BlockedOutcomePresentation {
  badge: string;
  borderClass: "border-success/25" | "border-warning/25";
  message: string;
  petMood: PetMood;
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
let blockedPetState = normalizePetState(undefined);

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
    app.className = "grid min-h-screen place-items-center bg-base-300 px-4 py-6 text-base-content sm:p-8";
    app.innerHTML = baseMarkup(null, false);
    await mountBlockedPet(null);
    renderStateUnavailable();
    return;
  }

  const session = state.state.activeSession;
  const pendingEmergency = state.state.pendingEmergency;

  if (!shouldPreserveTemporaryAllowView(mediumActionState?.sessionId ?? null, session)) {
    mediumActionState = null;
  }

  clearPageTimers();
  app.className = "grid min-h-screen place-items-center bg-base-300 px-4 py-6 text-base-content sm:p-8";
  app.innerHTML = baseMarkup(session, true);
  await mountBlockedPet(session);
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

async function mountBlockedPet(session: Session | null): Promise<void> {
  const slot = document.getElementById("pet-slot");
  if (!slot) {
    return;
  }

  const storedPetState = await getTyped("sync", STORAGE_KEYS.sync.petState).catch(() => undefined);
  blockedPetState = normalizePetState(storedPetState);
  mountPet(
    slot,
    blockedPetState,
    session?.status === "active" ? "focus" : "idle"
  );
}

function baseMarkup(session: Session | null, stateAvailable: boolean): string {
  const presentation = blockedPagePresentation(session, stateAvailable);
  const activeSession = session?.status === "active";
  const cardBorder = activeSession
    ? session.intensity === "hard"
      ? "border-error/20"
      : "border-primary/15"
    : "border-base-content/10";
  const sessionFacts = activeSession
    ? `
        <dl id="session-facts" class="stats stats-horizontal w-full overflow-hidden bg-base-200 text-left shadow-none">
          <div class="stat min-w-0 px-4 py-3">
            <dt class="stat-title">${translate("blockedTarget")}</dt>
            <dd class="stat-value break-all whitespace-normal text-base font-bold leading-snug tabular-nums">${escapeHtml(domain)}</dd>
          </div>
          <div class="stat min-w-0 px-4 py-3">
            <dt class="stat-title">${translate("blockedTimeRemaining")}</dt>
            <dd id="remaining-time" class="stat-value text-2xl font-black tabular-nums">${presentation.remaining}</dd>
          </div>
        </dl>
      `
    : "";
  return `
    <section id="blocked-card" class="card w-full max-w-[390px] overflow-hidden border ${cardBorder} bg-base-100 shadow-xl" aria-labelledby="blocked-title">
      <div class="card-body items-center gap-5 p-6 text-center sm:p-7">
        <div id="pet-shell" class="grid place-items-center">
          <div id="pet-backdrop" class="grid h-28 w-28 place-items-center rounded-full bg-base-200">
            <div id="pet-slot" class="grid place-items-center" aria-hidden="true"></div>
          </div>
        </div>
        <div id="blocked-heading-group">
          <p class="text-xs font-bold uppercase text-primary">${translate("onboardingBrand")}</p>
          <h1 id="blocked-title" class="mt-2 text-2xl font-black">${presentation.heading}</h1>
        </div>
        ${sessionFacts}
        <div
          id="action-area"
          class="w-full space-y-4 motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none"
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
    <div class="alert alert-warning alert-soft text-left text-sm shadow-none" role="alert"><span>${translate("blockedStateUnavailable")}</span></div>
    <div class="grid w-full gap-2">
      <button id="retry-state-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("commonRetry")}</button>
      <button id="back-button" type="button" class="btn btn-ghost min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
    </div>
  `, "#retry-state-button");
  document.getElementById("retry-state-button")?.addEventListener("click", queueRefresh);
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

function renderNoSession(): void {
  setActionArea(`
    <p class="text-sm leading-6 text-base-content/65">${translate("blockedSessionEndedNotice")}</p>
    <button id="exit-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToPreviousPage")}</button>
  `, "#exit-button");
  document.getElementById("exit-button")?.addEventListener("click", returnToRequestedPage);
}

function renderSoftFallback(): void {
  setActionArea(`
    <p class="text-sm leading-6 text-base-content/65">${translate("blockedSoftFallback")}</p>
    <button id="back-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
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
    <p class="text-sm leading-6 text-base-content/65">${translate("blockedMediumPrompt")}</p>
    <div class="grid w-full gap-2">
      <button id="back-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
      <button id="open-anyway-button" type="button" class="btn btn-ghost min-h-11 w-full">${translate("blockedOpenAnyway")}</button>
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
    <form id="intent-form" class="space-y-4 text-left">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">${translate("blockedIntentLegend")}</legend>
        <textarea id="intent-input" class="textarea min-h-24 w-full" name="intent" maxlength="140" autocomplete="off" required aria-describedby="intent-help"></textarea>
        <p id="intent-help" class="text-xs leading-5 text-base-content/60">${translate("blockedIntentHelp")}</p>
      </fieldset>
      <div class="grid w-full gap-2">
        <button id="back-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
        <button id="allow-button" type="submit" class="btn btn-soft min-h-11 w-full" aria-label="${translate("blockedTemporaryAllowAria")}" aria-describedby="allow-status" disabled><span id="allow-countdown" aria-hidden="true">${temporaryAllowCountdown(state.availableAt).visualText}</span></button>
      </div>
      <p id="allow-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    </form>
  `, "#intent-input");

  const form = document.getElementById("intent-form") as HTMLFormElement;
  const input = document.getElementById("intent-input") as HTMLTextAreaElement;
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
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
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
    <span class="badge badge-error badge-soft mx-auto">${translate("intensityHard")}</span>
    <div class="alert alert-soft text-left text-sm shadow-none" role="note"><span>${translate("blockedHardNoTemporaryAllow")}</span></div>
    <div class="grid w-full gap-2">
      <button id="hard-back-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
      <button id="emergency-button" type="button" class="btn btn-error btn-soft min-h-11 w-full">${translate("blockedEmergencyRequest")}</button>
    </div>
    <p class="text-xs leading-5 text-base-content/55">${translate("blockedEmergencyRule")}</p>
  `, "#hard-back-button");

  document.getElementById("emergency-button")?.addEventListener("click", () => {
    renderEmergencyConfirmation();
  });
  document.getElementById("hard-back-button")?.addEventListener("click", goBack);
}

function renderEmergencyConfirmation(): void {
  setActionArea(`
    <div class="alert alert-error alert-soft text-left text-sm leading-6 shadow-none" role="note"><span>${translate("blockedEmergencyConfirmWarning")}</span></div>
    <div class="grid w-full gap-2">
      <button id="cancel-emergency-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
      <button id="confirm-emergency-button" type="button" class="btn btn-error min-h-11 w-full">${translate("blockedEmergencySchedule")}</button>
    </div>
  `, "#cancel-emergency-button");

  document.getElementById("confirm-emergency-button")?.addEventListener("click", () => {
    void requestEmergencyEnd();
  });
  document.getElementById("cancel-emergency-button")?.addEventListener("click", goBack);
}

async function submitTemporaryAllow(intent: string, sessionId: string): Promise<void> {
  if (!intent) {
    const input = document.getElementById("intent-input") as HTMLTextAreaElement | null;
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
    <div class="alert alert-soft text-left text-sm shadow-none" role="status"><span>${translate("blockedTemporaryAllowApplying")}</span></div>
    <button id="back-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
  `, "#back-button");
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

export function tempAllowFailureMarkup(localeOverride?: LocaleOverride): string {
  return `
    <div class="alert alert-error alert-soft text-left text-sm shadow-none" role="alert"><span>${translate("blockedTemporaryAllowFailed", undefined, localeOverride)}</span></div>
    <div class="grid w-full gap-2">
      <button id="retry-allow-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("commonRetry", undefined, localeOverride)}</button>
      <button id="back-button" type="button" class="btn btn-ghost min-h-11 w-full">${translate("blockedReturnToFocus", undefined, localeOverride)}</button>
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
  const outcome = blockedOutcomePresentation("temporary-allow");
  prepareOutcomeShell(outcome);
  setActionArea(`
    <span class="badge badge-success badge-soft mx-auto">${outcome.badge}</span>
    <h1 id="blocked-outcome-title" class="text-xl font-black leading-7">${outcome.message}</h1>
    <button id="continue-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("commonContinue")}</button>
  `, "#continue-button");
  document.getElementById("continue-button")?.addEventListener("click", returnToRequestedPage);
}

async function requestEmergencyEnd(): Promise<void> {
  const response = await sendRuntime<{ emergencyDueAt?: number }>({ type: "END_SESSION", payload: { reason: "emergency" } });
  if (!response.ok) {
    setActionArea(`
      <div class="alert alert-warning alert-soft text-left text-sm shadow-none" role="alert"><span>${escapeHtml(localizeBlockedRuntimeError(response.error, "blockedEmergencySaveFailed"))}</span></div>
      <button id="back-button" type="button" class="btn btn-primary min-h-11 w-full">${translate("blockedReturnToFocus")}</button>
    `, "#back-button");
    document.getElementById("back-button")?.addEventListener("click", goBack);
    return;
  }

  renderEmergencyPending(response.emergencyDueAt ?? Date.now() + 5 * 60_000);
}

function renderEmergencyPending(dueAt: number): void {
  const outcome = blockedOutcomePresentation("emergency-pending");
  prepareOutcomeShell(outcome);
  setActionArea(`
    <span class="badge badge-warning badge-soft mx-auto">${outcome.badge}</span>
    <h1 id="blocked-outcome-title" class="text-2xl font-black leading-8">${outcome.message}</h1>
    <div id="emergency-countdown" class="text-5xl font-black tabular-nums" role="timer" aria-live="off">${formatCountdown(Math.ceil((dueAt - Date.now()) / 1_000))}</div>
  `);

  const countdown = document.getElementById("emergency-countdown");
  if (countdown) {
    startDeadlineCountdown(countdown, dueAt);
  }
}

function prepareOutcomeShell(outcome: BlockedOutcomePresentation): void {
  const card = document.getElementById("blocked-card");
  card?.classList.remove("border-primary/15", "border-error/20", "border-base-content/10");
  card?.classList.add(outcome.borderClass);
  card?.setAttribute("aria-labelledby", "blocked-outcome-title");
  document.getElementById("blocked-heading-group")?.remove();
  document.getElementById("session-facts")?.remove();

  const petBackdrop = document.getElementById("pet-backdrop");
  petBackdrop?.classList.remove("h-28", "w-28", "rounded-full", "bg-base-200");
  const slot = document.getElementById("pet-slot");
  if (slot) {
    mountPet(slot, blockedPetState, outcome.petMood);
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

export function blockedOutcomePresentation(
  kind: "temporary-allow" | "emergency-pending",
  localeOverride?: LocaleOverride
): BlockedOutcomePresentation {
  if (kind === "temporary-allow") {
    return {
      badge: translate("blockedTemporaryAllowFiveMinutes", undefined, localeOverride),
      borderClass: "border-success/25",
      message: translate("blockedTemporaryAllowSuccess", undefined, localeOverride),
      petMood: "happy"
    };
  }

  return {
    badge: translate("blockedEmergencyRequest", undefined, localeOverride),
    borderClass: "border-warning/25",
    message: translate("blockedEmergencyPending", undefined, localeOverride),
    petMood: "idle"
  };
}

function formatRemaining(endsAt: number, now = Date.now()): string {
  return formatCountdown(Math.max(0, Math.ceil((endsAt - now) / 1_000)));
}

export function formatCountdown(totalSeconds: number): string {
  const normalizedSeconds = Math.floor(Math.max(0, totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3_600);
  const minutes = Math.floor((normalizedSeconds % 3_600) / 60);
  const seconds = normalizedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

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
