import type { DailyStats, PetState, Schedule, Session, SiteList, TempAllow } from "./types";

export interface Settings {
  focusHours?: { startHHMM: string; endHHMM: string };
  softOverlaySeconds: number;
}

export interface ResolvedSettings extends Settings {
  focusHours: { startHHMM: string; endHHMM: string };
}

export const DEFAULT_SETTINGS: ResolvedSettings = {
  focusHours: { startHHMM: "09:00", endHHMM: "12:00" },
  softOverlaySeconds: 10
};

export function normalizeSettings(value: unknown): ResolvedSettings {
  const candidate = value as Partial<Settings> | undefined;
  const startHHMM = isHHMM(candidate?.focusHours?.startHHMM)
    ? candidate.focusHours.startHHMM
    : DEFAULT_SETTINGS.focusHours.startHHMM;
  const candidateEnd = candidate?.focusHours?.endHHMM;
  const endHHMM = isHHMM(candidateEnd) && candidateEnd !== startHHMM
    ? candidateEnd
    : DEFAULT_SETTINGS.focusHours.endHHMM !== startHHMM
      ? DEFAULT_SETTINGS.focusHours.endHHMM
      : DEFAULT_SETTINGS.focusHours.startHHMM;
  const softOverlaySeconds = Number(candidate?.softOverlaySeconds);

  return {
    focusHours: { startHHMM, endHHMM },
    softOverlaySeconds: Number.isFinite(softOverlaySeconds)
      ? Math.min(60, Math.max(3, Math.round(softOverlaySeconds)))
      : DEFAULT_SETTINGS.softOverlaySeconds
  };
}

export interface SyncStorageSchema {
  settings: Settings;
  siteLists: SiteList[];
  schedules: Schedule[];
  petState: PetState;
}

export interface LocalStorageSchema {
  activeSession: Session | null;
  tempAllows: TempAllow[];
  sessionLog: Session[];
  intentLog: Array<{ at: number; domain: string; intent: string; sessionId?: string }>;
}

export type StorageArea = "sync" | "local";
export type SyncStorageKey = keyof SyncStorageSchema;
export type LocalStorageKey = keyof LocalStorageSchema | `dailyStats:${string}`;

export const STORAGE_KEYS = {
  sync: {
    settings: "settings",
    siteLists: "siteLists",
    schedules: "schedules",
    petState: "petState"
  },
  local: {
    activeSession: "activeSession",
    tempAllows: "tempAllows",
    sessionLog: "sessionLog",
    intentLog: "intentLog",
    dailyStats: (date: string) => `dailyStats:${date}` as const
  }
} as const;

type KnownLocalValue<K extends LocalStorageKey> =
  K extends `dailyStats:${string}` ? DailyStats : K extends keyof LocalStorageSchema ? LocalStorageSchema[K] : never;

type StorageValue<A extends StorageArea, K extends string> =
  A extends "sync"
    ? K extends keyof SyncStorageSchema ? SyncStorageSchema[K] : unknown
    : K extends LocalStorageKey ? KnownLocalValue<K> : unknown;

export interface TypedStorageChange<T = unknown> {
  key: string;
  oldValue?: T;
  newValue?: T;
}

function storageArea(area: StorageArea): chrome.storage.StorageArea {
  return chrome.storage[area];
}

export async function getTyped<K extends SyncStorageKey>(
  area: "sync",
  key: K
): Promise<SyncStorageSchema[K] | undefined>;
export async function getTyped<K extends LocalStorageKey>(
  area: "local",
  key: K
): Promise<KnownLocalValue<K> | undefined>;
export async function getTyped<T = unknown>(area: StorageArea, key: string): Promise<T | undefined>;
export async function getTyped(area: StorageArea, key: string): Promise<unknown> {
  const result = await storageArea(area).get(key);
  return result[key];
}

export async function setTyped<K extends SyncStorageKey>(
  area: "sync",
  key: K,
  value: SyncStorageSchema[K]
): Promise<void>;
export async function setTyped<K extends LocalStorageKey>(
  area: "local",
  key: K,
  value: KnownLocalValue<K>
): Promise<void>;
export async function setTyped<T = unknown>(area: StorageArea, key: string, value: T): Promise<void>;
export async function setTyped(area: StorageArea, key: string, value: unknown): Promise<void> {
  await storageArea(area).set({ [key]: value });
}

export async function removeTyped(area: StorageArea, key: string): Promise<void> {
  await storageArea(area).remove(key);
}

export function subscribeTyped(
  onChange: (changes: Array<TypedStorageChange<StorageValue<StorageArea, string>>>, area: StorageArea) => void
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== "sync" && areaName !== "local") {
      return;
    }

    const typedChanges = Object.entries(changes).map(([key, change]) => ({
      key,
      oldValue: change.oldValue,
      newValue: change.newValue
    }));

    onChange(typedChanges, areaName);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

function isHHMM(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}
