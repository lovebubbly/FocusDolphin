import { sendMessage } from "../../shared/messaging";
import { stageName } from "../../shared/gamification";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import { DEFAULT_SITE_LISTS, migrateSiteListsForCurrentDefaults } from "../../shared/siteLists";
import type { Intensity, PetState, Session, SiteList } from "../../shared/types";
import { awardBadges, badgeName } from "../../pet/badges";
import { normalizePetState } from "../../pet/defaultState";
import {
  appendGrowthEvents,
  createGrowthEvent,
  drainPendingCelebrations,
  growthProgress,
  readGrowthLog,
  type GrowthEvent
} from "../../pet/growth";
import { mountPet } from "../../pet/renderer";
import { reconcileStreakFromSessions, type StreakRecoveryState } from "../../pet/streak";
import { settleCompletedSessionXp } from "../../pet/xpEngine";

const STREAK_LEDGER_KEY = "petStreakLedger";
const INTENSITY_ORDER: Record<Intensity, number> = {
  soft: 0,
  medium: 1,
  hard: 2
};

interface PopupModel {
  petState: PetState;
  activeSession: Session | null;
  siteLists: SiteList[];
  awardedXp: number;
  streakStatus: "active" | "resting" | "fresh";
  celebrations: GrowthEvent[];
  growthLog: GrowthEvent[];
  notice?: string;
}

interface SelectionState {
  listId: string;
  durationMinutes: number;
  customMinutes: string;
  intensity: Intensity;
}

interface PopupHandlers {
  updateSelection: (patch: Partial<SelectionState>) => void;
  startSession: () => Promise<void>;
  upgradeIntensity: (intensity: Intensity) => Promise<void>;
}

function minutesRemaining(session: Session, now = Date.now()): number {
  return Math.max(0, Math.ceil((session.endsAt - now) / 60_000));
}

