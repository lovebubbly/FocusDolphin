import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_WELLNESS_COPY } from "./gamification";

const SOURCE_ROOT = join(process.cwd(), "src");
const SCANNED_DIRS = new Set(["background", "content", "pages", "pet"]);
const CATALOG_ROOT = join(process.cwd(), "public", "_locales");
const ENGLISH_FORBIDDEN_WELLNESS_COPY = [
  "you failed",
  "your failure",
  "you are lazy",
  "you're lazy",
  "shame on",
  "feel ashamed",
  "feel guilty",
  "punished",
  "will die",
  "gets sick",
  "will regress",
  "lose your progress",
  "if you don't"
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (dir === SOURCE_ROOT && !SCANNED_DIRS.has(name)) {
        return [];
      }
      return sourceFiles(path);
    }

    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("wellness copy guard", () => {
  it("keeps punishment and shame copy out of UI-facing code", () => {
    const offenders = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return FORBIDDEN_WELLNESS_COPY
        .filter((pattern) => text.includes(pattern))
        .map((pattern) => `${path.replace(`${process.cwd()}/`, "")}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps punishment and shame copy out of both localized UI catalogs", () => {
    const patternsByLocale = {
      ko: FORBIDDEN_WELLNESS_COPY,
      en: ENGLISH_FORBIDDEN_WELLNESS_COPY
    } as const;
    const offenders = Object.entries(patternsByLocale).flatMap(([locale, patterns]) => {
      const catalog = JSON.parse(
        readFileSync(join(CATALOG_ROOT, locale, "messages.json"), "utf8")
      ) as Record<string, { message: string }>;
      return Object.entries(catalog).flatMap(([key, entry]) => patterns
        .filter((pattern) => entry.message.toLowerCase().includes(pattern.toLowerCase()))
        .map((pattern) => `public/_locales/${locale}/messages.json:${key}: ${pattern}`));
    });

    expect(offenders).toEqual([]);
  });
});
