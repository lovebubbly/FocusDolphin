import { normalizeDomain } from "../../background/rules";
import type { SiteList } from "../../shared/types";

export const ONBOARDING_STEP_COUNT = 3;
export type OnboardingStep = 1 | 2 | 3;

export function onboardingCopyKeys(mode: SiteList["mode"]): {
  title: string;
  body: string;
  hardBody: string;
} {
  return mode === "allowlist"
    ? {
        title: "onboardingAllowlistTitle",
        body: "onboardingAllowlistBody",
        hardBody: "onboardingHardAllowlistBody"
      }
    : {
        title: "onboardingListTitle",
        body: "onboardingListBody",
        hardBody: "onboardingHardBody"
      };
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
  return Math.min(ONBOARDING_STEP_COUNT, step + 1) as OnboardingStep;
}

export function previousOnboardingStep(step: OnboardingStep): OnboardingStep {
  return Math.max(1, step - 1) as OnboardingStep;
}

export function onboardingSiteLists(siteLists: readonly SiteList[]): SiteList[] {
  const blocklists = siteLists.filter((siteList) => siteList.mode === "blocklist");
  return (blocklists.length > 0 ? blocklists : siteLists).map(cloneSiteList);
}

export function normalizeDomainInput(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[\s,]+/u)
      .map(normalizeDomain)
      .filter(Boolean)
  ));
}

export function domainsChanged(current: readonly string[], next: readonly string[]): boolean {
  return current.length !== next.length || current.some((domain, index) => domain !== next[index]);
}

function cloneSiteList(siteList: SiteList): SiteList {
  return { ...siteList, domains: [...siteList.domains] };
}
