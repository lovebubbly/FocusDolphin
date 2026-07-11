import { DEFAULT_PET_STATE, normalizePetState } from "../../pet/defaultState";
import { mountPet, PET_RENDER_SIZES } from "../../pet/renderer";
import { sendMessage } from "../../shared/messaging";
import { getUiLocale, translate } from "../../shared/i18n";
import {
  DEFAULT_SITE_LISTS,
  migrateSiteListsForCurrentDefaults,
  siteListDisplayName
} from "../../shared/siteLists";
import { getTyped, setTyped, STORAGE_KEYS } from "../../shared/storage";
import type { Intensity, PetState, SiteList } from "../../shared/types";
import {
  completeOnboarding,
  isReplayRequest,
  readOnboardingCompletion,
  startOnboardingSession,
  type OnboardingOutcome
} from "./lifecycle";
import {
  domainsChanged,
  nextOnboardingStep,
  normalizeDomainInput,
  onboardingCopyKeys,
  ONBOARDING_STEP_COUNT,
  onboardingSiteLists,
  previousOnboardingStep,
  type OnboardingStep
} from "./model";

interface OnboardingModel {
  step: OnboardingStep;
  siteLists: SiteList[];
  selectedListId: string;
  domainsText: string;
  intensity: Intensity;
  petState: PetState;
  busy: boolean;
  error?: string;
  completedOutcome?: OnboardingOutcome;
}

interface OnboardingHandlers {
  skip: () => Promise<void>;
  back: () => void;
  next: () => Promise<void>;
  selectList: (listId: string) => void;
  editDomains: (value: string) => void;
  selectIntensity: (intensity: Intensity) => void;
  finishWithoutSession: () => Promise<void>;
  startSession: () => Promise<void>;
  close: () => void;
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("FocusWhale onboarding root was not found.");
}

void bootstrapOnboarding(app).catch(() => renderOnboardingLoadFailure(app));

export function renderOnboardingLoadFailure(root: HTMLElement): void {
  document.title = translate("onboardingDocumentTitle");
  document.documentElement.lang = getUiLocale();
  root.replaceChildren();
  root.className = "mx-auto flex min-h-screen w-full max-w-[720px] flex-col px-5 py-6 sm:px-6";

  const header = document.createElement("header");
  header.className = "flex min-h-11 items-center";
  appendText(header, "span", translate("onboardingBrand"), "text-sm font-extrabold");

  const wrap = document.createElement("div");
  wrap.className = "flex flex-1 items-center py-8";
  const section = document.createElement("section");
  section.className = "card w-full border border-error/20 bg-base-100 shadow-xl";
  const body = document.createElement("div");
  body.className = "card-body items-start gap-4 p-6 sm:p-8";
  const petSlot = document.createElement("div");
  petSlot.className = "grid place-items-center";
  mountPet(petSlot, normalizePetState(DEFAULT_PET_STATE), "idle");
  petSlot.setAttribute("aria-label", translate("onboardingPetAria"));
  appendText(body, "h1", translate("onboardingLoadErrorTitle"), "text-2xl font-black");
  const alert = document.createElement("div");
  alert.className = "alert alert-error alert-soft";
  alert.setAttribute("role", "alert");
  appendText(alert, "span", translate("onboardingLoadErrorBody"));
  body.append(
    alert,
    button(translate("commonRetry"), "btn btn-primary min-h-11 w-full", () => window.location.reload())
  );
  body.prepend(petSlot);
  section.append(body);
  wrap.append(section);
  root.append(header, wrap);
}

