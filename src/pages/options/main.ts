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
import { mountPet, PET_RENDER_SIZES } from "../../pet/renderer";
import { BADGE_DEFINITIONS } from "../../shared/gamification";
import {
  getUiLocale,
  initializeUiLocale,
  normalizeUiLocalePreference,
  setUiLocalePreference,
  translate,
  type SupportedLocale,
  type UiLocalePreference
} from "../../shared/i18n";
import { sendMessage } from "../../shared/messaging";
import { LatestRequestGuard } from "../../shared/latestRequest";
import { playMotion, prefersReducedMotion, shouldAnimateSurface } from "../../shared/motion";
import { siteListDisplayName } from "../../shared/siteLists";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import type { Intensity, PetState, Schedule, Session, SiteList } from "../../shared/types";
import { openOnboardingPage } from "../onboarding/lifecycle";
import {
  blockedDomainsFromLists,
  collectAttemptedTargets,
  collectDailyStats,
  completedSessionsInLocalWeek,
  isOptionsLocked,
  latestEarnedBadge,
  localWeekStartKey,
  makeId,
  normalizeDomainList,
  normalizeOptionsSettings,
  recentFocusWeeks,
  schedulesReferencingSiteList,
  validateScheduleConfiguration,
  type OptionsSettings
} from "./model";

interface OptionsState {
  uiLocalePreference: UiLocalePreference;
  settings: OptionsSettings;
  siteLists: SiteList[];
  schedules: Schedule[];
  activeSession: Session | null;
  petState: PetState;
  growthLog: GrowthEvent[];
  recommendations: Recommendation[];
  sessionLog: Session[];
  dailyStats: ReturnType<typeof collectDailyStats>;
  historyAccessGranted: boolean;
  notice?: string;
  noticeTone?: NoticeTone;
}

export type OptionsView = "review" | "rules" | "preferences";
type NoticeTone = "neutral" | "success" | "error";

interface OptionsUiState {
  view: OptionsView;
  analyzing: boolean;
}

interface OptionsHandlers {
  reload: (notice?: string, noticeTone?: NoticeTone, focusId?: string) => Promise<void>;
  setView: (view: OptionsView, restoreTabFocus?: boolean) => void;
  changeUiLocale: (preference: UiLocalePreference) => Promise<void>;
  analyzeHistory: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  revokeHistoryAccess: () => Promise<void>;
}

const DAY_KEYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"];
const OPTIONS_VIEWS: Array<[OptionsView, string]> = [
  ["review", "goal8OptionsTabReview"],
  ["rules", "goal8OptionsTabRules"]
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
  void initializeUiLocale().then(() => {
    updateLocalizedDocumentMetadata();
    return bootstrapOptions(root);
  }).catch((error: unknown) => {
    root.textContent = localizeOptionsRuntimeError(
      error instanceof Error ? error.message : undefined,
      translate("optionsLoadFailed")
    );
  });
}

