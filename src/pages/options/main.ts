import { aggregateDashboard } from "../../analytics/aggregate";
import { chromeHistoryClient, runRecommendationPipeline } from "../../analytics/history";
import { RECOMMENDATIONS_KEY, type Recommendation } from "../../analytics/recommend";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import type { Intensity, Schedule, Session, SiteList } from "../../shared/types";
import {
  addRecommendationToBlocklist,
  blockedDomainsFromLists,
  collectDailyStats,
  isHardLocked,
  makeId,
  normalizeDomainList,
  normalizeOptionsSettings,
  type OptionsSettings
} from "./model";

interface OptionsState {
  settings: OptionsSettings;
  siteLists: SiteList[];
  schedules: Schedule[];
  activeSession: Session | null;
  recommendations: Recommendation[];
  sessionLog: Session[];
  dailyStats: ReturnType<typeof collectDailyStats>;
  notice?: string;
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const root = document.querySelector<HTMLElement>("#app");

if (root && document.body.dataset.page === "focuswhale-options") {
  void bootstrapOptions(root).catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : "Options failed to load.";
  });
}

async function bootstrapOptions(container: HTMLElement): Promise<void> {
  let state = await loadState();

  const rerender = () => {
    renderOptions(container, state, {
      reload: async (notice?: string) => {
        state = await loadState(notice);
        rerender();
      }
    });
  };

  rerender();
}

async function loadState(notice?: string): Promise<OptionsState> {
  const localSnapshot = await chrome.storage.local.get(null);
  const settings = normalizeOptionsSettings(await getTyped("sync", STORAGE_KEYS.sync.settings));

  return {
    settings,
    siteLists: (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [],
    schedules: (await getTyped("sync", STORAGE_KEYS.sync.schedules)) ?? [],
    activeSession: (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null,
    recommendations: (localSnapshot[RECOMMENDATIONS_KEY] as Recommendation[] | undefined) ?? [],
    sessionLog: (await getTyped("local", STORAGE_KEYS.local.sessionLog)) ?? [],
    dailyStats: collectDailyStats(localSnapshot),
    notice
  };
}

function renderOptions(
  container: HTMLElement,
  state: OptionsState,
  handlers: { reload: (notice?: string) => Promise<void> }
): void {
  const locked = isHardLocked(state.activeSession);
  container.replaceChildren();
  container.className = "mx-auto grid w-full max-w-[720px] gap-8 bg-base-200 px-5 py-8 text-base-content";

  const header = document.createElement("header");
  header.className = "space-y-2";
  appendText(header, "p", "FocusWhale", "text-sm font-semibold text-base-content/50");
  appendText(header, "h1", "로컬 설정과 기록", "text-3xl font-extrabold");
  appendText(header, "p", "설정은 조용하게, 행동은 한 번에 끝나게 정리합니다.", "text-sm text-base-content/60");
  container.append(header);

  if (locked) {
    appendBanner(container, "hard 세션이 진행 중입니다. 목록과 스케줄은 세션 종료 후 변경할 수 있습니다.");
  }

  if (state.notice) {
    appendBanner(container, state.notice);
  }

  container.append(
    renderDashboard(state),
    renderSettings(state, locked, handlers),
    renderSiteLists(state, locked, handlers),
    renderSchedules(state, locked, handlers),
    renderRecommendations(state, locked, handlers)
  );
}

function renderSettings(
  state: OptionsState,
  locked: boolean,
  handlers: { reload: (notice?: string) => Promise<void> }
): HTMLElement {
  const section = card("설정");
  const form = document.createElement("form");
  form.className = "grid gap-3 md:grid-cols-3 md:items-end";

  const start = input("time", "집중 시작", state.settings.focusHours.startHHMM, locked);
  const end = input("time", "집중 종료", state.settings.focusHours.endHHMM, locked);
  const softSeconds = input("number", "Soft 대기 초", String(state.settings.softOverlaySeconds), locked);
  softSeconds.control.min = "3";
  softSeconds.control.max = "60";

  const action = document.createElement("div");
  action.className = "md:col-span-3";
  action.append(submitButton("저장", locked, "primary"));
  form.append(start.label, end.label, softSeconds.label, action);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    void setTyped("sync", STORAGE_KEYS.sync.settings, {
      ...state.settings,
      focusHours: { startHHMM: start.control.value, endHHMM: end.control.value },
      softOverlaySeconds: Number(softSeconds.control.value)
    }).then(() => handlers.reload("설정을 저장했습니다."));
  });

  section.append(form);
  return section;
}