export async function bootstrapOnboarding(root: HTMLElement): Promise<void> {
  document.title = translate("onboardingDocumentTitle");
  document.documentElement.lang = getUiLocale();

  const [siteLists, petState, completion] = await Promise.all([
    loadSiteLists(),
    loadPetState(),
    readOnboardingCompletion()
  ]);
  const availableLists = onboardingSiteLists(siteLists);
  const initialList = availableLists[0] ?? DEFAULT_SITE_LISTS[0];
  const replay = isReplayRequest(window.location.search);
  const model: OnboardingModel = {
    step: 1,
    siteLists: availableLists,
    selectedListId: initialList.id,
    domainsText: initialList.domains.join("\n"),
    intensity: "soft",
    petState,
    busy: false,
    ...(!replay && completion ? { completedOutcome: completion.outcome } : {})
  };

  const rerender = (focusHeading = false): void => {
    renderOnboarding(root, model, handlers);
    if (focusHeading) {
      root.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    }
  };

  const complete = async (outcome: OnboardingOutcome): Promise<void> => {
    model.busy = true;
    model.error = undefined;
    rerender();
    try {
      await completeOnboarding(outcome);
      model.completedOutcome = outcome;
    } catch {
      model.error = translate("onboardingFinishError");
    } finally {
      model.busy = false;
      rerender(true);
    }
  };

  const handlers: OnboardingHandlers = {
    skip: () => complete("skipped"),
    back: () => {
      if (model.busy) {
        return;
      }
      model.error = undefined;
      model.step = previousOnboardingStep(model.step);
      rerender(true);
    },
    next: async () => {
      if (model.busy) {
        return;
      }
      if (model.step === 2 && !(await saveSelectedSiteList(model, rerender))) {
        return;
      }
      model.error = undefined;
      model.step = nextOnboardingStep(model.step);
      rerender(true);
    },
    selectList: (listId) => {
      const selected = model.siteLists.find((siteList) => siteList.id === listId);
      if (!selected || model.busy) {
        return;
      }
      model.selectedListId = selected.id;
      model.domainsText = selected.domains.join("\n");
      model.error = undefined;
      rerender();
    },
    editDomains: (value) => {
      model.domainsText = value;
      model.error = undefined;
    },
    selectIntensity: (intensity) => {
      if (!model.busy) {
        model.intensity = intensity;
      }
    },
    finishWithoutSession: () => complete("setup_only"),
    startSession: async () => {
      if (model.busy) {
        return;
      }
      model.busy = true;
      model.error = undefined;
      rerender();
      try {
        const result = await startOnboardingSession(async () => {
          const response = await sendMessage({
            type: "START_SESSION",
            payload: {
              listId: model.selectedListId,
              intensity: model.intensity,
              durationMinutes: 25,
              source: "manual"
            }
          });
          if (!response.ok) {
            throw new Error(response.error);
          }
        });
        model.completedOutcome = "session_started";
        if (!result.completionSaved) {
          model.error = translate("onboardingCompletionSaveWarning");
        }
      } catch {
        model.error = translate("onboardingStartError");
      } finally {
        model.busy = false;
        rerender(true);
      }
    },
    close: () => window.close()
  };

  rerender(Boolean(model.completedOutcome));
}

async function loadSiteLists(): Promise<SiteList[]> {
  const stored = await getTyped("sync", STORAGE_KEYS.sync.siteLists);
  const migration = migrateSiteListsForCurrentDefaults(stored);
  if (migration.changed) {
    await setTyped("sync", STORAGE_KEYS.sync.siteLists, migration.siteLists);
  }
  return migration.siteLists;
}

async function loadPetState(): Promise<PetState> {
  try {
    const response = await sendMessage({ type: "RECONCILE_PET" });
    return response.ok ? response.pet.petState : normalizePetState(DEFAULT_PET_STATE);
  } catch {
    return normalizePetState(DEFAULT_PET_STATE);
  }
}

async function saveSelectedSiteList(
  model: OnboardingModel,
  rerender: () => void
): Promise<boolean> {
  const selected = model.siteLists.find((siteList) => siteList.id === model.selectedListId);
  if (!selected) {
    model.error = translate("onboardingListSaveError");
    rerender();
    return false;
  }

  const domains = normalizeDomainInput(model.domainsText);
  if (!domainsChanged(selected.domains, domains)) {
    model.domainsText = domains.join("\n");
    return true;
  }

  model.busy = true;
  model.error = undefined;
  rerender();
  try {
    const nextList = { ...selected, domains };
    const response = await sendMessage({ type: "UPDATE_SITE_LIST", payload: { siteList: nextList } });
    if (!response.ok) {
      throw new Error(response.error);
    }
    model.siteLists = model.siteLists.map((siteList) => siteList.id === nextList.id ? nextList : siteList);
    model.domainsText = domains.join("\n");
    return true;
  } catch {
    model.error = translate("onboardingListSaveError");
    return false;
  } finally {
    model.busy = false;
    rerender();
  }
}

