import { aggregateDashboard } from "../../analytics/aggregate";
import { RECOMMENDATIONS_KEY, type Recommendation } from "../../analytics/recommend";
import { badgeDescription, badgeName } from "../../pet/badges";
import { normalizePetState } from "../../pet/defaultState";
import {
  describeGrowthEvent,
  DEFAULT_PET_NAME,
  growthIntensityLabel,
  growthProgress,
  petDisplayName,
  readGrowthLog,
  type GrowthEvent
} from "../../pet/growth";
import { mountPet } from "../../pet/renderer";
import { BADGE_DEFINITIONS } from "../../shared/gamification";
import { getUiLocale, translate, type SupportedLocale } from "../../shared/i18n";
import { sendMessage } from "../../shared/messaging";
import { LatestRequestGuard } from "../../shared/latestRequest";
import { siteListDisplayName } from "../../shared/siteLists";
import { getTyped, STORAGE_KEYS } from "../../shared/storage";
import type { Intensity, PetState, Schedule, Session, SiteList } from "../../shared/types";
import { openOnboardingPage } from "../onboarding/lifecycle";
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

const DAY_KEYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"];
const OPTIONS_VIEWS: Array<[OptionsView, string]> = [
  ["insights", "optionsTabInsights"],
  ["lists", "optionsTabLists"],
  ["automation", "optionsTabAutomation"],
  ["growth", "optionsTabGrowth"]
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

if (typeof document !== "undefined") {
  document.documentElement.lang = getUiLocale();
  document.title = translate("optionsDocumentTitle");
}

if (root && document.body.dataset.page === "focuswhale-options") {
  void bootstrapOptions(root).catch((error: unknown) => {
    root.textContent = localizeOptionsRuntimeError(
      error instanceof Error ? error.message : undefined,
      translate("optionsLoadFailed")
    );
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
          await reload(translate("historyPermissionRequired"), "neutral", "history-analyze");
          return;
        }

        ui.analyzing = true;
        rerender("history-analyze");
        try {
          await requestHistoryAnalysis();
          await reload(translate("historyAnalysisComplete"), "success", "history-analyze");
        } catch (error) {
          await reload(localizeOptionsRuntimeError(
            error instanceof Error ? error.message : undefined,
            translate("historyAnalysisFailed")
          ), "error", "history-analyze");
        } finally {
          ui.analyzing = false;
          rerender("history-analyze");
        }
      },
      clearLocalData: async () => {
        try {
          const response = await sendMessage({ type: "CLEAR_LOCAL_DATA" }) as { ok: boolean; error?: string };
          if (!response.ok) {
            throw new Error(response.error ?? translate("localDataClearFailed"));
          }
          await reload(translate("localDataCleared"), "success", "local-data-clear");
        } catch (error) {
          await reload(localizeOptionsRuntimeError(
            error instanceof Error ? error.message : undefined,
            translate("localDataClearFailed")
          ), "error", "local-data-clear");
        }
      },
      revokeHistoryAccess: async () => {
        try {
          const removed = await chrome.permissions.remove({ permissions: ["history"] });
          await reload(
            removed ? translate("historyPermissionRevoked") : translate("historyPermissionAlreadyRevoked"),
            "neutral",
            "history-revoke"
          );
        } catch {
          await reload(translate("historyPermissionRevokeFailed"), "error", "history-revoke");
        }
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
  appendText(header, "h1", translate("optionsTitle"), "text-3xl font-extrabold");
  appendText(header, "p", translate("optionsDescription"), "text-sm");
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
  tabs.setAttribute("aria-label", translate("optionsTablistLabel"));

  for (const [view, label] of OPTIONS_VIEWS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = optionsTabId(view);
    tab.className = `tab min-h-10 flex-1 whitespace-nowrap ${view === activeView ? "tab-active" : ""}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(view === activeView));
    tab.setAttribute("aria-controls", optionsPanelId(view));
    tab.tabIndex = view === activeView ? 0 : -1;
    tab.textContent = translate(label);
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
  const section = card("growthSectionTitle", "growthSectionDescription");
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
  appendText(heroCopy, "p", petDisplayName(state.petState.name), "break-all text-sm font-semibold text-primary");
  appendText(heroCopy, "h3", stageSailingText(progress.currentStageName), "text-2xl font-extrabold");
  appendText(heroCopy, "p", progress.nextStageName
    ? translate("growthXpToNext", [progress.nextStageName, formatOptionsNumber(progress.remainingXp)])
    : translate("growthDeepestSeaReached"), "text-sm");
  heroBody.append(petSlot, heroCopy);
  hero.append(heroBody);

  const nameForm = document.createElement("form");
  nameForm.className = "grid gap-3 md:grid-cols-[1fr_auto] md:items-end";
  const name = input("text", translate("petNameLabel"), petDisplayName(state.petState.name), false);
  name.control.maxLength = 24;
  const save = submitButton(translate("petNameSave"), false, "soft");
  save.id = "pet-name-save";
  nameForm.append(name.label, save);
  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const enteredName = name.control.value.trim();
    const currentIsDefault = !state.petState.name || state.petState.name === DEFAULT_PET_NAME;
    const nextName = currentIsDefault && enteredName === petDisplayName(DEFAULT_PET_NAME)
      ? DEFAULT_PET_NAME
      : enteredName || DEFAULT_PET_NAME;
    void runGuardedMutation(save, translate("commonSaving"), async () => {
      const response = await sendMessage({ type: "SET_PET_NAME", payload: { name: nextName } });
      if (!response.ok) {
        throw new Error(response.error);
      }
      await handlers.reload(translate("petNameSaved"), "success", save.id);
    }, nameForm, translate("petNameSaveFailed"));
  });

  const stats = document.createElement("div");
  stats.className = "stats stats-horizontal w-full overflow-hidden bg-base-100 shadow-sm";
  metric(stats, translate("growthCurrentStage"), progress.currentStageName);
  metric(stats, translate("growthTotalFocus"), translate("commonMinutes", formatOptionsNumber(state.petState.totalFocusMinutes)));
  metric(stats, translate("growthNextStage"), progress.nextStageName ?? translate("growthComplete"));
  metric(stats, translate("growthRemainingXp"), formatOptionsNumber(progress.remainingXp));

  const protectionNote = document.createElement("div");
  protectionNote.className = "alert alert-soft border border-base-300 text-sm shadow-none";
  protectionNote.setAttribute("role", "note");
  appendText(
    protectionNote,
    "span",
    translate("growthShieldDescription", formatOptionsNumber(state.petState.streakFreezes))
  );

  const barWrap = document.createElement("div");
  barWrap.className = "grid gap-2";
  const bar = document.createElement("progress");
  bar.className = "progress progress-primary w-full";
  bar.max = 100;
  bar.value = progress.percentToNext;
  barWrap.append(bar);
  appendText(barWrap, "p", progress.nextStageName
    ? translate("growthPercentToNext", [progress.nextStageName, formatOptionsNumber(progress.percentToNext)])
    : translate("growthAtDeepestSea"), "text-sm");

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
    appendText(copy, "p", earned ? badgeName(id) : definition.kind === "surprise" ? translate("badgeHidden") : badgeName(id), "font-semibold");
    appendText(copy, "p", earned ? badgeDescription(id) : badgeProgressText(id, state), "text-sm");
    const status = appendText(item, "span", earned ? translate("badgeEarned") : translate("badgeInProgress"), earned ? "badge badge-soft badge-primary" : "badge badge-ghost");
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
        <th>${escapeHtml(translate("commonDate"))}</th>
        <th>${escapeHtml(translate("growthRecord"))}</th>
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
    cell.textContent = translate("growthLogEmpty");
    row.append(cell);
    tbody.append(row);
  }
  for (const event of state.growthLog) {
    const row = document.createElement("tr");
    appendText(row, "td", formatOptionsDate(event.ts), "text-xs");
    appendText(row, "td", describeGrowthEvent(event.type, event));
    appendText(row, "td", event.xpDelta ? `+${formatOptionsNumber(event.xpDelta)}` : "-", "text-right tabular-nums");
    tbody.append(row);
  }
  table.append(tbody);
  log.append(table);

  const logDetails = document.createElement("details");
  logDetails.className = "collapse collapse-arrow border border-base-300 bg-base-100";
  appendText(logDetails, "summary", translate("growthLogShow"), "collapse-title min-h-10 font-semibold");
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
  appendText(body, "h1", translate("optionsLockedTitle"), "text-2xl font-extrabold");
  appendText(body, "p", translate("optionsLockedDescription"), "text-sm");

  const stats = document.createElement("div");
  stats.className = "stats stats-vertical overflow-hidden bg-base-200 shadow-sm";
  const remaining = metric(stats, translate("commonTimeRemaining"), lockedOptionsCountdownText(session));
  remaining.id = "options-session-remaining";
  metric(stats, translate("currentIntensity"), formatIntensity(session?.intensity));
  body.append(stats);

  const actions = document.createElement("div");
  actions.className = "card-actions justify-end";
  actions.append(button(translate("commonGoBack"), "primary", () => {
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
  const section = card("behaviorSectionTitle", "behaviorSectionDescription");
  const form = document.createElement("form");
  form.className = "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end";
  const softSeconds = input("number", translate("softDelaySecondsLabel"), String(state.settings.softOverlaySeconds), locked);
  softSeconds.control.min = "3";
  softSeconds.control.max = "60";

  const action = document.createElement("div");
  const save = submitButton(translate("commonSave"), locked, "soft");
  save.id = "behavior-save";
  action.append(save);
  form.append(softSeconds.label, action);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    void runGuardedMutation(save, translate("commonSaving"), async () => {
      await requireOk(sendMessage({
        type: "PATCH_SETTINGS",
        payload: { patch: { softOverlaySeconds: Number(softSeconds.control.value) } }
      }));
      await handlers.reload(translate("behaviorSaved"), "success", save.id);
    }, form, translate("behaviorSaveFailed"));
  });

  section.append(form);
  return section;
}

function renderAnalysisSettings(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("analysisSectionTitle", "analysisSectionDescription");
  const form = document.createElement("form");
  form.className = "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end";
  const start = input("time", translate("focusHoursStart"), state.settings.focusHours.startHHMM, locked);
  const end = input("time", translate("focusHoursEnd"), state.settings.focusHours.endHHMM, locked);
  start.control.required = true;
  end.control.required = true;
  const action = document.createElement("div");
  const save = submitButton(translate("commonSave"), locked, "soft");
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
        ? translate("focusHoursBothRequired")
        : translate("focusHoursMustDiffer"));
      (!start.control.value ? start.control : end.control).focus({ preventScroll: true });
      return;
    }

    void runGuardedMutation(save, translate("commonSaving"), async () => {
      await requireOk(sendMessage({
        type: "PATCH_SETTINGS",
        payload: { patch: { focusHours: { startHHMM: start.control.value, endHHMM: end.control.value } } }
      }));
      await handlers.reload(translate("analysisSettingsSaved"), "success", save.id);
    }, form, translate("analysisSettingsSaveFailed"));
  });
  section.append(form);
  return section;
}

function renderSiteLists(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("listsSectionTitle", "listsSectionDescription");
  const listWrap = document.createElement("div");
  listWrap.className = "overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm";

  for (const siteList of state.siteLists) {
    listWrap.append(renderSiteListEditor(siteList, state, locked, handlers));
  }

  const addButton = button(translate("listAdd"), "soft", () => {
    if (locked) {
      return;
    }

    void runGuardedMutation(addButton, translate("commonAdding"), async () => {
      const next: SiteList = {
        id: makeId("list"),
        name: translate("newListName"),
        mode: "blocklist",
        domains: []
      };
      await requireOk(sendMessage({ type: "CREATE_SITE_LIST", payload: { siteList: next } }));
      await handlers.reload(translate("listAdded"), "success", addButton.id);
    }, section, translate("listAddFailed"));
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
  appendText(summaryCopy, "p", siteListDisplayName(siteList), "break-all font-semibold");
  appendText(summaryCopy, "p", translate("domainCount", formatOptionsNumber(siteList.domains.length)), "text-xs");
  appendText(summary, "span", translate(siteList.mode === "blocklist" ? "modeBlocklistShort" : "modeAllowlistShort"), "badge badge-soft shadow-sm");
  summary.prepend(summaryCopy);

  const form = document.createElement("form");
  form.className = "collapse-content grid gap-3 border-t border-base-200 pt-4";

  const name = input("text", translate("commonName"), siteListDisplayName(siteList), locked);
  const modeLabel = document.createElement("label");
  modeLabel.className = "fieldset";
  modeLabel.textContent = translate("commonMode");
  const mode = document.createElement("select");
  mode.className = "select w-full";
  mode.disabled = locked;
  for (const value of ["blocklist", "allowlist"] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = translate(value === "blocklist" ? "modeBlocklistDescription" : "modeAllowlistDescription");
    option.selected = value === siteList.mode;
    mode.append(option);
  }
  modeLabel.append(mode);

  const domainsLabel = document.createElement("label");
  domainsLabel.className = "fieldset";
  domainsLabel.textContent = translate("commonDomains");
  const domains = document.createElement("textarea");
  domains.className = "textarea w-full";
  domains.disabled = locked;
  domains.rows = 4;
  domains.value = siteList.domains.join("\n");
  domainsLabel.append(domains);

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";
  const save = submitButton(translate("commonSave"), locked, "soft");
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
      <h3 id="${dialogTitleId}" class="text-lg font-bold">${escapeHtml(translate("listDeleteTitle"))}</h3>
      <p id="${dialogDescriptionId}" class="mt-2 break-all text-sm">${escapeHtml(translate("listDeleteDescription", siteListDisplayName(siteList)))}</p>
      <div class="modal-action">
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost min-h-10" data-cancel>${escapeHtml(translate("commonCancel"))}</button>
          <button type="button" class="btn btn-error min-h-10" data-confirm>${escapeHtml(translate("commonDelete"))}</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="${escapeHtml(translate("listDeleteCloseLabel"))}">${escapeHtml(translate("commonClose"))}</button></form>
  `;
  configureModalDialog(deleteDialog);
  deleteDialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", () => deleteDialog.close());
  const confirmDelete = deleteDialog.querySelector<HTMLButtonElement>("[data-confirm]");
  confirmDelete?.addEventListener("click", () => {
    if (locked) {
      return;
    }
    const dialogBox = deleteDialog.querySelector<HTMLElement>(".modal-box") ?? deleteDialog;
    void runGuardedMutation(confirmDelete, translate("commonDeleting"), async () => {
      await requireOk(sendMessage({ type: "DELETE_SITE_LIST", payload: { siteListId: siteList.id } }));
      deleteDialog.close();
      await handlers.reload(translate("listDeleted"), "success", "site-list-add");
    }, dialogBox, translate("listDeleteFailed"));
  });
  const dependentSchedules = schedulesReferencingSiteList(state.schedules, siteList.id);
  const deleteBlockMessage = dependentSchedules.length > 0
    ? translate("listDeleteBlockedBySchedules", formatOptionsNumber(dependentSchedules.length))
    : state.siteLists.length <= 1
      ? translate("listDeleteRequiresOne")
      : null;
  const removeButton = button(translate("commonDelete"), "ghost", () => {
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

    void runGuardedMutation(save, translate("commonSaving"), async () => {
      await requireOk(sendMessage({
        type: "UPDATE_SITE_LIST",
        payload: {
          siteList: {
            ...siteList,
            name: persistedSiteListName(siteList, name.control.value),
            mode: mode.value as SiteList["mode"],
            domains: normalizeDomainList(domains.value)
          }
        }
      }));
      await handlers.reload(translate("listSaved"), "success", summary.id);
    }, form, translate("listSaveFailed"));
  });

  details.append(summary, form, deleteDialog);
  return details;
}

function renderSchedules(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("automationSectionTitle", "automationSectionDescription");
  const listWrap = document.createElement("div");
  listWrap.className = "overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm";
  for (const schedule of state.schedules) {
    listWrap.append(renderScheduleEditor(schedule, state, locked, handlers));
  }

  const addButton = button(translate("scheduleAdd"), "soft", () => {
    if (locked) {
      return;
    }

    void runGuardedMutation(addButton, translate("commonAdding"), async () => {
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
      await handlers.reload(translate("scheduleAdded"), "success", addButton.id);
    }, section, translate("scheduleAddFailed"));
  });
  addButton.id = "schedule-add";
  addButton.disabled = locked || state.siteLists.length === 0;
  addButton.classList.add("btn-outline", "min-h-10", "shadow-sm");
  if (state.siteLists.length === 0) {
    const notice = document.createElement("div");
    notice.className = "alert alert-soft border border-base-300 text-sm shadow-none";
    notice.setAttribute("role", "note");
    appendText(notice, "span", translate("scheduleListRequiredFirst"));
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
  const selectedList = state.siteLists.find((list) => list.id === schedule.listId);
  appendText(summaryCopy, "p", selectedList ? siteListDisplayName(selectedList) : translate("listNone"), "break-all text-xs");
  appendText(summary, "span", translate(schedule.enabled ? "commonEnabled" : "commonOff"), schedule.enabled ? "badge badge-soft badge-primary" : "badge badge-ghost");
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
  enabledLabel.append(enabled, ` ${translate("commonUse")}`);

  const start = input("time", translate("commonStart"), schedule.startHHMM, locked);
  const end = input("time", translate("commonEnd"), schedule.endHHMM, locked);
  start.control.required = true;
  end.control.required = true;
  const listSelect = select(translate("commonList"), state.siteLists.map((list) => [list.id, siteListDisplayName(list)]), schedule.listId, locked);
  listSelect.control.required = true;
  const intensity = select(translate("intensityLabel"), [
    ["soft", growthIntensityLabel("soft")],
    ["medium", growthIntensityLabel("medium")],
    ["hard", growthIntensityLabel("hard")]
  ], schedule.intensity, locked);

  const days = document.createElement("fieldset");
  days.className = "fieldset grid grid-cols-4 gap-2 sm:grid-cols-7";
  days.disabled = locked;
  const legend = document.createElement("legend");
  legend.className = "fieldset-legend col-span-full";
  legend.textContent = translate("commonDays");
  days.append(legend);
  DAY_KEYS.forEach((dayKey, index) => {
    const label = document.createElement("label");
    label.className = "label min-h-10 w-full min-w-0 cursor-pointer justify-center gap-1 text-xs";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox checkbox-sm";
    checkbox.value = String(index);
    checkbox.checked = schedule.days.includes(index);
    label.append(checkbox, translate(dayKey));
    days.append(label);
  });

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";
  const save = submitButton(translate("commonSave"), locked, "soft");
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
      <h3 id="${dialogTitleId}" class="text-lg font-bold">${escapeHtml(translate("scheduleDeleteTitle"))}</h3>
      <p id="${dialogDescriptionId}" class="mt-2 text-sm">${escapeHtml(translate("scheduleDeleteDescription", `${schedule.startHHMM} - ${schedule.endHHMM}`))}</p>
      <div class="modal-action">
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost min-h-10" data-cancel>${escapeHtml(translate("commonCancel"))}</button>
          <button type="button" class="btn btn-error min-h-10" data-confirm>${escapeHtml(translate("commonDelete"))}</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="${escapeHtml(translate("scheduleDeleteCloseLabel"))}">${escapeHtml(translate("commonClose"))}</button></form>
  `;
  configureModalDialog(deleteDialog);
  deleteDialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", () => deleteDialog.close());
  const confirmDelete = deleteDialog.querySelector<HTMLButtonElement>("[data-confirm]");
  confirmDelete?.addEventListener("click", () => {
    if (locked) {
      return;
    }
    const dialogBox = deleteDialog.querySelector<HTMLElement>(".modal-box") ?? deleteDialog;
    void runGuardedMutation(confirmDelete, translate("commonDeleting"), async () => {
      await requireOk(sendMessage({ type: "DELETE_SCHEDULE", payload: { scheduleId: schedule.id } }));
      deleteDialog.close();
      await handlers.reload(translate("scheduleDeleted"), "success", "schedule-add");
    }, dialogBox, translate("scheduleDeleteFailed"));
  });
  const removeButton = button(translate("commonDelete"), "ghost", () => showModalDialog(deleteDialog, removeButton));
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

    void runGuardedMutation(save, translate("commonSaving"), async () => {
      await requireOk(sendMessage({ type: "UPDATE_SCHEDULE", payload: { schedule: nextSchedule } }));
      await handlers.reload(translate("scheduleSaved"), "success", summary.id);
    }, form, translate("scheduleSaveFailed"));
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
  const section = card("recommendationsSectionTitle", "recommendationsSectionDescription");
  section.setAttribute("aria-busy", String(ui.analyzing));
  appendText(
    section,
    "p",
    translate("recommendationsMethod"),
    "text-sm"
  );
  const headerActions = document.createElement("div");
  headerActions.className = "flex justify-end";
  const analyzeButton = button(translate("historyAnalyze"), "soft", () => {
    if (locked || ui.analyzing) {
      return;
    }
    void handlers.analyzeHistory();
  });
  analyzeButton.id = "history-analyze";
  analyzeButton.disabled = locked || ui.analyzing;
  analyzeButton.textContent = translate(ui.analyzing ? "historyAnalyzing" : "historyAnalyze");
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
        <th>${escapeHtml(translate("commonDomain"))}</th>
        <th>${escapeHtml(translate("recommendationReason"))}</th>
        <th class="text-right">${escapeHtml(translate("visitsIn30Days"))}</th>
        <th class="text-right">${escapeHtml(translate("commonAction"))}</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  if (state.recommendations.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "text-sm";
    cell.textContent = translate("recommendationsEmpty");
    row.append(cell);
    tbody.append(row);
  }

  for (const recommendation of state.recommendations) {
    const row = document.createElement("tr");
    row.className = "h-12";
    appendText(row, "td", recommendation.domain, "break-all font-medium");
    const category = document.createElement("td");
    appendText(category, "span", categoryLabel(recommendation.category), "badge badge-soft shadow-sm");
    appendText(category, "p", translate("focusHourVisitRatio", formatOptionsNumber(Math.round(recommendation.focusVisitRatio * 100))), "mt-1 text-xs");
    row.append(category);
    appendText(row, "td", formatOptionsNumber(recommendation.visits), "text-right tabular-nums");
    const action = document.createElement("td");
    action.className = "text-right";
    const add = button(translate("commonBlock"), "soft", () => {
      if (locked) {
        return;
      }
      void runGuardedMutation(add, translate("commonAdding"), async () => {
        await requireOk(sendMessage({
          type: "ADD_RECOMMENDATION_DOMAIN",
          payload: { domain: recommendation.domain }
        }));
        await handlers.reload(translate("recommendationAdded", recommendation.domain), "success", "options-tab-insights");
      }, section, translate("recommendationAddFailed", recommendation.domain));
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
    throw new Error(response.error ?? translate("settingsSaveFailed"));
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
  const section = card("privacySectionTitle", "privacySectionDescription");
  const actions = document.createElement("div");
  actions.className = "flex flex-wrap justify-end gap-2";

  const revoke = button(translate("historyPermissionRevoke"), "soft", () => {
    void handlers.revokeHistoryAccess();
  });
  revoke.id = "history-revoke";
  revoke.classList.add("min-h-10", "shadow-sm");

  const replay = button(translate("onboardingReplay"), "soft", () => {
    void requestOnboardingReplay().catch(() => {
      showInlineError(section, translate("onboardingReplayFailed"));
    });
  });
  replay.id = "onboarding-replay";
  replay.classList.add("min-h-10", "shadow-sm");

  const clear = button(translate("localDataClear"), "soft", () => {
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
      <h3 id="${titleId}" class="text-lg font-bold">${escapeHtml(translate("localDataClearTitle"))}</h3>
      <p id="${descriptionId}" class="mt-2 text-sm">${escapeHtml(translate("localDataClearDescription"))}</p>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost min-h-10" data-cancel>${escapeHtml(translate("commonCancel"))}</button>
        <button type="button" class="btn btn-error min-h-10" data-confirm>${escapeHtml(translate("localDataClearConfirm"))}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="${escapeHtml(translate("commonClose"))}">${escapeHtml(translate("commonClose"))}</button></form>
  `;
  configureModalDialog(dialog);
  dialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", () => dialog.close());
  dialog.querySelector<HTMLButtonElement>("[data-confirm]")?.addEventListener("click", () => {
    const confirm = dialog.querySelector<HTMLButtonElement>("[data-confirm]");
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = translate("localDataClearing");
    }
    void handlers.clearLocalData().finally(() => {
      if (dialog.open) {
        dialog.close();
      }
    });
  });

  actions.append(replay, revoke, clear);
  section.append(actions, dialog);
  return section;
}

export function requestOnboardingReplay(): Promise<void> {
  return openOnboardingPage(true);
}

function renderDashboard(state: OptionsState): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-y-4";
  const aggregate = aggregateDashboard(state.dailyStats, state.sessionLog);
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h2", translate("dashboardTitle"), "text-xl font-bold");
  appendText(heading, "p", translate("dashboardDescription"), "text-sm");
  section.append(heading);
  const metrics = document.createElement("div");
  metrics.className = "stats stats-horizontal w-full overflow-hidden bg-base-100 shadow-sm";
  metric(metrics, translate("metricFocusMinutes"), formatOptionsNumber(aggregate.totalFocusMinutes));
  metric(metrics, translate("metricBlockedAttempts"), formatOptionsNumber(aggregate.blockedAttempts));
  metric(metrics, translate("metricOverrides"), formatOptionsNumber(aggregate.overrides));
  metric(metrics, translate("metricInterrupted"), formatOptionsNumber(aggregate.sessions.interrupted));
  section.append(metrics);

  const weekly = aggregate.weekly.slice(-8);
  const chart = document.createElement("div");
  chart.className = "rounded-box border border-base-300 bg-base-100 p-4 shadow-sm";
  appendText(chart, "h3", translate("weeklyFocusTitle"), "font-semibold");
  if (weekly.length === 0) {
    appendText(chart, "p", translate("weeklyFocusEmpty"), "mt-3 text-sm");
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
      const weekLabel = formatOptionsWeekDate(entry.weekStart);
      fill.setAttribute("aria-label", translate("weeklyFocusAria", [weekLabel, formatOptionsNumber(entry.focusMinutes)]));
      track.append(fill);
      appendText(column, "span", translate("commonMinutes", formatOptionsNumber(entry.focusMinutes)), "text-xs font-semibold tabular-nums");
      appendText(column, "span", weekLabel, "text-xs tabular-nums");
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
  appendText(categories, "h3", translate("blockedCategoriesTitle"), "font-semibold");
  const maxCategoryVisits = Math.max(1, ...categoryEntries.map(([, summary]) => summary.visits));
  for (const [category, summary] of categoryEntries) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3";
    const copy = document.createElement("div");
    appendText(copy, "p", categoryLabel(category), "text-sm font-medium");
    const bar = document.createElement("progress");
    bar.className = "progress progress-primary mt-1 h-2 w-full";
    bar.max = maxCategoryVisits;
    bar.value = summary.visits;
    copy.append(bar);
    appendText(row, "span", formatOptionsNumber(summary.visits), "text-sm font-semibold tabular-nums");
    row.prepend(copy);
    categories.append(row);
  }
  if (categoryEntries.length === 0) {
    appendText(categories, "p", translate("blockedCategoriesEmpty"), "text-sm");
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

function card(titleKey: string, descriptionKey?: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-y-4";
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h2", translate(titleKey), "text-xl font-bold");
  if (descriptionKey) {
    appendText(heading, "p", translate(descriptionKey), "text-sm");
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
    const message = localizeOptionsRuntimeError(
      error instanceof Error ? error.message : undefined,
      translate("commonRetryAfterError", failureMessage)
    );
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
    return translate("badgeProgressFirstSession");
  }
  if (id === "focus-10-hours") {
    return translate("badgeProgress10Hours", formatOptionsNumber(Math.min(600, totalMinutes)));
  }
  if (id === "focus-50-hours") {
    return translate("badgeProgress50Hours", formatOptionsNumber(Math.min(3_000, totalMinutes)));
  }
  if (id === "five-day-week") {
    return translate("badgeProgressFiveDayWeek");
  }
  if (id === "streak-7") {
    return translate("badgeProgressStreak7", formatOptionsNumber(Math.min(7, state.petState.streakDays)));
  }
  if (id === "streak-30") {
    return translate("badgeProgressStreak30", formatOptionsNumber(Math.min(30, state.petState.streakDays)));
  }
  if (id === "steady-4w") {
    return translate("badgeProgressSteady4w");
  }

  return translate("badgeProgressSurprise");
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

export function persistedSiteListName(
  siteList: Pick<SiteList, "id" | "name">,
  enteredName: string,
  localeOverride?: SupportedLocale
): string {
  const trimmed = enteredName.trim();
  if (!trimmed) {
    return translate("genericListName", undefined, localeOverride);
  }

  return trimmed === siteListDisplayName(siteList, localeOverride) ? siteList.name : trimmed;
}

export function localizeOptionsRuntimeError(
  error: string | undefined,
  fallbackMessage: string,
  localeOverride?: SupportedLocale
): string {
  const keyByMessage: Record<string, string> = {
    "가벼운 안내 대기 시간은 3초에서 60초 사이여야 합니다.": "optionsErrorSoftDelayRange",
    "집중 시간대의 시작과 종료를 올바르게 선택해 주세요.": "optionsErrorFocusHoursInvalid",
    "같은 차단 목록이 이미 존재합니다.": "optionsErrorListDuplicate",
    "변경할 차단 목록을 찾지 못했습니다. 화면을 새로고침해 주세요.": "optionsErrorListUpdateMissing",
    "삭제할 차단 목록을 찾지 못했습니다. 화면을 새로고침해 주세요.": "optionsErrorListDeleteMissing",
    "차단 목록은 하나 이상 필요합니다. 새 목록을 추가한 뒤 삭제해 주세요.": "listDeleteRequiresOne",
    "같은 자동 시작이 이미 존재합니다.": "optionsErrorScheduleDuplicate",
    "변경할 자동 시작을 찾지 못했습니다. 화면을 새로고침해 주세요.": "optionsErrorScheduleUpdateMissing",
    "삭제할 자동 시작을 찾지 못했습니다. 화면을 새로고침해 주세요.": "optionsErrorScheduleDeleteMissing",
    "차단 목록에 추가할 도메인을 확인하지 못했습니다.": "optionsErrorRecommendationDomainInvalid",
    "차단 목록 ID가 필요합니다.": "optionsErrorListIdRequired",
    "차단 목록 모드를 확인해 주세요.": "optionsErrorListModeInvalid",
    "자동 시작 ID가 필요합니다.": "optionsErrorScheduleIdRequired",
    "자동 시작에 사용할 차단 목록을 찾지 못했습니다.": "optionsErrorScheduleListMissing",
    "자동 시작의 시작과 종료 시간을 올바르게 선택해 주세요.": "scheduleTimesRequired",
    "자동 시작 요일을 하나 이상 선택해 주세요.": "scheduleDayRequired",
    "자동 시작의 차단 방식을 확인해 주세요.": "optionsErrorScheduleIntensityInvalid",
    "방문 기록 권한을 허용해야 로컬 추천 분석을 시작할 수 있습니다.": "historyPermissionRequired",
    "로컬 기록이 지워져 방문 기록 분석 결과를 저장하지 않았습니다.": "optionsErrorHistoryStale",
    "활성 세션이 끝난 뒤 로컬 기록을 지울 수 있습니다.": "optionsErrorClearDuringSession",
    "집중 세션 중에는 설정을 변경할 수 없습니다.": "optionsErrorConfigLocked",
    "Too many domains for the reserved session DNR rule range.": "optionsErrorTooManyDomains",
    "Too many temporary allow domains for the reserved DNR rule range.": "optionsErrorTooManyDomains"
  };
  const directKey = error ? keyByMessage[error] : undefined;
  if (directKey) {
    return translate(directKey, undefined, localeOverride);
  }

  const dependentMatch = error?.match(/^이 목록을 사용하는 자동 시작이 (\d+)개 있습니다\. 먼저 자동 시작을 변경하거나 삭제해 주세요\.$/u);
  if (dependentMatch) {
    return translate("listDeleteBlockedBySchedules", formatOptionsNumber(Number(dependentMatch[1]), localeOverride), localeOverride);
  }

  return fallbackMessage;
}

function formatRemainingMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return translate("durationHoursMinutes", [String(hours), String(remainingMinutes)]);
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatIntensity(intensity: Intensity | undefined): string {
  return intensity ? growthIntensityLabel(intensity) : "-";
}

export function formatOptionsNumber(value: number, localeOverride?: SupportedLocale): string {
  return new Intl.NumberFormat(localeTag(localeOverride)).format(value);
}

export function formatOptionsDate(timestamp: number, localeOverride?: SupportedLocale): string {
  return new Intl.DateTimeFormat(localeTag(localeOverride), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function formatOptionsWeekDate(dateKey: string, localeOverride?: SupportedLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateKey);
  if (!match) {
    return dateKey;
  }

  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(localeTag(localeOverride), {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(timestamp));
}

function localeTag(localeOverride?: SupportedLocale): "ko-KR" | "en-US" {
  return (localeOverride ?? getUiLocale()) === "ko" ? "ko-KR" : "en-US";
}

const CATEGORY_MESSAGE_KEYS: Record<string, string> = {
  sns: "categorySns",
  video: "categoryVideo",
  community: "categoryCommunity",
  news: "categoryNews",
  shopping: "categoryShopping",
  game: "categoryGame",
  entertainment: "categoryEntertainment",
  study: "categoryStudy",
  dev: "categoryDev",
  tools: "categoryTools",
  uncategorized: "categoryUncategorized"
};

function categoryLabel(category: string): string {
  const key = CATEGORY_MESSAGE_KEYS[category];
  return key ? translate(key) : category;
}

export function stageSailingText(stage: string, localeOverride?: "ko" | "en"): string {
  const locale = localeOverride ?? getUiLocale();
  if (locale !== "ko") {
    return translate("growthSailingWith", stage, localeOverride);
  }

  const lastCodePoint = stage.trim().codePointAt(stage.trim().length - 1);
  const hasFinalConsonant = lastCodePoint !== undefined
    && lastCodePoint >= 0xac00
    && lastCodePoint <= 0xd7a3
    && (lastCodePoint - 0xac00) % 28 !== 0;
  return translate(
    hasFinalConsonant ? "growthSailingWithConsonant" : "growthSailingWithVowel",
    stage,
    "ko"
  );
}
