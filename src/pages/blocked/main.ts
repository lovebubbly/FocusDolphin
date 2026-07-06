import { STORAGE_KEYS, getTyped, setTyped } from "../../shared/storage";
import type { DailyStats, Session } from "../../shared/types";
import { normalizeDomain } from "../../background/rules";

type RuntimeResponse<T = unknown> = { ok: true } & T | { ok: false; error?: string };

const app = document.getElementById("app");
const domain = normalizeDomain(new URLSearchParams(window.location.search).get("d") ?? "") || "현재 사이트";

void render();

async function render(): Promise<void> {
  if (!app) {
    return;
  }

  await incrementBlockedAttempts(domain);
  const state = await sendRuntime<{ state: { activeSession: Session | null } }>({ type: "GET_STATE" });
  const session = state.ok ? state.state.activeSession : null;

  app.innerHTML = baseMarkup(session);
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
    renderHard();
    return;
  }

  renderSoftFallback();
}

function baseMarkup(session: Session | null): string {
  return `
    <section class="shell" aria-labelledby="blocked-title">
      <div id="pet-slot" aria-hidden="true"></div>
      <div class="eyebrow">FocusWhale</div>
      <h1 id="blocked-title">집중 세션이 진행 중입니다</h1>
      <dl class="facts">
        <div>
          <dt>대상</dt>
          <dd>${escapeHtml(domain)}</dd>
        </div>
        <div>
          <dt>남은 시간</dt>
          <dd id="remaining-time">${session ? formatRemaining(session.endsAt) : "세션 없음"}</dd>
        </div>
      </dl>
      <div id="action-area"></div>
    </section>
  `;
}

function renderNoSession(): void {
  setActionArea(`
    <p class="note">현재 활성 세션을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
  `);
}

function renderSoftFallback(): void {
  setActionArea(`
    <p class="note">이 사이트는 soft 세션에서 안내 오버레이로 처리됩니다.</p>
    <button id="back-button" type="button" class="secondary">되돌아가기</button>
  `);
  document.getElementById("back-button")?.addEventListener("click", goBack);
}

function renderMedium(session: Session): void {
  setActionArea(`
    <p class="note">열기 전에 짧은 확인 시간을 둡니다.</p>
    <button id="open-anyway-button" type="button" class="primary">그래도 열기</button>
    <button id="back-button" type="button" class="secondary">되돌아가기</button>
  `);

  document.getElementById("back-button")?.addEventListener("click", goBack);
  document.getElementById("open-anyway-button")?.addEventListener("click", () => {
    renderMediumFriction(session);
  });
}

function renderMediumFriction(session: Session): void {
  const waitSeconds = session.snoozeCount === 0 ? 30 : Math.max(30, session.nextSnoozeDelayMin * 60);
  setActionArea(`
    <form id="intent-form" class="form">
      <label for="intent-input">열어야 하는 이유</label>
      <input id="intent-input" name="intent" type="text" maxlength="140" autocomplete="off" />
      <button id="allow-button" type="submit" class="primary" disabled>${formatCountdown(waitSeconds)}</button>
      <button id="back-button" type="button" class="secondary">되돌아가기</button>
    </form>
  `);

  const form = document.getElementById("intent-form") as HTMLFormElement;
  const input = document.getElementById("intent-input") as HTMLInputElement;
  const allowButton = document.getElementById("allow-button") as HTMLButtonElement;
  document.getElementById("back-button")?.addEventListener("click", goBack);

  startButtonCountdown(allowButton, waitSeconds);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitTemporaryAllow(input.value.trim());
  });
}

function renderHard(): void {
  setActionArea(`
    <p class="note">hard 세션에서는 임시 허용을 제공하지 않습니다.</p>
    <button id="emergency-button" type="button" class="secondary">비상 종료 요청</button>
  `);

  document.getElementById("emergency-button")?.addEventListener("click", () => {
    void requestEmergencyEnd();
  });
}