async function bootstrapOptions(container: HTMLElement): Promise<void> {
  let state = await loadState();
  const stateLoads = new LatestRequestGuard();
  const ui: OptionsUiState = { view: "review", analyzing: false };

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
      changeUiLocale: async (preference) => {
        try {
          await setTyped("sync", STORAGE_KEYS.sync.uiLocale, preference);
          setUiLocalePreference(preference);
          updateLocalizedDocumentMetadata();
          await reload(translate("optionsLanguageSaved"), "success", "ui-language-select");
        } catch {
          await reload(translate("optionsLanguageSaveFailed"), "error", "ui-language-select");
        }
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

        state = { ...state, historyAccessGranted: true };
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
    if (areaName === "sync" && hasStorageChange(changes, STORAGE_KEYS.sync.uiLocale)) {
      setUiLocalePreference(changes[STORAGE_KEYS.sync.uiLocale]?.newValue);
      updateLocalizedDocumentMetadata();
    }
    if (
      (areaName === "local" && Object.keys(changes).length > 0)
      || (areaName === "sync" && [
        STORAGE_KEYS.sync.uiLocale,
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
  const [storedSettings, storedUiLocalePreference, historyAccessGranted] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.settings),
    getTyped("sync", STORAGE_KEYS.sync.uiLocale),
    hasHistoryAccess()
  ]);
  const settings = normalizeOptionsSettings(storedSettings);

  return {
    uiLocalePreference: normalizeUiLocalePreference(storedUiLocalePreference),
    settings,
    siteLists: (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [],
    schedules: (await getTyped("sync", STORAGE_KEYS.sync.schedules)) ?? [],
    activeSession,
    petState: normalizePetState(await getTyped("sync", STORAGE_KEYS.sync.petState)),
    growthLog: await readGrowthLog(30),
    recommendations: (localSnapshot[RECOMMENDATIONS_KEY] as Recommendation[] | undefined) ?? [],
    sessionLog: (await getTyped("local", STORAGE_KEYS.local.sessionLog)) ?? [],
    dailyStats: collectDailyStats(localSnapshot),
    historyAccessGranted,
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
  const motionKey = locked ? `locked:${state.activeSession?.id ?? "active"}` : `view:${ui.view}`;
  const animateSurface = shouldAnimateSurface(container.dataset.motionKey, motionKey, prefersReducedMotion());
  container.dataset.motionKey = motionKey;
  container.replaceChildren();

  if (locked) {
    renderLockedOptions(container, state, handlers, animateSurface);
    return;
  }

  container.className = "fw-depth mx-auto grid min-h-screen w-full max-w-[720px] content-start gap-7 bg-base-300 px-5 py-8 text-base-content";

  container.append(renderOptionsHeader(ui.view, handlers.setView));
  if (ui.view !== "preferences") {
    container.append(renderOptionsTabs(ui.view, handlers.setView));
  }

  if (state.notice) {
    appendBanner(container, state.notice, state.noticeTone ?? "neutral");
  }

  const content = document.createElement("div");
  content.className = "grid gap-7";
  content.id = optionsPanelId(ui.view);
  content.setAttribute("role", "tabpanel");
  content.setAttribute("aria-labelledby", ui.view === "preferences" ? "options-view-title" : optionsTabId(ui.view));
  content.tabIndex = 0;
  content.dataset.view = ui.view;

  if (ui.view === "review") {
    content.append(
      renderReviewHero(state),
      renderDashboard(state, animateSurface),
      renderGrowth(state, handlers)
    );
  } else if (ui.view === "rules") {
    content.append(
      renderSchedules(state, locked, handlers),
      renderSiteLists(state, locked, handlers)
    );
  } else {
    content.append(
      renderSessionPreferences(state, locked, handlers),
      renderRecommendations(state, locked, ui, handlers),
      renderPrivacyControls(handlers)
    );
  }

  container.append(content);
  if (animateSurface) {
    playMotion(content, "surface");
  }
  for (const [view] of OPTIONS_VIEWS) {
    if (view === ui.view) {
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

function renderOptionsHeader(
  view: OptionsView,
  setView: (view: OptionsView, restoreTabFocus?: boolean) => void
): HTMLElement {
  const header = document.createElement("header");
  header.className = "flex items-start justify-between gap-5";
  const copy = document.createElement("div");
  copy.className = "min-w-0 space-y-1";
  appendText(copy, "p", translate("brandName"), "text-sm font-bold");
  const titleKey = view === "review"
    ? "goal8OptionsReviewTitle"
    : view === "rules"
      ? "goal8OptionsRulesTitle"
      : "goal8OptionsPreferencesTitle";
  const descriptionKey = view === "review"
    ? "goal8OptionsReviewDescription"
    : view === "rules"
      ? "goal8OptionsRulesDescription"
      : "goal8OptionsPreferencesDescription";
  const title = appendText(copy, "h1", translate(titleKey), "text-3xl font-black");
  title.id = "options-view-title";
  appendText(copy, "p", translate(descriptionKey), "text-sm text-base-content/60");

  const destination: OptionsView = view === "preferences" ? "review" : "preferences";
  const action = button(
    translate(view === "preferences" ? "goal8OptionsDoneAction" : "goal8OptionsPreferencesAction"),
    "ghost",
    () => setView(destination)
  );
  action.id = view === "preferences" ? "options-preferences-done" : "options-preferences-open";
  action.classList.add("min-h-10", "shrink-0");
  header.append(copy, action);
  return header;
}

function renderOptionsTabs(activeView: OptionsView, setView: (view: OptionsView, restoreTabFocus?: boolean) => void): HTMLElement {
  const tabs = document.createElement("div");
  tabs.className = "tabs tabs-box w-full bg-base-200 p-1";
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
  if (currentIndex < 0) {
    return null;
  }
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

function renderReviewHero(state: OptionsState): HTMLElement {
  const aggregate = aggregateDashboard(state.dailyStats, state.sessionLog);
  const latestWeekMinutes = aggregate.weekly.find((week) => week.weekStart === localWeekStartKey())?.focusMinutes ?? 0;
  const completedThisWeek = completedSessionsInLocalWeek(state.sessionLog);
  const hasActivity = aggregate.totalFocusMinutes > 0
    || aggregate.blockedAttempts > 0
    || aggregate.overrides > 0
    || state.sessionLog.length > 0;
  const hero = document.createElement("section");
  hero.className = hasActivity
    ? "fw-atmosphere fw-depth grid min-h-56 grid-cols-1 items-center overflow-hidden rounded-box border border-primary/10 p-5 text-center sm:grid-cols-[170px_1fr] sm:text-left"
    : "fw-atmosphere fw-depth flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-box border border-primary/10 p-6 text-center";

  const petSlot = document.createElement("div");
  petSlot.className = "grid place-items-center";
  mountPet(petSlot, state.petState, hasActivity ? "happy" : "idle", {
    size: hasActivity ? PET_RENDER_SIZES.hero : PET_RENDER_SIZES.large
  });
  const copy = document.createElement("div");
  copy.className = hasActivity ? "min-w-0 space-y-3" : "mt-5 max-w-md space-y-2";

  if (!hasActivity) {
    appendText(copy, "p", "0", "text-5xl font-black tabular-nums");
    appendText(copy, "h2", translate("goal8ReviewEmptyTitle"), "text-xl font-black");
    appendText(copy, "p", translate("goal8ReviewEmptyDescription"), "text-sm leading-6 text-base-content/65");
    const openSession = button(translate("goal8ReviewOpenSession"), "primary", () => window.close());
    openSession.classList.add("mt-4", "min-h-11", "w-full");
    copy.append(openSession);
    hero.append(petSlot, copy);
    return hero;
  }

  appendText(copy, "p", translate("goal8ReviewThisWeek"), "text-sm font-bold text-primary");
  const focus = document.createElement("div");
  focus.className = "flex flex-wrap items-baseline justify-center gap-2 sm:justify-start";
  appendText(focus, "span", formatOptionsNumber(latestWeekMinutes), "text-5xl font-black tabular-nums");
  appendText(focus, "span", translate("goal8ReviewFocusMinutesUnit"), "font-bold");
  copy.append(focus);
  appendText(
    copy,
    "p",
    translate("goal8ReviewCompletedSessions", [
      formatOptionsNumber(completedThisWeek),
      petDisplayName(state.petState.name)
    ]),
    "text-sm text-base-content/65"
  );
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap justify-center gap-2 sm:justify-start";
  appendText(badges, "span", translate("goal8ReviewStreakBadge", formatOptionsNumber(state.petState.streakDays)), "badge badge-primary badge-soft");
  appendText(badges, "span", translate("goal8ReviewShieldBadge", formatOptionsNumber(state.petState.streakFreezes)), "badge badge-soft");
  appendText(badges, "span", growthProgress(state.petState.xp, state.petState.stage).currentStageName, "badge badge-soft");
  copy.append(badges);
  hero.append(petSlot, copy);
  return hero;
}

function renderGrowth(
  state: OptionsState,
  handlers: OptionsHandlers
): HTMLElement {
  const section = document.createElement("section");
  section.className = "grid gap-3 border-t border-base-100/10 pt-5";
  const progress = growthProgress(state.petState.xp, state.petState.stage);

  const heading = document.createElement("div");
  heading.className = "flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4";
  const headingCopy = document.createElement("div");
  appendText(headingCopy, "h2", translate("growthSectionTitle"), "text-xl font-black");
  appendText(headingCopy, "p", translate("goal8GrowthNeverRegresses"), "text-sm text-base-content/60");
  heading.append(headingCopy);
  const latestBadge = latestEarnedBadge(state.petState);
  if (latestBadge) {
    appendText(heading, "span", translate("goal8GrowthLatestBadge", badgeName(latestBadge)), "badge badge-primary badge-soft whitespace-nowrap");
  }

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
  stats.className = "stats stats-vertical w-full overflow-hidden bg-base-100 shadow-sm sm:stats-horizontal";
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
  barWrap.className = "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center";
  const barCopy = document.createElement("div");
  const barLabel = document.createElement("div");
  barLabel.className = "flex justify-between gap-3 text-xs font-bold";
  appendText(barLabel, "span", progress.nextStageName
    ? translate("growthPercentToNext", [progress.nextStageName, formatOptionsNumber(progress.percentToNext)])
    : translate("growthAtDeepestSea"));
  if (progress.nextStageName) {
    appendText(barLabel, "span", `${formatOptionsNumber(progress.percentToNext)}%`, "tabular-nums");
  }
  const bar = document.createElement("progress");
  bar.className = "progress progress-primary mt-2 h-2 w-full";
  bar.max = 100;
  bar.value = progress.percentToNext;
  barCopy.append(barLabel, bar);

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

  const detailsContent = document.createElement("div");
  detailsContent.id = "growth-details-content";
  detailsContent.className = "grid gap-4 border-t border-base-100/10 pt-5";
  detailsContent.hidden = true;
  detailsContent.append(nameForm, stats, protectionNote, badgeGrid, logDetails);
  const detailsToggle = button(translate("goal8GrowthDetails"), "soft", () => {
    detailsContent.hidden = !detailsContent.hidden;
    detailsToggle.setAttribute("aria-expanded", String(!detailsContent.hidden));
  });
  detailsToggle.classList.add("btn-sm", "min-h-10");
  detailsToggle.setAttribute("aria-controls", detailsContent.id);
  detailsToggle.setAttribute("aria-expanded", "false");
  barWrap.append(barCopy, detailsToggle);

  section.append(heading, barWrap, detailsContent);
  return section;
}

function renderLockedOptions(
  container: HTMLElement,
  state: OptionsState,
  handlers: OptionsHandlers,
  animateSurface: boolean
): void {
  const session = state.activeSession;
  container.className = "fw-depth mx-auto grid min-h-screen w-full max-w-[520px] place-items-center bg-base-300 px-4 py-8 text-base-content";

  const panel = document.createElement("section");
  panel.className = "card w-full border border-primary/15 bg-base-100 shadow-xl";
  const body = document.createElement("div");
  body.className = "card-body items-center gap-5 text-center";
  const petSlot = document.createElement("div");
  petSlot.className = "grid place-items-center";
  mountPet(petSlot, state.petState, "focus");
  const copy = document.createElement("div");
  appendText(copy, "p", translate("goal8OptionsSessionInProgress"), "text-sm font-bold text-primary");
  const remaining = appendText(copy, "h1", lockedOptionsCountdownText(session), "mt-2 text-4xl font-black tabular-nums");
  remaining.id = "options-session-remaining";
  appendText(copy, "p", translate("goal8OptionsLockedRulesDescription"), "mt-2 text-sm text-base-content/65");

  const facts = document.createElement("div");
  facts.className = "w-full rounded-box bg-base-200 p-3 text-left text-sm";
  const selectedList = state.siteLists.find((list) => list.id === session?.listId);
  appendFact(facts, translate("goal8OptionsTargetsLabel"), selectedList ? siteListDisplayName(selectedList) : translate("listNone"));
  appendFact(facts, translate("commonMode"), formatIntensity(session?.intensity));
  const language = languagePreferenceField(state, handlers);
  language.classList.add("w-full", "text-left");
  body.append(petSlot, copy, facts, language);

  const actions = document.createElement("div");
  actions.className = "card-actions w-full";
  const returnButton = button(translate("goal8OptionsReturnToSession"), "primary", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.close();
  });
  returnButton.classList.add("min-h-11", "w-full");
  actions.append(returnButton);
  body.append(actions);
  panel.append(body);
  container.append(panel);
  if (animateSurface) {
    playMotion(panel, "hero");
  }
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

function renderSessionPreferences(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("goal8PreferencesSessionTitle", "goal8PreferencesSessionDescription");
  section.classList.add("border-t", "border-base-100/10", "pt-6");
  const form = document.createElement("form");
  form.className = "grid gap-4";
  const fields = document.createElement("div");
  fields.className = "grid gap-4 sm:grid-cols-2";
  const start = input("time", translate("focusHoursStart"), state.settings.focusHours.startHHMM, locked);
  const end = input("time", translate("focusHoursEnd"), state.settings.focusHours.endHHMM, locked);
  const softSeconds = input("number", translate("softDelaySecondsLabel"), String(state.settings.softOverlaySeconds), locked);
  const language = languagePreferenceField(state, handlers);
  start.control.required = true;
  end.control.required = true;
  softSeconds.control.min = "3";
  softSeconds.control.max = "60";
  softSeconds.control.required = true;
  fields.append(start.label, end.label, softSeconds.label, language);
  const save = submitButton(translate("goal8PreferencesSave"), locked, "primary");
  save.id = "preferences-save";
  const action = document.createElement("div");
  action.append(save);
  form.append(fields, action);
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
        payload: {
          patch: {
            focusHours: { startHHMM: start.control.value, endHHMM: end.control.value },
            softOverlaySeconds: Number(softSeconds.control.value)
          }
        }
      }));
      await handlers.reload(translate("goal8PreferencesSaved"), "success", save.id);
    }, form, translate("settingsSaveFailed"));
  });
  section.append(form);
  return section;
}

