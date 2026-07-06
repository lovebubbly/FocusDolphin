import rawCategorySeed from "./categories.json";

export const CATEGORY_OVERRIDE_KEY = "categoryOverrides";

export const CATEGORIES = [
  "sns",
  "video",
  "community",
  "news",
  "shopping",
  "game",
  "entertainment",
  "study",
  "dev",
  "tools",
  "uncategorized"
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategoryOverrides = Partial<Record<string, Category>>;

export interface CategoryPattern {
  pattern: string;
  category: Category;
}

export interface CategoryDictionary {
  domains: Record<string, Category>;
  patterns: CategoryPattern[];
}

interface RawCategoryDictionary {
  domains?: Record<string, unknown>;
  patterns?: Array<{ pattern?: unknown; category?: unknown }>;
}

const rawDictionary = rawCategorySeed as RawCategoryDictionary;

export const DEFAULT_CATEGORY_DICTIONARY: CategoryDictionary = {
  domains: sanitizeDomains(rawDictionary.domains ?? {}),
  patterns: sanitizePatterns(rawDictionary.patterns ?? [])
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.includes(value as Category);
}

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//u, "");
  const hostname = withoutProtocol.split(/[/?#]/u)[0] ?? "";
  const withoutCredentials = hostname.includes("@") ? hostname.slice(hostname.lastIndexOf("@") + 1) : hostname;
  const withoutPort = withoutCredentials.replace(/:\d+$/u, "");

  return withoutPort.replace(/^\.+|\.+$/gu, "").replace(/^www\./u, "");
}

export function categoryForDomain(
  domainInput: string,
  overrides: CategoryOverrides = {},
  dictionary: CategoryDictionary = DEFAULT_CATEGORY_DICTIONARY
): Category {
  const domain = normalizeDomain(domainInput);

  if (!domain) {
    return "uncategorized";
  }

  const overrideCategory = matchDomainMap(domain, sanitizeDomains(overrides));
  if (overrideCategory) {
    return overrideCategory;
  }

  const dictionaryCategory = matchDomainMap(domain, dictionary.domains);
  if (dictionaryCategory) {
    return dictionaryCategory;
  }

  for (const entry of dictionary.patterns) {
    if (new RegExp(entry.pattern, "u").test(domain)) {
      return entry.category;
    }
  }

  return "uncategorized";
}

export async function loadCategoryOverrides(
  storageArea: Pick<chrome.storage.StorageArea, "get"> = chrome.storage.local
): Promise<CategoryOverrides> {
  const result = await storageArea.get(CATEGORY_OVERRIDE_KEY);
  const value = result[CATEGORY_OVERRIDE_KEY];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return sanitizeDomains(value as Record<string, unknown>);
}

export async function categoryForDomainWithLocalOverrides(
  domain: string,
  storageArea?: Pick<chrome.storage.StorageArea, "get">
): Promise<Category> {
  return categoryForDomain(domain, await loadCategoryOverrides(storageArea));
}

function sanitizeDomains(rawDomains: Record<string, unknown>): Record<string, Category> {
  return Object.entries(rawDomains).reduce<Record<string, Category>>((domains, [domain, category]) => {
    if (isCategory(category)) {
      const normalized = normalizeDomain(domain);
      if (normalized) {
        domains[normalized] = category;
      }
    }

    return domains;
  }, {});
}

function sanitizePatterns(rawPatterns: Array<{ pattern?: unknown; category?: unknown }>): CategoryPattern[] {
  return rawPatterns.reduce<CategoryPattern[]>((patterns, entry) => {
    if (typeof entry.pattern === "string" && isCategory(entry.category)) {
      patterns.push({ pattern: entry.pattern, category: entry.category });
    }

    return patterns;
  }, []);
}

function matchDomainMap(domain: string, domains: Record<string, Category>): Category | undefined {
  const candidates = Object.keys(domains).sort((left, right) => right.length - left.length || left.localeCompare(right));

  for (const candidate of candidates) {
    if (domain === candidate || domain.endsWith(`.${candidate}`)) {
      return domains[candidate];
    }
  }

  return undefined;
}
