import { sendMessage, type FocusWhaleState } from "../../shared/messaging";
import { LatestRequestGuard } from "../../shared/latestRequest";
import { getUiLocale, translate } from "../../shared/i18n";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import { DEFAULT_SITE_LISTS, migrateSiteListsForCurrentDefaults, siteListDisplayName } from "../../shared/siteLists";
import type { Intensity, PetState, Session, SiteList } from "../../shared/types";
import { awardBadges } from "../../pet/badges";
import {
  growthProgress,
  DEFAULT_PET_NAME,
  petDisplayName,
  readPendingCelebrations,
  readGrowthLog,
  type GrowthEvent
} from "../../pet/growth";
import { mountPet, PET_RENDER_SIZES } from "../../pet/renderer";
import { reconcileStreakFromSessions } from "../../pet/streak";

const INTENSITY_ORDER: Record<Intensity, number> = {
  soft: 0,
  medium: 1,
  hard: 2
};
const MAX_MILESTONE_ROWS = 4;

type LocaleOverride = "ko" | "en";

const BADGE_KEY_BY_ID: Record<string, string> = {
  "first-session": "FirstSession",
  "first-hard": "FirstHard",
  "focus-10-hours": "Focus10Hours",
  "focus-50-hours": "Focus50Hours",
  "five-day-week": "FiveDayWeek",
  "allowlist-10": "Allowlist10",
  "streak-7": "Streak7",
  "streak-30": "Streak30",
  comeback: "Comeback",
  "first-schedule": "FirstSchedule",
  "steady-4w": "Steady4w"
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

function formatEndClock(deadline: number, localeOverride?: LocaleOverride): string {
  const locale = localeOverride ?? getUiLocale();
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(deadline));
}

export function intensityLabel(intensity: Intensity, localeOverride?: LocaleOverride): string {
  const keyByIntensity: Record<Intensity, string> = {
    soft: "intensitySoft",
    medium: "intensityMedium",
    hard: "intensityHard"
  };
  return translate(keyByIntensity[intensity], undefined, localeOverride);
}

export function coerceCustomDuration(rawValue: string, fallbackMinutes: number): number {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(240, Math.max(1, Math.round(parsed)))
    : fallbackMinutes;
}

export function stepDuration(minutes: number, delta: -1 | 1): number {
  return Math.min(240, Math.max(1, Math.round(minutes) + delta));
}

function renderPopupHeader(root: HTMLElement, model: PopupModel, handlers: PopupHandlers): void {
  const header = document.createElement("header");
  header.className = "flex h-12 shrink-0 items-center justify-between px-4";
  appendText(header, "p", "FocusWhale", "text-sm font-bold");

  if (model.activeSession?.status === "active") {
    appendText(
      header,
      "span",
      model.activeSession.intensity === "hard" ? intensityLabel("hard") : translate("popupActiveStatus"),
      model.activeSession.intensity === "hard"
        ? "badge badge-error badge-soft"
        : "badge badge-primary badge-soft"
    );
  } else if (model.celebrations.length > 0) {
    appendText(header, "span", translate("popupCompletionLabel"), "badge badge-success badge-soft");
  } else {
    header.append(createButton(translate("commonSettings"), "btn btn-ghost btn-sm min-h-10 px-3", handlers.openOptions));
  }
  root.append(header);
}

function progressValue(session: Session, now = Date.now()): number {
  const totalMs = Math.max(1, session.endsAt - session.startedAt);
  const elapsedMs = Math.min(totalMs, Math.max(0, now - session.startedAt));

  return Math.round((elapsedMs / totalMs) * 100);
}

function petStateLine(petState: PetState): string {
  return translate(`popupPetStageLine${petState.stage}`);
}

function streakChipText(model: PopupModel): string {
  if (model.streakStatus === "resting") {
    return translate("popupStreakResting");
  }

  if (model.streakStatus === "fresh") {
    return translate("popupStreakFresh");
  }

  return translate("popupStreakDays", String(model.petState.streakDays));
}

function localizedStageName(stage: PetState["stage"], localeOverride?: LocaleOverride): string {
  return translate(`petStageName${stage}`, undefined, localeOverride);
}

