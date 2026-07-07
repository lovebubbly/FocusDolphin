import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_WELLNESS_COPY } from "./gamification";

const SOURCE_ROOT = join(process.cwd(), "src");
const SCANNED_DIRS = new Set(["background", "content", "pages", "pet"]);

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
});
