import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import englishMessages from "../../public/_locales/en/messages.json";
import koreanMessages from "../../public/_locales/ko/messages.json";
import { getUiLocale, translate } from "./i18n";

interface CatalogEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

type Catalog = Record<string, CatalogEntry>;

const catalogs = {
  en: englishMessages as Catalog,
  ko: koreanMessages as Catalog
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("localization catalogs", () => {
  it("keeps Korean and English message keys in exact parity", () => {
    expect(Object.keys(catalogs.ko).sort()).toEqual(Object.keys(catalogs.en).sort());
  });

  it("keeps named placeholders declared and structurally identical", () => {
    for (const key of Object.keys(catalogs.en)) {
      const english = catalogs.en[key];
      const korean = catalogs.ko[key];
      expect(english.message.trim(), `${key} must have English copy`).not.toBe("");
      expect(korean.message.trim(), `${key} must have Korean copy`).not.toBe("");

      const englishNames = placeholderNames(english.message);
      const koreanNames = placeholderNames(korean.message);
      expect(koreanNames, `${key} placeholder tokens must match`).toEqual(englishNames);
      const englishDeclarations = Object.keys(english.placeholders ?? {}).sort();
      const koreanDeclarations = Object.keys(korean.placeholders ?? {}).sort();
      expect(englishDeclarations, `${key} must not declare unused placeholders`).toEqual(englishNames);
      expect(koreanDeclarations, `${key} placeholder declarations must match`).toEqual(englishDeclarations);

      for (const name of englishNames) {
        expect(english.placeholders?.[name], `${key}.${name} must be declared in English`).toBeDefined();
        expect(korean.placeholders?.[name], `${key}.${name} must be declared in Korean`).toBeDefined();
        expect(korean.placeholders?.[name]?.content, `${key}.${name} positions must match`).toBe(
          english.placeholders?.[name]?.content
        );
      }
    }
  });

  it("localizes manifest fields through keys that exist in both catalogs", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8")) as {
      name: string;
      description: string;
      default_locale?: string;
      action?: { default_title?: string };
    };

    expect(manifest.default_locale).toBe("en");
    expect(manifest.name).toBe("__MSG_appName__");
    expect(manifest.description).toBe("__MSG_appDescription__");
    expect(manifest.action?.default_title).toBe("__MSG_appName__");

    for (const value of [manifest.name, manifest.description, manifest.action?.default_title]) {
      const key = value?.match(/^__MSG_([A-Za-z0-9_]+)__$/u)?.[1];
      expect(key).toBeDefined();
      expect(catalogs.en[key ?? ""]).toBeDefined();
      expect(catalogs.ko[key ?? ""]).toBeDefined();
    }
  });

  it("contains every message key referenced by production TypeScript", () => {
    const keyPrefix = /^(?:app|analysis|automation|badge|behavior|blocked|category|common|current|dashboard|day|default|domain|duration|focus|generic|growth|history|intensity|list|local|metric|mode|newList|onboarding|options|pet|popup|privacy|recommendation|recommended|schedule|settings|soft|visits|weekly)[A-Z0-9]/u;
    const nonMessageKeys = new Set([
      "categoryOverrides",
      "focusHours",
      "growthLog",
      "listId",
      "petLedger",
      "petReconciliationJournal",
      "petSettlementJournal",
      "petState",
      "petStreakLedger",
      "scheduleSuppression",
      "softOverlaySeconds"
    ]);
    const referencedKeys = new Set<string>();

    for (const path of productionTypeScriptFiles(resolve("src"))) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/["'`]([A-Za-z][A-Za-z0-9_]*)["'`]/gu)) {
        const key = match[1];
        if (keyPrefix.test(key) && !nonMessageKeys.has(key)) {
          referencedKeys.add(key);
        }
      }
    }

    const missing = [...referencedKeys].filter((key) => !catalogs.en[key]).sort();
    expect(missing).toEqual([]);
  });

  it("contains the complete computed pet-stage and badge message families", () => {
    const badgeNames = [
      "FirstSession",
      "FirstHard",
      "Focus10Hours",
      "Focus50Hours",
      "FiveDayWeek",
      "Allowlist10",
      "Streak7",
      "Streak30",
      "Comeback",
      "FirstSchedule",
      "Steady4w"
    ];
    const computedKeys = [
      ...Array.from({ length: 5 }, (_, stage) => `petStageName${stage}`),
      ...Array.from({ length: 5 }, (_, stage) => `popupPetStageLine${stage}`),
      ...badgeNames.flatMap((name) => [`badge${name}Name`, `badge${name}Description`])
    ];

    for (const key of computedKeys) {
      expect(catalogs.en[key], `${key} must exist in English`).toBeDefined();
      expect(catalogs.ko[key], `${key} must exist in Korean`).toBeDefined();
    }
  });
});