function languagePreferenceField(state: OptionsState, handlers: OptionsHandlers): HTMLLabelElement {
  const language = select(translate("optionsLanguageLabel"), [
    ["auto", translate("optionsLanguageAutomatic")],
    ["en", translate("optionsLanguageEnglish")],
    ["ko", translate("optionsLanguageKorean")]
  ], state.uiLocalePreference, false);
  language.control.id = "ui-language-select";
  language.control.setAttribute("aria-describedby", "ui-language-description");
  language.control.addEventListener("change", () => {
    language.control.disabled = true;
    void handlers.changeUiLocale(normalizeUiLocalePreference(language.control.value));
  });
  const description = document.createElement("span");
  description.id = "ui-language-description";
  description.className = "fieldset-label leading-5";
  description.textContent = translate("optionsLanguageDescription");
  language.label.append(description);
  return language.label;
}

function updateLocalizedDocumentMetadata(): void {
  document.documentElement.lang = getUiLocale();
  document.title = translate("optionsDocumentTitle");
}

function renderSiteLists(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = document.createElement("section");
  section.className = "grid gap-4";
  const listWrap = document.createElement("div");
  listWrap.className = "overflow-hidden rounded-box border border-base-100/10 bg-base-100";

  for (const siteList of state.siteLists) {
    listWrap.append(renderSiteListEditor(siteList, state, locked, handlers));
  }

  const draft: SiteList = {
    id: makeId("list"),
    name: translate("newListName"),
    mode: "blocklist",
    domains: []
  };
  const newListDialog = renderSiteListDialog(draft, state, locked, handlers, true);
  const addButton = button(translate("listAdd"), "soft", () => {
    if (locked) {
      return;
    }
    showModalDialog(newListDialog.dialog, addButton);
  });
  addButton.id = "site-list-add";
  addButton.disabled = locked;
  addButton.classList.add("btn-sm", "min-h-10");
  section.append(
    sectionHeadingWithAction("goal8RulesTargetsTitle", "goal8RulesTargetsDescription", addButton, true),
    listWrap,
    newListDialog.dialog
  );
  return section;
}

