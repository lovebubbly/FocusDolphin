import type { SiteList } from "./types";
import { translate, type SupportedLocale } from "./i18n";

export const DEFAULT_BLOCKLIST_ID = "default-blocklist";
export const DEFAULT_ALLOWLIST_ID = "deep-work-allowlist";

export const DEFAULT_SITE_LISTS: SiteList[] = [
  {
    id: DEFAULT_BLOCKLIST_ID,
    name: "기본 차단 목록",
    mode: "blocklist",
    domains: ["youtube.com", "instagram.com", "x.com", "twitter.com"]
  },
  {
    id: DEFAULT_ALLOWLIST_ID,
    name: "집중 허용 목록",
    mode: "allowlist",
    domains: ["docs.google.com", "notion.so"]
  }
];

const KNOWN_DEFAULT_NAMES: Record<string, readonly string[]> = {
  [DEFAULT_BLOCKLIST_ID]: ["기본 차단 목록", "Default blocklist"],
  [DEFAULT_ALLOWLIST_ID]: ["집중 허용 목록", "Focus allowlist"]
};
const KNOWN_RECOMMENDED_NAMES = ["추천 차단 목록", "Recommended blocklist"] as const;

export function siteListDisplayName(
  siteList: Pick<SiteList, "id" | "name">,
  localeOverride?: SupportedLocale
): string {
  const knownNames = KNOWN_DEFAULT_NAMES[siteList.id];
  if (knownNames?.includes(siteList.name)) {
    return siteList.id === DEFAULT_BLOCKLIST_ID
      ? translate("defaultBlocklistName", undefined, localeOverride)
      : translate("defaultAllowlistName", undefined, localeOverride);
  }

  if (
    /^recommended-blocklist(?:-\d+)?$/u.test(siteList.id)
    && KNOWN_RECOMMENDED_NAMES.includes(siteList.name as typeof KNOWN_RECOMMENDED_NAMES[number])
  ) {
    return translate("recommendedBlocklistName", undefined, localeOverride);
  }

  return siteList.name;
}

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
