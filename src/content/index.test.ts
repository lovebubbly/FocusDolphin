import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBlockedPageRedirectUrl,
  clampOverlaySeconds,
  LatestEvaluationGuard,
  leaveSoftOverlayForFocus,
  normalizeOverlayRemUnits,
  rewriteOverlayAssetUrls,
  softCountdownSnapshot
} from "./index";

describe("soft overlay timing", () => {
  it("uses the saved delay within the supported range", () => {
    expect(clampOverlaySeconds(7)).toBe(7);
    expect(clampOverlaySeconds(1)).toBe(3);
    expect(clampOverlaySeconds(90)).toBe(60);
    expect(clampOverlaySeconds(undefined)).toBe(10);
  });

  it("derives countdown state from an absolute deadline after delayed ticks", () => {
    const deadlineMs = 10_000;

    expect(softCountdownSnapshot(deadlineMs, 0, "ko")).toEqual({
      remainingSeconds: 10,
      label: "계속하기 10",
      disabled: true
    });
    expect(softCountdownSnapshot(deadlineMs, 9_501, "ko")).toEqual({
      remainingSeconds: 1,
      label: "계속하기 1",
      disabled: true
    });
    expect(softCountdownSnapshot(deadlineMs, 12_000, "ko")).toEqual({
      remainingSeconds: 0,
      label: "계속하기",
      disabled: false
    });

    expect(softCountdownSnapshot(deadlineMs, 0, "en")).toEqual({
      remainingSeconds: 10,
      label: "Continue in 10",
      disabled: true
    });
    expect(softCountdownSnapshot(deadlineMs, 12_000, "en")).toEqual({
      remainingSeconds: 0,
      label: "Continue",
      disabled: false
    });
  });
});

describe("soft overlay evaluation ownership", () => {
  it("allows only the latest async evaluation to apply surface effects", () => {
    const guard = new LatestEvaluationGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);

    guard.invalidate();
    expect(guard.isCurrent(second)).toBe(false);
  });

  it("cleans up before deterministically leaving a user-created tab", () => {
    const operations: string[] = [];

    leaveSoftOverlayForFocus(
      () => operations.push("cleanup"),
      (target) => operations.push(`navigate:${target}`)
    );

    expect(operations).toEqual(["cleanup", "navigate:about:blank"]);
  });
});

describe("content-script extension URLs", () => {
  it("keeps soft-allow state out of the host page storage", () => {
    const source = readFileSync(resolve("src/content/index.ts"), "utf8");
    expect(source).not.toContain("sessionStorage");
  });

  it("rewrites both stable and hashed root-relative Pretendard URLs", () => {
    const extensionFontUrl = "chrome-extension://focuswhale/assets/PretendardVariable.woff2";

    expect(rewriteOverlayAssetUrls(
      "a{src:url(/assets/PretendardVariable.woff2)}b{src:url('https://page.example/PretendardVariable-deadbeef.woff2')}",
      extensionFontUrl
    )).toBe(
      `a{src:url("${extensionFontUrl}")}b{src:url("${extensionFontUrl}")}`
    );
  });

  it("pins overlay rem units to the designed scale instead of the host page root", () => {
    expect(normalizeOverlayRemUnits(
      "a{font-size:1rem;margin:-.25rem;max-width:28rem}@media(width>=40rem){a{gap:.5rem}}"
    )).toBe(
      "a{font-size:16px;margin:-4px;max-width:448px}@media(width>=640px){a{gap:8px}}"
    );
  });

  it("preserves only the sanitized scheme, host, port, and path in fallback redirects", () => {
    expect(buildBlockedPageRedirectUrl(
      "chrome-extension://focuswhale/src/pages/blocked/index.html",
      "x.com",
      "https://user:secret@x.com:8443/home?token=1#private"
    )).toBe(
      "chrome-extension://focuswhale/src/pages/blocked/index.html?d=x.com#https://x.com:8443/home"
    );
  });
});