async function submitTemporaryAllow(intent: string): Promise<void> {
  if (!intent) {
    const input = document.getElementById("intent-input") as HTMLInputElement | null;
    input?.focus();
    return;
  }

  const session = (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  const intentLog = (await getTyped("local", STORAGE_KEYS.local.intentLog)) ?? [];
  await setTyped("local", STORAGE_KEYS.local.intentLog, [
    ...intentLog,
    { at: Date.now(), domain, intent, sessionId: session?.id }
  ]);

  await sendRuntime({ type: "SNOOZE_REQUEST", payload: { domain } });
  const response = await sendRuntime({ type: "TEMP_ALLOW", payload: { domain, minutes: 5 } });
  if (!response.ok) {
    setActionArea(`<p class="note">임시 허용을 적용하지 못했습니다. 다시 시도해 주세요.</p>`);
    return;
  }

  setActionArea(`
    <p class="note">5분 동안 열 수 있습니다. 시간이 지나면 세션 규칙이 다시 적용됩니다.</p>
    <button id="continue-button" type="button" class="primary">계속하기</button>
  `);
  document.getElementById("continue-button")?.addEventListener("click", goBack);
}

async function requestEmergencyEnd(): Promise<void> {
  const response = await sendRuntime({ type: "END_SESSION", payload: { reason: "emergency" } });
  if (!response.ok) {
    setActionArea(`<p class="note">요청을 저장하지 못했습니다. 다시 시도해 주세요.</p>`);
    return;
  }

  setActionArea(`
    <p class="note">비상 종료 요청이 저장되었습니다. 약 5분 뒤 세션이 종료됩니다.</p>
    <div id="emergency-countdown" class="countdown">${formatCountdown(5 * 60)}</div>
  `);

  const countdown = document.getElementById("emergency-countdown");
  if (countdown) {
    startTextCountdown(countdown, 5 * 60);
  }
}

function wireRemainingTime(session: Session | null): void {
  if (!session) {
    return;
  }

  window.setInterval(() => {
    const remaining = document.getElementById("remaining-time");
    if (remaining) {
      remaining.textContent = formatRemaining(session.endsAt);
    }
  }, 1_000);
}

function startButtonCountdown(button: HTMLButtonElement, seconds: number): void {
  let remaining = seconds;
  button.textContent = formatCountdown(remaining);

  const timer = window.setInterval(() => {
    remaining -= 1;
    button.textContent = formatCountdown(remaining);
    if (remaining <= 0) {
      window.clearInterval(timer);
      button.disabled = false;
      button.textContent = "5분 임시 허용";
    }
  }, 1_000);
}

function startTextCountdown(element: HTMLElement, seconds: number): void {
  let remaining = seconds;
  element.textContent = formatCountdown(remaining);

  const timer = window.setInterval(() => {
    remaining -= 1;
    element.textContent = formatCountdown(remaining);
    if (remaining <= 0) {
      window.clearInterval(timer);
      element.textContent = "종료 처리 중";
    }
  }, 1_000);
}

async function sendRuntime<T>(message: unknown): Promise<RuntimeResponse<T>> {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function incrementBlockedAttempts(hostname: string): Promise<void> {
  const date = localDateKey(Date.now());
  const key = STORAGE_KEYS.local.dailyStats(date);
  const existing = await getTyped("local", key);
  const nextStats: DailyStats = {
    date,
    focusMinutes: existing?.focusMinutes ?? 0,
    blockedAttempts: (existing?.blockedAttempts ?? 0) + 1,
    overrides: existing?.overrides ?? 0,
    domainVisits: {
      ...(existing?.domainVisits ?? {}),
      [hostname]: (existing?.domainVisits?.[hostname] ?? 0) + 1
    }
  };

  await setTyped("local", key, nextStats);
}

function setActionArea(markup: string): void {
  const actionArea = document.getElementById("action-area");
  if (actionArea) {
    actionArea.innerHTML = markup;
  }
}

function goBack(): void {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

function formatRemaining(endsAt: number): string {
  return formatCountdown(Math.max(0, Math.ceil((endsAt - Date.now()) / 1_000)));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function localDateKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
