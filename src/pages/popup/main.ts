import { sendMessage, type FocusWhaleState } from "../../shared/messaging";
import { LatestRequestGuard } from "../../shared/latestRequest";
import { stageName } from "../../shared/gamification";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import { DEFAULT_SITE_LISTS, migrateSiteListsForCurrentDefaults } from "../../shared/siteLists";
import type { Intensity, PetState, Session, SiteList } from "../../shared/types";
import { awardBadges, badgeDescription, badgeName } from "../../pet/badges";
import {
  growthProgress,
  readPendingCelebrations,
  readGrowthLog,
  type GrowthEvent
} from "../../pet/growth";
import { mountPet } from "../../pet/renderer";
import { reconcileStreakFromSessions } from "../../pet/streak";

const INTENSITY_ORDER: Record<Intensity, number> = {
  soft: 0,
  medium: 1,
  hard: 2
};

export interface PopupModel {
  petState: PetState;
  activeSession: Session | null;
  pendingEmergency: FocusWhaleState["pendingEmergency"];
  siteLists: SiteList[];
  awardedXp: number;
  streakStatus: "active" | "resting" | "fresh";
  celebrations: GrowthEvent[];
  growthLog: GrowthEvent[];
  notice?: string;
  celebrationAckError?: string;
}

interface SelectionState {
  listId: string;
  durationMinutes: number;
  customMinutes: string;
  intensity: Intensity;
}

interface PopupHandlers {
  updateSelection: (patch: Partial<SelectionState>, rerender?: boolean, focusKey?: string) => void;
  startSession: () => Promise<void>;
  upgradeIntensity: (intensity: Intensity) => Promise<void>;
  dismissCelebrations: (eventIds: readonly string[]) => Promise<void>;
  setPetName: (name: string) => Promise<void>;
  requestEmergencyEnd: () => Promise<void>;
  openOptions: () => void;
}

function formatRemaining(session: Session, now = Date.now()): string {
  return formatDeadline(session.endsAt, now);
}

