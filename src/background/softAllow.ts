export const SOFT_ALLOW_SESSION_KEY = "focuswhaleSoftAllows";

export type SoftAllowLedger = Record<string, number>;

export function softAllowKey(sessionId: string, hostname: string): string {
  return `${sessionId}:${hostname}`;
}

export function activeSoftAllows(value: unknown, now = Date.now()): SoftAllowLedger {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => (
    typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > now
  )));
}

export function hasSoftAllow(
  value: unknown,
  sessionId: string,
  hostname: string,
  now = Date.now()
): boolean {
  return activeSoftAllows(value, now)[softAllowKey(sessionId, hostname)] !== undefined;
}

export function grantSoftAllow(
  value: unknown,
  sessionId: string,
  hostname: string,
  expiresAt: number,
  now = Date.now()
): SoftAllowLedger {
  return {
    ...activeSoftAllows(value, now),
    [softAllowKey(sessionId, hostname)]: expiresAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
