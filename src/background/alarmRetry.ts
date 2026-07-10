export interface AlarmRetryClient {
  create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void>;
}

export async function runAlarmWithRetry(
  name: string,
  operation: () => Promise<void>,
  alarms: AlarmRetryClient,
  delayInMinutes = 1,
  rearmAttempts = 3
): Promise<void> {
  try {
    await operation();
  } catch {
    let lastError: unknown;
    for (let attempt = 0; attempt < rearmAttempts; attempt += 1) {
      try {
        await alarms.create(name, { delayInMinutes });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