function formatDeadline(deadline: number, now = Date.now()): string {
  const totalSeconds = Math.max(0, Math.ceil((deadline - now) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function intensityLabel(intensity: Intensity): string {
  if (intensity === "soft") {
    return "가벼운 안내";
  }

  if (intensity === "medium") {
    return "확인 후 허용";
  }

  return "완전 차단";
}

export function coerceCustomDuration(rawValue: string, fallbackMinutes: number): number {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(240, Math.max(1, Math.round(parsed)))
    : fallbackMinutes;
}

function renderPopupHeader(root: HTMLElement, handlers: PopupHandlers): void {
  const header = document.createElement("header");
  header.className = "sticky top-0 z-20 flex min-h-10 shrink-0 items-center justify-between bg-base-100 py-1";
  appendText(header, "p", "FocusWhale", "text-sm font-bold");
  header.append(createButton("설정", "btn btn-ghost min-h-10 px-3", handlers.openOptions));
  root.append(header);
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
  stats.className = "min-w-0 space-y-2";
  appendText(stats, "p", model.petState.name ?? "미로", "break-all text-sm font-semibold");
  appendText(stats, "h1", petStateLine(model.petState), "text-xl font-extrabold");
  appendText(stats, "p", "집중 세션을 완료하면 자라요.", "text-xs");
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap gap-1.5";
  appendText(badges, "span", streakChipText(model), "badge badge-soft badge-primary shadow-sm");
  appendText(badges, "span", `보호막 ${model.petState.streakFreezes}/2`, "badge badge-soft shadow-sm");
  stats.append(badges);
  appendText(stats, "p", recentBadgeText(model.petState), "text-sm");

  if (model.notice) {
    appendText(stats, "p", model.notice, "text-sm");
  }

  body.append(stats);
  panel.append(body, renderPetDetails(model));
  root.append(panel);
}

function renderCelebrations(root: HTMLElement, model: PopupModel, handlers: PopupHandlers): void {
  if (model.celebrations.length === 0) {
    return;
  }

  const visibleEvents = celebrationBatch(model.celebrations);
  const animationTasks: Array<() => void> = [];
  const sessionEvent = visibleEvents.find((event) => event.type === "session_completed");
  const milestoneEvents = visibleEvents.filter((event) => event.type !== "session_completed");
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

  if (model.celebrations.length > visibleEvents.length) {
    appendText(body, "p", `확인할 변화가 ${model.celebrations.length - visibleEvents.length}개 더 있어요.`, "text-xs");
  }
  if (!model.petState.name && visibleEvents.some((event) => event.type === "stage_up")) {
    body.append(renderNamePrompt(handlers));
  }
  if (model.celebrationAckError) {
    const notice = document.createElement("div");
    notice.className = "alert alert-error alert-soft text-sm";
    notice.setAttribute("role", "alert");
    appendText(notice, "span", model.celebrationAckError);
    body.append(notice);
  }
  const actions = document.createElement("div");
  actions.className = "card-actions justify-end";
  const dismiss = createButton("확인", "btn btn-soft min-h-10 shadow-sm", () => {
    dismiss.disabled = true;
    dismiss.textContent = "저장 중...";
    void handlers.dismissCelebrations(visibleEvents.map((event) => event.id)).finally(() => {
      if (dismiss.isConnected) {
        dismiss.disabled = false;
        dismiss.textContent = "다시 시도";
      }
    });
  });
  actions.append(dismiss);
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
  mountPet(petSlot, model.petState, "celebrate");
  const copy = document.createElement("div");
  copy.className = "space-y-1";
  appendText(copy, "p", "세션 완료", "text-xs font-bold uppercase tracking-wide text-primary");
  appendText(copy, "h2", "집중이 고래를 키웠어요", "text-xl font-extrabold");
  appendText(copy, "p", event.text, "text-sm");
  hero.append(petSlot, copy);
  wrap.append(hero);

  const stats = document.createElement("div");
  stats.className = "stats stats-vertical overflow-hidden bg-base-200 shadow-sm";
  const gained = document.createElement("div");
  gained.className = "stat py-3";
  appendText(gained, "div", "이번 세션", "stat-title");
  appendText(gained, "div", `+${xpDelta} XP`, "stat-value text-2xl text-primary tabular-nums");
  appendText(gained, "div", `${event.minutes ?? 0}분 × ${intensityLabel(event.intensity ?? "medium")}`, "stat-desc");
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
  appendText(progress, "p", `${clampPercent(progressBefore)}% → ${clampPercent(progressAfter)}%`, "text-xs");
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
    appendText(row, "p", event.type === "badge_earned" && event.badgeId
      ? badgeDescription(event.badgeId)
      : event.text);
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

function renderNamePrompt(handlers: PopupHandlers): HTMLElement {
  const form = document.createElement("form");
  form.className = "grid gap-2 rounded-box bg-base-200 p-3";
  appendText(form, "p", "이 고래를 뭐라고 부를까요?", "text-sm font-semibold");
  const input = document.createElement("input");
  input.className = "input min-h-10 w-full";
  input.placeholder = "미로";
  input.maxLength = 24;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary min-h-10";
  submit.textContent = "이름 붙이기";
  form.append(input, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim() || "미로";
    void handlers.setPetName(name)
      .then(() => {
        form.replaceChildren();
        appendText(form, "p", `${name}와 함께 항해합니다.`, "text-sm font-semibold");
      })
      .catch((error: unknown) => {
        const existingError = form.querySelector("[role='alert']");
        existingError?.remove();
        appendText(
          form,
          "p",
          error instanceof Error ? error.message : "이름을 저장하지 못했습니다.",
          "text-error text-sm"
        ).setAttribute("role", "alert");
      });
  });
  return form;
}

function renderPetDetails(model: PopupModel): HTMLElement {
  const details = document.createElement("details");
  details.className = "collapse collapse-arrow border-t border-base-200";
  const summary = document.createElement("summary");
  summary.className = "collapse-title min-h-10 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  summary.textContent = "성장 자세히 보기";
  const content = document.createElement("div");
  content.className = "collapse-content grid gap-3 text-sm";

  const progress = growthProgress(model.petState.xp, model.petState.stage);
  appendText(content, "p", `누적 집중 ${model.petState.totalFocusMinutes}분 · ${model.petState.xp} XP`);
  if (progress.nextStageName) {
    appendText(content, "p", `${progress.nextStageName}까지 ${progress.remainingXp} XP`);
    const bar = document.createElement("progress");
    bar.className = "progress progress-primary w-full";
    bar.max = 100;
    bar.value = progress.percentToNext;
    content.append(bar);
  } else {
    appendText(content, "p", "지금은 가장 깊은 바다를 항해 중이에요.");
  }
  appendText(content, "p", "보호막은 7일 연속 집중할 때 1개 충전되고, 하루를 놓치면 자동으로 1개 사용되어 이어온 기록을 지켜줘요. 최대 2개까지 모을 수 있어요.", "text-xs");
  appendText(content, "p", "고래는 아프거나 돌아가지 않아요.", "text-xs");

  const recent = model.growthLog.slice(0, 3);
  if (recent.length > 0) {
    const list = document.createElement("ul");
    list.className = "grid gap-1";
    for (const event of recent) {
      appendText(list, "li", event.text, "text-xs");
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
    return event.badgeId ? `새 징표 · ${badgeName(event.badgeId)}` : "새 징표";
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
  body.className = "card-body grid grid-cols-[80px_1fr] items-center gap-3 p-4";

  const progress = document.createElement("div");
  progress.id = "active-session-progress";
  progress.className = "radial-progress text-primary tabular-nums [--size:4.5rem] [--thickness:0.35rem]";
  progress.style.setProperty("--value", String(progressValue(session)));
  progress.setAttribute("aria-label", "세션 진행률");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", String(progressValue(session)));
  progress.setAttribute("role", "progressbar");
  const petMount = document.createElement("div");
  petMount.className = "scale-75";
  mountPet(petMount, model.petState, "focus");
  progress.append(petMount);
  body.append(progress);

  const stats = document.createElement("div");
  stats.className = "min-w-0 space-y-1.5";
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap gap-1.5";
  appendText(badges, "span", streakChipText(model), "badge badge-soft badge-primary shadow-sm");
  appendText(badges, "span", intensityLabel(session.intensity), "badge badge-soft shadow-sm");
  stats.append(badges);
  appendText(stats, "p", model.notice ?? `보호막 ${model.petState.streakFreezes}/2`, "text-xs leading-relaxed");
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
  appendText(copy, "p", "진행 중", "text-sm font-semibold");
  const remaining = appendText(copy, "h1", `남은 시간 ${formatRemaining(model.activeSession)}`, "break-words text-4xl font-extrabold tabular-nums");
  remaining.id = "active-session-remaining";
  appendText(copy, "p", `현재 설정 ${intensityLabel(model.activeSession.intensity)}`, "text-sm");
  body.append(copy);

  const upgrades = (["soft", "medium", "hard"] as Intensity[]).filter(
    (intensity) => INTENSITY_ORDER[intensity] > INTENSITY_ORDER[model.activeSession?.intensity ?? "hard"]
  );

  const actions = document.createElement("div");
  actions.className = "space-y-2 border-t border-base-200 pt-4";

  if (upgrades.length === 0) {
    appendText(actions, "p", "이미 가장 단단한 설정입니다.", "text-sm");
  } else {
    appendText(actions, "p", "더 단단한 설정이 필요할 때만 상향합니다.", "text-sm");
  }

  for (const intensity of upgrades) {
    actions.append(createButton(`${intensityLabel(intensity)}으로 상향`, "btn btn-soft min-h-10 shadow-sm", () => {
      void handlers.upgradeIntensity(intensity);
    }));
  }

  if (model.activeSession.intensity === "hard") {
    renderHardEmergencyControls(actions, model, handlers);
  }

  body.append(actions);
  section.append(body);
  root.append(section);
}

function renderHardEmergencyControls(
  container: HTMLElement,
  model: PopupModel,
  handlers: PopupHandlers,
  confirming = false
): void {
  const session = model.activeSession;
  if (!session || session.intensity !== "hard") {
    return;
  }

  const pending = model.pendingEmergency?.sessionId === session.id ? model.pendingEmergency : null;
  const wrap = document.createElement("div");
  wrap.className = "grid gap-2 border-t border-base-200 pt-3";
  if (pending) {
    const notice = document.createElement("div");
    notice.className = "alert alert-warning alert-soft text-sm shadow-none";
    notice.setAttribute("role", "status");
    appendText(notice, "span", "비상 종료 요청이 저장되었습니다.");
    const remaining = appendText(wrap, "p", `종료까지 ${formatDeadline(pending.dueAt)}`, "text-sm font-semibold tabular-nums");
    remaining.id = "popup-emergency-remaining";
    wrap.prepend(notice);
    container.append(wrap);
    return;
  }

  if (!confirming) {
    appendText(wrap, "p", "비상 종료는 5분 뒤 적용되며 이번 주 1회만 사용할 수 있습니다.", "text-xs");
    wrap.append(createButton("비상 종료 요청", "btn btn-error btn-soft min-h-10 shadow-sm", () => {
      renderHardEmergencyControls(container, model, handlers, true);
      wrap.remove();
    }));
    container.append(wrap);
    return;
  }

  const warning = document.createElement("div");
  warning.className = "alert alert-warning alert-soft text-sm shadow-none";
  warning.setAttribute("role", "note");
  appendText(warning, "span", "한 번 더 누르면 5분 뒤 비상 종료가 예약됩니다.");
  const buttons = document.createElement("div");
  buttons.className = "flex flex-wrap gap-2";
  const confirm = createButton("5분 뒤 종료 예약", "btn btn-error min-h-10 shadow-md", () => {
    confirm.disabled = true;
    confirm.textContent = "예약 중...";
    void handlers.requestEmergencyEnd();
  });
  buttons.append(confirm, createButton("되돌아가기", "btn btn-soft min-h-10 shadow-sm", () => {
    renderHardEmergencyControls(container, model, handlers, false);
    wrap.remove();
  }));
  wrap.append(warning, buttons);
  container.append(wrap);
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
  appendText(heading, "p", "오늘 한 번만 정하고 바로 들어갑니다.", "text-sm");
  form.append(heading);

  const listLabel = appendText(form, "fieldset", "", "fieldset") as HTMLFieldSetElement;
  appendText(listLabel, "legend", "목록", "fieldset-legend");
  const listSelect = document.createElement("select");
  listSelect.name = "siteList";
  listSelect.dataset.popupFocus = "site-list";
  listSelect.className = "select w-full";
  listSelect.setAttribute("aria-label", "목록");
  for (const siteList of model.siteLists) {
    const option = document.createElement("option");
    option.value = siteList.id;
    option.textContent = siteList.name;
    option.selected = siteList.id === selection.listId;
    listSelect.append(option);
  }
  listSelect.addEventListener("change", () => handlers.updateSelection({ listId: listSelect.value }, true, "site-list"));
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
    radio.dataset.popupFocus = `duration-${minutes}`;
    radio.className = "join-item btn flex-1";
    radio.setAttribute("aria-label", String(minutes));
    radio.checked = selection.durationMinutes === minutes && !selection.customMinutes;
    radio.addEventListener("change", () => {
      handlers.updateSelection({ durationMinutes: minutes, customMinutes: "" }, true, `duration-${minutes}`);
    });
    durations.append(radio);
  }
  durationFieldset.append(durations);
  form.append(durationFieldset);

  const customDetails = document.createElement("details");
  customDetails.className = "collapse collapse-arrow bg-base-200";
  customDetails.open = Boolean(selection.customMinutes);
  appendText(
    customDetails,
    "summary",
    "직접 입력",
    "collapse-title min-h-10 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  );
  const customContent = document.createElement("div");
  customContent.className = "collapse-content";
  const customInput = document.createElement("input");
  customInput.type = "number";
  customInput.min = "1";
  customInput.max = "240";
  customInput.inputMode = "numeric";
  customInput.className = "input w-full";
  customInput.setAttribute("aria-label", "직접 입력 시간(분)");
  customInput.value = selection.customMinutes;
  customInput.placeholder = "분";
  customInput.addEventListener("input", () => {
    const durationMinutes = coerceCustomDuration(customInput.value, selection.durationMinutes);
    handlers.updateSelection({
      customMinutes: customInput.value,
      durationMinutes
    }, false);
    const submit = form.querySelector<HTMLButtonElement>("[data-start-session]");
    if (submit) {
      submit.textContent = `${durationMinutes}분 시작`;
    }
  });
  customInput.addEventListener("blur", () => {
    if (customInput.value) {
      const durationMinutes = coerceCustomDuration(customInput.value, selection.durationMinutes);
      customInput.value = String(durationMinutes);
      handlers.updateSelection({ customMinutes: customInput.value, durationMinutes }, false);
    }
  });
  customContent.append(customInput);
  customDetails.append(customContent);
  form.append(customDetails);

  const intensityFieldset = document.createElement("fieldset");
  intensityFieldset.className = "fieldset";
  appendText(intensityFieldset, "legend", "차단 방식", "fieldset-legend");
  const intensities = document.createElement("div");
  intensities.className = "join w-full";
  intensities.setAttribute("role", "group");
  intensities.setAttribute("aria-label", "강도 선택");
  for (const intensity of ["soft", "medium", "hard"] as Intensity[]) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "intensity";
    radio.dataset.popupFocus = `intensity-${intensity}`;
    radio.className = "join-item btn flex-1";
    radio.setAttribute("aria-label", intensityLabel(intensity));
    radio.checked = selection.intensity === intensity;
    radio.addEventListener("change", () => {
      handlers.updateSelection({ intensity }, true, `intensity-${intensity}`);
    });
    intensities.append(radio);
  }
  intensityFieldset.append(intensities);
  form.append(intensityFieldset);

  if (selection.intensity === "hard") {
    const hardNote = document.createElement("div");
    hardNote.className = "rounded-box border border-base-300 bg-base-200 px-3 py-2 text-sm";
    appendText(hardNote, "span", "비상 종료는 두 번 확인한 뒤 5분 후 적용되며, 주 1회 사용할 수 있습니다.");
    form.append(hardNote);
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.dataset.startSession = "true";
  submit.className = "btn btn-primary sticky bottom-0 z-10 mt-auto w-full shrink-0 shadow-lg";
  submit.textContent = `${selection.durationMinutes}분 시작`;
  form.append(submit);
  root.append(form);
}

export function renderPopup(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  root.replaceChildren();
  root.className = "flex h-[580px] w-[360px] flex-col gap-3 overflow-y-auto bg-base-100 px-4 pb-4 text-base-content shadow-xl";
  renderPopupHeader(root, handlers);

  if (model.activeSession?.status === "active") {
    renderActiveHero(root, model);
    renderActiveSession(root, model, handlers);
  } else if (model.celebrations.length > 0) {
    renderCelebrations(root, model, handlers);
  } else {
    renderPetPanel(root, model);
    renderSessionForm(root, model, selection, handlers);
  }
}

export function clearPopupCelebrations(model: PopupModel): PopupModel {
  return { ...model, celebrations: [] };
}

export function celebrationBatch(events: readonly GrowthEvent[]): GrowthEvent[] {
  const sessionEvent = events.find((event) => event.type === "session_completed");
  if (sessionEvent) {
    return events.filter((event) => event.id === sessionEvent.id || (
      Boolean(sessionEvent.sessionId) && event.sessionId === sessionEvent.sessionId
    ));
  }
  return events.slice(0, 4);
}

export function mergePetNameSave(model: PopupModel, petState: PetState): PopupModel {
  return { ...model, petState };
}

export async function dismissPopupCelebrations(
  model: PopupModel,
  acknowledge: (eventIds: readonly string[]) => Promise<void> = acknowledgePopupCelebrations
): Promise<PopupModel> {
  try {
    await acknowledge(model.celebrations.map((event) => event.id));
    return clearPopupCelebrations({ ...model, celebrationAckError: undefined });
  } catch {
    return {
      ...model,
      celebrationAckError: "완료 기록을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
    };
  }
}

export function mergeCelebrationDismissal(
  current: PopupModel,
  dismissedEventIds: readonly string[],
  acknowledgementError?: string
): PopupModel {
  if (acknowledgementError) {
    return { ...current, celebrationAckError: acknowledgementError };
  }

  const dismissed = new Set(dismissedEventIds);
  return {
    ...current,
    celebrations: current.celebrations.filter((event) => !dismissed.has(event.id)),
    celebrationAckError: undefined
  };
}

export async function acknowledgePopupCelebrations(eventIds: readonly string[]): Promise<void> {
  const response = await sendMessage({
    type: "ACK_CELEBRATIONS",
    payload: { eventIds: [...eventIds] }
  });
  assertOkResponse(response);
}

export function activeSessionClockSnapshot(session: Session, now = Date.now()): { remainingText: string; progress: number } {
  return {
    remainingText: `남은 시간 ${formatRemaining(session, now)}`,
    progress: progressValue(session, now)
  };
}

export function updateActiveSessionClock(root: HTMLElement, session: Session, now = Date.now()): void {
  const snapshot = activeSessionClockSnapshot(session, now);
  const remaining = root.querySelector<HTMLElement>("#active-session-remaining");
  if (remaining) {
    remaining.textContent = snapshot.remainingText;
  }

  const progress = root.querySelector<HTMLElement>("#active-session-progress");
  if (progress) {
    progress.style.setProperty("--value", String(snapshot.progress));
    progress.setAttribute("aria-valuenow", String(snapshot.progress));
  }
}

export function updatePendingEmergencyClock(
  root: HTMLElement,
  pendingEmergency: FocusWhaleState["pendingEmergency"],
  now = Date.now()
): void {
  const remaining = root.querySelector<HTMLElement>("#popup-emergency-remaining");
  if (remaining && pendingEmergency) {
    remaining.textContent = `종료까지 ${formatDeadline(pendingEmergency.dueAt, now)}`;
  }
}

async function getRuntimeState(): Promise<FocusWhaleState> {
  try {
    const response = await sendMessage({ type: "GET_STATE" });
    if (!response.ok) {
      throw new Error(response.error);
    }
    return response.state;
  } catch {
    const [activeSession, pendingEmergency] = await Promise.all([
      getTyped("local", STORAGE_KEYS.local.activeSession),
      getTyped<FocusWhaleState["pendingEmergency"]>("local", "pendingEmergency")
    ]);
    return fallbackRuntimeState(activeSession ?? null, pendingEmergency ?? null);
  }
}

export function fallbackRuntimeState(
  activeSession: Session | null,
  pendingEmergency: FocusWhaleState["pendingEmergency"],
  now = Date.now()
): FocusWhaleState {
  const running = activeSession?.status === "active" && activeSession.endsAt > now
    ? activeSession
    : null;
  const pending = running && pendingEmergency?.sessionId === running.id
    ? pendingEmergency
    : null;
  return { activeSession: running, pendingEmergency: pending };
}

export async function loadPopupModel(notice?: string): Promise<PopupModel> {
  const storedSiteLists = await getTyped("sync", STORAGE_KEYS.sync.siteLists);
  const migration = migrateSiteListsForCurrentDefaults(storedSiteLists);
  const siteLists = migration.siteLists;
  if (migration.changed) {
    await setTyped("sync", STORAGE_KEYS.sync.siteLists, siteLists);
  }

  // GET_STATE may finalize a session whose alarm was missed while the browser
  // slept. Reconcile rewards and read celebrations only after that durable
  // finalization, otherwise the first popup can miss the completion overview.
  const runtimeState = await getRuntimeState();
  const petResponse = await sendMessage({ type: "RECONCILE_PET" });
  if (!petResponse.ok) {
    throw new Error(petResponse.error);
  }
  const [celebrations, growthLog] = await Promise.all([
    readPendingCelebrations(),
    readGrowthLog(10)
  ]);

  return {
    petState: petResponse.pet.petState,
    activeSession: runtimeState.activeSession,
    pendingEmergency: runtimeState.pendingEmergency,
    siteLists,
    awardedXp: petResponse.pet.awardedXp,
    streakStatus: petResponse.pet.streakStatus,
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
  const modelLoads = new LatestRequestGuard();
  let selection: SelectionState = coerceSelection({
    listId: model.siteLists[0]?.id ?? DEFAULT_SITE_LISTS[0].id,
    durationMinutes: 25,
    customMinutes: "",
    intensity: "medium"
  }, model.siteLists);

  const reloadModel = async (notice?: string): Promise<boolean> => {
    const token = modelLoads.begin();
    const nextModel = await loadPopupModel(notice);
    if (!modelLoads.isCurrent(token)) {
      return false;
    }
    model = nextModel;
    return true;
  };

  const rerender = (focusKey?: string) => {
    const scrollTop = root.scrollTop;
    renderPopup(root, model, selection, {
      updateSelection: (patch, shouldRerender = true, nextFocusKey) => {
        selection = coerceSelection({ ...selection, ...patch }, model.siteLists);
        if (shouldRerender) {
          rerender(nextFocusKey);
        }
      },
      startSession: async () => {
        let applied = false;
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
          applied = await reloadModel("세션을 시작했습니다.");
        } catch (error) {
          applied = await reloadModel(error instanceof Error ? error.message : "세션을 시작하지 못했습니다.");
        }
        if (applied) {
          rerender();
        }
      },
      upgradeIntensity: async (intensity) => {
        if (!model.activeSession || INTENSITY_ORDER[intensity] <= INTENSITY_ORDER[model.activeSession.intensity]) {
          return;
        }

        let applied = false;
        try {
          const response = await sendMessage({
            type: "UPGRADE_SESSION_INTENSITY",
            payload: { intensity }
          });
          assertOkResponse(response);
          applied = await reloadModel("차단 방식을 강화했습니다.");
        } catch (error) {
          applied = await reloadModel(error instanceof Error ? error.message : "차단 방식을 강화하지 못했습니다.");
        }
        if (applied) {
          rerender();
        }
      },
      dismissCelebrations: async (eventIds) => {
        const dismissedEventIds = [...eventIds];
        const selected = new Set(dismissedEventIds);
        const result = await dismissPopupCelebrations({
          ...model,
          celebrations: model.celebrations.filter((event) => selected.has(event.id))
        });
        model = mergeCelebrationDismissal(model, dismissedEventIds, result.celebrationAckError);
        rerender();
      },
      setPetName: async (name) => {
        const response = await sendMessage({ type: "SET_PET_NAME", payload: { name } });
        if (!response.ok) {
          throw new Error(response.error);
        }
        model = mergePetNameSave(model, response.petState);
      },
      requestEmergencyEnd: async () => {
        let applied = false;
        try {
          const response = await sendMessage({ type: "END_SESSION", payload: { reason: "emergency" } });
          if (!response.ok) {
            throw new Error(response.error);
          }
          applied = await reloadModel("비상 종료 요청을 저장했습니다.");
        } catch (error) {
          applied = await reloadModel(error instanceof Error ? error.message : "비상 종료 요청을 저장하지 못했습니다.");
        }
        if (applied) {
          rerender();
        }
      },
      openOptions: () => {
        void chrome.runtime.openOptionsPage();
      }
    });
    root.scrollTop = scrollTop;
    if (focusKey) {
      root.querySelector<HTMLElement>(`[data-popup-focus="${focusKey}"]`)?.focus({ preventScroll: true });
    }
  };

  rerender();
  window.setInterval(() => {
    if (model.activeSession?.status === "active") {
      updateActiveSessionClock(root, model.activeSession);
      updatePendingEmergencyClock(root, model.pendingEmergency);
    }
  }, 1_000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    const relevantChange = (
      areaName === "local"
      && (hasOwn(changes, STORAGE_KEYS.local.activeSession) || hasOwn(changes, "pendingEmergency"))
    ) || (
      areaName === "sync"
      && (hasOwn(changes, STORAGE_KEYS.sync.siteLists) || hasOwn(changes, STORAGE_KEYS.sync.petState))
    );
    if (relevantChange) {
      const focusKey = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
        ? document.activeElement.dataset.popupFocus
        : undefined;
      void reloadModel(model.notice).then((applied) => {
        if (applied) {
          rerender(focusKey);
        }
      }).catch((error: unknown) => {
        model = {
          ...model,
          notice: error instanceof Error ? error.message : "세션 상태를 새로고침하지 못했습니다."
        };
        rerender(focusKey);
      });
    }
  });
}

export function renderPopupPreview(root: HTMLElement, petState: PetState, siteLists: SiteList[], sessionLog: Session[]): void {
  const streak = reconcileStreakFromSessions(petState, sessionLog, { now: new Date("2026-07-06T12:00:00+09:00") });
  const previewModel: PopupModel = {
    petState: awardBadges(streak.state, sessionLog, siteLists),
    activeSession: null,
    pendingEmergency: null,
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
    upgradeIntensity: async () => undefined,
    dismissCelebrations: async () => undefined,
    setPetName: async () => undefined,
    requestEmergencyEnd: async () => undefined,
    openOptions: () => undefined
  };

  renderPopup(root, previewModel, previewSelection, noopHandlers);
}

function assertOkResponse(response: unknown): void {
  if (!response || typeof response !== "object" || !("ok" in response)) {
    throw new Error("백그라운드 응답을 확인하지 못했습니다.");
  }

  const candidate = response as { ok: boolean; error?: string };
  if (!candidate.ok) {
    throw new Error(candidate.error ?? "요청을 처리하지 못했습니다.");
  }
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const root = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("#app");
if (root && document.body.dataset.page === "focuswhale-popup") {
  void bootstrapPopup(root).catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : "Popup failed to load.";
  });
}
