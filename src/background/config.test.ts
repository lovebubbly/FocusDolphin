import { describe, expect, it } from "vitest";
import type { Schedule, SiteList } from "../shared/types";
import {
  addRecommendationDomain,
  applySettingsPatch,
  createSchedule,
  createSiteList,
  deleteSiteList,
  recommendationAnalysisContext,
  updateSchedule,
  updateSiteList
} from "./config";

const lists: SiteList[] = [
  { id: "default", name: "기본", mode: "blocklist", domains: ["youtube.com"] },
  { id: "work", name: "업무", mode: "allowlist", domains: ["notion.so"] }
];

const schedule: Schedule = {
  id: "morning",
  enabled: true,
  days: [1, 2, 3, 4, 5],
  startHHMM: "09:00",
  endHHMM: "12:00",
  listId: "default",
  intensity: "medium"
};

describe("serialized configuration mutations", () => {
  it("patches one settings field without replacing a newer sibling field", () => {
    expect(applySettingsPatch({
      softOverlaySeconds: 8,
      focusHours: { startHHMM: "10:00", endHHMM: "14:00" }
    }, { softOverlaySeconds: 5 })).toEqual({
      softOverlaySeconds: 5,
      focusHours: { startHHMM: "10:00", endHHMM: "14:00" }
    });
  });

  it("applies the same focus-hour defaults shown by Options when settings are missing", () => {
    expect(applySettingsPatch(undefined, { softOverlaySeconds: 8 })).toEqual({
      softOverlaySeconds: 8,
      focusHours: { startHHMM: "09:00", endHHMM: "12:00" }
    });
  });

  it("uses shared focus-hour defaults for background recommendation analysis", () => {
    expect(recommendationAnalysisContext(lists, undefined)).toEqual({
      blockedDomains: ["youtube.com"],
      focusHours: { startHHMM: "09:00", endHHMM: "12:00" }
    });
  });

  it("creates and updates one list against the latest collection", () => {
    const withConcurrent = createSiteList(lists, {
      id: "later",
      name: "나중",
      mode: "blocklist",
      domains: ["X.com", "x.com"]
    });
    const updated = updateSiteList(withConcurrent, {
      ...lists[0],
      name: "새 이름",
      domains: ["instagram.com"]
    });

    expect(updated.map((siteList) => siteList.id)).toEqual(["default", "work", "later"]);
    expect(updated[0]).toMatchObject({ name: "새 이름", domains: ["instagram.com"] });
    expect(updated[2]?.domains).toEqual(["x.com"]);
  });

  it("rejects deleting a list still referenced by the latest schedules", () => {
    expect(() => deleteSiteList(lists, [schedule], "default"))
      .toThrow("이 목록을 사용하는 자동 시작이 1개 있습니다");
  });

  it("preserves concurrently added schedules while updating one schedule", () => {
    const later = { ...schedule, id: "later", startHHMM: "13:00", endHHMM: "14:00" };
    const current = createSchedule([schedule], lists, later);
    const updated = updateSchedule(current, lists, { ...schedule, intensity: "hard" });

    expect(updated).toEqual([{ ...schedule, intensity: "hard" }, later]);
  });

  it("adds a recommendation to the latest blocklist without replacing other lists", () => {
    const updated = addRecommendationDomain(lists, "https://www.instagram.com/reels/1");
    expect(updated[0]?.domains).toEqual(["youtube.com", "instagram.com"]);
    expect(updated[1]).toEqual(lists[1]);
  });
});