function renderSiteListEditor(
  siteList: SiteList,
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const row = document.createElement("div");
  row.className = "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-base-200 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-3";
  appendText(row, "strong", siteListDisplayName(siteList), "min-w-0 truncate");
  appendText(row, "span", translate(siteList.mode === "blocklist" ? "modeBlocklistShort" : "modeAllowlistShort"), "badge badge-soft");
  const schedules = schedulesReferencingSiteList(state.schedules, siteList.id);
  appendText(
    row,
    "span",
    `${translate("domainCount", formatOptionsNumber(siteList.domains.length))} · ${formatScheduleCount(schedules.length)}`,
    "text-sm text-base-content/60"
  );
  const editor = renderSiteListDialog(siteList, state, locked, handlers, false);
  const edit = button(translate("goal8CommonEdit"), "ghost", () => showModalDialog(editor.dialog, edit));
  edit.id = uniqueDomId("site-list-summary", siteList.id);
  edit.disabled = locked;
  edit.classList.add("btn-sm", "min-h-10");
  row.append(edit, editor.dialog);
  if (editor.deleteDialog) {
    row.append(editor.deleteDialog);
  }
  return row;
}

function renderSiteListDialog(
  siteList: SiteList,
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers,
  isNew: boolean
): { dialog: HTMLDialogElement; deleteDialog?: HTMLDialogElement } {
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  const titleId = uniqueDomId("site-list-editor-title", siteList.id);
  dialog.setAttribute("aria-labelledby", titleId);
  const box = document.createElement("div");
  box.className = "modal-box max-w-xl border border-base-100/10 bg-base-100";
  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-4";
  const headerCopy = document.createElement("div");
  appendText(headerCopy, "p", translate("goal8RulesTargetsTitle"), "text-xs font-bold uppercase text-primary");
  appendText(headerCopy, "h2", isNew ? translate("listAdd") : siteListDisplayName(siteList), "mt-1 text-2xl font-black").id = titleId;
  const close = button(translate("commonClose"), "ghost", () => dialog.close());
  close.classList.add("btn-sm", "min-h-10", "min-w-10");
  close.setAttribute("aria-label", translate("commonClose"));
  header.append(headerCopy, close);

  const form = document.createElement("form");
  form.className = "mt-6 grid gap-5";

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
  actions.className = "modal-action flex flex-wrap justify-between gap-2";
  const destructiveActions = document.createElement("div");
  const commitActions = document.createElement("div");
  commitActions.className = "flex flex-wrap gap-2";
  const cancel = button(translate("commonCancel"), "ghost", () => dialog.close());
  cancel.classList.add("min-h-10");
  const save = submitButton(translate("commonSave"), locked, "primary");
  save.id = uniqueDomId("site-list-save", siteList.id);
  commitActions.append(cancel, save);
  let deleteDialog: HTMLDialogElement | undefined;
  const dependentSchedules = schedulesReferencingSiteList(state.schedules, siteList.id);
  const deleteBlockMessage = dependentSchedules.length > 0
    ? translate("listDeleteBlockedBySchedules", formatOptionsNumber(dependentSchedules.length))
    : state.siteLists.length <= 1
      ? translate("listDeleteRequiresOne")
      : null;
  if (!isNew) {
    deleteDialog = confirmationDialog(
      uniqueDomId("list-delete", siteList.id),
      translate("listDeleteTitle"),
      translate("listDeleteDescription", siteListDisplayName(siteList)),
      translate("listDeleteCloseLabel")
    );
    const removeButton = button(translate("commonDelete"), "ghost", () => {
      if (deleteBlockMessage) {
        showInlineError(form, deleteBlockMessage);
        return;
      }
      const editorReturnTarget = modalReturnTargets.get(dialog) ?? removeButton;
      dialog.close();
      window.queueMicrotask(() => showModalDialog(deleteDialog as HTMLDialogElement, editorReturnTarget));
    });
    removeButton.disabled = locked;
    removeButton.classList.add("btn-error", "min-h-10");
    destructiveActions.append(removeButton);
    const confirmDelete = deleteDialog.querySelector<HTMLButtonElement>("[data-confirm]");
    confirmDelete?.addEventListener("click", () => {
      void runGuardedMutation(confirmDelete, translate("commonDeleting"), async () => {
        await requireOk(sendMessage({ type: "DELETE_SITE_LIST", payload: { siteListId: siteList.id } }));
        deleteDialog?.close();
        await handlers.reload(translate("listDeleted"), "success", "site-list-add");
      }, deleteDialog as HTMLDialogElement, translate("listDeleteFailed"));
    });
  }

  actions.append(destructiveActions, commitActions);
  form.append(name.label, modeLabel, domainsLabel, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    void runGuardedMutation(save, translate("commonSaving"), async () => {
      const nextSiteList: SiteList = {
        ...siteList,
        name: persistedSiteListName(siteList, name.control.value),
        mode: mode.value as SiteList["mode"],
        domains: normalizeDomainList(domains.value)
      };
      await requireOk(sendMessage(isNew
        ? { type: "CREATE_SITE_LIST", payload: { siteList: nextSiteList } }
        : { type: "UPDATE_SITE_LIST", payload: { siteList: nextSiteList } }));
      dialog.close();
      await handlers.reload(translate(isNew ? "listAdded" : "listSaved"), "success", isNew ? "site-list-add" : uniqueDomId("site-list-summary", siteList.id));
    }, form, translate(isNew ? "listAddFailed" : "listSaveFailed"));
  });

  box.append(header, form);
  dialog.append(box, modalBackdrop(translate("commonClose")));
  configureModalDialog(dialog);
  return { dialog, deleteDialog };
}