function formatRemaining(session: Session): string {
  const totalMinutes = minutesRemaining(session);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

function progressValue(session: Session, now = Date.now()): number {
  const totalMs = Math.max(1, session.endsAt - session.startedAt);
  const elapsedMs = Math.min(totalMs, Math.max(0, now - session.startedAt));

  return Math.round((elapsedMs / totalMs) * 100);
}

function petStateLine(petState: PetState): string {
  const stageLabels: Record<PetState["stage"], string> = {
    0: "알이 깨어날 준비 중",
    1: "새끼 고래로 자라는 중",
    2: "어린 고래가 항해 중",
    3: "푸른 고래가 깊어지는 중",
    4: "별고래와 항해 중"
  };

  return stageLabels[petState.stage];
}

function streakChipText(model: PopupModel): string {
  if (model.streakStatus === "resting") {
    return "쉬는 중";
  }

  if (model.streakStatus === "fresh") {
    return "새 출발";
  }

  return `${model.petState.streakDays}일째`;
}

function recentBadgeText(petState: PetState): string {
  const recentBadge = [...petState.badges].sort((left, right) =>
    (petState.badgeAwards[right]?.earnedAt ?? 0) - (petState.badgeAwards[left]?.earnedAt ?? 0)
  )[0];

  return recentBadge ? `최근 징표 · ${badgeName(recentBadge)}` : "첫 징표를 기다리는 중";
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

function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function renderPetPanel(root: HTMLElement, model: PopupModel): void {
  const panel = document.createElement("section");
  panel.className = "card fw-pet-hero shrink-0 border border-base-200 shadow-sm";

  const body = document.createElement("div");
  body.className = "card-body grid grid-cols-[112px_1fr] items-center gap-3 p-4";

  const petMount = document.createElement("div");
  petMount.className = "grid place-items-center";
  body.append(petMount);
  mountPet(petMount, model.petState, model.awardedXp > 0 ? "happy" : "idle");

  const stats = document.createElement("div");
  stats.className = "space-y-2";
  appendText(stats, "p", model.petState.name ?? "미로", "text-sm font-semibold text-base-content/60");
  appendText(stats, "h1", petStateLine(model.petState), "text-xl font-extrabold");
  appendText(stats, "p", "집중 세션을 완료하면 자라요.", "text-xs text-base-content/60");
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap gap-1.5";
  appendText(badges, "span", streakChipText(model), "badge badge-soft badge-primary shadow-sm");
  appendText(badges, "span", `보호막 ${model.petState.streakFreezes}/2`, "badge badge-soft shadow-sm");
  stats.append(badges);
  appendText(stats, "p", recentBadgeText(model.petState), "text-sm text-base-content/70");

  if (model.notice) {
    appendText(stats, "p", model.notice, "text-sm text-base-content/70");
  }

  body.append(stats);
  panel.append(body, renderPetDetails(model));
  root.append(panel);
}

function renderCelebrations(root: HTMLElement, model: PopupModel): void {
  if (model.celebrations.length === 0) {
    return;
  }

  const animationTasks: Array<() => void> = [];
  const sessionEvent = model.celebrations.find((event) => event.type === "session_completed");
  const milestoneEvents = model.celebrations.filter((event) => event.type !== "session_completed");
  const panel = document.createElement("section");
  panel.className = "card border border-primary/20 bg-base-100 shadow-sm";
  const body = document.createElement("div");
  body.className = "card-body gap-3 p-4";

  if (sessionEvent) {
    body.append(renderSessionGrowthOverview(model, sessionEvent, animationTasks));
  } else {
    appendText(body, "p", "방금 만든 변화", "text-sm font-semibold text-primary");
  }

  if (milestoneEvents.length > 0) {
    body.append(renderMilestoneOverview(milestoneEvents, animationTasks));
  }

  if (model.celebrations.length > 4) {
    appendText(body, "p", `그리고 ${model.celebrations.length - 4}개의 기록이 성장 로그에 남았어요.`, "text-xs text-base-content/60");
  }
  if (!model.petState.name && model.celebrations.some((event) => event.type === "stage_up")) {
    body.append(renderNamePrompt(model.petState));
  }
  const actions = document.createElement("div");
  actions.className = "card-actions justify-end";
  actions.append(createButton("확인", "btn btn-soft btn-sm shadow-sm", () => panel.remove()));
  body.append(actions);
  panel.append(body);
  root.append(panel);
  runAnimationTasks(animationTasks);
}

function renderSessionGrowthOverview(
  model: PopupModel,
  event: GrowthEvent,
  animationTasks: Array<() => void>
): HTMLElement {
  const xpDelta = event.xpDelta ?? model.awardedXp;
  const xpAfter = event.xpAfter ?? model.petState.xp;
  const xpBefore = event.xpBefore ?? Math.max(0, xpAfter - xpDelta);
  const stageFrom = event.stageFrom ?? model.petState.stage;
  const stageTo = event.stageTo ?? model.petState.stage;
  const progressBefore = event.progressBefore ?? growthProgress(xpBefore, stageFrom).percentToNext;
  const progressAfter = event.progressAfter ?? growthProgress(xpAfter, stageTo).percentToNext;

  const wrap = document.createElement("div");
  wrap.className = "grid gap-3";

  const hero = document.createElement("div");
  hero.className = "grid grid-cols-[72px_1fr] items-center gap-3";
  const petSlot = document.createElement("div");
  petSlot.className = "grid scale-75 place-items-center";
  mountPet(petSlot, model.petState, "happy");
  const copy = document.createElement("div");
  copy.className = "space-y-1";
  appendText(copy, "p", "세션 완료", "text-xs font-bold uppercase tracking-wide text-primary");
  appendText(copy, "h2", "집중이 고래를 키웠어요", "text-xl font-extrabold");
  appendText(copy, "p", event.text, "text-sm text-base-content/70");
  hero.append(petSlot, copy);
  wrap.append(hero);

  const stats = document.createElement("div");
  stats.className = "stats stats-vertical overflow-hidden bg-base-200 shadow-sm";
  const gained = document.createElement("div");
  gained.className = "stat py-3";
  appendText(gained, "div", "이번 세션", "stat-title");
  appendText(gained, "div", `+${xpDelta} XP`, "stat-value text-2xl text-primary tabular-nums");
  appendText(gained, "div", `${event.minutes ?? 0}분 × ${event.intensity ?? "medium"}`, "stat-desc");
  const total = document.createElement("div");
  total.className = "stat py-3";
  appendText(total, "div", "누적 XP", "stat-title");
  const totalValue = appendText(total, "div", String(xpAfter), "stat-value text-2xl tabular-nums");
  appendText(total, "div", `${xpBefore} → ${xpAfter}`, "stat-desc");
  const stage = document.createElement("div");
  stage.className = "stat py-3";
  appendText(stage, "div", "현재 단계", "stat-title");
  appendText(stage, "div", stageName(stageTo), "stat-value text-2xl");
  appendText(stage, "div", stageFrom === stageTo ? "차근차근 자라는 중" : `${stageName(stageFrom)}에서 성장`, "stat-desc");
  stats.append(gained, total, stage);
  wrap.append(stats);

  const progress = document.createElement("div");
  progress.className = "grid gap-2 rounded-box bg-base-200 p-3";
  appendText(progress, "p", stageFrom === stageTo ? "다음 성장까지" : "새 단계로 넘어갔어요", "text-sm font-semibold");
  const track = document.createElement("div");
  track.className = "h-3 overflow-hidden rounded-full bg-base-300";
  const fill = document.createElement("div");
  fill.className = "h-full rounded-full bg-primary";
  fill.style.width = `${clampPercent(progressBefore)}%`;
  fill.style.transition = prefersReducedMotion() ? "none" : "width 900ms ease";
  track.append(fill);
  appendText(progress, "p", `${clampPercent(progressBefore)}% → ${clampPercent(progressAfter)}%`, "text-xs text-base-content/60");
  progress.append(track);
  wrap.append(progress);

  animationTasks.push(() => {
    animateCount(totalValue, xpBefore, xpAfter, 900);
    animateWidth(fill, progressAfter);
  });

  return wrap;
}

function renderMilestoneOverview(events: readonly GrowthEvent[], animationTasks: Array<() => void>): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "grid gap-2";

  events.slice(0, 4).forEach((event, index) => {
    const row = document.createElement("div");
    row.className = "rounded-box border border-base-300 bg-base-100 p-3 text-sm shadow-sm";
    row.style.opacity = "0";
    row.style.transform = "translateY(6px)";
    row.style.transition = prefersReducedMotion() ? "none" : "opacity 360ms ease, transform 360ms ease";
    appendText(row, "p", milestoneTitle(event), "font-semibold");
    appendText(row, "p", event.text, "text-base-content/60");
    wrap.append(row);
    animationTasks.push(() => {
      if (prefersReducedMotion()) {
        row.style.opacity = "1";
        row.style.transform = "translateY(0)";
        return;
      }
      window.setTimeout(() => {
        row.style.opacity = "1";
        row.style.transform = "translateY(0)";
      }, 160 + index * 120);
    });
  });

  return wrap;
}

function renderNamePrompt(petState: PetState): HTMLElement {
  const form = document.createElement("form");
  form.className = "grid gap-2 rounded-box bg-base-200 p-3";
  appendText(form, "p", "이 고래를 뭐라고 부를까요?", "text-sm font-semibold");
  const input = document.createElement("input");
  input.className = "input input-sm w-full";
  input.placeholder = "미로";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary btn-sm";
  submit.textContent = "이름 붙이기";
  form.append(input, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim() || "미로";
    void setTyped("sync", STORAGE_KEYS.sync.petState, { ...petState, name }).then(() => {
      form.replaceChildren();
      appendText(form, "p", `${name}와 함께 항해합니다.`, "text-sm font-semibold");
    });
  });
  return form;
}

