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

  it("adds X/Twitter domains to an existing default blocklist", () => {
    const existing: SiteList[] = [
      {
        id: "default-blocklist",
        name: "기본 차단 목록",
        mode: "blocklist",
        domains: ["youtube.com", "instagram.com"]
      }
    ];

    expect(migrateSiteListsForCurrentDefaults(existing)).toEqual({
      siteLists: [
        {
          ...existing[0],
          domains: ["youtube.com", "instagram.com", "x.com", "twitter.com"]
        }
      ],
      changed: true
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
