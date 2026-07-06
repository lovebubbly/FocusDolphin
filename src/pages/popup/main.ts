import { sendMessage } from "../../shared/messaging";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
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

const DEFAULT_SITE_LISTS: SiteList[] = [
  {
    id: "default-blocklist",
    name: "기본 차단 목록",
    mode: "blocklist",
    domains: ["youtube.com", "instagram.com", "x.com"]
  },
  {
    id: "deep-work-allowlist",
    name: "집중 허용 목록",
    mode: "allowlist",
    domains: ["docs.google.com", "notion.so"]
  }
];

function minutesRemaining(session: Session, now = Date.now()): number {
  return Math.max(0, Math.ceil((session.endsAt - now) / 60_000));
}

function formatRemaining(session: Session): string {
  const totalMinutes = minutesRemaining(session);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

function makeSession(listId: string, intensity: Intensity, durationMinutes: number): Session {
  const startedAt = Date.now();

  return {
    id: `popup-dev-${startedAt}`,
    source: "manual",
    listId,
    intensity,
    startedAt,
    endsAt: startedAt + durationMinutes * 60_000,
    status: "active",
    snoozeCount: 0,
    nextSnoozeDelayMin: 5
  };
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
  panel.className = "pet-panel";

  const petMount = document.createElement("div");
  petMount.className = "pet-mount";
  panel.append(petMount);
  mountPet(petMount, model.petState, model.awardedXp > 0 ? "happy" : "idle");

  const stats = document.createElement("div");
  stats.className = "pet-stats";
  appendText(stats, "p", model.streakStatus === "recoveryPending" ? "복원 대기" : `${model.petState.streakDays}일 스트릭`, "streak-value");
  appendText(stats, "p", `프리즈 ${model.petState.streakFreezes}/2`, "muted");
  appendText(stats, "p", `징표 ${model.petState.badges.length}개`, "muted");

  if (model.awardedXp > 0) {
    appendText(stats, "p", `방금 집중 보상 +${model.awardedXp} XP`, "reward-summary");
  }

  if (model.notice) {
    appendText(stats, "p", model.notice, "notice");
  }

  panel.append(stats);
  root.append(panel);
}

function renderActiveSession(root: HTMLElement, model: PopupModel, handlers: PopupHandlers): void {
  if (!model.activeSession) {
    return;
  }

  const section = document.createElement("section");
  section.className = "session-panel";
  appendText(section, "h2", "진행 중", "panel-title");
  appendText(section, "p", `남은 시간 ${formatRemaining(model.activeSession)}`, "session-remaining");
  appendText(section, "p", `현재 강도 ${model.activeSession.intensity}`, "muted");

  const upgrades = (["soft", "medium", "hard"] as Intensity[]).filter(
    (intensity) => INTENSITY_ORDER[intensity] > INTENSITY_ORDER[model.activeSession?.intensity ?? "hard"]
  );

  const actions = document.createElement("div");
  actions.className = "button-row";

  if (upgrades.length === 0) {
    appendText(actions, "p", "이미 가장 단단한 설정입니다.", "muted");
  }

  for (const intensity of upgrades) {
    actions.append(createButton(`${intensity}로 상향`, "secondary-button", () => {
      void handlers.upgradeIntensity(intensity);
    }));
  }

  section.append(actions);
  root.append(section);
}

function renderSessionForm(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  const form = document.createElement("form");
  form.className = "session-panel";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handlers.startSession();
  });

  appendText(form, "h2", "집중 시작", "panel-title");

  const listLabel = appendText(form, "label", "목록", "field-label") as HTMLLabelElement;
  const listSelect = document.createElement("select");
  listSelect.name = "siteList";
  listSelect.className = "select-control";
  for (const siteList of model.siteLists) {
    const option = document.createElement("option");
    option.value = siteList.id;
    option.textContent = siteList.name;
    option.selected = siteList.id === selection.listId;
    listSelect.append(option);
  }
  listSelect.addEventListener("change", () => handlers.updateSelection({ listId: listSelect.value }));
  listLabel.append(listSelect);

  appendText(form, "p", "시간", "field-label");
  const durations = document.createElement("div");
  durations.className = "segmented";
  for (const minutes of [15, 25, 50, 90]) {
    const button = createButton(`${minutes}`, selection.durationMinutes === minutes ? "segment active" : "segment", () => {
      handlers.updateSelection({ durationMinutes: minutes, customMinutes: "" });
    });
    durations.append(button);
  }
  form.append(durations);

  const customLabel = appendText(form, "label", "직접 입력", "field-label") as HTMLLabelElement;
  const customInput = document.createElement("input");
  customInput.type = "number";
  customInput.min = "1";
  customInput.max = "240";
  customInput.inputMode = "numeric";
  customInput.className = "number-control";
  customInput.value = selection.customMinutes;
  customInput.placeholder = "분";
  customInput.addEventListener("input", () => {
    const parsed = Number(customInput.value);
    handlers.updateSelection({
      customMinutes: customInput.value,
      durationMinutes: Number.isFinite(parsed) && parsed > 0 ? Math.min(240, Math.round(parsed)) : selection.durationMinutes
    });
  });
  customLabel.append(customInput);

  appendText(form, "p", "강도", "field-label");
  const intensities = document.createElement("div");
  intensities.className = "segmented";
  for (const intensity of ["soft", "medium", "hard"] as Intensity[]) {
    const button = createButton(intensity, selection.intensity === intensity ? "segment active" : "segment", () => {
      handlers.updateSelection({ intensity });
    });
    intensities.append(button);
  }
  form.append(intensities);

  if (selection.intensity === "hard") {
    appendText(form, "p", "hard는 종료까지 해제할 수 없습니다.", "hard-note");
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary-button";
  submit.textContent = `${selection.durationMinutes}분 시작`;
  form.append(submit);
  root.append(form);
}

