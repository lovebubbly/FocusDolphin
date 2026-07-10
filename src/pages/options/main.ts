import { aggregateDashboard } from "../../analytics/aggregate";
import { RECOMMENDATIONS_KEY, type Recommendation } from "../../analytics/recommend";
import { badgeName } from "../../pet/badges";
import { normalizePetState } from "../../pet/defaultState";
import { growthProgress, readGrowthLog, type GrowthEvent } from "../../pet/growth";
import { mountPet } from "../../pet/renderer";
import { BADGE_DEFINITIONS } from "../../shared/gamification";
import { sendMessage } from "../../shared/messaging";
import { LatestRequestGuard } from "../../shared/latestRequest";
import { getTyped, STORAGE_KEYS } from "../../shared/storage";
import type { Intensity, PetState, Schedule, Session, SiteList } from "../../shared/types";
import {
  blockedDomainsFromLists,
  collectDailyStats,
  isOptionsLocked,
  makeId,
  normalizeDomainList,
  normalizeOptionsSettings,
  schedulesReferencingSiteList,
  validateScheduleConfiguration,
  type OptionsSettings
} from "./model";

interface OptionsState {
  settings: OptionsSettings;
  siteLists: SiteList[];
  schedules: Schedule[];
  activeSession: Session | null;
  petState: PetState;
  growthLog: GrowthEvent[];
  recommendations: Recommendation[];
  sessionLog: Session[];
  dailyStats: ReturnType<typeof collectDailyStats>;
  notice?: string;
  noticeTone?: NoticeTone;
}

export type OptionsView = "insights" | "lists" | "automation" | "growth";
type NoticeTone = "neutral" | "success" | "error";

interface OptionsUiState {
  view: OptionsView;
  analyzing: boolean;
}

interface OptionsHandlers {
  reload: (notice?: string, noticeTone?: NoticeTone, focusId?: string) => Promise<void>;
  setView: (view: OptionsView, restoreTabFocus?: boolean) => void;
  analyzeHistory: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  revokeHistoryAccess: () => Promise<void>;
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const OPTIONS_VIEWS: Array<[OptionsView, string]> = [
  ["insights", "기록"],
  ["lists", "차단 규칙"],
  ["automation", "자동 시작"],
  ["growth", "고래 성장"]
];
const modalReturnTargets = new WeakMap<HTMLDialogElement, HTMLElement>();
const MODAL_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])"
].join(",");
const root = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("#app");

if (root && document.body.dataset.page === "focuswhale-options") {
  void bootstrapOptions(root).catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : "Options failed to load.";
  });
}

async function bootstrapOptions(container: HTMLElement): Promise<void> {
  let state = await loadState();
  const stateLoads = new LatestRequestGuard();
  const ui: OptionsUiState = { view: "insights", analyzing: false };

  const reload = async (notice?: string, noticeTone: NoticeTone = "success", focusId?: string) => {
    const token = stateLoads.begin();
    const nextState = await loadState(notice, noticeTone);
    if (!stateLoads.isCurrent(token)) {
      return;
    }
    state = nextState;
    rerender(focusId);
  };

  const rerender = (focusId?: string) => {
    renderOptions(container, state, ui, {
      reload,
      setView: (view, restoreTabFocus = false) => {
        ui.view = view;
        rerender(restoreTabFocus ? optionsTabId(view) : undefined);
      },
      analyzeHistory: async () => {
        if (ui.analyzing) {
          return;
        }

        const historyAccessGranted = await requestHistoryAccess().catch(() => false);
        if (!historyAccessGranted) {
          await reload("방문 기록 권한을 허용해야 로컬 추천 분석을 시작할 수 있습니다.", "neutral", "history-analyze");
          return;
        }

        ui.analyzing = true;
        rerender("history-analyze");
        try {
          await requestHistoryAnalysis();
          await reload("로컬 방문 기록 분석을 완료했습니다.", "success", "history-analyze");
        } catch (error) {
          await reload(error instanceof Error ? error.message : "방문 기록을 분석하지 못했습니다.", "error", "history-analyze");
        } finally {
          ui.analyzing = false;
          rerender("history-analyze");
        }
      },
      clearLocalData: async () => {
        try {
          const response = await sendMessage({ type: "CLEAR_LOCAL_DATA" }) as { ok: boolean; error?: string };
          if (!response.ok) {
            throw new Error(response.error ?? "로컬 기록을 지우지 못했습니다.");
          }
          await reload("이 기기에 저장된 활동 기록을 지웠습니다.", "success", "local-data-clear");
        } catch (error) {
          await reload(error instanceof Error ? error.message : "로컬 기록을 지우지 못했습니다.", "error", "local-data-clear");
        }
      },
      revokeHistoryAccess: async () => {
        const removed = await chrome.permissions.remove({ permissions: ["history"] });
        await reload(
          removed ? "방문 기록 권한을 해제했습니다." : "방문 기록 권한이 이미 해제되어 있습니다.",
          "neutral",
          "history-revoke"
        );
      }
    });
    if (focusId) {
      document.getElementById(focusId)?.focus({ preventScroll: true });
    }
  };

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      (areaName === "local" && Object.keys(changes).length > 0)
      || (areaName === "sync" && [
        STORAGE_KEYS.sync.settings,
        STORAGE_KEYS.sync.siteLists,
        STORAGE_KEYS.sync.schedules,
        STORAGE_KEYS.sync.petState
      ].some((key) => hasStorageChange(changes, key)))
    ) {
      const focusId = document.activeElement instanceof HTMLElement && container.contains(document.activeElement)
        ? document.activeElement.id || undefined
        : undefined;
      void reload(state.notice, state.noticeTone ?? "neutral", focusId);
    }
  });

  rerender();
  window.setInterval(() => updateLockedOptionsCountdown(container, state.activeSession), 1_000);
}