function localizedBadgeName(id: string, localeOverride?: LocaleOverride): string {
  const key = BADGE_KEY_BY_ID[id];
  return key ? translate(`badge${key}Name`, undefined, localeOverride) : id;
}

function localizedBadgeDescription(id: string, localeOverride?: LocaleOverride): string {
  const key = BADGE_KEY_BY_ID[id];
  return key
    ? translate(`badge${key}Description`, undefined, localeOverride)
    : translate("badgeFallbackDescription", undefined, localeOverride);
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
  panel.className = "fw-pet-hero fw-atmosphere mx-3 grid min-h-28 shrink-0 grid-cols-[104px_1fr] items-center overflow-hidden rounded-box border border-primary/10 px-3";

  const petMount = document.createElement("div");
  petMount.className = "grid place-items-center";
  mountPet(petMount, model.petState, model.awardedXp > 0 ? "happy" : "idle");

  const stats = document.createElement("div");
  stats.className = "min-w-0 space-y-1.5";
  appendText(stats, "p", petDisplayName(model.petState.name), "truncate text-sm font-bold");
  appendText(stats, "p", petStateLine(model.petState), "truncate text-xs text-base-content/65");
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap gap-1";
  appendText(badges, "span", streakChipText(model), "badge badge-primary badge-soft badge-sm");
  appendText(badges, "span", translate("popupFreezeCount", String(model.petState.streakFreezes)), "badge badge-soft badge-sm");
  stats.append(badges);

  if (model.notice) {
    appendText(stats, "p", model.notice, "truncate text-xs text-base-content/65");
  }

  panel.append(petMount, stats);
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
  panel.className = "flex min-h-0 flex-1 flex-col";
  const body = document.createElement("div");
  body.className = sessionEvent ? "flex flex-col gap-3" : "grid flex-1 content-start gap-3 px-4 pt-4";

  if (sessionEvent) {
    body.append(renderSessionGrowthOverview(model, sessionEvent, animationTasks));
  } else {
    appendText(body, "p", translate("popupCelebrationRecentChange"), "text-sm font-semibold text-primary");
  }

  const additionalContent = document.createElement("div");
  additionalContent.className = sessionEvent ? "grid gap-3 px-4" : "contents";
  if (milestoneEvents.length > 0) {
    additionalContent.append(renderMilestoneOverview(milestoneEvents, animationTasks));
  }

  if (model.celebrations.length > visibleEvents.length) {
    appendText(
      additionalContent,
      "p",
      translate("popupCelebrationMoreChanges", String(model.celebrations.length - visibleEvents.length)),
      "text-xs"
    );
  }
  if (!model.petState.name && visibleEvents.some((event) => event.type === "stage_up")) {
    additionalContent.append(renderNamePrompt(handlers));
  }
  if (model.celebrationAckError) {
    const notice = document.createElement("div");
    notice.className = "alert alert-error alert-soft text-sm";
    notice.setAttribute("role", "alert");
    appendText(notice, "span", model.celebrationAckError);
    additionalContent.append(notice);
  }
  if (additionalContent.childElementCount > 0) {
    body.append(additionalContent);
  }
  const actions = document.createElement("div");
  actions.className = "mt-auto shrink-0 p-4 pt-2";
  const dismiss = createButton(translate("popupCelebrationConfirm"), "btn btn-primary min-h-11 w-full", () => {
    dismiss.disabled = true;
    dismiss.textContent = translate("popupSaving");
    void handlers.dismissCelebrations(visibleEvents.map((event) => event.id)).finally(() => {
      if (dismiss.isConnected) {
        dismiss.disabled = false;
        dismiss.textContent = translate("commonRetry");
      }
    });
  });
  actions.append(dismiss);
  panel.append(body, actions);
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
  wrap.className = "flex flex-col gap-4";

  const hero = document.createElement("div");
  hero.className = "fw-pet-hero fw-atmosphere mx-3 grid min-h-48 grid-cols-[120px_1fr] items-center overflow-hidden rounded-box border border-primary/10 px-3";
  const petSlot = document.createElement("div");
  petSlot.className = "grid place-items-center";
  mountPet(petSlot, model.petState, "celebrate", { size: PET_RENDER_SIZES.large });
  const copy = document.createElement("div");
  copy.className = "space-y-1";
  appendText(
    copy,
    "p",
    `${translate("commonMinutes", String(event.minutes ?? 0))} · ${translate("popupCompletionLabel")}`,
    "text-xs font-bold uppercase text-primary"
  );
  appendText(copy, "h2", translate("popupCompletionHeading"), "break-keep text-2xl font-black leading-tight");
  hero.append(petSlot, copy);
  wrap.append(hero);

  const content = document.createElement("div");
  content.className = "grid gap-4 px-4";
  const stats = document.createElement("div");
  stats.className = "stats stats-horizontal w-full overflow-hidden bg-base-200 shadow-sm";
  const gained = document.createElement("div");
  gained.className = "stat px-4 py-3";
  appendText(gained, "div", translate("popupCompletionThisSession"), "stat-title");
  appendText(gained, "div", `+${xpDelta} XP`, "stat-value text-2xl text-primary tabular-nums");
  const stage = document.createElement("div");
  stage.className = "stat min-w-0 px-4 py-3";
  appendText(stage, "div", translate("popupCompletionCurrentStage"), "stat-title");
  appendText(stage, "div", localizedStageName(stageTo), "stat-value truncate text-lg");
  stats.append(gained, stage);
  content.append(stats);

  const progress = document.createElement("div");
  progress.className = "grid gap-2";
  const progressCopy = document.createElement("div");
  progressCopy.className = "flex justify-between gap-3 text-xs font-bold";
  appendText(
    progressCopy,
    "span",
    stageFrom === stageTo ? translate("popupCompletionUntilNextGrowth") : translate("popupCompletionReachedNewStage")
  );
  appendText(progressCopy, "span", `${clampPercent(progressAfter)}%`, "tabular-nums");
  const track = document.createElement("div");
  track.className = "h-2 overflow-hidden rounded-full bg-base-200";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(clampPercent(progressAfter)));
  const fill = document.createElement("div");
  fill.className = "h-full rounded-full bg-primary";
  fill.style.width = `${clampPercent(progressBefore)}%`;
  fill.style.transition = prefersReducedMotion() ? "none" : "width 900ms ease";
  track.append(fill);
  progress.append(progressCopy, track);
  content.append(progress);
  wrap.append(content);

  animationTasks.push(() => {
    animateWidth(fill, progressAfter);
  });

  return wrap;
}