export function renderPopup(root: HTMLElement, model: PopupModel, selection: SelectionState, handlers: PopupHandlers): void {
  root.replaceChildren();
  root.className = "popup-shell";
  renderPetPanel(root, model);

  if (model.activeSession?.status === "active") {
    renderActiveSession(root, model, handlers);
  } else {
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
  const [siteListsValue = DEFAULT_SITE_LISTS, sessionLog = [], streakLedgerValue] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.siteLists),
    getTyped("local", STORAGE_KEYS.local.sessionLog),
    getTyped<StreakRecoveryState>("local", STREAK_LEDGER_KEY)
  ]);

  const siteLists = siteListsValue.length > 0 ? siteListsValue : DEFAULT_SITE_LISTS;
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
          await sendMessage({
            type: "START_SESSION",
            payload: {
              listId: selection.listId,
              intensity: selection.intensity,
              durationMinutes: selection.durationMinutes,
              source: "manual"
            }
          });
        } catch {
          await setTyped("local", STORAGE_KEYS.local.activeSession, makeSession(selection.listId, selection.intensity, selection.durationMinutes));
        }
        model = await loadPopupModel("세션을 시작했습니다.");
        rerender();
      },
      upgradeIntensity: async (intensity) => {
        if (!model.activeSession || INTENSITY_ORDER[intensity] <= INTENSITY_ORDER[model.activeSession.intensity]) {
          return;
        }

        const remaining = Math.max(1, minutesRemaining(model.activeSession));
        try {
          await sendMessage({
            type: "START_SESSION",
            payload: {
              listId: model.activeSession.listId,
              intensity,
              durationMinutes: remaining,
              source: model.activeSession.source
            }
          });
        } catch {
          await setTyped("local", STORAGE_KEYS.local.activeSession, {
            ...model.activeSession,
            intensity
          });
        }
        model = await loadPopupModel("강도를 상향했습니다.");
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

const root = document.querySelector<HTMLElement>("#app");
if (root && document.body.dataset.page === "focuswhale-popup") {
  void bootstrapPopup(root).catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : "Popup failed to load.";
  });
}