export async function loadState(notice?: string, noticeTone: NoticeTone = "neutral"): Promise<OptionsState> {
  // GET_STATE can complete an overdue session. All dashboard and pet reads must
  // happen afterwards because the initial storage listener is not installed yet.
  const activeSession = await getAuthoritativeActiveSession();
  const localSnapshot = await chrome.storage.local.get(null);
  const settings = normalizeOptionsSettings(await getTyped("sync", STORAGE_KEYS.sync.settings));

  return {
    settings,
    siteLists: (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [],
    schedules: (await getTyped("sync", STORAGE_KEYS.sync.schedules)) ?? [],
    activeSession,
    petState: normalizePetState(await getTyped("sync", STORAGE_KEYS.sync.petState)),
    growthLog: await readGrowthLog(30),
    recommendations: (localSnapshot[RECOMMENDATIONS_KEY] as Recommendation[] | undefined) ?? [],
    sessionLog: (await getTyped("local", STORAGE_KEYS.local.sessionLog)) ?? [],
    dailyStats: collectDailyStats(localSnapshot),
    notice,
    noticeTone
  };
}

async function getAuthoritativeActiveSession(): Promise<Session | null> {
  try {
    const response = await sendMessage({ type: "GET_STATE" });
    if (!response.ok) {
      throw new Error(response.error);
    }
    return response.state.activeSession;
  } catch {
    const stored = (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
    return isOptionsLocked(stored) ? stored : null;
  }
}

function renderOptions(
  container: HTMLElement,
  state: OptionsState,
  ui: OptionsUiState,
  handlers: OptionsHandlers
): void {
  const locked = isOptionsLocked(state.activeSession);
  container.replaceChildren();

  if (locked) {
    renderLockedOptions(container, state);
    return;
  }

  container.className = "mx-auto grid w-full max-w-[720px] gap-6 bg-base-200 px-5 py-8 text-base-content";

  const header = document.createElement("header");
  header.className = "space-y-2";
  appendText(header, "p", "FocusWhale", "text-sm font-semibold");
  appendText(header, "h1", "FocusWhale 관리", "text-3xl font-extrabold");
  appendText(header, "p", "기록, 차단 규칙, 자동 시작, 고래 성장을 한곳에서 관리합니다.", "text-sm");
  container.append(header, renderOptionsTabs(ui.view, handlers.setView));

  if (state.notice) {
    appendBanner(container, state.notice, state.noticeTone ?? "neutral");
  }

  const content = document.createElement("div");
  content.className = "grid gap-8";
  content.id = optionsPanelId(ui.view);
  content.setAttribute("role", "tabpanel");
  content.setAttribute("aria-labelledby", optionsTabId(ui.view));
  content.tabIndex = 0;
  content.dataset.view = ui.view;

  if (ui.view === "insights") {
    content.append(
      renderDashboard(state),
      renderAnalysisSettings(state, locked, handlers),
      renderRecommendations(state, locked, ui, handlers),
      renderPrivacyControls(handlers)
    );
  } else if (ui.view === "lists") {
    content.append(
      renderBehaviorSettings(state, locked, handlers),
      renderSiteLists(state, locked, handlers)
    );
  } else if (ui.view === "automation") {
    content.append(renderSchedules(state, locked, handlers));
  } else {
    content.append(renderGrowth(state, handlers));
  }

  for (const [view] of OPTIONS_VIEWS) {
    if (view === ui.view) {
      container.append(content);
      continue;
    }

    const inactivePanel = document.createElement("div");
    inactivePanel.id = optionsPanelId(view);
    inactivePanel.setAttribute("role", "tabpanel");
    inactivePanel.setAttribute("aria-labelledby", optionsTabId(view));
    inactivePanel.hidden = true;
    container.append(inactivePanel);
  }
}

function renderOptionsTabs(activeView: OptionsView, setView: (view: OptionsView, restoreTabFocus?: boolean) => void): HTMLElement {
  const tabs = document.createElement("div");
  tabs.className = "tabs tabs-box w-full overflow-x-auto bg-base-100 p-1 shadow-sm";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "관리 화면");

  for (const [view, label] of OPTIONS_VIEWS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = optionsTabId(view);
    tab.className = `tab min-h-10 flex-1 whitespace-nowrap ${view === activeView ? "tab-active" : ""}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(view === activeView));
    tab.setAttribute("aria-controls", optionsPanelId(view));
    tab.tabIndex = view === activeView ? 0 : -1;
    tab.textContent = label;
    tab.addEventListener("click", () => setView(view, true));
    tab.addEventListener("keydown", (event) => {
      const nextView = nextOptionsView(view, event.key);
      if (!nextView) {
        return;
      }
      event.preventDefault();
      setView(nextView, true);
    });
    tabs.append(tab);
  }

  return tabs;
}

export function nextOptionsView(current: OptionsView, key: string): OptionsView | null {
  const views = OPTIONS_VIEWS.map(([view]) => view);
  const currentIndex = views.indexOf(current);
  if (key === "Home") {
    return views[0];
  }
  if (key === "End") {
    return views[views.length - 1];
  }
  if (key !== "ArrowLeft" && key !== "ArrowRight") {
    return null;
  }

  const offset = key === "ArrowRight" ? 1 : -1;
  return views[(currentIndex + offset + views.length) % views.length];
}

function optionsTabId(view: OptionsView): string {
  return `options-tab-${view}`;
}

function optionsPanelId(view: OptionsView): string {
  return `options-panel-${view}`;
}

function renderGrowth(
  state: OptionsState,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("고래 성장");
  const progress = growthProgress(state.petState.xp, state.petState.stage);

  const hero = document.createElement("div");
  hero.className = "card fw-pet-hero border border-base-200 shadow-sm";
  const heroBody = document.createElement("div");
  heroBody.className = "card-body grid gap-4 sm:grid-cols-[112px_1fr] sm:items-center";
  const petSlot = document.createElement("div");
  petSlot.className = "mx-auto grid place-items-center";
  mountPet(petSlot, state.petState, "idle");
  const heroCopy = document.createElement("div");
  heroCopy.className = "min-w-0 space-y-2 text-center sm:text-left";
  appendText(heroCopy, "p", state.petState.name ?? "미로", "break-all text-sm font-semibold text-primary");
  appendText(heroCopy, "h3", `${progress.currentStageName}와 항해 중`, "text-2xl font-extrabold");
  appendText(heroCopy, "p", progress.nextStageName
    ? `${progress.nextStageName}까지 ${progress.remainingXp} XP`
    : "가장 깊은 바다에 도착했어요.", "text-sm");
  heroBody.append(petSlot, heroCopy);
  hero.append(heroBody);

  const nameForm = document.createElement("form");
  nameForm.className = "grid gap-3 md:grid-cols-[1fr_auto] md:items-end";
  const name = input("text", "고래 이름", state.petState.name ?? "미로", false);
  name.control.maxLength = 24;
  const save = submitButton("이름 저장", false, "soft");
  save.id = "pet-name-save";
  nameForm.append(name.label, save);
  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextName = name.control.value.trim() || "미로";
    void runGuardedMutation(save, "저장 중...", async () => {
      const response = await sendMessage({ type: "SET_PET_NAME", payload: { name: nextName } });
      if (!response.ok) {
        throw new Error(response.error);
      }
      await handlers.reload("고래 이름을 저장했습니다.", "success", save.id);
    }, nameForm, "고래 이름을 저장하지 못했습니다.");
  });

  const stats = document.createElement("div");
  stats.className = "stats stats-horizontal w-full overflow-hidden bg-base-100 shadow-sm";
  metric(stats, "현재 단계", progress.currentStageName);
  metric(stats, "누적 집중", `${state.petState.totalFocusMinutes}분`);
  metric(stats, "다음 단계", progress.nextStageName ?? "완성");
  metric(stats, "남은 XP", String(progress.remainingXp));

  const protectionNote = document.createElement("div");
  protectionNote.className = "alert alert-soft border border-base-300 text-sm shadow-none";
  protectionNote.setAttribute("role", "note");
  appendText(
    protectionNote,
    "span",
    `보호막 ${state.petState.streakFreezes}/2 · 7일 연속 집중할 때 1개 충전되고, 하루를 놓치면 자동으로 1개 사용되어 이어온 기록을 지켜줘요.`
  );

  const barWrap = document.createElement("div");
  barWrap.className = "grid gap-2";
  const bar = document.createElement("progress");
  bar.className = "progress progress-primary w-full";
  bar.max = 100;
  bar.value = progress.percentToNext;
  barWrap.append(bar);
  appendText(barWrap, "p", progress.nextStageName
    ? `${progress.nextStageName}까지 ${progress.percentToNext}%`
    : "지금은 가장 깊은 바다를 항해 중입니다.", "text-sm");

  const badgeGrid = document.createElement("ul");
  badgeGrid.className = "list overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm";
  for (const [id, definition] of Object.entries(BADGE_DEFINITIONS)) {
    const earned = state.petState.badges.includes(id);
    const item = document.createElement("li");
    item.className = "list-row items-center border-b border-base-200 last:border-b-0";
    const marker = document.createElement("span");
    marker.className = earned ? "size-3 rounded-full bg-primary" : "size-3 rounded-full bg-base-300";
    marker.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "min-w-0";
    appendText(copy, "p", earned ? definition.name : definition.kind === "surprise" ? "숨은 징표" : definition.name, "font-semibold");
    appendText(copy, "p", earned ? definition.description : badgeProgressText(id, state), "text-sm");
    const status = appendText(item, "span", earned ? "획득" : "진행 중", earned ? "badge badge-soft badge-primary" : "badge badge-ghost");
    item.prepend(marker, copy);
    item.append(status);
    badgeGrid.append(item);
  }

  const log = document.createElement("div");
  log.className = "overflow-hidden rounded-box border border-base-300 bg-base-100";
  const table = document.createElement("table");
  table.className = "table table-sm";
  table.innerHTML = `
    <thead>
      <tr>
        <th>날짜</th>
        <th>기록</th>
        <th class="text-right">XP</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  if (state.growthLog.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "text-sm";
    cell.textContent = "아직 성장 기록이 없습니다.";
    row.append(cell);
    tbody.append(row);
  }
  for (const event of state.growthLog) {
    const row = document.createElement("tr");
    appendText(row, "td", formatDate(event.ts), "text-xs");
    appendText(row, "td", event.badgeId ? `징표 획득 - ${badgeName(event.badgeId)}` : event.text);
    appendText(row, "td", event.xpDelta ? `+${event.xpDelta}` : "-", "text-right tabular-nums");
    tbody.append(row);
  }
  table.append(tbody);
  log.append(table);

  const logDetails = document.createElement("details");
  logDetails.className = "collapse collapse-arrow border border-base-300 bg-base-100";
  appendText(logDetails, "summary", "성장 기록 보기", "collapse-title min-h-10 font-semibold");
  const logContent = document.createElement("div");
  logContent.className = "collapse-content";
  logContent.append(log);
  logDetails.append(logContent);

  section.append(hero, nameForm, stats, protectionNote, barWrap, badgeGrid, logDetails);
  return section;
}

function renderLockedOptions(container: HTMLElement, state: OptionsState): void {
  const session = state.activeSession;
  container.className = "mx-auto grid min-h-screen w-full max-w-[520px] place-items-center bg-base-200 px-5 py-8 text-base-content";

  const panel = document.createElement("section");
  panel.className = "card w-full border border-base-300 bg-base-100 shadow-xl";
  const body = document.createElement("div");
  body.className = "card-body gap-5";
  appendText(body, "p", "FocusWhale", "text-sm font-semibold");
  appendText(body, "h1", "세션 중에는 설정을 잠가둡니다", "text-2xl font-extrabold");
  appendText(body, "p", "집중 세션이 끝나면 차단 규칙, 자동 시작, 추천 분석을 다시 열 수 있습니다.", "text-sm");

  const stats = document.createElement("div");
  stats.className = "stats stats-vertical overflow-hidden bg-base-200 shadow-sm";
  const remaining = metric(stats, "남은 시간", lockedOptionsCountdownText(session));
  remaining.id = "options-session-remaining";
  metric(stats, "현재 강도", formatIntensity(session?.intensity));
  body.append(stats);

  const actions = document.createElement("div");
  actions.className = "card-actions justify-end";
  actions.append(button("되돌아가기", "primary", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.close();
  }));
  body.append(actions);
  panel.append(body);
  container.append(panel);
}

function updateLockedOptionsCountdown(container: HTMLElement, session: Session | null): void {
  const remaining = container.querySelector<HTMLElement>("#options-session-remaining");
  if (!remaining || !session) {
    return;
  }

  remaining.textContent = lockedOptionsCountdownText(session);
}

export function lockedOptionsCountdownText(session: Session | null, now = Date.now()): string {
  return formatRemainingMs((session?.endsAt ?? now) - now);
}

function renderBehaviorSettings(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("차단 동작");
  const form = document.createElement("form");
  form.className = "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end";
  const softSeconds = input("number", "가벼운 안내 대기 시간(초)", String(state.settings.softOverlaySeconds), locked);
  softSeconds.control.min = "3";
  softSeconds.control.max = "60";

  const action = document.createElement("div");
  const save = submitButton("저장", locked, "soft");
  save.id = "behavior-save";
  action.append(save);
  form.append(softSeconds.label, action);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    void runGuardedMutation(save, "저장 중...", async () => {
      await requireOk(sendMessage({
        type: "PATCH_SETTINGS",
        payload: { patch: { softOverlaySeconds: Number(softSeconds.control.value) } }
      }));
      await handlers.reload("차단 동작을 저장했습니다.", "success", save.id);
    }, form, "차단 동작을 저장하지 못했습니다.");
  });

  section.append(form);
  return section;
}