function renderSchedules(
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const section = document.createElement("section");
  section.className = "grid gap-4";
  const listWrap = document.createElement("div");
  listWrap.className = "list overflow-hidden rounded-box border border-base-100/10 bg-base-100 shadow-sm";
  for (const schedule of state.schedules) {
    listWrap.append(renderScheduleEditor(schedule, state, locked, handlers));
  }

  const draft: Schedule = {
    id: makeId("schedule"),
    enabled: true,
    days: [1, 2, 3, 4, 5],
    startHHMM: "09:00",
    endHHMM: "12:00",
    listId: state.siteLists[0]?.id ?? "",
    intensity: "medium"
  };
  const newScheduleDialog = renderScheduleDialog(draft, state, locked, handlers, true);
  const addButton = button(translate("scheduleAdd"), "primary", () => {
    if (locked) {
      return;
    }
    showModalDialog(newScheduleDialog.dialog, addButton);
  });
  addButton.id = "schedule-add";
  addButton.disabled = locked || state.siteLists.length === 0;
  addButton.classList.add("min-h-10");
  section.append(sectionHeadingWithAction("goal8RulesScheduledTitle", "goal8RulesScheduledDescription", addButton));
  if (state.siteLists.length === 0) {
    const notice = document.createElement("div");
    notice.className = "alert alert-soft border border-base-300 text-sm shadow-none";
    notice.setAttribute("role", "note");
    appendText(notice, "span", translate("scheduleListRequiredFirst"));
    section.append(notice);
  }
  if (state.schedules.length === 0) {
    appendText(listWrap, "p", translate("goal8RulesSchedulesEmpty"), "px-4 py-5 text-sm text-base-content/60");
  }
  section.append(listWrap, newScheduleDialog.dialog);
  return section;
}

function renderScheduleEditor(
  schedule: Schedule,
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers
): HTMLElement {
  const row = document.createElement("div");
  row.className = `grid min-h-20 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 border-b border-base-200 px-4 py-3 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_auto] ${schedule.enabled ? "" : "opacity-70"}`;
  const enabledLabel = document.createElement("label");
  enabledLabel.className = "grid min-h-10 min-w-10 cursor-pointer place-items-center";
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "toggle toggle-primary";
  enabled.checked = schedule.enabled;
  enabled.disabled = locked;
  enabled.id = uniqueDomId("schedule-toggle", schedule.id);
  enabled.setAttribute("aria-label", translate("goal8RulesScheduleEnabledLabel", formatScheduleTrigger(schedule)));
  enabled.addEventListener("change", () => {
    enabled.disabled = true;
    void requireOk(sendMessage({
      type: "UPDATE_SCHEDULE",
      payload: { schedule: { ...schedule, enabled: enabled.checked } }
    })).then(
      () => handlers.reload(translate("scheduleSaved"), "success", enabled.id),
      (error: unknown) => {
        enabled.checked = schedule.enabled;
        enabled.disabled = locked;
        showInlineError(row, localizeOptionsRuntimeError(
          error instanceof Error ? error.message : undefined,
          translate("scheduleSaveFailed")
        ));
      }
    );
  });
  enabledLabel.append(enabled);
  const summaryCopy = document.createElement("div");
  summaryCopy.className = "min-w-0 flex-1";
  const title = document.createElement("div");
  title.className = "flex flex-wrap items-center gap-2";
  appendText(title, "p", formatScheduleTrigger(schedule), "font-bold tabular-nums");
  appendText(title, "span", translate(schedule.enabled ? "commonEnabled" : "commonOff"), schedule.enabled ? "badge badge-success badge-soft badge-sm whitespace-nowrap" : "badge badge-soft badge-sm whitespace-nowrap");
  summaryCopy.append(title);
  const selectedList = state.siteLists.find((list) => list.id === schedule.listId);
  appendText(
    summaryCopy,
    "p",
    selectedList
      ? `${siteListDisplayName(selectedList)} · ${translate("domainCount", formatOptionsNumber(selectedList.domains.length))}`
      : translate("listNone"),
    "mt-1 break-words text-sm text-base-content/60"
  );
  const rowActions = document.createElement("div");
  rowActions.className = "col-span-2 flex flex-row items-center justify-end gap-2 sm:col-span-1";
  appendText(rowActions, "span", growthIntensityLabel(schedule.intensity), schedule.intensity === "medium" ? "badge badge-primary badge-soft h-auto whitespace-normal text-center" : "badge badge-soft h-auto whitespace-normal text-center");
  const editor = renderScheduleDialog(schedule, state, locked, handlers, false);
  const edit = button(translate("goal8CommonEdit"), "ghost", () => showModalDialog(editor.dialog, edit));
  edit.id = uniqueDomId("schedule-summary", schedule.id);
  edit.disabled = locked;
  edit.classList.add("btn-sm", "min-h-10");
  rowActions.append(edit);
  row.append(enabledLabel, summaryCopy, rowActions, editor.dialog);
  if (editor.deleteDialog) {
    row.append(editor.deleteDialog);
  }
  return row;
}