function renderOnboarding(
  root: HTMLElement,
  model: OnboardingModel,
  handlers: OnboardingHandlers
): void {
  root.replaceChildren();
  root.className = "mx-auto flex min-h-screen w-full max-w-[720px] flex-col px-5 py-6 sm:px-6";

  const header = document.createElement("header");
  header.className = "flex min-h-11 items-center justify-between gap-3";
  appendText(header, "span", translate("onboardingBrand"), "text-sm font-extrabold");
  if (!model.completedOutcome) {
    const skip = button(
      translate("onboardingSkip"),
      "btn btn-ghost min-h-11 px-3",
      () => void handlers.skip()
    );
    skip.disabled = model.busy;
    header.append(skip);
  }
  root.append(header);

  if (model.completedOutcome) {
    root.append(renderCompletion(model, handlers));
    return;
  }

  root.append(renderProgress(model.step));
  const content = document.createElement("div");
  content.className = "flex flex-1 items-center py-6 sm:py-10";
  content.append(
    model.step === 1
      ? renderIntro(model)
      : model.step === 2
        ? renderSiteListStep(model, handlers)
        : renderIntensityStep(model, handlers)
  );
  root.append(content, renderFooter(model, handlers));
}

function renderProgress(step: OnboardingStep): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mt-4 grid gap-2";
  const progressText = translate("onboardingStepProgress", [String(step), String(ONBOARDING_STEP_COUNT)]);
  const labels = document.createElement("div");
  labels.className = "flex items-center justify-between gap-4 text-xs font-bold";
  appendText(labels, "span", progressText);
  const labelKey = step === 1
    ? "goal8OnboardingProgressIntro"
    : step === 2
      ? "goal8OnboardingProgressList"
      : "goal8OnboardingProgressSession";
  appendText(labels, "span", translate(labelKey), "text-primary");
  const progress = document.createElement("progress");
  progress.className = "progress progress-primary h-1.5 w-full";
  progress.max = ONBOARDING_STEP_COUNT;
  progress.value = step;
  progress.setAttribute(
    "aria-label",
    translate("onboardingProgressAria", [String(step), String(ONBOARDING_STEP_COUNT)])
  );
  wrap.append(labels, progress);
  return wrap;
}

function renderIntro(model: OnboardingModel): HTMLElement {
  const section = document.createElement("section");
  section.className = "card fw-atmosphere fw-depth w-full overflow-hidden border border-primary/10";
  section.setAttribute("aria-labelledby", "onboarding-intro-title");
  const body = document.createElement("div");
  body.className = "card-body gap-8 p-6 sm:p-8";
  const hero = document.createElement("div");
  hero.className = "grid items-center gap-8 sm:grid-cols-[180px_1fr]";
  const petBackdrop = document.createElement("div");
  petBackdrop.className = "mx-auto grid h-44 w-44 place-items-center rounded-full bg-base-300/35";
  const petSlot = document.createElement("div");
  petSlot.className = "grid place-items-center";
  mountPet(petSlot, model.petState, "happy", { size: PET_RENDER_SIZES.large });
  petSlot.setAttribute("aria-label", translate("onboardingPetAria"));
  petBackdrop.append(petSlot);
  const copy = document.createElement("div");
  copy.className = "space-y-4 text-center sm:text-start";
  appendText(copy, "p", translate("onboardingIntroEyebrow"), "text-sm font-bold text-primary");
  const heading = appendText(copy, "h1", translate("onboardingIntroTitle"), "text-4xl font-black leading-tight focus:outline-none");
  heading.id = "onboarding-intro-title";
  heading.dataset.stepHeading = "true";
  heading.tabIndex = -1;
  appendText(copy, "p", translate("onboardingIntroBody"), "text-base leading-7 text-base-content/70");
  hero.append(petBackdrop, copy);

  const principles = document.createElement("div");
  principles.className = "grid gap-6 border-t border-base-content/10 pt-6 sm:grid-cols-2";
  principles.append(
    principleRow("onboardingIntroPrivacyTitle", "onboardingIntroPrivacyBody"),
    principleRow("onboardingIntroPetTitle", "onboardingIntroPetBody")
  );
  body.append(hero, principles);
  section.append(body);
  return section;
}

function principleRow(titleKey: string, bodyKey: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "space-y-1";
  appendText(row, "h2", translate(titleKey), "font-black");
  appendText(row, "p", translate(bodyKey), "text-sm leading-6 text-base-content/65");
  return row;
}

