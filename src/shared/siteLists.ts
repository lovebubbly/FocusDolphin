import type { SiteList } from "./types";

export const DEFAULT_BLOCKLIST_ID = "default-blocklist";

export const DEFAULT_SITE_LISTS: SiteList[] = [
  {
    id: DEFAULT_BLOCKLIST_ID,
    name: "기본 차단 목록",
    mode: "blocklist",
    domains: ["youtube.com", "instagram.com", "x.com", "twitter.com"]
  },
  {
    id: "deep-work-allowlist",
    name: "집중 허용 목록",
    mode: "allowlist",
    domains: ["docs.google.com", "notion.so"]
  }
];

export function migrateSiteListsForCurrentDefaults(storedSiteLists?: readonly SiteList[]): {
  siteLists: SiteList[];
  changed: boolean;
} {
  if (!storedSiteLists || storedSiteLists.length === 0) {
    return { siteLists: cloneSiteLists(DEFAULT_SITE_LISTS), changed: true };
  }

  // Existing lists are user-owned. Reapplying product defaults here would
  // silently undo domains that the user intentionally removed.
  return { siteLists: cloneSiteLists(storedSiteLists), changed: false };
}

function cloneSiteLists(siteLists: readonly SiteList[]): SiteList[] {
  return siteLists.map((siteList) => ({ ...siteList, domains: [...siteList.domains] }));
}
