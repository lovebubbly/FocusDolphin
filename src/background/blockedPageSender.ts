const BLOCKED_PAGE_PATH = "src/pages/blocked/index.html";

export function requireTrustedBlockedPageSender(sender: chrome.runtime.MessageSender): string {
  if (sender.id !== chrome.runtime.id || typeof sender.tab?.id !== "number" || (sender.frameId ?? 0) !== 0) {
    throw new Error("This action requires a top-level FocusWhale blocked-page tab.");
  }

  const senderUrl = parseUrl(sender.url);
  const blockedUrl = parseUrl(chrome.runtime.getURL(BLOCKED_PAGE_PATH));
  if (!senderUrl || !blockedUrl || senderUrl.origin !== blockedUrl.origin || senderUrl.pathname !== blockedUrl.pathname) {
    throw new Error("This action requires the FocusWhale blocked page.");
  }

  return `tab:${sender.tab.id}`;
}

function parseUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}