function renderSiteListStep(model: OnboardingModel, handlers: OnboardingHandlers): HTMLElement {
  const selected = model.siteLists.find((siteList) => siteList.id === model.selectedListId);
  const copy = onboardingCopyKeys(selected?.mode ?? "blocklist");
  const section = stepSection("onboardingListEyebrow", copy.title, copy.body);
  const form = document.createElement("div");
  form.className = "grid gap-5";

  const listField = document.createElement("fieldset");
  listField.className = "fieldset";
  appendText(listField, "legend", translate("onboardingListLabel"), "fieldset-legend font-semibold");
  const select = document.createElement("select");
  select.className = "select min-h-11 w-full";
  select.disabled = model.busy;
  select.setAttribute("aria-label", translate("onboardingListLabel"));
  for (const siteList of model.siteLists) {
    const option = document.createElement("option");
    option.value = siteList.id;
    option.textContent = siteListDisplayName(siteList);
    option.selected = siteList.id === model.selectedListId;
    select.append(option);
  }
  select.addEventListener("change", () => handlers.selectList(select.value));
  listField.append(select);

  const domainsField = document.createElement("fieldset");
  domainsField.className = "fieldset";
  const legend = document.createElement("legend");
  legend.className = "fieldset-legend flex w-full items-center justify-between gap-3 font-semibold";
  appendText(legend, "span", translate("onboardingDomainsLabel"));
  const domainCount = appendText(
    legend,
    "span",
    translate("onboardingDomainCount", String(normalizeDomainInput(model.domainsText).length)),
    "badge badge-soft"
  );
  const textarea = document.createElement("textarea");
  textarea.className = "textarea min-h-36 w-full leading-relaxed";
  textarea.value = model.domainsText;
  textarea.disabled = model.busy;
  textarea.placeholder = translate("onboardingDomainsPlaceholder");
  textarea.setAttribute("aria-describedby", "onboarding-domain-hint");
  textarea.addEventListener("input", () => {
    handlers.editDomains(textarea.value);
    domainCount.textContent = translate(
      "onboardingDomainCount",
      String(normalizeDomainInput(textarea.value).length)
    );
  });
  domainsField.append(legend, textarea);
  const hint = appendText(
    domainsField,
    "p",
    translate("onboardingDomainsHint"),
    "mt-1 text-sm leading-6 text-base-content/60"
  );
  hint.id = "onboarding-domain-hint";
  if (selected) {
    appendText(
      domainsField,
      "span",
      selected.mode === "blocklist"
        ? translate("onboardingBlocklistBadge")
        : translate("onboardingAllowlistBadge"),
      "badge badge-primary badge-soft mt-2 w-fit"
    );
  }
  form.append(listField, domainsField);
  section.querySelector(".card-body")?.append(form, renderError(model));
  return section;
}

function renderIntensityStep(model: OnboardingModel, handlers: OnboardingHandlers): HTMLElement {
  const section = stepSection("onboardingIntensityEyebrow", "onboardingIntensityTitle", "onboardingIntensityBody");
  const body = section.querySelector<HTMLElement>(".card-body");
  if (!body) {
    return section;
  }

  const duration = document.createElement("div");
  duration.className = "flex items-center justify-between gap-3 border-y border-base-200 py-3";
  appendText(duration, "span", translate("onboardingSessionLabel"), "text-sm font-bold");
  appendText(duration, "span", translate("onboardingSessionDuration"), "badge badge-primary badge-soft");

  const choices = document.createElement("fieldset");
  choices.className = "fieldset";
  appendText(choices, "legend", translate("onboardingIntensityLabel"), "fieldset-legend font-semibold");
  const join = document.createElement("div");
  join.className = "join join-vertical w-full";
  const selected = model.siteLists.find((siteList) => siteList.id === model.selectedListId);
  const copy = onboardingCopyKeys(selected?.mode ?? "blocklist");
  const intensityOptions: Array<{ value: Intensity; title: string; body: string }> = [
    { value: "soft", title: "onboardingSoftTitle", body: "onboardingSoftBody" },
    { value: "medium", title: "onboardingMediumTitle", body: "onboardingMediumBody" },
    { value: "hard", title: "onboardingHardTitle", body: copy.hardBody }
  ];
  for (const option of intensityOptions) {
    const label = document.createElement("label");
    const selectedOption = model.intensity === option.value;
    label.className = "join-item flex min-h-20 cursor-pointer items-center gap-4 border border-base-content/10 px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary/60 has-[:checked]:shadow-lg";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "onboarding-intensity";
    radio.value = option.value;
    radio.className = "radio radio-primary shrink-0";
    radio.checked = selectedOption;
    radio.disabled = model.busy;
    radio.addEventListener("change", () => handlers.selectIntensity(option.value));
    const copy = document.createElement("span");
    copy.className = "min-w-0 space-y-1";
    appendText(copy, "span", translate(option.title), "block font-black");
    appendText(copy, "span", translate(option.body), "mt-1 block text-sm leading-6 text-base-content/60");
    label.append(radio, copy);
    join.append(label);
  }
  choices.append(join);

  const emergency = document.createElement("div");
  emergency.className = "alert alert-soft text-sm leading-6";
  appendText(emergency, "span", translate("onboardingEmergencyNote"));
  body.append(duration, choices, emergency, renderError(model));
  return section;
}

