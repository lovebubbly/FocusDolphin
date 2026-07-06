import type { Intensity, SiteList, TempAllow } from "../shared/types";

export interface DynamicRuleClient {
  updateDynamicRules(options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void>;
}

export class ChromeDynamicRuleClient implements DynamicRuleClient {
  async updateDynamicRules(options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void> {
    await chrome.declarativeNetRequest.updateDynamicRules(options);
  }
}

export const SESSION_RULE_IDS = Array.from({ length: 999 }, (_, index) => index + 1);
export const TEMP_ALLOW_RULE_IDS = Array.from({ length: 1000 }, (_, index) => index + 1000);

const MAIN_FRAME: chrome.declarativeNetRequest.RuleCondition["resourceTypes"] = ["main_frame"];
const BLOCKED_PAGE_PATH = "/src/pages/blocked/index.html";

export function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (trimmed.length === 0) {
    return "";
  }

  const withoutProtocol = trimmed.includes("://") ? new URL(trimmed).hostname : trimmed;
  return withoutProtocol
    .split("/")[0]
    .replace(/^\*\./, "")
    .replace(/^\./, "")
    .replace(/\.$/, "");
}

export function domainMatches(hostname: string, domain: string): boolean {
  const normalizedHost = normalizeDomain(hostname);
  const normalizedDomain = normalizeDomain(domain);
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

export function isDomainInList(hostname: string, list: SiteList): boolean {
  return uniqueDomains(list.domains).some((domain) => domainMatches(hostname, domain));
}

export function shouldBlockDomain(hostname: string, list: SiteList): boolean {
  const listed = isDomainInList(hostname, list);
  return list.mode === "blocklist" ? listed : !listed;
}

export function compileRules(list: SiteList, intensity: Intensity): chrome.declarativeNetRequest.Rule[] {
  if (intensity === "soft") {
    return [];
  }

  const domains = uniqueDomains(list.domains);
  if (list.mode === "blocklist") {
    ensureSessionRuleCapacity(domains.length);
    return domains.map((domain, index) => redirectRule(index + 1, 10, [domain], domain));
  }

  ensureSessionRuleCapacity(domains.length + 1);
  return [
    {
      id: 1,
      priority: 1,
      action: redirectAction(),
      condition: {
        urlFilter: "*",
        resourceTypes: MAIN_FRAME
      }
    },
    ...domains.map((domain, index) => allowRule(index + 2, 100, [domain]))
  ];
}

export function compileTempAllowRules(
  tempAllows: TempAllow[],
  now = Date.now()
): chrome.declarativeNetRequest.Rule[] {
  const activeDomains = uniqueDomains(
    tempAllows
      .filter((entry) => entry.until > now)
      .map((entry) => entry.domain)
  );

  if (activeDomains.length > TEMP_ALLOW_RULE_IDS.length) {
    throw new Error("Too many temporary allow domains for the reserved DNR rule range.");
  }

  return activeDomains.map((domain, index) => allowRule(TEMP_ALLOW_RULE_IDS[index], 200, [domain]));
}

export async function applySessionRules(
  client: DynamicRuleClient,
  rules: chrome.declarativeNetRequest.Rule[]
): Promise<void> {
  await client.updateDynamicRules({
    removeRuleIds: SESSION_RULE_IDS,
    addRules: rules
  });
}

export async function applyTempAllowRules(
  client: DynamicRuleClient,
  rules: chrome.declarativeNetRequest.Rule[]
): Promise<void> {
  await client.updateDynamicRules({
    removeRuleIds: TEMP_ALLOW_RULE_IDS,
    addRules: rules
  });
}

function uniqueDomains(domains: string[]): string[] {
  return Array.from(new Set(domains.map(normalizeDomain).filter(Boolean)));
}

function ensureSessionRuleCapacity(ruleCount: number): void {
  if (ruleCount > SESSION_RULE_IDS.length) {
    throw new Error("Too many domains for the reserved session DNR rule range.");
  }
}

function redirectRule(
  id: number,
  priority: number,
  requestDomains: string[],
  visibleDomain?: string
): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority,
    action: redirectAction(visibleDomain),
    condition: {
      requestDomains,
      resourceTypes: MAIN_FRAME
    }
  };
}

function allowRule(id: number, priority: number, requestDomains: string[]): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority,
    action: {
      type: "allow"
    },
    condition: {
      requestDomains,
      resourceTypes: MAIN_FRAME
    }
  };
}

function redirectAction(domain?: string): chrome.declarativeNetRequest.RuleAction {
  const query = domain ? `?d=${encodeURIComponent(domain)}` : "";
  return {
    type: "redirect",
    redirect: {
      extensionPath: `${BLOCKED_PAGE_PATH}${query}`
    }
  };
}
