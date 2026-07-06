import { describe, expect, it, vi } from "vitest";
import {
  categoryForDomain,
  categoryForDomainWithLocalOverrides,
  DEFAULT_CATEGORY_DICTIONARY,
  loadCategoryOverrides
} from "./categories";

describe("categoryForDomain", () => {
  it("matches seed domains and subdomains by suffix", () => {
    expect(categoryForDomain("instagram.com")).toBe("sns");
    expect(categoryForDomain("m.instagram.com")).toBe("sns");
    expect(categoryForDomain("docs.google.com")).toBe("study");
    expect(categoryForDomain("class.notes.docs.google.com")).toBe("study");
  });

  it("prefers user overrides over the seed dictionary", () => {
    expect(categoryForDomain("m.youtube.com", { "youtube.com": "study" })).toBe("study");
  });

  it("uses regex patterns after domain dictionary matching", () => {
    expect(categoryForDomain("topic.arca.live")).toBe("community");
  });

  it("keeps the bundled seed dictionary above the 60-domain requirement", () => {
    expect(Object.keys(DEFAULT_CATEGORY_DICTIONARY.domains).length).toBeGreaterThanOrEqual(60);
  });
});

describe("category override storage", () => {
  it("loads only valid override entries from local storage", async () => {
    const storage = {
      get: vi.fn(async () => ({
        categoryOverrides: {
          "youtube.com": "study",
          "bad.example": "not-a-category",
          "github.com": "sns"
        }
      }))
    };

    await expect(loadCategoryOverrides(storage)).resolves.toEqual({
      "youtube.com": "study",
      "github.com": "sns"
    });
    await expect(categoryForDomainWithLocalOverrides("github.com", storage)).resolves.toBe("sns");
  });
});
