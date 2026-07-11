import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWLIST_ID,
  DEFAULT_BLOCKLIST_ID,
  DEFAULT_SITE_LISTS,
  migrateSiteListsForCurrentDefaults,
  siteListDisplayName
} from "./siteLists";
import type { SiteList } from "./types";

describe("default site list migration", () => {
  it("creates default lists for first-run storage", () => {
    expect(migrateSiteListsForCurrentDefaults(undefined)).toEqual({
      siteLists: DEFAULT_SITE_LISTS,
      changed: true
    });
  });

  it("does not restore defaults that a user removed from the default blocklist", () => {
    const existing: SiteList[] = [
      {
        id: "default-blocklist",
        name: "기본 차단 목록",
        mode: "blocklist",
        domains: ["youtube.com"]
      }
    ];

    expect(migrateSiteListsForCurrentDefaults(existing)).toEqual({
      siteLists: existing,
      changed: false
    });
  });

  it("does not rewrite custom lists", () => {
    const existing: SiteList[] = [{ id: "custom", name: "Custom", mode: "blocklist", domains: ["example.com"] }];

    expect(migrateSiteListsForCurrentDefaults(existing)).toEqual({
      siteLists: existing,
      changed: false
    });
  });
});

describe("siteListDisplayName", () => {
  it("localizes only untouched product defaults", () => {
    expect(siteListDisplayName({ id: DEFAULT_BLOCKLIST_ID, name: "기본 차단 목록" }, "en"))
      .toBe("Default blocklist");
    expect(siteListDisplayName({ id: DEFAULT_ALLOWLIST_ID, name: "Focus allowlist" }, "ko"))
      .toBe("집중 허용 목록");
  });

  it("never translates a user-owned name", () => {
    expect(siteListDisplayName({ id: DEFAULT_BLOCKLIST_ID, name: "시험 기간" }, "en"))
      .toBe("시험 기간");
    expect(siteListDisplayName({ id: "recommended-blocklist", name: "My recommendations" }, "ko"))
      .toBe("My recommendations");
  });

  it("localizes untouched recommendation-list defaults", () => {
    expect(siteListDisplayName({ id: "recommended-blocklist-2", name: "추천 차단 목록" }, "en"))
      .toBe("Recommended blocklist");
  });
});
