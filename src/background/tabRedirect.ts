import { STORAGE_KEYS, getTyped } from "../shared/storage";
import type { Session, SiteList, TempAllow } from "../shared/types";
import { domainMatches, normalizeDomain, shouldBlockDomain } from "./rules";
import { isRunning } from "./session";

const BLOCKED_PAGE_PATH = "src/pages/blocked/index.html";

export interface BlockedTabRedirectContext {
  session: Session | null;
  siteList: SiteList | undefined;
  tempAllows: TempAllow[];
  now: number;
  blockedPageUrl: string;
}

export function getBlockedTabRedirectUrl(
  pageUrl: string | undefined,
  context: BlockedTabRedirectContext
): string | null {
  if (!isRunning(context.session, context.now) || context.session.intensity === "soft") {
    return null;
  }

  const parsedUrl = parseHttpUrl(pageUrl);
  if (!parsedUrl || !context.siteList) {
    return null;
  }

  const hostname = normalizeDomain(parsedUrl.hostname);
  if (!hostname || hasActiveTempAllow(hostname, context.tempAllows, context.now)) {
    return null;
  }

  if (!shouldBlockDomain(hostname, context.siteList)) {
    return null;
  }

  return `${context.blockedPageUrl}?d=${encodeURIComponent(hostname)}`;
}

export async function redirectTabIfBlocked(tabId: number, pageUrl: string | undefined, now = Date.now()): Promise<void> {
  const redirectUrl = await resolveBlockedTabRedirectUrl(pageUrl, now);
  if (redirectUrl) {
    await chrome.tabs.update(tabId, { url: redirectUrl });
  }
}

export async function redirectOpenBlockedTabs(now = Date.now()): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) => {
      if (tab.id === undefined) {
        return Promise.resolve();
      }

      return redirectTabIfBlocked(tab.id, tab.url, now);
    })
  );
}

async function resolveBlockedTabRedirectUrl(pageUrl: string | undefined, now: number): Promise<string | null> {
  const session = (await getTyped("local", STORAGE_KEYS.local.activeSession)) ?? null;
  if (!isRunning(session, now) || session.intensity === "soft") {
    return null;
  }

  const [siteLists, tempAllows] = await Promise.all([
    getTyped("sync", STORAGE_KEYS.sync.siteLists),
    getTyped("local", STORAGE_KEYS.local.tempAllows)
  ]);

  return getBlockedTabRedirectUrl(pageUrl, {
    session,
    siteList: siteLists?.find((candidate) => candidate.id === session.listId),
    tempAllows: tempAllows ?? [],
    now,
    blockedPageUrl: chrome.runtime.getURL(BLOCKED_PAGE_PATH)
  });
}

function parseHttpUrl(pageUrl: string | undefined): URL | null {
  if (!pageUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(pageUrl);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? parsedUrl : null;
  } catch {
    return null;
  }
}

function hasActiveTempAllow(hostname: string, tempAllows: TempAllow[], now: number): boolean {
  return tempAllows.some((entry) => entry.until > now && domainMatches(hostname, entry.domain));
}