function renderSiteLists(
  state: OptionsState,
  locked: boolean,
  handlers: { reload: (notice?: string) => Promise<void> }
): HTMLElement {
  const section = card("목록");
  const listWrap = document.createElement("div");
  listWrap.className = "grid gap-3";

  for (const siteList of state.siteLists) {
    listWrap.append(renderSiteListEditor(siteList, state, locked, handlers));
  }

  const addButton = button("목록 추가", "soft", () => {
    if (locked) {
      return;
    }

    const next: SiteList = {
      id: makeId("list"),
      name: "새 목록",
      mode: "blocklist",
      domains: []
    };
    void setTyped("sync", STORAGE_KEYS.sync.siteLists, [...state.siteLists, next]).then(() => handlers.reload("목록을 추가했습니다."));
  });
  addButton.disabled = locked;
  addButton.classList.add("btn-sm", "shadow-sm");
  section.append(listWrap, addButton);
  return section;
}

function renderSiteListEditor(
  siteList: SiteList,
  state: OptionsState,
  locked: boolean,
  handlers: { reload: (notice?: string) => Promise<void> }
): HTMLElement {
  const form = document.createElement("form");
  form.className = "grid gap-3 rounded-box border border-base-300 bg-base-100 p-3";

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
    option.textContent = value;
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
  actions.append(submitButton("저장", locked, "soft"));
  const removeButton = button("삭제", "ghost", () => {
    if (locked) {
      return;
    }
    void setTyped("sync", STORAGE_KEYS.sync.siteLists, state.siteLists.filter((candidate) => candidate.id !== siteList.id))
      .then(() => handlers.reload("목록을 삭제했습니다."));
  });
  removeButton.disabled = locked;
  removeButton.classList.add("btn-sm");
  actions.append(removeButton);

  form.append(name.label, modeLabel, domainsLabel, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    const nextLists = state.siteLists.map((candidate) => candidate.id === siteList.id
      ? { ...candidate, name: name.control.value.trim() || "목록", mode: mode.value as SiteList["mode"], domains: normalizeDomainList(domains.value) }
      : candidate);

    void setTyped("sync", STORAGE_KEYS.sync.siteLists, nextLists).then(() => handlers.reload("목록을 저장했습니다."));
  });

  return form;
}

function renderSchedules(
  state: OptionsState,
  locked: boolean,
  handlers: { reload: (notice?: string) => Promise<void> }
): HTMLElement {
  const section = card("스케줄");
  const listWrap = document.createElement("div");
  listWrap.className = "grid gap-3";
  for (const schedule of state.schedules) {
    listWrap.append(renderScheduleEditor(schedule, state, locked, handlers));
  }

  const addButton = button("스케줄 추가", "soft", () => {
    if (locked) {
      return;
    }

    const next: Schedule = {
      id: makeId("schedule"),
      enabled: true,
      days: [1, 2, 3, 4, 5],
      startHHMM: "09:00",
      endHHMM: "12:00",
      listId: state.siteLists[0]?.id ?? "",
      intensity: "medium"
    };
    void setTyped("sync", STORAGE_KEYS.sync.schedules, [...state.schedules, next]).then(() => handlers.reload("스케줄을 추가했습니다."));
  });
  addButton.disabled = locked || state.siteLists.length === 0;
  addButton.classList.add("btn-sm", "shadow-sm");
  section.append(listWrap, addButton);
  return section;
}

