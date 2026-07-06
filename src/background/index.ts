import type { FocusWhaleRequest } from "../shared/messaging";
import { ChromeDynamicRuleClient } from "./rules";
import {
  EMERGENCY_END_ALARM,
  SESSION_END_ALARM,
  TEMP_ALLOW_ALARM_PREFIX,
  SessionManager
} from "./session";
import { SCHEDULE_RECONCILE_ALARM, ScheduleManager } from "./schedule";

const sessionManager = new SessionManager(new ChromeDynamicRuleClient());
const scheduleManager = new ScheduleManager(sessionManager);
const revertingSyncKeys = new Set<string>();

chrome.runtime.onInstalled.addListener(() => {
  void boot();
});

chrome.runtime.onStartup.addListener(() => {
  void boot();
});

chrome.runtime.onMessage.addListener((message: FocusWhaleRequest, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm.name);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  void handleSyncStorageChange(changes);
});

async function boot(): Promise<void> {
  await sessionManager.reconcile();
  await scheduleManager.reconcile();
}

async function handleMessage(message: FocusWhaleRequest): Promise<unknown> {
  switch (message.type) {
    case "START_SESSION": {
      const session = await sessionManager.startSession(message.payload);
      return { ok: true, session };
    }
    case "END_SESSION": {
      const session = await sessionManager.endSession(message.payload.reason);
      return { ok: true, session };
    }
    case "GET_STATE": {
      return { ok: true, state: { activeSession: await sessionManager.getActiveSession() } };
    }
    case "SNOOZE_REQUEST": {
      return { ok: true, nextSnoozeDelayMin: await sessionManager.registerSnooze() };
    }
    case "TEMP_ALLOW": {
      await sessionManager.addTempAllow(message.payload.domain, message.payload.minutes);
      return { ok: true };
    }
    default:
      return assertNever(message);
  }
}

async function handleAlarm(name: string): Promise<void> {
  if (name === SESSION_END_ALARM) {
    await sessionManager.completeDueSession();
    await scheduleManager.reconcile();
    return;
  }

  if (name === EMERGENCY_END_ALARM) {
    await sessionManager.completeEmergencyIfDue();
    await scheduleManager.reconcile();
    return;
  }

  if (name === SCHEDULE_RECONCILE_ALARM) {
    await sessionManager.reconcile();
    await scheduleManager.reconcile();
    return;
  }

  if (name.startsWith(TEMP_ALLOW_ALARM_PREFIX)) {
    await sessionManager.syncTempAllowRules();
  }
}

async function handleSyncStorageChange(changes: Record<string, chrome.storage.StorageChange>): Promise<void> {
  await sessionManager.rejectLockedSettingChanges(changes, revertingSyncKeys);
  await sessionManager.reconcile();
  await scheduleManager.reconcile();
}

function assertNever(value: never): never {
  throw new Error(`Unknown message: ${JSON.stringify(value)}`);
}
