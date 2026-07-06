import type { PetState } from "../shared/types";
import { stageForXp } from "../shared/xp";
import { renderPopupPreview } from "../pages/popup/main";
import { DEV_PET_STATE, DEV_SESSION_LOG, DEV_SITE_LISTS } from "./devFixture";
import { mountPet } from "./renderer";

const stagePreview = document.querySelector<HTMLElement>("#stage-preview");
const popupPreview = document.querySelector<HTMLElement>("#popup-preview");

function stateForStage(stage: PetState["stage"]): PetState {
  const xpByStage = [0, 300, 1_500, 5_000, 12_000] as const;

  return {
    ...DEV_PET_STATE,
    stage,
    xp: xpByStage[stage]
  };
}

if (stagePreview) {
  for (const stage of [0, 1, 2, 3, 4] as PetState["stage"][]) {
    const card = document.createElement("article");
    card.className = "stage-card";

    const petMount = document.createElement("div");
    const state = stateForStage(stage);
    mountPet(petMount, { ...state, stage: stageForXp(state.xp) }, stage === 4 ? "happy" : "idle");

    const label = document.createElement("p");
    label.textContent = `Stage ${stage}`;
    card.append(petMount, label);
    stagePreview.append(card);
  }
}

if (popupPreview) {
  renderPopupPreview(popupPreview, DEV_PET_STATE, DEV_SITE_LISTS, DEV_SESSION_LOG);
}