function renderScheduleEditor(
  schedule: Schedule,
  state: OptionsState,
  locked: boolean,
  handlers: { reload: (notice?: string) => Promise<void> }
): HTMLElement {
  const form = document.createElement("form");
  form.className = "grid gap-3 rounded-box border border-base-300 bg-base-100 p-3";

  const enabledLabel = document.createElement("label");
  enabledLabel.className = "label cursor-pointer justify-start gap-2";
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "checkbox checkbox-sm";
  enabled.checked = schedule.enabled;
  enabled.disabled = locked;
  enabledLabel.append(enabled, " 사용");

  const start = input("time", "시작", schedule.startHHMM, locked);
  const end = input("time", "종료", schedule.endHHMM, locked);
  const listSelect = select("목록", state.siteLists.map((list) => [list.id, list.name]), schedule.listId, locked);
  const intensity = select("강도", [["soft", "soft"], ["medium", "medium"], ["hard", "hard"]], schedule.intensity, locked);

  const days = document.createElement("fieldset");
  days.className = "fieldset grid grid-cols-7 gap-2";
  days.disabled = locked;
  const legend = document.createElement("legend");
  legend.className = "fieldset-legend col-span-full";
  legend.textContent = "요일";
  days.append(legend);
  DAYS.forEach((day, index) => {
    const label = document.createElement("label");
    label.className = "label cursor-pointer justify-start gap-1 text-xs";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox checkbox-xs";
    checkbox.value = String(index);
    checkbox.checked = schedule.days.includes(index);
    label.append(checkbox, day);
    days.append(label);
  });

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";
  actions.append(submitButton("저장", locked, "soft"));
  const removeButton = button("삭제", "ghost", () => {
    if (locked) {
      return;
    }
    void setTyped("sync", STORAGE_KEYS.sync.schedules, state.schedules.filter((candidate) => candidate.id !== schedule.id))
      .then(() => handlers.reload("스케줄을 삭제했습니다."));
  });
  removeButton.disabled = locked;
  removeButton.classList.add("btn-sm");
  actions.append(removeButton);

  form.append(enabledLabel, listSelect.label, intensity.label, start.label, end.label, days, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }

    const checkedDays = Array.from(days.querySelectorAll<HTMLInputElement>("input:checked")).map((checkbox) => Number(checkbox.value));
    const nextSchedules = state.schedules.map((candidate) => candidate.id === schedule.id
      ? {
          ...candidate,
          enabled: enabled.checked,
          days: checkedDays,
          startHHMM: start.control.value,
          endHHMM: end.control.value,
          listId: listSelect.control.value,
          intensity: intensity.control.value as Intensity
        }
      : candidate);

    void setTyped("sync", STORAGE_KEYS.sync.schedules, nextSchedules).then(() => handlers.reload("스케줄을 저장했습니다."));
  });

  return form;
}

function renderRecommendations(
  state: OptionsState,
  locked: boolean,
  handlers: { reload: (notice?: string) => Promise<void> }
): HTMLElement {
  const section = card("추천");
  const headerActions = document.createElement("div");
  headerActions.className = "flex justify-end";
  const analyzeButton = button("방문 기록 분석", "soft", () => {
    if (locked) {
      return;
    }

    void runRecommendationPipeline(chromeHistoryClient, chrome.storage.local, {
      blockedDomains: blockedDomainsFromLists(state.siteLists),
      focusHours: state.settings.focusHours,
      limit: 10
    }).then(() => handlers.reload("로컬 방문 기록 분석을 완료했습니다."));
  });
  analyzeButton.disabled = locked;
  analyzeButton.classList.add("btn-sm", "shadow-sm");
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
        <th>카테고리</th>
        <th class="text-right">방문수</th>
        <th class="text-right">작업</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  if (state.recommendations.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "text-base-content/60";
    cell.textContent = "아직 추천 후보가 없습니다.";
    row.append(cell);
    tbody.append(row);
  }

  for (const recommendation of state.recommendations) {
    const row = document.createElement("tr");
    row.className = "h-12";
    appendText(row, "td", recommendation.domain, "font-medium");
    const category = document.createElement("td");
    appendText(category, "span", recommendation.category, "badge badge-soft shadow-sm");
    row.append(category);
    appendText(row, "td", String(recommendation.visits), "text-right tabular-nums");
    const action = document.createElement("td");
    action.className = "text-right";
    const add = button("차단", "soft", () => {
      if (locked) {
        return;
      }
      const nextLists = addRecommendationToBlocklist(state.siteLists, recommendation);
      void setTyped("sync", STORAGE_KEYS.sync.siteLists, nextLists).then(() => handlers.reload(`${recommendation.domain}을 차단 목록에 추가했습니다.`));
    });
    add.disabled = locked || blockedDomainsFromLists(state.siteLists).some((domain) => recommendation.domain === domain || recommendation.domain.endsWith(`.${domain}`));
    add.classList.add("btn-xs", "shadow-sm");
    action.append(add);
    row.append(action);
    tbody.append(row);
  }
  table.append(tbody);
  wrap.append(table);
  section.append(wrap);
  return section;
}

