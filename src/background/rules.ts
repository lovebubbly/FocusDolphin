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
const REGEX_FILTER_DOMAINS = new Set(["x.com"]);
const DOMAIN_ALIASES: Record<string, string[]> = {
  "twitter.com": ["twitter.com", "x.com"],
  "x.com": ["x.com", "twitter.com"]
};

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
  return expandDomainAliases(domain).some(
    (normalizedDomain) => normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`)
  );
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
  const domainFilters = domainFilterTargets(domains);
  if (list.mode === "blocklist") {
    ensureSessionRuleCapacity(domainFilters.length);
    return domainFilters.map((target, index) => redirectRule(index + 1, 10, target.domain, target.visibleDomain));
  }

  ensureSessionRuleCapacity(domainFilters.length + 1);
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
    ...domainFilters.map((target, index) => allowRule(index + 2, 100, target.domain))
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

  const domainFilters = domainFilterTargets(activeDomains);

  if (domainFilters.length > TEMP_ALLOW_RULE_IDS.length) {
    throw new Error("Too many temporary allow domains for the reserved DNR rule range.");
  }

  return domainFilters.map((target, index) => allowRule(TEMP_ALLOW_RULE_IDS[index], 200, target.domain));
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

function expandDomainAliases(domain: string): string[] {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return [];
  }

  return uniqueDomains(DOMAIN_ALIASES[normalizedDomain] ?? [normalizedDomain]);
}

function domainFilterTargets(domains: string[]): Array<{ visibleDomain: string; domain: string }> {
  const covered = new Set<string>();
  const targets: Array<{ visibleDomain: string; domain: string }> = [];

  for (const domain of domains) {
    for (const expandedDomain of expandDomainAliases(domain)) {
      if (covered.has(expandedDomain)) {
        continue;
      }

      covered.add(expandedDomain);
      targets.push({ visibleDomain: domain, domain: expandedDomain });
    }
  }

  return targets;
}

function ensureSessionRuleCapacity(ruleCount: number): void {
  if (ruleCount > SESSION_RULE_IDS.length) {
    throw new Error("Too many domains for the reserved session DNR rule range.");
  }
}

function redirectRule(
  id: number,
  priority: number,
  domain: string,
  visibleDomain?: string
): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority,
    action: redirectAction(visibleDomain),
    condition: domainCondition(domain)
  };
}

function allowRule(id: number, priority: number, domain: string): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority,
    action: {
      type: "allow"
    },
    condition: domainCondition(domain)
  };
}

function domainCondition(domain: string): chrome.declarativeNetRequest.RuleCondition {
  if (REGEX_FILTER_DOMAINS.has(domain)) {
    return {
      regexFilter: domainRegexFilter(domain),
      resourceTypes: MAIN_FRAME
    };
  }

  return {
    urlFilter: domainUrlFilter(domain),
    resourceTypes: MAIN_FRAME
  };
}

function domainUrlFilter(domain: string): string {
  return `||${domain}^`;
}

function domainRegexFilter(domain: string): string {
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^https?://([^/?#]+\\.)?${escapedDomain}(:[0-9]+)?([/?#]|$)`;
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