function renderAnalysisSettings(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("추천 분석 기준");
  const form = document.createElement("form");
  form.className = "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end";
  const start = input("time", "집중 시간대 시작", state.settings.focusHours.startHHMM, locked);
  const end = input("time", "집중 시간대 종료", state.settings.focusHours.endHHMM, locked);
  start.control.required = true;
  end.control.required = true;
  const action = document.createElement("div");
  const save = submitButton("저장", locked, "soft");
  save.id = "analysis-settings-save";
  action.append(save);
  form.append(start.label, end.label, action);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    if (!start.control.value || !end.control.value || start.control.value === end.control.value) {
      showInlineError(form, !start.control.value || !end.control.value
        ? "집중 시간대의 시작과 종료 시간을 모두 선택해 주세요."
        : "집중 시간대의 시작과 종료 시간을 다르게 선택해 주세요.");
      (!start.control.value ? start.control : end.control).focus({ preventScroll: true });
      return;
    }

    void runGuardedMutation(save, "저장 중...", async () => {
      await requireOk(sendMessage({
        type: "PATCH_SETTINGS",
        payload: { patch: { focusHours: { startHHMM: start.control.value, endHHMM: end.control.value } } }
      }));
      await handlers.reload("추천 분석 기준을 저장했습니다.", "success", save.id);
    }, form, "추천 분석 기준을 저장하지 못했습니다.");
  });
  section.append(form);
  return section;
}

