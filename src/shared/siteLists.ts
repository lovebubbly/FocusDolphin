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

  let changed = false;
  const siteLists = storedSiteLists.map((siteList) => {
    if (siteList.id !== DEFAULT_BLOCKLIST_ID || siteList.mode !== "blocklist") {
      return siteList;
    }

    const domains = mergeDomains(siteList.domains, DEFAULT_SITE_LISTS[0]?.domains ?? []);
    if (!sameStringArray(domains, siteList.domains)) {
      changed = true;
      return { ...siteList, domains };
    }

    return siteList;
  });

  return { siteLists, changed };
}

function cloneSiteLists(siteLists: readonly SiteList[]): SiteList[] {
  return siteLists.map((siteList) => ({ ...siteList, domains: [...siteList.domains] }));
}

function mergeDomains(domains: readonly string[], defaults: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const domain of [...domains, ...defaults]) {
    const normalized = normalizeDomainForList(domain);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

function normalizeDomainForList(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  try {
    const hostname = trimmed.includes("://") ? new URL(trimmed).hostname : trimmed.split("/")[0];
    return hostname.replace(/^\*\./, "").replace(/^\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