function renderPetDetails(model: PopupModel): HTMLElement {
  const details = document.createElement("details");
  details.className = "collapse collapse-arrow border-t border-base-200";
  const summary = document.createElement("summary");
  summary.className = "collapse-title min-h-10 text-sm font-semibold";
  summary.textContent = "성장 자세히 보기";
  const content = document.createElement("div");
  content.className = "collapse-content grid gap-3 text-sm";

  const progress = growthProgress(model.petState.xp, model.petState.stage);
  appendText(content, "p", `누적 집중 ${model.petState.totalFocusMinutes}분 · ${model.petState.xp} XP`, "text-base-content/70");
  if (progress.nextStageName) {
    appendText(content, "p", `${progress.nextStageName}까지 ${progress.remainingXp} XP`, "text-base-content/70");
    const bar = document.createElement("progress");
    bar.className = "progress progress-primary w-full";
    bar.max = 100;
    bar.value = progress.percentToNext;
    content.append(bar);
  } else {
    appendText(content, "p", "지금은 가장 깊은 바다를 항해 중이에요.", "text-base-content/70");
  }
  appendText(content, "p", "고래는 아프거나 돌아가지 않아요.", "text-xs text-base-content/50");

  const recent = model.growthLog.slice(0, 3);
  if (recent.length > 0) {
    const list = document.createElement("ul");
    list.className = "grid gap-1";
    for (const event of recent) {
      appendText(list, "li", event.text, "text-xs text-base-content/60");
    }
    content.append(list);
  }

  details.append(summary, content);
  return details;
}

