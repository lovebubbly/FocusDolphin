export const ONBOARDING_PAGE_PATH = "src/pages/onboarding/index.html";
export const ONBOARDING_STATE_KEY = "focuswhaleOnboarding";
export const ONBOARDING_VERSION = 1;

export type OnboardingOutcome = "skipped" | "setup_only" | "session_started";

export interface OnboardingCompletionState {
  version: typeof ONBOARDING_VERSION;
  completedAt: number;
  outcome: OnboardingOutcome;
}

type RuntimeUrlResolver = (path: string) => string;
type TabCreator = (properties: chrome.tabs.CreateProperties) => Promise<unknown>;
type CompletionReader = () => Promise<OnboardingCompletionState | null>;
type CompletionWriter = (outcome: OnboardingOutcome) => Promise<unknown>;

export function shouldOpenOnboarding(reason: string): boolean {
  return reason === "install";
}

export function onboardingPageUrl(
  replay = false,
  getUrl: RuntimeUrlResolver = (path) => chrome.runtime.getURL(path)
): string {
  const url = getUrl(ONBOARDING_PAGE_PATH);
  return replay ? `${url}?replay=1` : url;
}

export async function openOnboardingPage(
  replay = false,
  createTab: TabCreator = (properties) => chrome.tabs.create(properties),
  getUrl?: RuntimeUrlResolver
): Promise<void> {
  await createTab({ url: onboardingPageUrl(replay, getUrl) });
}

export async function runInstalledLifecycle(
  reason: string,
  boot: () => Promise<void>,
  open: () => Promise<void> = () => openOnboardingPage(),
  readCompletion: CompletionReader = readOnboardingCompletion
): Promise<void> {
  await boot();
  if (shouldOpenOnboarding(reason) && !(await readCompletion())) {
    await open();
  }
}

export function isReplayRequest(search: string): boolean {
  return new URLSearchParams(search).get("replay") === "1";
}

export function parseOnboardingCompletion(value: unknown): OnboardingCompletionState | null {
  if (!isRecord(value)) {
    return null;
  }

  const outcome = value.outcome;
  if (
    value.version !== ONBOARDING_VERSION
    || typeof value.completedAt !== "number"
    || !Number.isFinite(value.completedAt)
    || value.completedAt <= 0
    || (outcome !== "skipped" && outcome !== "setup_only" && outcome !== "session_started")
  ) {
    return null;
  }

  return {
    version: ONBOARDING_VERSION,
    completedAt: value.completedAt,
    outcome
  };
}

export async function readOnboardingCompletion(): Promise<OnboardingCompletionState | null> {
  const stored = await chrome.storage.local.get(ONBOARDING_STATE_KEY);
  return parseOnboardingCompletion(stored[ONBOARDING_STATE_KEY]);
}

export async function completeOnboarding(
  outcome: OnboardingOutcome,
  completedAt = Date.now()
): Promise<OnboardingCompletionState> {
  const state: OnboardingCompletionState = {
    version: ONBOARDING_VERSION,
    completedAt,
    outcome
  };
  await chrome.storage.local.set({ [ONBOARDING_STATE_KEY]: state });
  return state;
}

export async function startOnboardingSession(
  startSession: () => Promise<void>,
  writeCompletion: CompletionWriter = completeOnboarding
): Promise<{ completionSaved: boolean }> {
  await startSession();
  try {
    await writeCompletion("session_started");
    return { completionSaved: true };
  } catch {
    return { completionSaved: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