function renderMilestoneOverview(events: readonly GrowthEvent[], animationTasks: Array<() => void>): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "grid gap-2";

  events.slice(0, MAX_MILESTONE_ROWS).forEach((event, index) => {
    const row = document.createElement("div");
    row.className = "flex items-start justify-between gap-3 rounded-field bg-base-200 px-3 py-2 text-sm";
    row.style.opacity = "0";
    row.style.transform = "translateY(6px)";
    row.style.transition = prefersReducedMotion() ? "none" : "opacity 360ms ease, transform 360ms ease";
    const copy = document.createElement("div");
    copy.className = "min-w-0";
    appendText(copy, "p", milestoneTitle(event), "font-semibold");
    appendText(copy, "p", event.type === "badge_earned" && event.badgeId
      ? localizedBadgeDescription(event.badgeId)
      : localizedGrowthEventText(event));
    appendText(row, "span", translate("goal8PopupMilestoneNew"), "badge badge-primary badge-soft badge-sm shrink-0");
    row.prepend(copy);
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
  appendText(form, "p", translate("popupNamePrompt"), "text-sm font-semibold");
  const input = document.createElement("input");
  input.className = "input min-h-10 w-full";
  input.placeholder = translate("defaultPetName");
  input.maxLength = 24;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-soft min-h-10";
  submit.textContent = translate("popupNameSubmit");
  form.append(input, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim() || DEFAULT_PET_NAME;
    void handlers.setPetName(name)
      .then(() => {
        form.replaceChildren();
        appendText(form, "p", translate("popupNameSuccess", petDisplayName(name)), "text-sm font-semibold");
      })
      .catch((error: unknown) => {
        const existingError = form.querySelector("[role='alert']");
        existingError?.remove();
        appendText(
          form,
          "p",
          error instanceof Error ? localizePopupRuntimeError(error.message, "popupNameSaveError") : translate("popupNameSaveError"),
          "text-error text-sm"
        ).setAttribute("role", "alert");
      });
  });
  return form;
}

