import type { Intensity, SiteList, TempAllow } from "../shared/types";

export interface DynamicRuleClient {
  updateDynamicRules(options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void>;
}

type DynamicRulesApi = Pick<
  typeof chrome.declarativeNetRequest,
  "getDynamicRules" | "updateDynamicRules"
>;

export class ChromeDynamicRuleClient implements DynamicRuleClient {
  constructor(private readonly api: DynamicRulesApi = chrome.declarativeNetRequest) {}

  async updateDynamicRules(options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void> {
    const requestedRemovalIds = options.removeRuleIds ?? [];
    const existingIds = requestedRemovalIds.length > 0
      ? new Set((await this.api.getDynamicRules()).map((rule) => rule.id))
      : new Set<number>();
    const removeRuleIds = requestedRemovalIds.filter((id) => existingIds.has(id));
    const addRules = options.addRules ?? [];

    if (removeRuleIds.length === 0 && addRules.length === 0) {
      return;
    }

    await this.api.updateDynamicRules({
      ...options,
      removeRuleIds,
      addRules
    });
  }
}

const MAX_ACTIVE_REGEX_RULES = 1_000;
export const TEMP_ALLOW_RULE_CAPACITY = 100;
export const SESSION_RULE_CAPACITY = MAX_ACTIVE_REGEX_RULES - TEMP_ALLOW_RULE_CAPACITY;
// Removal ranges retain every ID used by pre-1.0 builds; add capacities are smaller.
export const SESSION_RULE_IDS = Array.from({ length: 999 }, (_, index) => index + 1);
export const TEMP_ALLOW_RULE_IDS = Array.from({ length: 1_000 }, (_, index) => index + 1_000);

const MAIN_FRAME: chrome.declarativeNetRequest.RuleCondition["resourceTypes"] = ["main_frame"];
const BLOCKED_PAGE_PATH = "src/pages/blocked/index.html";
const DOMAIN_ALIASES: Record<string, string[]> = {
  "twitter.com": ["twitter.com", "x.com"],
  "x.com": ["x.com", "twitter.com"]
};

export function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (trimmed.length === 0) {
    return "";
  }

  const candidate = trimmed
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)\*\./u, "$1")
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)\./u, "$1")
    .replace(/^\*?\./u, "");
  try {
    const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    return parsed.hostname
      .toLowerCase()
      .replace(/^\.+|\.+$/gu, "")
      .replace(/^www\./u, "");
  } catch {
    return "";
  }
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

export function compileRules(
  list: SiteList,
  intensity: Intensity,
  blockedPageUrl?: string
): chrome.declarativeNetRequest.Rule[] {
  if (intensity === "soft") {
    return [];
  }

  const redirectUrl = blockedPageUrl ?? chrome.runtime.getURL(BLOCKED_PAGE_PATH);
  const domains = uniqueDomains(list.domains);
  const domainFilters = domainFilterTargets(domains);
  if (list.mode === "blocklist") {
    ensureSessionRuleCapacity(domainFilters.length);
    return domainFilters.map((target, index) => redirectRule(index + 1, 10, target.domain, redirectUrl));
  }

  ensureSessionRuleCapacity(domainFilters.length + 1);
  return [
    {
      id: 1,
      priority: 1,
      action: redirectAction(redirectUrl),
      condition: {
        regexFilter: "^(https?)://(?:[^/?#@]*@)?([^/?#@]+)(/[^?#]*)?(?:[?#].*)?$",
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

  if (domainFilters.length > TEMP_ALLOW_RULE_CAPACITY) {
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
  if (ruleCount > SESSION_RULE_CAPACITY) {
    throw new Error("Too many domains for the reserved session DNR rule range.");
  }
}

function redirectRule(
  id: number,
  priority: number,
  domain: string,
  blockedPageUrl: string
): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority,
    action: redirectAction(blockedPageUrl),
    condition: redirectDomainCondition(domain)
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
  return {
    regexFilter: domainRegexFilter(domain),
    resourceTypes: MAIN_FRAME
  };
}

function redirectDomainCondition(domain: string): chrome.declarativeNetRequest.RuleCondition {
  return {
    regexFilter: domainRegexFilter(domain),
    resourceTypes: MAIN_FRAME
  };
}

function domainRegexFilter(domain: string): string {
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^(https?)://(?:[^/?#@]*@)?((?:[^/?#@]+\\.)?${escapedDomain}\\.?(?::[0-9]+)?)(/[^?#]*)?(?:[?#].*)?$`;
}

function redirectAction(blockedPageUrl: string): chrome.declarativeNetRequest.RuleAction {
  return {
    type: "redirect",
    redirect: {
      regexSubstitution: `${blockedPageUrl}#\\1://\\2\\3`
    }
  };
}

export function sanitizeHttpReturnUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}