function stepSection(eyebrowKey: string, titleKey: string, bodyKey: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "card fw-depth w-full border border-base-content/10 bg-base-100 shadow-sm";
  const body = document.createElement("div");
  body.className = "card-body gap-5 p-6 sm:p-7";
  const copy = document.createElement("div");
  copy.className = "space-y-2";
  appendText(copy, "p", translate(eyebrowKey), "text-sm font-bold text-primary");
  const heading = appendText(copy, "h1", translate(titleKey), "text-3xl font-black focus:outline-none");
  heading.dataset.stepHeading = "true";
  heading.tabIndex = -1;
  appendText(copy, "p", translate(bodyKey), "leading-7 text-base-content/65");
  body.append(copy);
  section.append(body);
  return section;
}

function renderFooter(model: OnboardingModel, handlers: OnboardingHandlers): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "flex min-h-16 items-center justify-between gap-3 border-t border-base-content/10 py-3";
  const back = button(translate("onboardingBack"), "btn btn-ghost min-h-11", handlers.back);
  back.disabled = model.step === 1 || model.busy;
  back.classList.toggle("invisible", model.step === 1);
  footer.append(back);

  if (model.step < 3) {
    const next = button(
      model.busy ? translate("onboardingSaving") : translate("onboardingContinue"),
      "btn btn-primary min-h-11 px-7",
      () => void handlers.next()
    );
    next.disabled = model.busy;
    footer.append(next);
    return footer;
  }

  const actions = document.createElement("div");
  actions.className = "flex flex-col items-end gap-2 sm:flex-row";
  const finish = button(
    model.busy ? translate("onboardingFinishing") : translate("onboardingFinishWithoutSession"),
    "btn btn-ghost min-h-11",
    () => void handlers.finishWithoutSession()
  );
  const start = button(
    model.busy ? translate("onboardingStartingSession") : translate("onboardingStartSession"),
    "btn btn-primary min-h-11",
    () => void handlers.startSession()
  );
  finish.disabled = model.busy;
  start.disabled = model.busy;
  actions.append(finish, start);
  footer.append(actions);
  return footer;
}

function renderCompletion(model: OnboardingModel, handlers: OnboardingHandlers): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "flex flex-1 items-center py-8";
  const section = document.createElement("section");
  section.className = "card fw-atmosphere fw-depth w-full border border-primary/10 shadow-xl";
  const body = document.createElement("div");
  body.className = "card-body items-center gap-5 p-7 text-center sm:p-10";
  const petSlot = document.createElement("div");
  petSlot.className = "grid place-items-center";
  mountPet(petSlot, model.petState, "celebrate", { size: PET_RENDER_SIZES.hero });
  petSlot.setAttribute("aria-label", translate("onboardingPetAria"));
  body.append(petSlot);
  appendText(body, "span", translate("goal8OnboardingSetupComplete"), "badge badge-success badge-soft");
  const heading = appendText(body, "h1", translate("onboardingCompleteTitle"), "text-4xl font-black focus:outline-none");
  heading.dataset.stepHeading = "true";
  heading.tabIndex = -1;
  appendText(
    body,
    "p",
    model.completedOutcome === "session_started"
      ? translate("onboardingCompleteStartedBody")
      : translate("onboardingCompleteSetupBody"),
    "max-w-lg leading-7 text-base-content/65"
  );
  const close = button(translate("onboardingCloseTab"), "btn btn-primary min-h-11 px-8", handlers.close);
  body.append(close);
  appendText(body, "p", translate("onboardingCloseHint"), "text-xs text-base-content/60");
  body.append(renderError(model));
  section.append(body);
  wrap.append(section);
  return wrap;
}

function renderError(model: OnboardingModel): HTMLElement {
  const holder = document.createElement("div");
  if (!model.error) {
    return holder;
  }
  holder.className = "alert alert-error alert-soft text-sm";
  holder.setAttribute("role", "alert");
  appendText(holder, "span", model.error);
  return holder;
}

function appendText(
  parent: HTMLElement,
  tagName: keyof HTMLElementTagNameMap,
  text: string,
  className?: string
): HTMLElement {
  const child = document.createElement(tagName);
  child.textContent = text;
  if (className) {
    child.className = className;
  }
  parent.append(child);
  return child;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.textContent = text;
  control.addEventListener("click", onClick);
  return control;
}