function milestoneTitle(event: GrowthEvent): string {
  if (event.type === "stage_up") {
    return "성장";
  }
  if (event.type === "half_way") {
    return "절반 지점";
  }
  if (event.type === "badge_earned") {
    return "새 징표";
  }
  if (event.type === "freeze_granted") {
    return "보호막";
  }
  if (event.type === "freeze_used") {
    return "스트릭 보호";
  }
  if (event.type === "streak_restored") {
    return "이어받기";
  }
  if (event.type === "streak_fresh_start") {
    return "새 출발";
  }

  return "성장 로그";
}

function runAnimationTasks(tasks: Array<() => void>): void {
  if (prefersReducedMotion()) {
    tasks.forEach((task) => task());
    return;
  }

  window.requestAnimationFrame(() => {
    tasks.forEach((task) => task());
  });
}

function animateCount(element: HTMLElement, from: number, to: number, durationMs: number): void {
  if (prefersReducedMotion() || from === to) {
    element.textContent = String(to);
    return;
  }

  const startedAt = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(from + (to - from) * eased));
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
}

function animateWidth(element: HTMLElement, targetPercent: number): void {
  if (prefersReducedMotion()) {
    element.style.width = `${clampPercent(targetPercent)}%`;
    return;
  }

  window.requestAnimationFrame(() => {
    element.style.width = `${clampPercent(targetPercent)}%`;
  });
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderActiveHero(root: HTMLElement, model: PopupModel): void {
  const session = model.activeSession;
  if (!session) {
    renderPetPanel(root, model);
    return;
  }

  const panel = document.createElement("section");
  panel.className = "card fw-pet-hero shrink-0 border border-base-200 shadow-sm";

  const body = document.createElement("div");
  body.className = "card-body grid grid-cols-[112px_1fr] items-center gap-3 p-4";

  const progress = document.createElement("div");
  progress.className = "radial-progress text-primary tabular-nums";
  progress.style.setProperty("--value", String(progressValue(session)));
  progress.setAttribute("aria-valuenow", String(progressValue(session)));
  progress.setAttribute("role", "progressbar");
  const petMount = document.createElement("div");
  petMount.className = "scale-75";
  mountPet(petMount, model.petState, "idle");
  progress.append(petMount);
  body.append(progress);

  const stats = document.createElement("div");
  stats.className = "space-y-2";
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap gap-1.5";
  appendText(badges, "span", streakChipText(model), "badge badge-soft badge-primary shadow-sm");
  appendText(badges, "span", session.intensity, "badge badge-soft shadow-sm");
  stats.append(badges);
  appendText(stats, "p", model.notice ?? `보호막 ${model.petState.streakFreezes}/2`, "text-sm text-base-content/70");
  body.append(stats);
  panel.append(body);
  root.append(panel);
}

function renderActiveSession(root: HTMLElement, model: PopupModel, handlers: PopupHandlers): void {
  if (!model.activeSession) {
    return;
  }

  const section = document.createElement("section");
  section.className = "card flex-1 border border-base-200 bg-base-100 shadow-sm";
  const body = document.createElement("div");
  body.className = "card-body gap-5 p-4";
  const copy = document.createElement("div");
  copy.className = "space-y-2";
  appendText(copy, "p", "진행 중", "text-sm font-semibold text-base-content/60");
  appendText(copy, "h1", `남은 시간 ${formatRemaining(model.activeSession)}`, "text-4xl font-extrabold tabular-nums");
  appendText(copy, "p", `현재 강도 ${model.activeSession.intensity}`, "text-sm text-base-content/60");
  body.append(copy);

  const upgrades = (["soft", "medium", "hard"] as Intensity[]).filter(
    (intensity) => INTENSITY_ORDER[intensity] > INTENSITY_ORDER[model.activeSession?.intensity ?? "hard"]
  );

  const actions = document.createElement("div");
  actions.className = "space-y-2 border-t border-base-200 pt-4";

  if (upgrades.length === 0) {
    appendText(actions, "p", "이미 가장 단단한 설정입니다.", "text-sm text-base-content/60");
  } else {
    appendText(actions, "p", "더 단단한 설정이 필요할 때만 상향합니다.", "text-sm text-base-content/60");
  }

  for (const intensity of upgrades) {
    actions.append(createButton(`${intensity}로 상향`, "btn btn-soft btn-sm shadow-sm", () => {
      void handlers.upgradeIntensity(intensity);
    }));
  }

  body.append(actions);
  section.append(body);
  root.append(section);
}

function renderSessionForm(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  const form = document.createElement("form");
  form.className = "flex min-h-0 flex-1 flex-col gap-4";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handlers.startSession();
  });

  const heading = document.createElement("div");
  heading.className = "space-y-2";
  appendText(heading, "h1", "집중 시작", "text-xl font-bold");
  appendText(heading, "p", "오늘 한 번만 정하고 바로 들어갑니다.", "text-sm text-base-content/60");
  form.append(heading);

  const listLabel = appendText(form, "fieldset", "", "fieldset") as HTMLFieldSetElement;
  appendText(listLabel, "legend", "목록", "fieldset-legend");
  const listSelect = document.createElement("select");
  listSelect.name = "siteList";
  listSelect.className = "select w-full";
  listSelect.setAttribute("aria-label", "목록");
  for (const siteList of model.siteLists) {
    const option = document.createElement("option");
    option.value = siteList.id;
    option.textContent = siteList.name;
    option.selected = siteList.id === selection.listId;
    listSelect.append(option);
  }
  listSelect.addEventListener("change", () => handlers.updateSelection({ listId: listSelect.value }));
  listLabel.append(listSelect);
  form.append(listLabel);

  const durationFieldset = document.createElement("fieldset");
  durationFieldset.className = "fieldset";
  appendText(durationFieldset, "legend", "시간", "fieldset-legend");
  const durations = document.createElement("div");
  durations.className = "join w-full";
  durations.setAttribute("role", "group");
  durations.setAttribute("aria-label", "시간 선택");
  for (const minutes of [15, 25, 50, 90]) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "duration";
    radio.className = "join-item btn flex-1";
    radio.setAttribute("aria-label", String(minutes));
    radio.checked = selection.durationMinutes === minutes && !selection.customMinutes;
    radio.addEventListener("change", () => {
      handlers.updateSelection({ durationMinutes: minutes, customMinutes: "" });
    });
    durations.append(radio);
  }
  durationFieldset.append(durations);
  form.append(durationFieldset);

  const customDetails = document.createElement("details");
  customDetails.className = "collapse collapse-arrow bg-base-200";
  customDetails.open = Boolean(selection.customMinutes);
  appendText(customDetails, "summary", "직접 입력", "collapse-title min-h-10 text-sm font-medium");
  const customContent = document.createElement("div");
  customContent.className = "collapse-content";
  const customInput = document.createElement("input");
  customInput.type = "number";
  customInput.min = "1";
  customInput.max = "240";
  customInput.inputMode = "numeric";
  customInput.className = "input w-full";
  customInput.value = selection.customMinutes;
  customInput.placeholder = "분";
  customInput.addEventListener("input", () => {
    const parsed = Number(customInput.value);
    handlers.updateSelection({
      customMinutes: customInput.value,
      durationMinutes: Number.isFinite(parsed) && parsed > 0 ? Math.min(240, Math.round(parsed)) : selection.durationMinutes
    });
  });
  customContent.append(customInput);
  customDetails.append(customContent);
  form.append(customDetails);

  const intensityFieldset = document.createElement("fieldset");
  intensityFieldset.className = "fieldset";
  appendText(intensityFieldset, "legend", "강도", "fieldset-legend");
  const intensities = document.createElement("div");
  intensities.className = "join w-full";
  intensities.setAttribute("role", "group");
  intensities.setAttribute("aria-label", "강도 선택");
  for (const intensity of ["soft", "medium", "hard"] as Intensity[]) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "intensity";
    radio.className = "join-item btn flex-1";
    radio.setAttribute("aria-label", intensity);
    radio.checked = selection.intensity === intensity;
    radio.addEventListener("change", () => {
      handlers.updateSelection({ intensity });
    });
    intensities.append(radio);
  }
  intensityFieldset.append(intensities);
  form.append(intensityFieldset);

  if (selection.intensity === "hard") {
    const hardNote = document.createElement("div");
    hardNote.className = "alert alert-warning py-2 text-sm";
    appendText(hardNote, "span", "hard는 종료까지 해제할 수 없습니다.");
    form.append(hardNote);
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary mt-auto w-full shrink-0";
  submit.textContent = `${selection.durationMinutes}분 시작`;
  form.append(submit);
  root.append(form);
}