function renderSiteLists(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("차단 목록");
  const listWrap = document.createElement("div");
  listWrap.className = "overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm";

  for (const siteList of state.siteLists) {
    listWrap.append(renderSiteListEditor(siteList, state, locked, handlers));
  }

  const addButton = button("목록 추가", "soft", () => {
    if (locked) {
      return;
    }

    void runGuardedMutation(addButton, "추가 중...", async () => {
      const next: SiteList = {
        id: makeId("list"),
        name: "새 목록",
        mode: "blocklist",
        domains: []
      };
      await requireOk(sendMessage({ type: "CREATE_SITE_LIST", payload: { siteList: next } }));
      await handlers.reload("목록을 추가했습니다.", "success", addButton.id);
    }, section, "목록을 추가하지 못했습니다.");
  });
  addButton.id = "site-list-add";
  addButton.disabled = locked;
  addButton.classList.add("btn-outline", "min-h-10", "shadow-sm");
  section.append(listWrap, addButton);
  return section;
}

function renderSiteListEditor(
  siteList: SiteList,
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const details = document.createElement("details");
  details.className = "collapse collapse-arrow border-b border-base-200 bg-base-100 last:border-b-0";
  const summary = document.createElement("summary");
  summary.id = uniqueDomId("site-list-summary", siteList.id);
  summary.className = "collapse-title grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 pe-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const summaryCopy = document.createElement("div");
  summaryCopy.className = "min-w-0";
  appendText(summaryCopy, "p", siteList.name, "break-all font-semibold");
  appendText(summaryCopy, "p", `${siteList.domains.length}개 도메인`, "text-xs");
  appendText(summary, "span", siteList.mode === "blocklist" ? "기본 차단" : "집중 허용", "badge badge-soft shadow-sm");
  summary.prepend(summaryCopy);

  const form = document.createElement("form");
  form.className = "collapse-content grid gap-3 border-t border-base-200 pt-4";

  const name = input("text", "이름", siteList.name, locked);
  const modeLabel = document.createElement("label");
  modeLabel.className = "fieldset";
  modeLabel.textContent = "모드";
  const mode = document.createElement("select");
  mode.className = "select w-full";
  mode.disabled = locked;
  for (const value of ["blocklist", "allowlist"] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "blocklist" ? "기본 차단 - 목록의 사이트만 차단" : "집중 허용 - 목록의 사이트만 허용";
    option.selected = value === siteList.mode;
    mode.append(option);
  }
  modeLabel.append(mode);

  const domainsLabel = document.createElement("label");
  domainsLabel.className = "fieldset";
  domainsLabel.textContent = "도메인";
  const domains = document.createElement("textarea");
  domains.className = "textarea w-full";
  domains.disabled = locked;
  domains.rows = 4;
  domains.value = siteList.domains.join("\n");
  domainsLabel.append(domains);

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";
  const save = submitButton("저장", locked, "soft");
  save.id = uniqueDomId("site-list-save", siteList.id);
  actions.append(save);
  const deleteDialog = document.createElement("dialog");
  deleteDialog.className = "modal";
  const dialogTitleId = uniqueDomId("list-delete-title", siteList.id);
  const dialogDescriptionId = uniqueDomId("list-delete-description", siteList.id);
  deleteDialog.setAttribute("aria-labelledby", dialogTitleId);
  deleteDialog.setAttribute("aria-describedby", dialogDescriptionId);
  deleteDialog.innerHTML = `
    <div class="modal-box">
      <h3 id="${dialogTitleId}" class="text-lg font-bold">이 목록을 삭제할까요?</h3>
      <p id="${dialogDescriptionId}" class="mt-2 break-all text-sm">${escapeHtml(siteList.name)} 목록만 삭제됩니다.</p>
      <div class="modal-action">
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost min-h-10" data-cancel>취소</button>
          <button type="button" class="btn btn-error min-h-10" data-confirm>삭제</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="목록 삭제 대화상자 닫기">닫기</button></form>
  `;
  configureModalDialog(deleteDialog);
  deleteDialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", () => deleteDialog.close());
  const confirmDelete = deleteDialog.querySelector<HTMLButtonElement>("[data-confirm]");
  confirmDelete?.addEventListener("click", () => {
    if (locked) {
      return;
    }
    const dialogBox = deleteDialog.querySelector<HTMLElement>(".modal-box") ?? deleteDialog;
    void runGuardedMutation(confirmDelete, "삭제 중...", async () => {
      await requireOk(sendMessage({ type: "DELETE_SITE_LIST", payload: { siteListId: siteList.id } }));
      deleteDialog.close();
      await handlers.reload("목록을 삭제했습니다.", "success", "site-list-add");
    }, dialogBox, "목록을 삭제하지 못했습니다.");
  });
  const dependentSchedules = schedulesReferencingSiteList(state.schedules, siteList.id);
  const deleteBlockMessage = dependentSchedules.length > 0
    ? `이 목록을 사용하는 자동 시작이 ${dependentSchedules.length}개 있습니다. 먼저 자동 시작에서 다른 목록을 선택하거나 삭제해 주세요.`
    : state.siteLists.length <= 1
      ? "차단 목록은 하나 이상 필요합니다. 새 목록을 추가한 뒤 삭제해 주세요."
      : null;
  const removeButton = button("삭제", "ghost", () => {
    if (deleteBlockMessage) {
      showInlineError(form, deleteBlockMessage);
      return;
    }
    showModalDialog(deleteDialog, removeButton);
  });
  removeButton.disabled = locked;
  removeButton.classList.add("min-h-10");
  actions.append(removeButton);

  form.append(name.label, modeLabel, domainsLabel, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    void runGuardedMutation(save, "저장 중...", async () => {
      await requireOk(sendMessage({
        type: "UPDATE_SITE_LIST",
        payload: {
          siteList: {
            ...siteList,
            name: name.control.value.trim() || "목록",
            mode: mode.value as SiteList["mode"],
            domains: normalizeDomainList(domains.value)
          }
        }
      }));
      await handlers.reload("목록을 저장했습니다.", "success", summary.id);
    }, form, "목록을 저장하지 못했습니다.");
  });

  details.append(summary, form, deleteDialog);
  return details;
}