function renderDashboard(state: OptionsState): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-y-4";
  const aggregate = aggregateDashboard(state.dailyStats, state.sessionLog);
  const metrics = document.createElement("div");
  metrics.className = "stats stats-vertical overflow-hidden bg-base-100 shadow-sm md:stats-horizontal";
  metric(metrics, "집중 분", String(aggregate.totalFocusMinutes));
  metric(metrics, "차단 시도", String(aggregate.blockedAttempts));
  metric(metrics, "임시 허용", String(aggregate.overrides));
  metric(metrics, "중단 기록", String(aggregate.sessions.interrupted));
  section.append(metrics);

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 220;
  canvas.className = "w-full rounded-box border border-base-300 bg-base-100";
  section.append(canvas);
  drawWeeklyChart(canvas, aggregate.weekly.map((week) => ({ label: week.weekStart.slice(5), value: week.focusMinutes })));

  const categories = document.createElement("div");
  categories.className = "flex flex-wrap gap-2";
  for (const [category, summary] of Object.entries(aggregate.categories)) {
    if (summary.visits > 0) {
      appendText(categories, "span", `${category}: ${summary.visits}`, "badge badge-soft shadow-sm");
    }
  }
  if (categories.childElementCount === 0) {
    appendText(categories, "p", "기록이 쌓이면 카테고리별 방문 수가 표시됩니다.", "text-sm text-base-content/60");
  }
  section.append(categories);
  return section;
}

function drawWeeklyChart(canvas: HTMLCanvasElement, values: Array<{ label: string; value: number }>): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const styles = getComputedStyle(canvas);
  const base = styles.getPropertyValue("--color-base-100").trim();
  const baseContent = styles.getPropertyValue("--color-base-content").trim();
  const primary = styles.getPropertyValue("--color-primary").trim();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = baseContent;
  context.font = "14px system-ui";
  context.fillText("주간 집중 분", 24, 28);

  const max = Math.max(1, ...values.map((entry) => entry.value));
  const barWidth = values.length > 0 ? Math.max(24, (canvas.width - 80) / values.length - 12) : 24;
  values.slice(-8).forEach((entry, index) => {
    const height = Math.round((entry.value / max) * 140);
    const x = 40 + index * (barWidth + 12);
    const y = 180 - height;
    context.fillStyle = primary;
    context.fillRect(x, y, barWidth, height);
    context.fillStyle = baseContent;
    context.fillText(entry.label, x, 202);
  });
}

function card(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-y-4";
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h2", title, "text-xl font-bold");
  const descriptions: Record<string, string> = {
    "설정": "집중 시간대와 soft 대기 시간을 조정합니다.",
    "목록": "도메인 목록은 필요한 행만 펼쳐서 수정합니다.",
    "스케줄": "자동으로 시작할 집중 시간을 정합니다.",
    "추천": "방문 기록은 로컬에서만 분석합니다."
  };
  if (descriptions[title]) {
    appendText(heading, "p", descriptions[title], "text-sm text-base-content/60");
  }
  const divider = document.createElement("div");
  divider.className = "divider my-0";
  section.append(heading, divider);
  return section;
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
  element.className = variant === "primary" ? "btn btn-primary" : "btn btn-soft btn-sm shadow-sm";
  element.textContent = text;
  element.disabled = disabled;
  return element;
}

function appendBanner(container: HTMLElement, text: string): void {
  const alert = document.createElement("div");
  alert.className = "alert alert-warning";
  appendText(alert, "span", text);
  container.append(alert);
}

function metric(container: HTMLElement, label: string, value: string): void {
  const item = document.createElement("div");
  item.className = "stat";
  appendText(item, "div", label, "stat-title");
  appendText(item, "div", value, "stat-value tabular-nums");
  container.append(item);
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