export function renderPopup(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  root.replaceChildren();
  root.className = "flex h-[580px] w-[360px] flex-col gap-3 bg-base-100 p-4 text-base-content shadow-xl";

  if (model.activeSession?.status === "active") {
    renderActiveHero(root, model);
    renderActiveSession(root, model, handlers);
  } else {
    renderCelebrations(root, model);
    renderPetPanel(root, model);
    renderSessionForm(root, model, selection, handlers);
  }
}

async function getActiveSession(): Promise<Session | null> {
  try {
    const response = await sendMessage({ type: "GET_STATE" });
    return response.state.activeSession;
  } catch {
    return (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  }
}

async function loadPopupModel(notice?: string): Promise<PopupModel> {
  const settlement = await settleCompletedSessionXp();
  const [storedSiteLists, sessionLog = [], streakLedgerValue] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.siteLists),
    getTyped("local", STORAGE_KEYS.local.sessionLog),
    getTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY)
  ]);

  const migration = migrateSiteListsForCurrentDefaults(storedSiteLists);
  const siteLists = migration.siteLists;
  if (migration.changed) {
    await setTyped("sync", STORAGE_KEYS.sync.siteLists, siteLists);
  }
  const streakResult = reconcileStreakFromSessions(settlement.petState, sessionLog, {
    now: new Date(),
    recovery: streakLedgerValue
  });
  const beforeBadges = new Set(streakResult.state.badges);
  const petState = awardBadges(streakResult.state, sessionLog, siteLists, {
    comebackEligible: streakResult.streakRestored,
    now: Date.now()
  });
  const normalizedPetState = normalizePetState(petState);
  const growthEvents: GrowthEvent[] = [];
  const now = Date.now();

  if (streakResult.freezeAwarded) {
    growthEvents.push(createGrowthEvent("freeze_granted", now, {}));
  }
  if (streakResult.freezeConsumed) {
    growthEvents.push(createGrowthEvent("freeze_used", now, {}));
  }
  if (streakResult.restStarted) {
    growthEvents.push(createGrowthEvent("streak_rest", now, { streakFrom: streakResult.recovery.previousStreakDays }));
  }
  if (streakResult.streakRestored) {
    growthEvents.push(createGrowthEvent("streak_restored", now, {
      streakFrom: streakLedgerValue?.previousStreakDays,
      streakTo: normalizedPetState.streakDays
    }));
  }
  if (streakResult.freshStarted) {
    growthEvents.push(createGrowthEvent("streak_fresh_start", now, {}));
  }

  for (const badge of normalizedPetState.badges) {
    if (!beforeBadges.has(badge)) {
      growthEvents.push(createGrowthEvent("badge_earned", normalizedPetState.badgeAwards[badge]?.earnedAt ?? now, { badgeId: badge }));
    }
  }

  await appendGrowthEvents(growthEvents, true);

  await Promise.all([
    setTyped("sync", STORAGE_KEYS.sync.petState, normalizedPetState),
    setTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY, streakResult.recovery)
  ]);
  const [celebrations, growthLog] = await Promise.all([
    drainPendingCelebrations(),
    readGrowthLog(10)
  ]);

  return {
    petState: normalizedPetState,
    activeSession: await getActiveSession(),
    siteLists,
    awardedXp: settlement.awardedXp,
    streakStatus: streakResult.status,
    celebrations,
    growthLog,
    notice
  };
}