function renderScheduleDialog(
  schedule: Schedule,
  state: OptionsState,
  locked: boolean,
  handlers: OptionsHandlers,
  isNew: boolean
): { dialog: HTMLDialogElement; deleteDialog?: HTMLDialogElement } {
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  const titleId = uniqueDomId("schedule-editor-title", schedule.id);
  dialog.setAttribute("aria-labelledby", titleId);
  const box = document.createElement("div");
  box.className = "modal-box max-w-xl border border-base-100/10 bg-base-100";
  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-4";
  const headerCopy = document.createElement("div");
  appendText(headerCopy, "p", translate("goal8RulesScheduledTitle"), "text-xs font-bold uppercase text-primary");
  appendText(headerCopy, "h2", isNew ? translate("scheduleAdd") : formatScheduleTrigger(schedule), "mt-1 text-2xl font-black").id = titleId;
  const close = button(translate("commonClose"), "ghost", () => dialog.close());
  close.classList.add("btn-sm", "min-h-10", "min-w-10");
  close.setAttribute("aria-label", translate("commonClose"));
  header.append(headerCopy, close);

  const form = document.createElement("form");
  form.className = "mt-6 grid gap-5";
  form.noValidate = true;

  const start = input("time", translate("commonStart"), schedule.startHHMM, locked);
  const end = input("time", translate("commonEnd"), schedule.endHHMM, locked);
  start.control.required = true;
  end.control.required = true;
  const listSelect = select(translate("commonList"), state.siteLists.map((list) => [list.id, siteListDisplayName(list)]), schedule.listId, locked);
  listSelect.control.required = true;
  const timeFields = document.createElement("div");
  timeFields.className = "grid gap-3 sm:grid-cols-2";
  timeFields.append(start.label, end.label);

  const days = document.createElement("fieldset");
  days.className = "fieldset";
  days.disabled = locked;
  const legend = document.createElement("legend");
  legend.className = "fieldset-legend col-span-full";
  legend.textContent = translate("commonDays");
  const dayGrid = document.createElement("div");
  dayGrid.className = "grid grid-cols-4 gap-2 sm:grid-cols-7";
  days.append(legend, dayGrid);
  DAY_KEYS.forEach((dayKey, index) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "btn h-auto min-h-10 min-w-10 px-1 text-xs";
    checkbox.value = String(index);
    checkbox.checked = schedule.days.includes(index);
    checkbox.setAttribute("aria-label", translate(dayKey));
    dayGrid.append(checkbox);
  });

  const intensity = document.createElement("fieldset");
  intensity.className = "fieldset";
  const intensityLegend = document.createElement("legend");
  intensityLegend.className = "fieldset-legend";
  intensityLegend.textContent = translate("intensityLabel");
  const intensityJoin = document.createElement("div");
  intensityJoin.className = "join grid grid-cols-3";
  for (const value of ["soft", "medium", "hard"] as const) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = uniqueDomId("schedule-intensity", schedule.id);
    radio.value = value;
    radio.checked = schedule.intensity === value;
    radio.disabled = locked;
    radio.className = "btn join-item h-auto min-h-11 whitespace-normal px-2 text-xs leading-4";
    radio.setAttribute("aria-label", growthIntensityLabel(value));
    intensityJoin.append(radio);
  }
  intensity.append(intensityLegend, intensityJoin);

  const actions = document.createElement("div");
  actions.className = "modal-action flex flex-wrap justify-between gap-2";
  const destructiveActions = document.createElement("div");
  const commitActions = document.createElement("div");
  commitActions.className = "flex flex-wrap gap-2";
  const cancel = button(translate("commonCancel"), "ghost", () => dialog.close());
  cancel.classList.add("min-h-10");
  const save = submitButton(translate("commonSave"), locked, "primary");
  save.id = uniqueDomId("schedule-save", schedule.id);
  commitActions.append(cancel, save);
  let deleteDialog: HTMLDialogElement | undefined;
  if (!isNew) {
    deleteDialog = confirmationDialog(
      uniqueDomId("schedule-delete", schedule.id),
      translate("scheduleDeleteTitle"),
      translate("scheduleDeleteDescription", `${schedule.startHHMM} - ${schedule.endHHMM}`),
      translate("scheduleDeleteCloseLabel")
    );
    const removeButton = button(translate("commonDelete"), "ghost", () => {
      const editorReturnTarget = modalReturnTargets.get(dialog) ?? removeButton;
      dialog.close();
      window.queueMicrotask(() => showModalDialog(deleteDialog as HTMLDialogElement, editorReturnTarget));
    });
    removeButton.disabled = locked;
    removeButton.classList.add("btn-error", "min-h-10");
    destructiveActions.append(removeButton);
    const confirmDelete = deleteDialog.querySelector<HTMLButtonElement>("[data-confirm]");
    confirmDelete?.addEventListener("click", () => {
      void runGuardedMutation(confirmDelete, translate("commonDeleting"), async () => {
        await requireOk(sendMessage({ type: "DELETE_SCHEDULE", payload: { scheduleId: schedule.id } }));
        deleteDialog?.close();
        await handlers.reload(translate("scheduleDeleted"), "success", "schedule-add");
      }, deleteDialog as HTMLDialogElement, translate("scheduleDeleteFailed"));
    });
  }
  actions.append(destructiveActions, commitActions);

  form.append(timeFields, days, listSelect.label, intensity, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    const checkedDays = Array.from(days.querySelectorAll<HTMLInputElement>("input:checked")).map((checkbox) => Number(checkbox.value));
    const selectedIntensity = intensity.querySelector<HTMLInputElement>("input:checked")?.value as Intensity | undefined;
    const nextSchedule: Schedule = {
      ...schedule,
      days: checkedDays,
      startHHMM: start.control.value,
      endHHMM: end.control.value,
      listId: listSelect.control.value,
      intensity: selectedIntensity ?? schedule.intensity
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
      await requireOk(sendMessage(isNew
        ? { type: "CREATE_SCHEDULE", payload: { schedule: nextSchedule } }
        : { type: "UPDATE_SCHEDULE", payload: { schedule: nextSchedule } }));
      dialog.close();
      await handlers.reload(translate(isNew ? "scheduleAdded" : "scheduleSaved"), "success", isNew ? "schedule-add" : uniqueDomId("schedule-summary", schedule.id));
    }, form, translate(isNew ? "scheduleAddFailed" : "scheduleSaveFailed"));
  });

  box.append(header, form);
  dialog.append(box, modalBackdrop(translate("commonClose")));
  configureModalDialog(dialog);
  return { dialog, deleteDialog };
}

function renderRecommendations(
  state: OptionsState,
  locked: boolean,
  ui: OptionsUiState,
  handlers: OptionsHandlers
): HTMLElement {
  const section = card("recommendationsSectionTitle", "recommendationsSectionDescription");
  section.classList.add("border-t", "border-base-100/10", "pt-6");
  section.setAttribute("aria-busy", String(ui.analyzing));
  appendText(
    section,
    "p",
    translate("recommendationsMethod"),
    "text-sm"
  );
  const permissionState = historyPermissionRowState(state.historyAccessGranted, locked, ui.analyzing);
  const permissionRow = document.createElement("div");
  permissionRow.className = "flex flex-wrap items-center gap-3 rounded-box border border-base-100/10 bg-base-100 p-4";
  const permissionCopy = document.createElement("div");
  permissionCopy.className = "min-w-0 flex-1";
  appendText(permissionCopy, "strong", translate("historyPermissionTitle"));
  appendText(
    permissionCopy,
    "p",
    translate(permissionState.statusKey),
    "mt-1 text-sm text-base-content/60"
  );
  const analyzeButton = button(translate("historyAnalyze"), "soft", () => {
    if (locked || ui.analyzing) {
      return;
    }
    void handlers.analyzeHistory();
  });
  analyzeButton.id = "history-analyze";
  analyzeButton.disabled = permissionState.analyzeDisabled;
  if (ui.analyzing) {
    setButtonBusyContent(analyzeButton, translate("historyAnalyzing"));
  }
  analyzeButton.classList.add("min-h-10");
  const revokeButton = button(translate("historyPermissionRevoke"), "ghost", () => {
    void handlers.revokeHistoryAccess();
  });
  revokeButton.id = "history-revoke";
  revokeButton.disabled = permissionState.revokeDisabled;
  revokeButton.classList.add("min-h-10");
  permissionRow.append(permissionCopy, analyzeButton, revokeButton);
  section.append(permissionRow);

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
        await handlers.reload(translate("recommendationAdded", recommendation.domain), "success", add.id);
      }, section, translate("recommendationAddFailed", recommendation.domain));
    });
    add.id = uniqueDomId("recommendation-add", recommendation.domain);
    add.disabled = locked || blockedDomainsFromLists(state.siteLists).some((domain) => recommendation.domain === domain || recommendation.domain.endsWith(`.${domain}`));
    add.classList.add("h-auto", "min-h-11", "py-2", "shadow-sm");
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

