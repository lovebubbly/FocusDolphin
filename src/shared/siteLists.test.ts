import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_LISTS, migrateSiteListsForCurrentDefaults } from "./siteLists";
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