function milestoneTitle(event: GrowthEvent): string {
  if (event.type === "stage_up") {
    return translate("popupMilestoneStage");
  }
  if (event.type === "half_way") {
    return translate("popupMilestoneHalfWay");
  }
  if (event.type === "badge_earned") {
    return event.badgeId
      ? translate("popupMilestoneNewBadgeNamed", localizedBadgeName(event.badgeId))
      : translate("popupMilestoneNewBadge");
  }
  if (event.type === "freeze_granted") {
    return translate("popupMilestoneFreeze");
  }
  if (event.type === "freeze_used") {
    return translate("popupMilestoneStreakProtected");
  }
  if (event.type === "streak_restored") {
    return translate("popupMilestoneStreakRestored");
  }
  if (event.type === "streak_fresh_start") {
    return translate("popupMilestoneFreshStart");
  }

  return translate("popupMilestoneGrowthLog");
}

export function localizedGrowthEventText(event: GrowthEvent, localeOverride?: LocaleOverride): string {
  const minutes = String(event.minutes ?? 0);
  const xpDelta = String(event.xpDelta ?? 0);
  if (event.type === "session_completed") {
    return translate(
      "growthSessionCompleted",
      [minutes, xpDelta, intensityLabel(event.intensity ?? "medium", localeOverride)],
      localeOverride
    );
  }
  if (event.type === "stage_up") {
    return translate(
      "growthStageUp",
      localizedStageName(event.stageTo ?? 0, localeOverride),
      localeOverride
    );
  }
  if (event.type === "half_way") {
    return translate(
      "growthHalfWay",
      localizedStageName(event.stageTo ?? 0, localeOverride),
      localeOverride
    );
  }
  if (event.type === "badge_earned") {
    return event.badgeId
      ? translate("growthBadgeEarned", localizedBadgeName(event.badgeId, localeOverride), localeOverride)
      : translate("growthBadgeEarnedGeneric", undefined, localeOverride);
  }
  if (event.type === "freeze_granted") {
    return translate("growthFreezeGranted", undefined, localeOverride);
  }
  if (event.type === "freeze_used") {
    return translate("growthFreezeUsed", undefined, localeOverride);
  }
  if (event.type === "streak_restored") {
    return translate("growthStreakRestored", String(event.streakTo ?? 1), localeOverride);
  }
  if (event.type === "streak_rest") {
    return translate("growthStreakRest", undefined, localeOverride);
  }
  if (event.type === "streak_fresh_start") {
    return translate("growthStreakFreshStart", undefined, localeOverride);
  }
  if (event.type === "session_ended_early") {
    return translate("growthSessionEndedEarly", undefined, localeOverride);
  }
  return translate("growthMigration", undefined, localeOverride);
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
  panel.className = "fw-pet-hero fw-atmosphere mx-3 flex min-h-56 shrink-0 flex-col items-center justify-center overflow-hidden rounded-box border border-primary/10 px-4 text-center";

  const progress = document.createElement("div");
  progress.id = "active-session-progress";
  progress.className = "radial-progress grid place-items-center rounded-full bg-base-300/35 text-primary [--size:7rem] [--thickness:0.2rem]";
  progress.style.setProperty("--value", String(progressValue(session)));
  progress.setAttribute("aria-label", translate("popupActiveProgressLabel"));
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", String(progressValue(session)));
  progress.setAttribute("role", "progressbar");
  const petMount = document.createElement("div");
  mountPet(petMount, model.petState, "focus");
  progress.append(petMount);

  const remaining = appendText(
    panel,
    "h1",
    formatRemaining(session),
    "mt-3 w-[7ch] text-center text-5xl font-black leading-tight tabular-nums"
  );
  remaining.id = "active-session-remaining";
  remaining.dataset.compactClock = "true";
  appendText(
    panel,
    "p",
    translate("goal8PopupEndsAt", formatEndClock(session.endsAt)),
    "mt-1 text-xs text-base-content/60"
  );
  if (model.notice) {
    appendText(panel, "p", model.notice, "mt-1 max-w-full truncate text-xs text-base-content/60");
  }
  panel.prepend(progress);
  root.append(panel);
}

