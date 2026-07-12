import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTrustedBlockedPageSender } from "./blockedPageSender";

const EXTENSION_ORIGIN = "chrome-extension://focuswhale-id";

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: {
      id: "focuswhale-id",
      getURL: (path: string) => `${EXTENSION_ORIGIN}/${path}`
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requireTrustedBlockedPageSender", () => {
  it("accepts only the extension's top-level blocked-page tab", () => {
    expect(requireTrustedBlockedPageSender({
      id: "focuswhale-id",
      tab: { id: 42 } as chrome.tabs.Tab,
      frameId: 0,
      url: `${EXTENSION_ORIGIN}/src/pages/blocked/index.html?d=x.com#https://x.com/home`
    })).toBe("tab:42");
  });

  it.each([
    { id: "foreign-id", tab: { id: 42 }, frameId: 0, url: `${EXTENSION_ORIGIN}/src/pages/blocked/index.html` },
    { id: "focuswhale-id", tab: { id: 42 }, frameId: 1, url: `${EXTENSION_ORIGIN}/src/pages/blocked/index.html` },
    { id: "focuswhale-id", tab: { id: 42 }, frameId: 0, url: `${EXTENSION_ORIGIN}/src/pages/options/index.html` },
    { id: "focuswhale-id", frameId: 0, url: `${EXTENSION_ORIGIN}/src/pages/blocked/index.html` }
  ])("rejects an untrusted sender", (sender) => {
    expect(() => requireTrustedBlockedPageSender(sender as chrome.runtime.MessageSender)).toThrow(
      /Focus Dolphin blocked-page|Focus Dolphin blocked page/u
    );
  });
});
