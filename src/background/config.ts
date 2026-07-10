import { normalizeSettings, type Settings } from "../shared/storage";
import type { Schedule, SiteList } from "../shared/types";
import { normalizeDomain } from "./rules";

export interface SettingsPatch {
  softOverlaySeconds?: number;
  focusHours?: { startHHMM: string; endHHMM: string };
}

export function recommendationAnalysisContext(
  siteLists: readonly SiteList[] | undefined,
  settings: Settings | undefined
): { blockedDomains: string[]; focusHours: { startHHMM: string; endHHMM: string } } {
  return {
    blockedDomains: (siteLists ?? [])
      .filter((siteList) => siteList.mode === "blocklist")
      .flatMap((siteList) => siteList.domains),
    focusHours: normalizeSettings(settings).focusHours
  };
}

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

export function applySettingsPatch(current: Settings | undefined, patch: SettingsPatch): Settings {
  const next: Settings = normalizeSettings(current);

  if (patch.softOverlaySeconds !== undefined) {
    if (!Number.isFinite(patch.softOverlaySeconds) || patch.softOverlaySeconds < 3 || patch.softOverlaySeconds > 60) {
      throw new Error("가벼운 안내 대기 시간은 3초에서 60초 사이여야 합니다.");
    }
    next.softOverlaySeconds = Math.round(patch.softOverlaySeconds);
  }

  if (patch.focusHours !== undefined) {
    if (
      !HHMM_PATTERN.test(patch.focusHours.startHHMM)
      || !HHMM_PATTERN.test(patch.focusHours.endHHMM)
      || patch.focusHours.startHHMM === patch.focusHours.endHHMM
    ) {
      throw new Error("집중 시간대의 시작과 종료를 올바르게 선택해 주세요.");
    }
    next.focusHours = { ...patch.focusHours };
  }

  return next;
}

export function createSiteList(current: readonly SiteList[], candidate: SiteList): SiteList[] {
  const normalized = normalizeSiteList(candidate);
  if (current.some((siteList) => siteList.id === normalized.id)) {
    throw new Error("같은 차단 목록이 이미 존재합니다.");
  }
  return [...cloneSiteLists(current), normalized];
}

export function updateSiteList(current: readonly SiteList[], candidate: SiteList): SiteList[] {
  const normalized = normalizeSiteList(candidate);
  if (!current.some((siteList) => siteList.id === normalized.id)) {
    throw new Error("변경할 차단 목록을 찾지 못했습니다. 화면을 새로고침해 주세요.");
  }
  return current.map((siteList) => siteList.id === normalized.id ? normalized : cloneSiteList(siteList));
}

export function deleteSiteList(
  current: readonly SiteList[],
  schedules: readonly Schedule[],
  siteListId: string
): SiteList[] {
  if (!current.some((siteList) => siteList.id === siteListId)) {
    throw new Error("삭제할 차단 목록을 찾지 못했습니다. 화면을 새로고침해 주세요.");
  }
  const dependents = schedules.filter((schedule) => schedule.listId === siteListId);
  if (dependents.length > 0) {
    throw new Error(`이 목록을 사용하는 자동 시작이 ${dependents.length}개 있습니다. 먼저 자동 시작을 변경하거나 삭제해 주세요.`);
  }
  if (current.length <= 1) {
    throw new Error("차단 목록은 하나 이상 필요합니다. 새 목록을 추가한 뒤 삭제해 주세요.");
  }
  return current.filter((siteList) => siteList.id !== siteListId).map(cloneSiteList);
}

export function createSchedule(
  current: readonly Schedule[],
  siteLists: readonly SiteList[],
  candidate: Schedule
): Schedule[] {
  const normalized = normalizeSchedule(candidate, siteLists);
  if (current.some((schedule) => schedule.id === normalized.id)) {
    throw new Error("같은 자동 시작이 이미 존재합니다.");
  }
  return [...current.map(cloneSchedule), normalized];
}