function renderActiveSession(root: HTMLElement, model: PopupModel, handlers: PopupHandlers): void {
  if (!model.activeSession) {
    return;
  }

  const session = model.activeSession;
  const section = document.createElement("section");
  section.className = "grid flex-1 content-start gap-3 px-4 pt-4";

  const facts = document.createElement("div");
  facts.dataset.popupSessionFacts = "true";
  facts.className = "grid grid-cols-3 overflow-hidden rounded-box border border-base-100/10 bg-base-200 text-center";
  const selectedList = model.siteLists.find((siteList) => siteList.id === session.listId);
  const factValues = [
    [translate("goal8PopupTargets"), selectedList ? siteListDisplayName(selectedList) : translate("listNone")],
    [translate("commonMode"), intensityLabel(session.intensity)],
    [
      translate("goal8PopupSource"),
      translate(session.source === "schedule" ? "goal8PopupSourceSchedule" : "goal8PopupSourceManual")
    ]
  ] as const;
  factValues.forEach(([label, value], index) => {
    const fact = document.createElement("div");
    fact.className = `${index === 1 ? "border-x border-base-100/10 " : ""}min-h-16 min-w-0 p-2.5`;
    appendText(fact, "p", label, "text-[11px] text-base-content/50");
    appendText(fact, "p", value, "mt-1 break-words text-[11px] font-bold leading-4");
    facts.append(fact);
  });
  section.append(facts);

  const upgrades = (["soft", "medium", "hard"] as Intensity[]).filter(
    (intensity) => INTENSITY_ORDER[intensity] > INTENSITY_ORDER[model.activeSession?.intensity ?? "hard"]
  );

  const actions = document.createElement("details");
  actions.className = "collapse collapse-arrow border border-base-100/10 bg-base-200";
  appendText(
    actions,
    "summary",
    translate("goal8PopupUpgradeSummary"),
    "collapse-title min-h-11 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  );
  const actionContent = document.createElement("div");
  actionContent.className = "collapse-content grid gap-2";

  appendText(
    actionContent,
    "p",
    upgrades.length === 0 ? translate("popupActiveStrongestIntensity") : translate("popupActiveUpgradeHint"),
    "text-xs text-base-content/60"
  );

  for (const intensity of upgrades) {
    actionContent.append(createButton(translate("popupActiveUpgradeButton", intensityLabel(intensity)), "btn btn-soft min-h-10", () => {
      void handlers.upgradeIntensity(intensity);
    }));
  }

  if (session.intensity === "hard") {
    renderHardEmergencyControls(actionContent, model, handlers);
  }

  actions.append(actionContent);
  section.append(actions);
  appendText(section, "p", translate("goal8PopupImmutableNote"), "text-center text-xs text-base-content/50");
  root.append(section);
}

function renderHardEmergencyControls(
  container: HTMLElement,
  model: PopupModel,
  handlers: PopupHandlers
): void {
  const session = model.activeSession;
  if (!session || session.intensity !== "hard") {
    return;
  }

  const pending = model.pendingEmergency?.sessionId === session.id ? model.pendingEmergency : null;
  const wrap = document.createElement("div");
  wrap.className = "grid gap-2 border-t border-base-100/10 pt-3";
  if (pending) {
    const notice = document.createElement("div");
    notice.className = "alert alert-warning alert-soft text-sm shadow-none";
    notice.setAttribute("role", "status");
    appendText(notice, "span", translate("popupEmergencySaved"));
    const remaining = appendText(
      wrap,
      "p",
      translate("popupEmergencyUntilEnd", formatDeadline(pending.dueAt)),
      "text-sm font-semibold tabular-nums"
    );
    remaining.id = "popup-emergency-remaining";
    wrap.prepend(notice);
    container.append(wrap);
    return;
  }

  appendText(wrap, "p", translate("popupEmergencyRule"), "text-xs");
  wrap.append(createButton(translate("popupEmergencyRequest"), "btn btn-error btn-soft min-h-10 shadow-sm", () => {
    const activeSection = container.closest<HTMLElement>("section");
    if (activeSection) {
      renderHardEmergencyConfirmation(activeSection, model, handlers);
    }
  }));
  container.append(wrap);
}

function renderHardEmergencyConfirmation(
  section: HTMLElement,
  model: PopupModel,
  handlers: PopupHandlers
): void {
  const facts = section.querySelector<HTMLElement>("[data-popup-session-facts]");
  const warning = document.createElement("div");
  warning.className = "alert alert-error alert-soft text-sm shadow-none";
  warning.setAttribute("role", "note");
  appendText(warning, "span", translate("popupEmergencyConfirmWarning"));
  const buttons = document.createElement("div");
  buttons.className = "grid gap-2";
  const confirm = createButton(translate("popupEmergencySchedule"), "btn btn-error btn-soft min-h-11 w-full", () => {
    confirm.disabled = true;
    confirm.textContent = translate("popupEmergencyScheduling");
    void handlers.requestEmergencyEnd();
  });
  const keepFocusing = createButton(translate("goal8PopupKeepFocusing"), "btn btn-primary min-h-11 w-full", () => {
    const root = section.parentElement;
    section.remove();
    if (root) {
      renderActiveSession(root, model, handlers);
    }
  });
  buttons.append(keepFocusing, confirm);
  section.className = "grid flex-1 content-start gap-3 px-4 pt-4";
  section.replaceChildren();
  if (facts) {
    section.append(facts);
  }
  section.append(warning);
  appendText(section, "p", translate("popupEmergencyRule"), "text-xs leading-5 text-base-content/60");
  section.append(buttons);
  keepFocusing.focus({ preventScroll: true });
}

function renderSessionForm(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  const form = document.createElement("form");
  form.className = "flex min-h-0 flex-1 flex-col";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handlers.startSession();
  });

  const content = document.createElement("section");
  content.className = "flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3";
  const heading = document.createElement("div");
  heading.className = "space-y-1";
  appendText(heading, "h1", translate("popupFormHeading"), "text-xl font-black");
  appendText(heading, "p", translate("popupFormDescription"), "text-xs text-base-content/60");
  content.append(heading);

  const durationFieldset = document.createElement("fieldset");
  durationFieldset.className = "grid gap-1.5";
  appendText(durationFieldset, "legend", translate("popupFormDuration"), "text-xs font-bold");
  const durationStepper = document.createElement("div");
  durationStepper.className = "join grid grid-cols-[44px_1fr_44px]";
  durationStepper.setAttribute("role", "group");
  durationStepper.setAttribute("aria-label", translate("popupFormDurationSelection"));
  const decrement = createButton("−", "btn join-item min-h-11 text-xl", () => {
    const durationMinutes = stepDuration(selection.durationMinutes, -1);
    handlers.updateSelection(
      { durationMinutes, customMinutes: String(durationMinutes) },
      true,
      "duration-decrement"
    );
  });
  decrement.dataset.popupFocus = "duration-decrement";
  decrement.setAttribute("aria-label", translate("goal8PopupDurationDecrease"));
  decrement.disabled = selection.durationMinutes <= 1;
  const durationValue = document.createElement("div");
  durationValue.className = "join-item grid min-h-11 place-items-center border border-base-100/10 bg-base-200";
  appendText(
    durationValue,
    "span",
    translate("commonMinutes", String(selection.durationMinutes)),
    "text-2xl font-black tabular-nums"
  );
  const increment = createButton("+", "btn join-item min-h-11 text-xl", () => {
    const durationMinutes = stepDuration(selection.durationMinutes, 1);
    handlers.updateSelection(
      { durationMinutes, customMinutes: String(durationMinutes) },
      true,
      "duration-increment"
    );
  });
  increment.dataset.popupFocus = "duration-increment";
  increment.setAttribute("aria-label", translate("goal8PopupDurationIncrease"));
  increment.disabled = selection.durationMinutes >= 240;
  durationStepper.append(decrement, durationValue, increment);
  durationFieldset.append(durationStepper);
  content.append(durationFieldset);

  const selectedList = model.siteLists.find((siteList) => siteList.id === selection.listId) ?? model.siteLists[0];
  const listLabel = document.createElement("label");
  listLabel.className = "flex min-h-11 items-center justify-between gap-3 rounded-field border border-base-100/10 bg-base-200 px-3";
  const listCopy = document.createElement("span");
  listCopy.className = "min-w-0 flex-1";
  appendText(listCopy, "span", translate("goal8PopupTargets"), "block text-xs text-base-content/55");
  const listSelect = document.createElement("select");
  listSelect.name = "siteList";
  listSelect.dataset.popupFocus = "site-list";
  listSelect.className = "block h-5 w-full min-w-0 appearance-none truncate bg-transparent text-sm font-bold outline-none";
  listSelect.setAttribute("aria-label", translate("goal8PopupTargets"));
  for (const siteList of model.siteLists) {
    const option = document.createElement("option");
    option.value = siteList.id;
    option.textContent = siteListDisplayName(siteList);
    option.selected = siteList.id === selection.listId;
    listSelect.append(option);
  }
  listSelect.addEventListener("change", () => handlers.updateSelection({ listId: listSelect.value }, true, "site-list"));
  listCopy.append(listSelect);
  listLabel.append(listCopy);
  if (selectedList) {
    appendText(
      listLabel,
      "span",
      translate("goal8PopupSiteCount", String(selectedList.domains.length)),
      "shrink-0 text-xs text-base-content/55"
    );
  }
  content.append(listLabel);

  const intensityFieldset = document.createElement("fieldset");
  intensityFieldset.className = "grid gap-1.5";
  appendText(intensityFieldset, "legend", translate("popupFormBlockingMethod"), "text-xs font-bold");
  const intensities = document.createElement("div");
  intensities.className = "join grid grid-cols-3";
  intensities.setAttribute("role", "group");
  intensities.setAttribute("aria-label", translate("popupFormIntensitySelection"));
  for (const intensity of ["soft", "medium", "hard"] as Intensity[]) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "intensity";
    radio.dataset.popupFocus = `intensity-${intensity}`;
    radio.className = "join-item btn h-auto min-h-11 min-w-0 whitespace-normal px-1 py-1 text-xs leading-4";
    radio.setAttribute("aria-label", intensityLabel(intensity));
    radio.checked = selection.intensity === intensity;
    radio.addEventListener("change", () => {
      handlers.updateSelection({ intensity }, true, `intensity-${intensity}`);
    });
    intensities.append(radio);
  }
  intensityFieldset.append(intensities);
  const selectedIntensityDescription = selection.intensity === "soft"
    ? "onboardingSoftBody"
    : selection.intensity === "medium"
      ? "onboardingMediumBody"
      : selectedList?.mode === "allowlist"
        ? "onboardingHardAllowlistBody"
        : "onboardingHardBody";
  appendText(intensityFieldset, "p", translate(selectedIntensityDescription), "text-xs text-base-content/55");
  content.append(intensityFieldset);

  if (selection.intensity === "hard") {
    const hardNote = document.createElement("div");
    hardNote.className = "alert alert-warning alert-soft py-2 text-xs";
    appendText(hardNote, "span", translate("popupFormHardNote"));
    content.append(hardNote);
  }

  form.append(content);
  const footer = document.createElement("footer");
  footer.className = "mt-auto shrink-0 p-4 pt-2";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.dataset.startSession = "true";
  submit.className = "btn btn-primary min-h-11 w-full shadow-sm";
  submit.textContent = translate("popupStartMinutes", String(selection.durationMinutes));
  footer.append(submit);
  form.append(footer);
  root.append(form);
}

