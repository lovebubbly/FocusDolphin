import { STORAGE_KEYS, getTyped } from "../shared/storage";
import type { Session, SiteList, TempAllow } from "../shared/types";
import { normalizeDomain, shouldBlockDomain } from "../background/rules";
import overlayStyles from "../styles/overlay.css?inline";

const OVERLAY_ID = "focuswhale-soft-overlay";
const URL_CHANGED_EVENT = "focuswhale:url-changed";
const PRETENDARD_FONT_URL = new URL("../../assets/fonts/PretendardVariable.woff2", import.meta.url).toString();

let countdownTimer: number | undefined;
let sessionExpiryTimer: number | undefined;

void evaluateSoftOverlay();
installNavigationHooks();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    (areaName === "local" && (changes.activeSession || changes.tempAllows)) ||
    (areaName === "sync" && changes.siteLists)
  ) {
    void evaluateSoftOverlay();
  }
});

window.addEventListener(URL_CHANGED_EVENT, () => {
  void evaluateSoftOverlay();
});

window.addEventListener("popstate", () => {
  void evaluateSoftOverlay();
});

async function evaluateSoftOverlay(): Promise<void> {
  const session = (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  clearSessionExpiryTimer();

  if (!isActiveSoftSession(session)) {
    removeOverlay();
    return;
  }

  sessionExpiryTimer = window.setTimeout(() => {
    void evaluateSoftOverlay();
  }, Math.max(1_000, session.endsAt - Date.now()));

  const hostname = normalizeDomain(window.location.hostname);
  if (!hostname || isSoftAllowedForPage(session.id, hostname)) {
    removeOverlay();
    return;
  }

  const [siteLists, tempAllows] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.siteLists),
    getTyped("local", STORAGE_KEYS.local.tempAllows)
  ]);
  const siteList = siteLists?.find((candidate) => candidate.id === session.listId);
  if (!siteList || hasActiveTempAllow(hostname, tempAllows ?? [])) {
    removeOverlay();
    return;
  }

  if (shouldBlockDomain(hostname, siteList)) {
    showOverlay(session, siteList, hostname);
  } else {
    removeOverlay();
  }
}

function showOverlay(session: Session, siteList: SiteList, hostname: string): void {
  if (document.getElementById(OVERLAY_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "focuswhale-dark" : "focuswhale";
  shadow.innerHTML = `
    <style>${runtimeOverlayStyles()}</style>
    <div data-theme="${theme}" class="fixed inset-0 z-[2147483647] grid min-h-screen w-screen place-items-center bg-base-200/80 p-7 text-base-content" role="dialog" aria-modal="true" aria-labelledby="focuswhale-title">
      <section class="card w-full max-w-md bg-base-100 shadow-xl">
        <div class="card-body gap-4">
          <p class="text-sm text-base-content/60">${escapeHtml(siteList.name)} · ${escapeHtml(hostname)}</p>
          <h1 id="focuswhale-title" class="text-2xl font-extrabold">잠시 멈춤</h1>
          <p class="text-sm text-base-content/60">이 세션에서는 이 사이트를 열기 전에 짧은 확인 시간을 둡니다.</p>
          <div class="card-actions justify-center gap-2">
            <button class="btn btn-primary" id="back-button" type="button">되돌아가기</button>
            <button class="btn btn-soft shadow-sm" id="continue-button" type="button" disabled>계속하기 10</button>
          </div>
        </div>
      </section>
    </div>
  `;

  document.documentElement.append(host);
  const continueButton = shadow.getElementById("continue-button") as HTMLButtonElement;
  const backButton = shadow.getElementById("back-button") as HTMLButtonElement;

  backButton.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });

  continueButton.addEventListener("click", () => {
    rememberSoftAllowed(session.id, hostname);
    removeOverlay();
  });

  startCountdown(continueButton, 10);
}

function runtimeOverlayStyles(): string {
  return overlayStyles.replace(
    /url\((?:"|')?(?:\.\.\/\.\.\/assets\/fonts\/PretendardVariable\.woff2|\/assets\/PretendardVariable-[^)'" ]+\.woff2)(?:"|')?\)/g,
    `url("${PRETENDARD_FONT_URL}")`
  );
}

function startCountdown(button: HTMLButtonElement, seconds: number): void {
  window.clearInterval(countdownTimer);
  let remaining = seconds;
  button.textContent = `계속하기 ${remaining}`;

  countdownTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(countdownTimer);
      button.disabled = false;
      button.textContent = "계속하기";
      return;
    }

    button.textContent = `계속하기 ${remaining}`;
  }, 1_000);
}

function removeOverlay(): void {
  window.clearInterval(countdownTimer);
  document.getElementById(OVERLAY_ID)?.remove();
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

function isActiveSoftSession(session: Session | null): session is Session {
  return Boolean(session && session.status === "active" && session.intensity === "soft" && session.endsAt > Date.now());
}

function hasActiveTempAllow(hostname: string, tempAllows: TempAllow[]): boolean {
  return tempAllows.some((entry) => entry.until > Date.now() && domainMatches(hostname, entry.domain));
}

function domainMatches(hostname: string, domain: string): boolean {
  const normalizedDomain = normalizeDomain(domain);
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
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