function coerceSelection(selection: SelectionState, siteLists: SiteList[]): SelectionState {
  const firstListId = siteLists[0]?.id ?? DEFAULT_SITE_LISTS[0].id;
  const listId = siteLists.some((siteList) => siteList.id === selection.listId) ? selection.listId : firstListId;

  return {
    ...selection,
    listId,
    durationMinutes: Math.min(240, Math.max(1, Math.round(selection.durationMinutes || 25)))
  };
}

export async function bootstrapPopup(root: HTMLElement): Promise<void> {
  let model = await loadPopupModel();
  let selection: SelectionState = coerceSelection({
    listId: model.siteLists[0]?.id ?? DEFAULT_SITE_LISTS[0].id,
    durationMinutes: 25,
    customMinutes: "",
    intensity: "medium"
  }, model.siteLists);

  const rerender = () => {
    renderPopup(root, model, selection, {
      updateSelection: (patch) => {
        selection = coerceSelection({ ...selection, ...patch }, model.siteLists);
        rerender();
      },
      startSession: async () => {
        try {
          const response = await sendMessage({
            type: "START_SESSION",
            payload: {
              listId: selection.listId,
              intensity: selection.intensity,
              durationMinutes: selection.durationMinutes,
              source: "manual"
            }
          });
          assertOkResponse(response);
          model = await loadPopupModel("세션을 시작했습니다.");
        } catch (error) {
          model = await loadPopupModel(error instanceof Error ? error.message : "세션을 시작하지 못했습니다.");
        }
        rerender();
      },
      upgradeIntensity: async (intensity) => {
        if (!model.activeSession || INTENSITY_ORDER[intensity] <= INTENSITY_ORDER[model.activeSession.intensity]) {
          return;
        }

        const remaining = Math.max(1, minutesRemaining(model.activeSession));
        try {
          const response = await sendMessage({
            type: "START_SESSION",
            payload: {
              listId: model.activeSession.listId,
              intensity,
              durationMinutes: remaining,
              source: model.activeSession.source
            }
          });
          assertOkResponse(response);
          model = await loadPopupModel("강도를 상향했습니다.");
        } catch (error) {
          model = await loadPopupModel(error instanceof Error ? error.message : "강도를 상향하지 못했습니다.");
        }
        rerender();
      }
    });
  };

  rerender();
  window.setInterval(async () => {
    if (model.activeSession?.status === "active") {
      model = await loadPopupModel(model.notice);
      rerender();
    }
  }, 30_000);
}

