import { sendMessage } from "../../shared/messaging";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import { DEFAULT_SITE_LISTS, migrateSiteListsForCurrentDefaults } from "../../shared/siteLists";
import type { Intensity, PetState, Session, SiteList } from "../../shared/types";
import { awardBadges } from "../../pet/badges";
import { normalizePetState } from "../../pet/defaultState";
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
  streakStatus: "active" | "recoveryPending";
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
  const badges = document.createElement("div");
  badges.className = "flex flex-wrap gap-1.5";
  appendText(badges, "span", model.streakStatus === "recoveryPending" ? "복원 대기" : `${model.petState.streakDays}일 스트릭`, "badge badge-soft badge-primary shadow-sm");
  appendText(badges, "span", `프리즈 ${model.petState.streakFreezes}/2`, "badge badge-soft shadow-sm");
  stats.append(badges);
  appendText(stats, "p", `징표 ${model.petState.badges.length}개`, "text-sm text-base-content/70");

  if (model.awardedXp > 0) {
    appendText(stats, "p", `방금 집중 보상 +${model.awardedXp} XP`, "text-sm font-semibold text-success");
  }

  if (model.notice) {
    appendText(stats, "p", model.notice, "text-sm text-base-content/70");
  }

  body.append(stats);
  panel.append(body);
  root.append(panel);
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
  appendText(badges, "span", model.streakStatus === "recoveryPending" ? "복원 대기" : `${model.petState.streakDays}일 스트릭`, "badge badge-soft badge-primary shadow-sm");
  appendText(badges, "span", session.intensity, "badge badge-soft shadow-sm");
  stats.append(badges);
  appendText(stats, "p", model.notice ?? `프리즈 ${model.petState.streakFreezes}/2`, "text-sm text-base-content/70");
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
  const petState = awardBadges(streakResult.state, sessionLog, siteLists);
  const normalizedPetState = normalizePetState(petState);

  await Promise.all([
    setTyped("sync", STORAGE_KEYS.sync.petState, normalizedPetState),
    setTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY, streakResult.recovery)
  ]);

  return {
    petState: normalizedPetState,
    activeSession: await getActiveSession(),
    siteLists,
    awardedXp: settlement.awardedXp,
    streakStatus: streakResult.status,
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
