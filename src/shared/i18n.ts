import englishMessages from "../../public/_locales/en/messages.json";
import koreanMessages from "../../public/_locales/ko/messages.json";

export type SupportedLocale = "ko" | "en";
export type UiLocale = SupportedLocale;

interface MessagePlaceholder {
  content: string;
  example?: string;
}

interface MessageEntry {
  message: string;
  description?: string;
  placeholders?: Record<string, MessagePlaceholder>;
}

type MessageCatalog = Record<string, MessageEntry>;

const catalogs: Record<UiLocale, MessageCatalog> = {
  en: englishMessages as MessageCatalog,
  ko: koreanMessages as MessageCatalog
};

function localeFromLanguageTag(language: string | undefined): UiLocale {
  return language?.toLowerCase().split(/[-_]/u)[0] === "ko" ? "ko" : "en";
}

export function getUiLocale(): UiLocale {
  try {
    const runtimeLocale = globalThis.chrome?.i18n?.getUILanguage?.();
    if (runtimeLocale) {
      return localeFromLanguageTag(runtimeLocale);
    }
  } catch {
    // Browser globals are optional in unit tests and non-extension previews.
  }

  const navigatorLocale = typeof globalThis.window === "undefined"
    ? undefined
    : globalThis.navigator?.language;
  return navigatorLocale ? localeFromLanguageTag(navigatorLocale) : "ko";
}

function normalizeSubstitutions(substitutions: string | string[] | undefined): string[] {
  if (substitutions === undefined) {
    return [];
  }
  return Array.isArray(substitutions) ? substitutions : [substitutions];
}

function substituteMessage(entry: MessageEntry, substitutions: string | string[] | undefined): string {
  const values = normalizeSubstitutions(substitutions);
  const escapedDollar = "\u0000FOCUSWHALE_DOLLAR\u0000";
  let message = entry.message.replaceAll("$$", escapedDollar);

  message = message.replace(/\$([A-Za-z][A-Za-z0-9_]*)\$/gu, (token, placeholderName: string) => {
    const placeholder = entry.placeholders?.[placeholderName.toLowerCase()];
    if (!placeholder) {
      return token;
    }
    return placeholder.content.replace(/\$(\d+)/gu, (_position, index: string) => values[Number(index) - 1] ?? "");
  });

  message = message.replace(/\$(\d+)/gu, (_position, index: string) => values[Number(index) - 1] ?? "");
  return message.replaceAll(escapedDollar, "$");
}

function runtimeTranslation(key: string, substitutions: string | string[] | undefined): string {
  try {
    return globalThis.chrome?.i18n?.getMessage?.(key, substitutions) ?? "";
  } catch {
    return "";
  }
}

function runtimeUiLocale(): UiLocale | null {
  try {
    const locale = globalThis.chrome?.i18n?.getMessage?.("@@ui_locale");
    return locale ? localeFromLanguageTag(locale) : null;
  } catch {
    return null;
  }
}

export function translate(
  key: string,
  substitutions?: string | string[],
  localeOverride?: UiLocale
): string {
  const locale = localeOverride ?? getUiLocale();
  if (!localeOverride) {
    const runtimeLocale = runtimeUiLocale();
    if (!runtimeLocale || runtimeLocale === locale) {
      const translated = runtimeTranslation(key, substitutions);
      if (translated) {
        return translated;
      }
    }
  }

  const entry = catalogs[locale][key] ?? catalogs.en[key];
  return entry ? substituteMessage(entry, substitutions) : key;
}