export function updateSchedule(
  current: readonly Schedule[],
  siteLists: readonly SiteList[],
  candidate: Schedule
): Schedule[] {
  const normalized = normalizeSchedule(candidate, siteLists);
  if (!current.some((schedule) => schedule.id === normalized.id)) {
    throw new Error("변경할 자동 시작을 찾지 못했습니다. 화면을 새로고침해 주세요.");
  }
  return current.map((schedule) => schedule.id === normalized.id ? normalized : cloneSchedule(schedule));
}

export function deleteSchedule(current: readonly Schedule[], scheduleId: string): Schedule[] {
  if (!current.some((schedule) => schedule.id === scheduleId)) {
    throw new Error("삭제할 자동 시작을 찾지 못했습니다. 화면을 새로고침해 주세요.");
  }
  return current.filter((schedule) => schedule.id !== scheduleId).map(cloneSchedule);
}

export function addRecommendationDomain(current: readonly SiteList[], rawDomain: string): SiteList[] {
  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    throw new Error("차단 목록에 추가할 도메인을 확인하지 못했습니다.");
  }

  const blocklistIndex = current.findIndex((siteList) => siteList.mode === "blocklist");
  if (blocklistIndex === -1) {
    const usedIds = new Set(current.map((siteList) => siteList.id));
    let id = "recommended-blocklist";
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `recommended-blocklist-${suffix}`;
      suffix += 1;
    }
    return [...cloneSiteLists(current), { id, name: "추천 차단 목록", mode: "blocklist", domains: [domain] }];
  }

  return current.map((siteList, index) => {
    const cloned = cloneSiteList(siteList);
    if (index !== blocklistIndex || cloned.domains.includes(domain)) {
      return cloned;
    }
    return { ...cloned, domains: [...cloned.domains, domain] };
  });
}

function normalizeSiteList(candidate: SiteList): SiteList {
  const id = candidate.id.trim();
  if (!id) {
    throw new Error("차단 목록 ID가 필요합니다.");
  }
  if (candidate.mode !== "blocklist" && candidate.mode !== "allowlist") {
    throw new Error("차단 목록 모드를 확인해 주세요.");
  }
  const domains = Array.from(new Set(candidate.domains.map(normalizeDomain).filter(Boolean)));
  return {
    id,
    name: candidate.name.trim() || "목록",
    mode: candidate.mode,
    domains
  };
}

function normalizeSchedule(candidate: Schedule, siteLists: readonly SiteList[]): Schedule {
  const id = candidate.id.trim();
  if (!id) {
    throw new Error("자동 시작 ID가 필요합니다.");
  }
  if (!siteLists.some((siteList) => siteList.id === candidate.listId)) {
    throw new Error("자동 시작에 사용할 차단 목록을 찾지 못했습니다.");
  }
  if (
    !HHMM_PATTERN.test(candidate.startHHMM)
    || !HHMM_PATTERN.test(candidate.endHHMM)
    || candidate.startHHMM === candidate.endHHMM
  ) {
    throw new Error("자동 시작의 시작과 종료 시간을 올바르게 선택해 주세요.");
  }
  const days = Array.from(new Set(candidate.days)).sort((left, right) => left - right);
  if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("자동 시작 요일을 하나 이상 선택해 주세요.");
  }
  if (candidate.intensity !== "soft" && candidate.intensity !== "medium" && candidate.intensity !== "hard") {
    throw new Error("자동 시작의 차단 방식을 확인해 주세요.");
  }
  return { ...candidate, id, days };
}

function cloneSiteLists(siteLists: readonly SiteList[]): SiteList[] {
  return siteLists.map(cloneSiteList);
}

function cloneSiteList(siteList: SiteList): SiteList {
  return { ...siteList, domains: [...siteList.domains] };
}

function cloneSchedule(schedule: Schedule): Schedule {
  return { ...schedule, days: [...schedule.days] };
}
