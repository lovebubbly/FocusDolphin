import type { SiteList } from "../../shared/types";
import {
  domainsChanged,
  nextOnboardingStep,
  normalizeDomainInput,
  onboardingCopyKeys,
  onboardingSiteLists,
  previousOnboardingStep
} from "./model";

describe("onboarding model", () => {
  it("keeps navigation inside the three setup decisions", () => {
    expect(nextOnboardingStep(1)).toBe(2);
    expect(nextOnboardingStep(2)).toBe(3);
    expect(nextOnboardingStep(3)).toBe(3);
    expect(previousOnboardingStep(3)).toBe(2);
    expect(previousOnboardingStep(2)).toBe(1);
    expect(previousOnboardingStep(1)).toBe(1);
  });

  it("prefers the safer blocklist choices and returns defensive clones", () => {
    const siteLists: SiteList[] = [
      { id: "block", name: "Block", mode: "blocklist", domains: ["x.com"] },
      { id: "allow", name: "Allow", mode: "allowlist", domains: ["notion.so"] }
    ];

    const result = onboardingSiteLists(siteLists);
    expect(result).toEqual([siteLists[0]]);
    result[0].domains.push("example.com");
    expect(siteLists[0].domains).toEqual(["x.com"]);
  });

  it("normalizes pasted URLs, comma-separated domains, and duplicates", () => {
    expect(normalizeDomainInput(
      "https://www.YouTube.com/watch?v=1, x.com\nhttps://x.com/home  instagram.com"
    )).toEqual(["youtube.com", "x.com", "instagram.com"]);
  });

  it("detects ordered domain edits", () => {
    expect(domainsChanged(["x.com"], ["x.com"])).toBe(false);
    expect(domainsChanged(["x.com"], ["instagram.com"])).toBe(true);
    expect(domainsChanged(["x.com", "instagram.com"], ["instagram.com", "x.com"])).toBe(true);
  });

  it("describes blocklists and allowlists without reversing their meaning", () => {
    expect(onboardingCopyKeys("blocklist")).toEqual({
      title: "onboardingListTitle",
      body: "onboardingListBody",
      hardBody: "onboardingHardBody"
    });
    expect(onboardingCopyKeys("allowlist")).toEqual({
      title: "onboardingAllowlistTitle",
      body: "onboardingAllowlistBody",
      hardBody: "onboardingHardAllowlistBody"
    });
  });
});