export function renderPopupPreview(root: HTMLElement, petState: PetState, siteLists: SiteList[], sessionLog: Session[]): void {
  const streak = reconcileStreakFromSessions(petState, sessionLog, { now: new Date("2026-07-06T12:00:00+09:00") });
  const previewModel: PopupModel = {
    petState: awardBadges(streak.state, sessionLog, siteLists),
    activeSession: null,
    siteLists,
    awardedXp: 36,
    streakStatus: streak.status,
    celebrations: [],
    growthLog: [],
    notice: "개발 프리뷰"
  };
  const previewSelection: SelectionState = {
    listId: siteLists[0]?.id ?? DEFAULT_SITE_LISTS[0].id,
    durationMinutes: 25,
    customMinutes: "",
    intensity: "medium"
  };
  const noopHandlers: PopupHandlers = {
    updateSelection: () => undefined,
    startSession: async () => undefined,
    upgradeIntensity: async () => undefined
  };

  renderPopup(root, previewModel, previewSelection, noopHandlers);
}

function assertOkResponse(response: unknown): void {
  if (!response || typeof response !== "object" || !("ok" in response)) {
    return;
  }

  const candidate = response as { ok: boolean; error?: string };
  if (!candidate.ok) {
    throw new Error(candidate.error ?? "요청을 처리하지 못했습니다.");
  }
}

const root = document.querySelector<HTMLElement>("#app");
if (root && document.body.dataset.page === "focuswhale-popup") {
  void bootstrapPopup(root).catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : "Popup failed to load.";
  });
}