export async function hasHistoryAccess(): Promise<boolean> {
  if (typeof chrome.permissions?.contains !== "function") {
    return false;
  }

  try {
    return await chrome.permissions.contains({ permissions: ["history"] });
  } catch {
    return false;
  }
}

export function historyPermissionRowState(
  granted: boolean,
  locked: boolean,
  analyzing: boolean
): {
  statusKey: "historyPermissionGranted" | "historyPermissionNotGranted";
  analyzeDisabled: boolean;
  revokeDisabled: boolean;
} {
  return {
    statusKey: granted ? "historyPermissionGranted" : "historyPermissionNotGranted",
    analyzeDisabled: locked || analyzing,
    revokeDisabled: locked || !granted
  };
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
  section.classList.add("border-t", "border-base-100/10", "pt-6");
  const actions = document.createElement("div");
  actions.className = "overflow-hidden rounded-box border border-base-100/10 bg-base-100";

  const replay = button(translate("goal8PreferencesOpen"), "soft", () => {
    void requestOnboardingReplay().catch(() => {
      showInlineError(section, translate("onboardingReplayFailed"));
    });
  });
  replay.id = "onboarding-replay";
  replay.classList.add("btn-sm", "min-h-10");

  const clear = button(translate("localDataClearConfirm"), "soft", () => {
    showModalDialog(dialog, clear);
  });
  clear.id = "local-data-clear";
  clear.classList.add("btn-error", "btn-sm", "min-h-10");

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

  actions.append(
    actionRow("onboardingReplay", "goal8PreferencesReplayDescription", replay, true),
    actionRow("localDataClear", "goal8PreferencesClearDescription", clear, false)
  );
  section.append(actions, dialog);
  return section;
}

export function requestOnboardingReplay(): Promise<void> {
  return openOnboardingPage(true);
}

function renderDashboard(state: OptionsState, animateSurface: boolean): HTMLElement {
  const section = document.createElement("section");
  section.className = "grid gap-4";
  const aggregate = aggregateDashboard(state.dailyStats, state.sessionLog);
  const metrics = document.createElement("div");
  metrics.className = "stats stats-vertical w-full overflow-hidden bg-base-100 shadow-sm sm:stats-horizontal";
  metric(metrics, translate("metricFocusMinutes"), formatOptionsNumber(aggregate.totalFocusMinutes));
  metric(metrics, translate("goal8MetricCompleted"), formatOptionsNumber(aggregate.sessions.completed));
  metric(metrics, translate("metricBlockedAttempts"), formatOptionsNumber(aggregate.blockedAttempts));
  metric(metrics, translate("metricOverrides"), formatOptionsNumber(aggregate.overrides));
  section.append(metrics);

  const reviewGrid = document.createElement("div");
  reviewGrid.className = "grid gap-4 md:grid-cols-[1.25fr_0.75fr]";
  const weekly = recentFocusWeeks(aggregate.weekly, 8);
  const chart = document.createElement("div");
  chart.className = "space-y-4 rounded-box border border-base-100/10 bg-base-100 p-4";
  const chartHeading = document.createElement("div");
  appendText(chartHeading, "h2", translate("goal8ReviewEightWeekTitle"), "font-black");
  appendText(chartHeading, "p", translate("goal8ReviewEightWeekDescription"), "text-xs text-base-content/55");
  chart.append(chartHeading);
  if (aggregate.weekly.length === 0) {
    appendText(chart, "p", translate("weeklyFocusEmpty"), "text-sm text-base-content/60");
  } else {
    const max = Math.max(1, ...weekly.map((entry) => entry.focusMinutes));
    const bars = document.createElement("div");
    bars.className = "grid h-36 items-end gap-2";
    bars.style.gridTemplateColumns = `repeat(${weekly.length}, minmax(0, 1fr))`;
    const barAnimations: Array<{ fill: HTMLElement; targetHeight: string }> = [];
    for (const entry of weekly) {
      const column = document.createElement("div");
      column.className = "grid h-full grid-rows-[1fr_auto] items-end gap-1 text-center";
      const track = document.createElement("div");
      track.className = "flex h-full items-end overflow-hidden rounded-field bg-primary/10";
      const fill = document.createElement("div");
      fill.className = "w-full rounded-field bg-primary motion-safe:transition-[height] motion-safe:duration-700 motion-reduce:transition-none";
      const targetHeight = weeklyBarHeight(entry.focusMinutes, max);
      fill.style.height = animateSurface ? "0" : targetHeight;
      if (animateSurface) {
        barAnimations.push({ fill, targetHeight });
      }
      fill.setAttribute("role", "img");
      const weekLabel = formatOptionsWeekDate(entry.weekStart);
      fill.setAttribute("aria-label", translate("weeklyFocusAria", [weekLabel, formatOptionsNumber(entry.focusMinutes)]));
      track.append(fill);
      appendText(column, "span", weekLabel, "truncate text-xs tabular-nums text-base-content/55");
      column.prepend(track);
      bars.append(column);
    }
    chart.append(bars);
    if (barAnimations.length > 0) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          for (const { fill, targetHeight } of barAnimations) {
            fill.style.height = targetHeight;
          }
        });
      });
    }
  }
  reviewGrid.append(chart);

  const attemptedTargets = collectAttemptedTargets(state.dailyStats, 5);
  const targets = document.createElement("div");
  targets.className = "space-y-4 rounded-box border border-base-100/10 bg-base-100 p-4";
  const targetHeading = document.createElement("div");
  appendText(targetHeading, "h2", translate("goal8ReviewTargetsTitle"), "font-black");
  appendText(targetHeading, "p", translate("goal8ReviewTargetsDescription"), "text-xs text-base-content/55");
  targets.append(targetHeading);
  const targetRows = document.createElement("div");
  targetRows.className = "space-y-3 text-sm";
  const maxTargetAttempts = Math.max(1, ...attemptedTargets.map((target) => target.attempts));
  for (const target of attemptedTargets) {
    const row = document.createElement("div");
    const label = document.createElement("div");
    label.className = "flex justify-between gap-3";
    appendText(label, "span", target.domain, "min-w-0 break-all");
    appendText(label, "strong", formatOptionsNumber(target.attempts), "tabular-nums");
    const bar = document.createElement("progress");
    bar.className = "progress progress-primary h-1.5 w-full";
    bar.max = maxTargetAttempts;
    bar.value = target.attempts;
    row.append(label, bar);
    targetRows.append(row);
  }
  if (attemptedTargets.length === 0) {
    appendText(targetRows, "p", translate("goal8ReviewTargetsEmpty"), "text-sm text-base-content/60");
  }
  targets.append(targetRows, renderCategorySummary(aggregate.categories));
  reviewGrid.append(targets);
  section.append(reviewGrid);
  return section;
}