function renderSchedules(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("자동 시작");
  const listWrap = document.createElement("div");
  listWrap.className = "overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm";
  for (const schedule of state.schedules) {
    listWrap.append(renderScheduleEditor(schedule, state, locked, handlers));
  }

  const addButton = button("자동 시작 추가", "soft", () => {
    if (locked) {
      return;
    }

    void runGuardedMutation(addButton, "추가 중...", async () => {
      const next: Schedule = {
        id: makeId("schedule"),
        enabled: true,
        days: [1, 2, 3, 4, 5],
        startHHMM: "09:00",
        endHHMM: "12:00",
        listId: state.siteLists[0]?.id ?? "",
        intensity: "medium"
      };
      await requireOk(sendMessage({ type: "CREATE_SCHEDULE", payload: { schedule: next } }));
      await handlers.reload("자동 시작을 추가했습니다.", "success", addButton.id);
    }, section, "자동 시작을 추가하지 못했습니다.");
  });
  addButton.id = "schedule-add";
  addButton.disabled = locked || state.siteLists.length === 0;
  addButton.classList.add("btn-outline", "min-h-10", "shadow-sm");
  if (state.siteLists.length === 0) {
    const notice = document.createElement("div");
    notice.className = "alert alert-soft border border-base-300 text-sm shadow-none";
    notice.setAttribute("role", "note");
    appendText(notice, "span", "자동 시작을 추가하려면 차단 규칙에서 목록을 먼저 만들어 주세요.");
    section.append(notice);
  }
  section.append(listWrap, addButton);
  return section;
}

function renderScheduleEditor(
  schedule: Schedule,
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const details = document.createElement("details");
  details.className = "collapse collapse-arrow border-b border-base-200 bg-base-100 last:border-b-0";
  const summary = document.createElement("summary");
  summary.id = uniqueDomId("schedule-summary", schedule.id);
  summary.className = "collapse-title grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 pe-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const summaryCopy = document.createElement("div");
  summaryCopy.className = "min-w-0";
  appendText(summaryCopy, "p", `${schedule.startHHMM} - ${schedule.endHHMM}`, "font-semibold tabular-nums");
  appendText(summaryCopy, "p", state.siteLists.find((list) => list.id === schedule.listId)?.name ?? "목록 없음", "break-all text-xs");
  appendText(summary, "span", schedule.enabled ? "사용 중" : "꺼짐", schedule.enabled ? "badge badge-soft badge-primary" : "badge badge-ghost");
  summary.prepend(summaryCopy);

  const form = document.createElement("form");
  form.className = "collapse-content grid gap-3 border-t border-base-200 pt-4";
  form.noValidate = true;

  const enabledLabel = document.createElement("label");
  enabledLabel.className = "label min-h-10 cursor-pointer justify-start gap-2";
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "checkbox checkbox-sm";
  enabled.checked = schedule.enabled;
  enabled.disabled = locked;
  enabledLabel.append(enabled, " 사용");

  const start = input("time", "시작", schedule.startHHMM, locked);
  const end = input("time", "종료", schedule.endHHMM, locked);
  start.control.required = true;
  end.control.required = true;
  const listSelect = select("목록", state.siteLists.map((list) => [list.id, list.name]), schedule.listId, locked);
  listSelect.control.required = true;
  const intensity = select("차단 방식", [
    ["soft", "가벼운 안내"],
    ["medium", "확인 후 허용"],
    ["hard", "완전 차단"]
  ], schedule.intensity, locked);

  const days = document.createElement("fieldset");
  days.className = "fieldset grid grid-cols-4 gap-2 sm:grid-cols-7";
  days.disabled = locked;
  const legend = document.createElement("legend");
  legend.className = "fieldset-legend col-span-full";
  legend.textContent = "요일";
  days.append(legend);
  DAYS.forEach((day, index) => {
    const label = document.createElement("label");
    label.className = "label min-h-10 w-full min-w-0 cursor-pointer justify-center gap-1 text-xs";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox checkbox-sm";
    checkbox.value = String(index);
    checkbox.checked = schedule.days.includes(index);
    label.append(checkbox, day);
    days.append(label);
  });

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";
  const save = submitButton("저장", locked, "soft");
  save.id = uniqueDomId("schedule-save", schedule.id);
  actions.append(save);
  const deleteDialog = document.createElement("dialog");
  deleteDialog.className = "modal";
  const dialogTitleId = uniqueDomId("schedule-delete-title", schedule.id);
  const dialogDescriptionId = uniqueDomId("schedule-delete-description", schedule.id);
  deleteDialog.setAttribute("aria-labelledby", dialogTitleId);
  deleteDialog.setAttribute("aria-describedby", dialogDescriptionId);
  deleteDialog.innerHTML = `
    <div class="modal-box">
      <h3 id="${dialogTitleId}" class="text-lg font-bold">이 자동 시작을 삭제할까요?</h3>
      <p id="${dialogDescriptionId}" class="mt-2 text-sm">${schedule.startHHMM} - ${schedule.endHHMM} 일정만 삭제됩니다.</p>
      <div class="modal-action">
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost min-h-10" data-cancel>취소</button>
          <button type="button" class="btn btn-error min-h-10" data-confirm>삭제</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="자동 시작 삭제 대화상자 닫기">닫기</button></form>
  `;
  configureModalDialog(deleteDialog);
  deleteDialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", () => deleteDialog.close());
  const confirmDelete = deleteDialog.querySelector<HTMLButtonElement>("[data-confirm]");
  confirmDelete?.addEventListener("click", () => {
    if (locked) {
      return;
    }
    const dialogBox = deleteDialog.querySelector<HTMLElement>(".modal-box") ?? deleteDialog;
    void runGuardedMutation(confirmDelete, "삭제 중...", async () => {
      await requireOk(sendMessage({ type: "DELETE_SCHEDULE", payload: { scheduleId: schedule.id } }));
      deleteDialog.close();
      await handlers.reload("자동 시작을 삭제했습니다.", "success", "schedule-add");
    }, dialogBox, "자동 시작을 삭제하지 못했습니다.");
  });
  const removeButton = button("삭제", "ghost", () => showModalDialog(deleteDialog, removeButton));
  removeButton.disabled = locked;
  removeButton.classList.add("min-h-10");
  actions.append(removeButton);

  form.append(enabledLabel, listSelect.label, intensity.label, start.label, end.label, days, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    const checkedDays = Array.from(days.querySelectorAll<HTMLInputElement>("input:checked")).map((checkbox) => Number(checkbox.value));
    const nextSchedule: Schedule = {
      ...schedule,
      enabled: enabled.checked,
      days: checkedDays,
      startHHMM: start.control.value,
      endHHMM: end.control.value,
      listId: listSelect.control.value,
      intensity: intensity.control.value as Intensity
    };
    const validation = validateScheduleConfiguration(nextSchedule);
    start.control.removeAttribute("aria-invalid");
    end.control.removeAttribute("aria-invalid");
    listSelect.control.removeAttribute("aria-invalid");
    days.removeAttribute("aria-invalid");
    if (!validation.valid) {
      showInlineError(form, validation.message);
      const target = validation.field === "days"
        ? days.querySelector<HTMLInputElement>("input")
        : validation.field === "list"
          ? listSelect.control
          : !start.control.value ? start.control : end.control;
      if (validation.field === "days") {
        days.setAttribute("aria-invalid", "true");
      } else {
        target?.setAttribute("aria-invalid", "true");
      }
      target?.focus({ preventScroll: true });
      return;
    }

    void runGuardedMutation(save, "저장 중...", async () => {
      await requireOk(sendMessage({ type: "UPDATE_SCHEDULE", payload: { schedule: nextSchedule } }));
      await handlers.reload("자동 시작을 저장했습니다.", "success", summary.id);
    }, form, "자동 시작을 저장하지 못했습니다.");
  });

  details.append(summary, form, deleteDialog);
  return details;
}