describe("translate", () => {
  it("prefers the browser i18n runtime when no locale override is supplied", () => {
    const getMessage = vi.fn((key: string) => key === "@@ui_locale" ? "ko" : "Runtime translation");
    vi.stubGlobal("chrome", { i18n: { getMessage, getUILanguage: () => "ko-KR" } });

    expect(translate("commonNext")).toBe("Runtime translation");
    expect(getMessage).toHaveBeenCalledWith("@@ui_locale");
    expect(getMessage).toHaveBeenCalledWith("commonNext", undefined);
  });

  it("uses the bundled requested locale when the browser runtime catalog is stale", () => {
    const getMessage = vi.fn((key: string) => key === "@@ui_locale" ? "en_US" : "Next");
    vi.stubGlobal("chrome", { i18n: { getMessage, getUILanguage: () => "ko-KR" } });

    expect(getUiLocale()).toBe("ko");
    expect(translate("commonNext")).toBe("다음");
    expect(getMessage).not.toHaveBeenCalledWith("commonNext", undefined);
  });

  it("uses explicit locale overrides and Chrome-compatible substitutions", () => {
    vi.stubGlobal("chrome", { i18n: { getMessage: () => "Must not win", getUILanguage: () => "ko" } });

    expect(translate("commonMinutes", "25", "en")).toBe("25 min");
    expect(translate("commonMinutes", "25", "ko")).toBe("25분");
    expect(translate("commonStepOf", ["1", "3"], "en")).toBe("1 of 3");
    expect(translate("commonStepOf", ["1", "3"], "ko")).toBe("3단계 중 1");
  });

  it("falls back to bundled English for unsupported browser locales", () => {
    vi.stubGlobal("chrome", { i18n: { getMessage: () => "", getUILanguage: () => "fr-FR" } });

    expect(getUiLocale()).toBe("en");
    expect(translate("commonNext")).toBe("Next");
  });

  it("falls back to bundled Korean and leaves unknown keys visible", () => {
    vi.stubGlobal("chrome", { i18n: { getMessage: () => "", getUILanguage: () => "ko-KR" } });

    expect(getUiLocale()).toBe("ko");
    expect(translate("commonNext")).toBe("다음");
    expect(translate("missingKey")).toBe("missingKey");
  });

  it("preserves Korean legacy behavior outside a browser runtime", () => {
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("navigator", undefined);

    expect(getUiLocale()).toBe("ko");
    expect(translate("commonNext")).toBe("다음");
  });

  it("uses navigator language in browser previews without the extension runtime", () => {
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { language: "en-GB" });

    expect(getUiLocale()).toBe("en");
    expect(translate("commonNext")).toBe("Next");
  });
});

function placeholderNames(message: string): string[] {
  return [...new Set(
    [...message.matchAll(/\$([A-Za-z][A-Za-z0-9_]*)\$/gu)]
      .map((match) => match[1].toLowerCase())
  )].sort();
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return productionTypeScriptFiles(path);
    }
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}