function renderCategorySummary(categories: ReturnType<typeof aggregateDashboard>["categories"]): HTMLElement {
  const details = document.createElement("details");
  details.className = "collapse collapse-arrow border-t border-base-200 pt-2";
  appendText(details, "summary", translate("blockedCategoriesTitle"), "collapse-title min-h-10 px-0 text-sm font-semibold");
  const content = document.createElement("div");
  content.className = "collapse-content grid gap-3 px-0";
  const entries = Object.entries(categories)
    .filter(([, summary]) => summary.visits > 0)
    .sort((left, right) => right[1].visits - left[1].visits)
    .slice(0, 5);
  const maxVisits = Math.max(1, ...entries.map(([, summary]) => summary.visits));
  for (const [category, summary] of entries) {
    const row = document.createElement("div");
    const label = document.createElement("div");
    label.className = "flex justify-between gap-3 text-xs";
    appendText(label, "span", categoryLabel(category));
    appendText(label, "strong", formatOptionsNumber(summary.visits), "tabular-nums");
    const bar = document.createElement("progress");
    bar.className = "progress progress-primary mt-1 h-1.5 w-full";
    bar.max = maxVisits;
    bar.value = summary.visits;
    row.append(label, bar);
    content.append(row);
  }
  if (entries.length === 0) {
    appendText(content, "p", translate("blockedCategoriesEmpty"), "text-sm text-base-content/60");
  }
  details.append(content);
  return details;
}

export function weeklyBarHeight(focusMinutes: number, maxFocusMinutes: number): string {
  if (focusMinutes <= 0) {
    return "0%";
  }

  const safeMax = Math.max(1, maxFocusMinutes);
  return `${Math.max(6, Math.round((focusMinutes / safeMax) * 100))}%`;
}

function sectionHeadingWithAction(
  titleKey: string,
  descriptionKey: string,
  action: HTMLElement,
  withDivider = false
): HTMLElement {
  const header = document.createElement("div");
  header.className = `flex items-end justify-between gap-4 ${withDivider ? "border-t border-base-100/10 pt-6" : ""}`;
  const copy = document.createElement("div");
  appendText(copy, "h2", translate(titleKey), "text-xl font-black");
  appendText(copy, "p", translate(descriptionKey), "text-sm text-base-content/60");
  header.append(copy, action);
  return header;
}

function actionRow(
  titleKey: string,
  descriptionKey: string,
  action: HTMLElement,
  withDivider: boolean
): HTMLElement {
  const row = document.createElement("div");
  row.className = `flex min-h-16 items-center justify-between gap-4 px-4 py-3 ${withDivider ? "border-b border-base-200" : ""}`;
  const copy = document.createElement("div");
  copy.className = "min-w-0";
  appendText(copy, "strong", translate(titleKey));
  appendText(copy, "p", translate(descriptionKey), "mt-1 text-sm text-base-content/55");
  row.append(copy, action);
  return row;
}

function appendFact(container: HTMLElement, label: string, value: string): void {
  const row = document.createElement("div");
  row.className = "flex justify-between gap-3 border-b border-base-300 py-2 last:border-b-0";
  appendText(row, "span", label, "text-base-content/60");
  appendText(row, "strong", value, "min-w-0 break-all text-right");
  container.append(row);
}

export function formatScheduleTrigger(
  schedule: Pick<Schedule, "days" | "startHHMM" | "endHHMM">,
  localeOverride?: SupportedLocale
): string {
  const normalizedDays = Array.from(new Set(schedule.days)).filter((day) => day >= 0 && day <= 6).sort((left, right) => left - right);
  const dayText = arraysEqual(normalizedDays, [1, 2, 3, 4, 5])
    ? translate("goal8RulesWeekdays", undefined, localeOverride)
    : arraysEqual(normalizedDays, [0, 6])
      ? translate("goal8RulesWeekend", undefined, localeOverride)
      : arraysEqual(normalizedDays, [0, 1, 2, 3, 4, 5, 6])
        ? translate("goal8RulesEveryDay", undefined, localeOverride)
        : normalizedDays.map((day) => translate(DAY_KEYS[day] ?? "daySun", undefined, localeOverride)).join(", ");
  return `${dayText} · ${schedule.startHHMM}–${schedule.endHHMM}`;
}

function formatScheduleCount(count: number): string {
  return translate(
    count === 1 ? "goal8RulesScheduleCountOne" : "goal8RulesScheduleCount",
    formatOptionsNumber(count)
  );
}

function arraysEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function confirmationDialog(id: string, title: string, description: string, closeLabel: string): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descriptionId);
  const box = document.createElement("div");
  box.className = "modal-box bg-base-100";
  appendText(box, "h3", title, "text-lg font-bold").id = titleId;
  appendText(box, "p", description, "mt-2 break-all text-sm").id = descriptionId;
  const actions = document.createElement("div");
  actions.className = "modal-action flex gap-2";
  const cancel = button(translate("commonCancel"), "ghost", () => dialog.close());
  cancel.classList.add("min-h-10");
  cancel.dataset.cancel = "true";
  const confirm = button(translate("commonDelete"), "ghost", () => undefined);
  confirm.classList.add("btn-error", "min-h-10");
  confirm.dataset.confirm = "true";
  actions.append(cancel, confirm);
  box.append(actions);
  dialog.append(box, modalBackdrop(closeLabel));
  configureModalDialog(dialog);
  return dialog;
}

function modalBackdrop(closeLabel: string): HTMLFormElement {
  const backdrop = document.createElement("form");
  backdrop.method = "dialog";
  backdrop.className = "modal-backdrop";
  const close = document.createElement("button");
  close.setAttribute("aria-label", closeLabel);
  close.textContent = translate("commonClose");
  backdrop.append(close);
  return backdrop;
}

function card(titleKey: string, descriptionKey?: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "grid gap-4";
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h2", translate(titleKey), "text-xl font-black");
  if (descriptionKey) {
    appendText(heading, "p", translate(descriptionKey), "text-sm text-base-content/60");
  }
  section.append(heading);
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

function setButtonBusyContent(button: HTMLButtonElement, text: string): void {
  const spinner = document.createElement("span");
  spinner.className = "loading loading-spinner loading-sm";
  spinner.setAttribute("aria-hidden", "true");
  button.replaceChildren(spinner, document.createTextNode(text));
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
  setButtonBusyContent(trigger, busyText);

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
