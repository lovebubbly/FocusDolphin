import {
  ONBOARDING_PAGE_PATH,
  ONBOARDING_STATE_KEY,
  ONBOARDING_VERSION,
  completeOnboarding,
  isReplayRequest,
  onboardingPageUrl,
  openOnboardingPage,
  parseOnboardingCompletion,
  runInstalledLifecycle,
  startOnboardingSession,
  shouldOpenOnboarding
} from "./lifecycle";

describe("onboarding lifecycle", () => {
  it("opens only for a fresh extension install", () => {
    expect(shouldOpenOnboarding("install")).toBe(true);
    expect(shouldOpenOnboarding("update")).toBe(false);
    expect(shouldOpenOnboarding("chrome_update")).toBe(false);
    expect(shouldOpenOnboarding("shared_module_update")).toBe(false);
  });

  it("builds normal and replay URLs without extra permissions", () => {
    const getUrl = (path: string) => `chrome-extension://focuswhale/${path}`;

    expect(onboardingPageUrl(false, getUrl)).toBe(
      `chrome-extension://focuswhale/${ONBOARDING_PAGE_PATH}`
    );
    expect(onboardingPageUrl(true, getUrl)).toBe(
      `chrome-extension://focuswhale/${ONBOARDING_PAGE_PATH}?replay=1`
    );
  });

  it("creates one extension tab for the requested onboarding URL", async () => {
    const createTab = vi.fn(async () => ({ id: 12 }));
    await openOnboardingPage(true, createTab, (path) => `chrome-extension://id/${path}`);

    expect(createTab).toHaveBeenCalledTimes(1);
    expect(createTab).toHaveBeenCalledWith({
      url: `chrome-extension://id/${ONBOARDING_PAGE_PATH}?replay=1`
    });
  });

  it("finishes install boot before opening onboarding", async () => {
    const events: string[] = [];
    await runInstalledLifecycle(
      "install",
      async () => { events.push("boot"); },
      async () => { events.push("open"); },
      async () => null
    );
    expect(events).toEqual(["boot", "open"]);
  });

  it("does not reopen onboarding when the current completion record already exists", async () => {
    const boot = vi.fn(async () => undefined);
    const open = vi.fn(async () => undefined);
    await runInstalledLifecycle("install", boot, open, async () => ({
      version: ONBOARDING_VERSION,
      completedAt: 1_700_000_000_000,
      outcome: "setup_only"
    }));

    expect(boot).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it("still boots on update without opening onboarding", async () => {
    const boot = vi.fn(async () => undefined);
    const open = vi.fn(async () => undefined);
    await runInstalledLifecycle("update", boot, open);

    expect(boot).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it("recognizes only the explicit replay flag", () => {
    expect(isReplayRequest("?replay=1")).toBe(true);
    expect(isReplayRequest("?replay=0")).toBe(false);
    expect(isReplayRequest("?other=1")).toBe(false);
  });

  it("accepts only the current versioned completion record", () => {
    const valid = { version: ONBOARDING_VERSION, completedAt: 1_700_000_000_000, outcome: "setup_only" };
    expect(parseOnboardingCompletion(valid)).toEqual(valid);
    expect(parseOnboardingCompletion({ ...valid, version: ONBOARDING_VERSION + 1 })).toBeNull();
    expect(parseOnboardingCompletion({ ...valid, completedAt: 0 })).toBeNull();
    expect(parseOnboardingCompletion({ ...valid, outcome: "unknown" })).toBeNull();
    expect(parseOnboardingCompletion(null)).toBeNull();
  });

  it("writes completion to local storage with the current schema version", async () => {
    const set = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { storage: { local: { set } } });
    try {
      const result = await completeOnboarding("session_started", 1_700_000_000_000);
      expect(result).toEqual({
        version: ONBOARDING_VERSION,
        completedAt: 1_700_000_000_000,
        outcome: "session_started"
      });
      expect(set).toHaveBeenCalledWith({ [ONBOARDING_STATE_KEY]: result });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not report a started session as failed when completion persistence fails", async () => {
    const start = vi.fn(async () => undefined);
    const writeCompletion = vi.fn(async () => { throw new Error("storage unavailable"); });

    await expect(startOnboardingSession(start, writeCompletion)).resolves.toEqual({ completionSaved: false });
    expect(start).toHaveBeenCalledTimes(1);
    expect(writeCompletion).toHaveBeenCalledWith("session_started");
  });

  it("does not write completion when the first session fails to start", async () => {
    const start = vi.fn(async () => { throw new Error("start failed"); });
    const writeCompletion = vi.fn(async () => undefined);

    await expect(startOnboardingSession(start, writeCompletion)).rejects.toThrow("start failed");
    expect(writeCompletion).not.toHaveBeenCalled();
  });
});