export function renderPopup(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  root.replaceChildren();
  root.className = "flex h-[580px] w-[360px] flex-col overflow-y-auto bg-base-300 text-base-content shadow-xl";
  renderPopupHeader(root, model, handlers);

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
    const milestones = events
      .filter((event) => (
        event.id !== sessionEvent.id
        && Boolean(sessionEvent.sessionId)
        && event.sessionId === sessionEvent.sessionId
      ))
      .slice(0, MAX_MILESTONE_ROWS);
    return [sessionEvent, ...milestones];
  }
  return events.slice(0, MAX_MILESTONE_ROWS);
}

export function mergePetNameSave(model: PopupModel, petState: PetState): PopupModel {
  return { ...model, petState };
}

export async function dismissPopupCelebrations(
  model: PopupModel,
  acknowledge: (eventIds: readonly string[]) => Promise<void> = acknowledgePopupCelebrations,
  localeOverride?: LocaleOverride
): Promise<PopupModel> {
  try {
    await acknowledge(model.celebrations.map((event) => event.id));
    return clearPopupCelebrations({ ...model, celebrationAckError: undefined });
  } catch {
    return {
      ...model,
      celebrationAckError: translate("popupCelebrationAckError", undefined, localeOverride)
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

export function activeSessionClockSnapshot(
  session: Session,
  now = Date.now(),
  localeOverride?: LocaleOverride
): { remainingText: string; progress: number } {
  return {
    remainingText: translate("popupActiveRemaining", formatRemaining(session, now), localeOverride),
    progress: progressValue(session, now)
  };
}

export function activeSessionTimerValue(session: Session, now = Date.now()): string {
  return formatRemaining(session, now);
}

export function updateActiveSessionClock(root: HTMLElement, session: Session, now = Date.now()): void {
  const snapshot = activeSessionClockSnapshot(session, now);
  const remaining = root.querySelector<HTMLElement>("#active-session-remaining");
  if (remaining) {
    remaining.textContent = remaining.dataset.compactClock === "true"
      ? activeSessionTimerValue(session, now)
      : snapshot.remainingText;
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
    remaining.textContent = translate("popupEmergencyUntilEnd", formatDeadline(pendingEmergency.dueAt, now));
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
          applied = await reloadModel(translate("popupNoticeSessionStarted"));
        } catch (error) {
          applied = await reloadModel(
            error instanceof Error
              ? localizePopupRuntimeError(error.message, "popupNoticeSessionStartFailed")
              : translate("popupNoticeSessionStartFailed")
          );
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
          applied = await reloadModel(translate("popupNoticeIntensityUpgraded"));
        } catch (error) {
          applied = await reloadModel(
            error instanceof Error
              ? localizePopupRuntimeError(error.message, "popupNoticeIntensityUpgradeFailed")
              : translate("popupNoticeIntensityUpgradeFailed")
          );
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
          applied = await reloadModel(translate("popupNoticeEmergencySaved"));
        } catch (error) {
          applied = await reloadModel(
            error instanceof Error
              ? localizePopupRuntimeError(error.message, "popupNoticeEmergencySaveFailed")
              : translate("popupNoticeEmergencySaveFailed")
          );
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
          notice: error instanceof Error
            ? localizePopupRuntimeError(error.message, "popupNoticeRefreshFailed")
            : translate("popupNoticeRefreshFailed")
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
    notice: translate("popupDevelopmentPreview")
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
    throw new Error(translate("popupErrorInvalidBackgroundResponse"));
  }

  const candidate = response as { ok: boolean; error?: string };
  if (!candidate.ok) {
    throw new Error(candidate.error ?? translate("popupErrorRequestFailed"));
  }
}

function localizePopupRuntimeError(error: string, fallbackKey: string): string {
  const keyByMessage: Record<string, string> = {
    "A session is already running. Use the intensity upgrade action instead.": "popupErrorSessionAlreadyRunning",
    "No active session is available for an intensity upgrade.": "popupErrorNoActiveSessionForUpgrade",
    "Running sessions can only raise intensity.": "popupErrorIntensityCanOnlyIncrease",
    "Emergency end is only available during an active hard session.": "popupErrorEmergencyUnavailable",
    "\uc774\ubc88 \uc8fc \ube44\uc0c1 \uc885\ub8cc \uc694\uccad\uc740 \uc774\ubbf8 \uc0ac\uc6a9\ud588\uc2b5\ub2c8\ub2e4.": "popupErrorEmergencyAlreadyUsed"
  };
  const key = keyByMessage[error];
  if (key) {
    return translate(key);
  }

  const localKeys = ["popupErrorInvalidBackgroundResponse", "popupErrorRequestFailed"];
  return localKeys.some((localKey) => error === translate(localKey)) ? error : translate(fallbackKey);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const root = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("#app");
if (typeof document !== "undefined") {
  document.documentElement.lang = translate("appLocale");
  document.title = translate("popupDocumentTitle");
}
if (root && document.body.dataset.page === "focuswhale-popup") {
  void bootstrapPopup(root).catch((error: unknown) => {
    root.textContent = error instanceof Error
      ? localizePopupRuntimeError(error.message, "popupLoadFailed")
      : translate("popupLoadFailed");
  });
}