function renderRecommendations(
  state: OptionsState,
  locked: boolean,
  ui: OptionsUiState,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("방문 기록 추천");
  section.setAttribute("aria-busy", String(ui.analyzing));
  appendText(
    section,
    "p",
    "최근 30일의 실제 방문 시각을 기기 안에서 최대 5,000개 URL까지 도메인 단위로 집계합니다.",
    "text-sm"
  );
  const headerActions = document.createElement("div");
  headerActions.className = "flex justify-end";
  const analyzeButton = button("방문 기록 분석", "soft", () => {
    if (locked || ui.analyzing) {
      return;
    }
    void handlers.analyzeHistory();
  });
  analyzeButton.id = "history-analyze";
  analyzeButton.disabled = locked || ui.analyzing;
  analyzeButton.textContent = ui.analyzing ? "분석 중..." : "방문 기록 분석";
  analyzeButton.classList.add("min-h-10", "shadow-sm");
  headerActions.append(analyzeButton);
  section.append(headerActions);

  const wrap = document.createElement("div");
  wrap.className = "overflow-x-auto rounded-box border border-base-300 bg-base-100";
  const table = document.createElement("table");
  table.className = "table table-sm";
  table.innerHTML = `
    <thead>
      <tr>
        <th>도메인</th>
        <th>추천 이유</th>
        <th class="text-right">30일 내 방문</th>
        <th class="text-right">작업</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  if (state.recommendations.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "text-sm";
    cell.textContent = "아직 추천 후보가 없습니다.";
    row.append(cell);
    tbody.append(row);
  }

  for (const recommendation of state.recommendations) {
    const row = document.createElement("tr");
    row.className = "h-12";
    appendText(row, "td", recommendation.domain, "break-all font-medium");
    const category = document.createElement("td");
    appendText(category, "span", recommendation.category, "badge badge-soft shadow-sm");
    appendText(category, "p", `집중 시간대 방문 ${Math.round(recommendation.focusVisitRatio * 100)}%`, "mt-1 text-xs");
    row.append(category);
    appendText(row, "td", String(recommendation.visits), "text-right tabular-nums");
    const action = document.createElement("td");
    action.className = "text-right";
    const add = button("차단", "soft", () => {
      if (locked) {
        return;
      }
      void runGuardedMutation(add, "추가 중...", async () => {
        await requireOk(sendMessage({
          type: "ADD_RECOMMENDATION_DOMAIN",
          payload: { domain: recommendation.domain }
        }));
        await handlers.reload(`${recommendation.domain}을 차단 목록에 추가했습니다.`, "success", "options-tab-insights");
      }, section, `${recommendation.domain}을 차단 목록에 추가하지 못했습니다.`);
    });
    add.id = uniqueDomId("recommendation-add", recommendation.domain);
    add.disabled = locked || blockedDomainsFromLists(state.siteLists).some((domain) => recommendation.domain === domain || recommendation.domain.endsWith(`.${domain}`));
    add.classList.add("min-h-10", "shadow-sm");
    action.append(add);
    row.append(action);
    tbody.append(row);
  }
  table.append(tbody);
  wrap.append(table);
  section.append(wrap);
  return section;
}

export function requestHistoryAccess(): Promise<boolean> {
  return chrome.permissions.request({ permissions: ["history"] });
}

async function requireOk<T extends { ok: boolean; error?: string }>(request: Promise<T>): Promise<T> {
  const response = await request;
  if (!response.ok) {
    throw new Error(response.error ?? "설정을 저장하지 못했습니다.");
  }
  return response;
}

export async function requestHistoryAnalysis(): Promise<void> {
  const response = await sendMessage({ type: "ANALYZE_HISTORY" });
  if (!response.ok) {
    throw new Error(response.error);
  }
}

function renderPrivacyControls(handlers: OptionsHandlers): HTMLElement {
  const section = card("개인정보와 로컬 데이터");
  const actions = document.createElement("div");
  actions.className = "flex flex-wrap justify-end gap-2";

  const revoke = button("방문 기록 권한 해제", "soft", () => {
    void handlers.revokeHistoryAccess();
  });
  revoke.id = "history-revoke";
  revoke.classList.add("min-h-10", "shadow-sm");

  const clear = button("로컬 기록 지우기", "soft", () => {
    showModalDialog(dialog, clear);
  });
  clear.id = "local-data-clear";
  clear.classList.add("btn-error", "btn-outline", "min-h-10");

  const titleId = uniqueDomId("local-data-clear-title", "all");
  const descriptionId = uniqueDomId("local-data-clear-description", "all");
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descriptionId);
  dialog.innerHTML = `
    <div class="modal-box">
      <h3 id="${titleId}" class="text-lg font-bold">이 기기의 활동 기록을 지울까요?</h3>
      <p id="${descriptionId}" class="mt-2 text-sm">세션, 의도 입력, 추천, 통계와 성장 로그를 지웁니다. 동기화된 차단 규칙, 일정과 고래 성장은 유지됩니다.</p>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost min-h-10" data-cancel>취소</button>
        <button type="button" class="btn btn-error min-h-10" data-confirm>기록 지우기</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="닫기">close</button></form>
  `;
  configureModalDialog(dialog);
  dialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", () => dialog.close());
  dialog.querySelector<HTMLButtonElement>("[data-confirm]")?.addEventListener("click", () => {
    const confirm = dialog.querySelector<HTMLButtonElement>("[data-confirm]");
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = "지우는 중...";
    }
    void handlers.clearLocalData().finally(() => {
      if (dialog.open) {
        dialog.close();
      }
    });
  });

  actions.append(revoke, clear);
  section.append(actions, dialog);
  return section;
}

function renderDashboard(state: OptionsState): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-y-4";
  const aggregate = aggregateDashboard(state.dailyStats, state.sessionLog);
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h2", "집중 기록", "text-xl font-bold");
  appendText(heading, "p", "브라우저 밖으로 보내지 않은 로컬 기록입니다.", "text-sm");
  section.append(heading);
  const metrics = document.createElement("div");
  metrics.className = "stats stats-horizontal w-full overflow-hidden bg-base-100 shadow-sm";
  metric(metrics, "집중 분", String(aggregate.totalFocusMinutes));
  metric(metrics, "차단 시도", String(aggregate.blockedAttempts));
  metric(metrics, "임시 허용", String(aggregate.overrides));
  metric(metrics, "중단 기록", String(aggregate.sessions.interrupted));
  section.append(metrics);

  const weekly = aggregate.weekly.slice(-8);
  const chart = document.createElement("div");
  chart.className = "rounded-box border border-base-300 bg-base-100 p-4 shadow-sm";
  appendText(chart, "h3", "주간 집중", "font-semibold");
  if (weekly.length === 0) {
    appendText(chart, "p", "세션을 완료하면 주간 흐름이 여기에 나타납니다.", "mt-3 text-sm");
  } else {
    const max = Math.max(1, ...weekly.map((entry) => entry.focusMinutes));
    const bars = document.createElement("div");
    bars.className = "mt-4 grid h-40 items-end gap-2";
    bars.style.gridTemplateColumns = `repeat(${weekly.length}, minmax(0, 1fr))`;
    for (const entry of weekly) {
      const column = document.createElement("div");
      column.className = "grid h-full grid-rows-[1fr_auto_auto] items-end gap-1 text-center";
      const track = document.createElement("div");
      track.className = "flex h-full items-end overflow-hidden rounded-field bg-base-200";
      const fill = document.createElement("div");
      fill.className = "w-full rounded-field bg-primary motion-safe:transition-[height] motion-safe:duration-700 motion-reduce:transition-none";
      fill.style.height = weeklyBarHeight(entry.focusMinutes, max);
      fill.setAttribute("role", "img");
      fill.setAttribute("aria-label", `${entry.weekStart} 주간 ${entry.focusMinutes}분 집중`);
      track.append(fill);
      appendText(column, "span", `${entry.focusMinutes}분`, "text-xs font-semibold tabular-nums");
      appendText(column, "span", entry.weekStart.slice(5), "text-xs tabular-nums");
      column.prepend(track);
      bars.append(column);
    }
    chart.append(bars);
  }
  section.append(chart);

  const categoryEntries = Object.entries(aggregate.categories)
    .filter(([, summary]) => summary.visits > 0)
    .sort((left, right) => right[1].visits - left[1].visits)
    .slice(0, 5);
  const categories = document.createElement("div");
  categories.className = "grid gap-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm";
  appendText(categories, "h3", "차단 시도 카테고리", "font-semibold");
  const maxCategoryVisits = Math.max(1, ...categoryEntries.map(([, summary]) => summary.visits));
  for (const [category, summary] of categoryEntries) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3";
    const copy = document.createElement("div");
    appendText(copy, "p", category, "text-sm font-medium");
    const bar = document.createElement("progress");
    bar.className = "progress progress-primary mt-1 h-2 w-full";
    bar.max = maxCategoryVisits;
    bar.value = summary.visits;
    copy.append(bar);
    appendText(row, "span", String(summary.visits), "text-sm font-semibold tabular-nums");
    row.prepend(copy);
    categories.append(row);
  }
  if (categoryEntries.length === 0) {
    appendText(categories, "p", "기록이 쌓이면 카테고리별 흐름이 표시됩니다.", "text-sm");
  }
  section.append(categories);
  return section;
}

export function weeklyBarHeight(focusMinutes: number, maxFocusMinutes: number): string {
  if (focusMinutes <= 0) {
    return "0%";
  }

  const safeMax = Math.max(1, maxFocusMinutes);
  return `${Math.max(6, Math.round((focusMinutes / safeMax) * 100))}%`;
}

function card(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-y-4";
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h2", title, "text-xl font-bold");
  const descriptions: Record<string, string> = {
    "고래 성장": "이름, 성장 단계, 징표와 최근 기록을 확인합니다.",
    "차단 동작": "가벼운 안내에서 기다릴 시간을 정합니다.",
    "추천 분석 기준": "방문 기록 추천이 집중 시간대로 볼 구간을 정합니다.",
    "차단 목록": "목록을 펼쳐 차단 또는 집중 허용 도메인을 수정합니다.",
    "자동 시작": "정한 요일과 시간에 세션을 자동으로 시작합니다.",
    "방문 기록 추천": "최근 방문 기록을 기기 안에서만 분석합니다.",
    "개인정보와 로컬 데이터": "기기에 남은 기록과 선택 권한을 관리합니다."
  };
  if (descriptions[title]) {
    appendText(heading, "p", descriptions[title], "text-sm");
  }
  const divider = document.createElement("div");
  divider.className = "divider my-0";
  section.append(heading, divider);
  return section;
}

function configureModalDialog(dialog: HTMLDialogElement): void {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR))
      .filter((element) => element.getClientRects().length > 0);
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = modalFocusWrapIndex(currentIndex, focusable.length, event.shiftKey);
    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    focusable[nextIndex]?.focus();
  });
  dialog.addEventListener("close", () => {
    const returnTarget = modalReturnTargets.get(dialog);
    modalReturnTargets.delete(dialog);
    if (returnTarget?.isConnected) {
      returnTarget.focus({ preventScroll: true });
    }
  });
}

function showModalDialog(dialog: HTMLDialogElement, invoker: HTMLElement): void {
  modalReturnTargets.set(dialog, invoker);
  dialog.showModal();
  window.queueMicrotask(() => {
    const first = Array.from(dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR))
      .find((element) => element.getClientRects().length > 0);
    first?.focus({ preventScroll: true });
  });
}

export function modalFocusWrapIndex(
  currentIndex: number,
  focusableCount: number,
  shiftKey: boolean
): number | null {
  if (focusableCount <= 0) {
    return null;
  }
  if (currentIndex < 0) {
    return shiftKey ? focusableCount - 1 : 0;
  }
  if (shiftKey && currentIndex === 0) {
    return focusableCount - 1;
  }
  if (!shiftKey && currentIndex === focusableCount - 1) {
    return 0;
  }
  return null;
}

function input(type: string, text: string, value: string, disabled: boolean): { label: HTMLLabelElement; control: HTMLInputElement } {
  const label = document.createElement("label");
  label.className = "fieldset";
  label.textContent = text;
  const control = document.createElement("input");
  control.type = type;
  control.className = type === "time" || type === "number" ? "input w-full tabular-nums" : "input w-full";
  control.value = value;
  control.disabled = disabled;
  label.append(control);
  return { label, control };
}

function select(text: string, options: Array<[string, string]>, value: string, disabled: boolean): { label: HTMLLabelElement; control: HTMLSelectElement } {
  const label = document.createElement("label");
  label.className = "fieldset";
  label.textContent = text;
  const control = document.createElement("select");
  control.className = "select w-full";
  control.disabled = disabled;
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    control.append(option);
  }
  label.append(control);
  return { label, control };
}

function button(text: string, variant: "primary" | "soft" | "ghost", onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = variant === "primary" ? "btn btn-primary" : variant === "soft" ? "btn btn-soft" : "btn btn-ghost";
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}

function submitButton(text: string, disabled: boolean, variant: "primary" | "soft"): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "submit";
  element.className = variant === "primary" ? "btn btn-primary" : "btn btn-soft min-h-10 shadow-sm";
  element.textContent = text;
  element.disabled = disabled;
  return element;
}

async function runGuardedMutation(
  trigger: HTMLButtonElement,
  busyText: string,
  task: () => Promise<void>,
  errorContainer: HTMLElement,
  failureMessage: string
): Promise<void> {
  if (trigger.dataset.busy === "true") {
    return;
  }

  const originalText = trigger.textContent ?? "";
  clearInlineError(errorContainer);
  trigger.dataset.busy = "true";
  trigger.disabled = true;
  trigger.setAttribute("aria-busy", "true");
  trigger.textContent = busyText;

  try {
    await task();
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : `${failureMessage} 다시 시도해 주세요.`;
    showInlineError(errorContainer, message);
  } finally {
    if (trigger.isConnected) {
      delete trigger.dataset.busy;
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
      trigger.textContent = originalText;
    }
  }
}

function showInlineError(container: HTMLElement, message: string): HTMLElement {
  clearInlineError(container);
  const notice = document.createElement("div");
  notice.dataset.optionsInlineError = "true";
  notice.className = "alert alert-error alert-soft text-sm shadow-none";
  notice.setAttribute("role", "alert");
  notice.tabIndex = -1;
  appendText(notice, "span", message);
  container.append(notice);
  notice.focus({ preventScroll: true });
  return notice;
}

function clearInlineError(container: HTMLElement): void {
  container.querySelector<HTMLElement>("[data-options-inline-error]")?.remove();
}

function appendBanner(container: HTMLElement, text: string, tone: NoticeTone): void {
  const notice = document.createElement("div");
  notice.className = tone === "error"
    ? "rounded-box border border-error/30 bg-base-100 px-4 py-3 text-sm shadow-sm"
    : tone === "success"
      ? "rounded-box border border-primary/25 bg-base-100 px-4 py-3 text-sm shadow-sm"
      : "rounded-box border border-base-300 bg-base-100 px-4 py-3 text-sm shadow-sm";
  notice.setAttribute("role", tone === "error" ? "alert" : "status");
  appendText(notice, "span", text);
  container.append(notice);
}

function badgeProgressText(id: string, state: OptionsState): string {
  const completed = state.sessionLog.filter((session) => session.status === "completed");
  const totalMinutes = completed.reduce((sum, session) => (
    sum + Math.max(0, Math.round((session.endsAt - session.startedAt) / 60_000))
  ), 0);

  if (id === "first-session") {
    return "첫 집중 세션을 완료하면 열려요.";
  }
  if (id === "focus-10-hours") {
    return `${Math.min(600, totalMinutes)}/600분의 물결이 모였어요.`;
  }
  if (id === "focus-50-hours") {
    return `${Math.min(3_000, totalMinutes)}/3,000분의 항해가 쌓였어요.`;
  }
  if (id === "five-day-week") {
    return "한 주에 닷새 집중하면 열려요.";
  }
  if (id === "streak-7") {
    return `${Math.min(7, state.petState.streakDays)}/7일의 물살이 이어졌어요.`;
  }
  if (id === "streak-30") {
    return `${Math.min(30, state.petState.streakDays)}/30일의 해류가 이어졌어요.`;
  }
  if (id === "steady-4w") {
    return "네 주 동안 나만의 리듬이 쌓이면 열려요.";
  }

  return "뜻밖의 항해에서 조용히 열려요.";
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

function uniqueDomId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function metric(container: HTMLElement, label: string, value: string): HTMLElement {
  const item = document.createElement("div");
  item.className = "stat min-w-0 px-2 py-3";
  appendText(item, "div", label, "stat-title whitespace-normal text-xs");
  const metricValue = appendText(item, "div", value, "stat-value truncate text-2xl tabular-nums");
  container.append(item);
  return metricValue;
}

function appendText(parent: HTMLElement, tagName: keyof HTMLElementTagNameMap, text: string, className?: string): HTMLElement {
  const child = document.createElement(tagName);
  child.textContent = text;
  if (className) {
    child.className = className;
  }
  parent.append(child);
  return child;
}

function hasStorageChange(changes: Record<string, chrome.storage.StorageChange>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(changes, key);
}

function formatRemainingMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatIntensity(intensity: Intensity | undefined): string {
  if (intensity === "soft") {
    return "가벼운 안내";
  }

  if (intensity === "medium") {
    return "확인 후 허용";
  }

  return intensity === "hard" ? "완전 차단" : "-";
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
