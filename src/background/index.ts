import type { FocusWhaleRequest } from "../shared/messaging";
import { STORAGE_KEYS, getTyped, normalizeSettings, setTyped } from "../shared/storage";
import { migrateSiteListsForCurrentDefaults } from "../shared/siteLists";
import { ChromeDynamicRuleClient } from "./rules";
import {
  EMERGENCY_END_ALARM,
  SESSION_END_ALARM,
  TEMP_ALLOW_ALARM_PREFIX,
  SessionManager
} from "./session";
import { SCHEDULE_RECONCILE_ALARM, ScheduleManager } from "./schedule";
import { redirectOpenBlockedTabs, redirectTabIfBlocked } from "./tabRedirect";
import { reconcilePetGamification, savePetName } from "../pet/reconcile";
import { acknowledgeCelebrations } from "../pet/growth";
import { chromeHistoryClient, runRecommendationPipeline } from "../analytics/history";
import { MutationGeneration, SerialOperationQueue } from "./operationQueue";
import { requireTrustedBlockedPageSender } from "./blockedPageSender";
import { runAlarmWithRetry } from "./alarmRetry";
import { HistoryAnalysisCoordinator } from "./historyAnalysis";
import {
  addRecommendationDomain,
  applySettingsPatch,
  createSchedule,
  createSiteList,
  deleteSchedule,
  deleteSiteList,
  recommendationAnalysisContext,
  updateSchedule,
  updateSiteList
} from "./config";

type QueuedFocusWhaleRequest = Exclude<FocusWhaleRequest, { type: "ANALYZE_HISTORY" }>;

const sessionManager = new SessionManager(new ChromeDynamicRuleClient());
const scheduleManager = new ScheduleManager(sessionManager);
const revertingSyncValues = new Map<string, unknown>();
const backgroundOperations = new SerialOperationQueue();
const localDataGeneration = new MutationGeneration();
const historyAnalysis = new HistoryAnalysisCoordinator({
  operations: backgroundOperations,
  generation: localDataGeneration,
  hasHistoryPermission: () => chrome.permissions.contains({ permissions: ["history"] }),
  loadContext: async () => {
    const [siteLists, settings] = await Promise.all([
      getTyped("sync", STORAGE_KEYS.sync.siteLists),
      getTyped("sync", STORAGE_KEYS.sync.settings)
    ]);
    return recommendationAnalysisContext(siteLists, settings);
  },
  runPipeline: (writer, options) => runRecommendationPipeline(chromeHistoryClient, writer, options),
  commit: (items) => chrome.storage.local.set(items)
});

chrome.runtime.onInstalled.addListener(() => {
  void backgroundOperations
    .run(() => runAlarmWithRetry(SCHEDULE_RECONCILE_ALARM, boot, chrome.alarms))
    .catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  void backgroundOperations
    .run(() => runAlarmWithRetry(SCHEDULE_RECONCILE_ALARM, boot, chrome.alarms))
    .catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: FocusWhaleRequest, sender, sendResponse) => {
  const operation = message.type === "ANALYZE_HISTORY"
    ? historyAnalysis.analyze()
    : backgroundOperations.run(() => handleMessage(message, sender));
  void operation
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void backgroundOperations
    .run(() => runAlarmWithRetry(alarm.name, () => handleAlarmOnce(alarm.name), chrome.alarms))
    .catch(() => undefined);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  void backgroundOperations
    .run(() => runAlarmWithRetry(
      SCHEDULE_RECONCILE_ALARM,
      () => handleSyncStorageChange(changes),
      chrome.alarms
    ))
    .catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }
  void backgroundOperations
    .run(() => redirectTabIfBlocked(tabId, changeInfo.url))
    .catch(() => undefined);
});

async function boot(): Promise<void> {
  await migrateDefaultSiteLists();
  await migrateDefaultSettings();
  await sessionManager.reconcile();
  await scheduleManager.reconcile();
  await redirectOpenBlockedTabs();
}

async function migrateDefaultSettings(): Promise<void> {
  const storedSettings = await getTyped("sync", STORAGE_KEYS.sync.settings);
  const settings = normalizeSettings(storedSettings);
  if (JSON.stringify(storedSettings) !== JSON.stringify(settings)) {
    await setTyped("sync", STORAGE_KEYS.sync.settings, settings);
  }
}

async function migrateDefaultSiteLists(): Promise<void> {
  const storedSiteLists = await getTyped("sync", STORAGE_KEYS.sync.siteLists);
  const migration = migrateSiteListsForCurrentDefaults(storedSiteLists);
  if (migration.changed) {
    await setTyped("sync", STORAGE_KEYS.sync.siteLists, migration.siteLists);
  }
}

async function handleMessage(message: QueuedFocusWhaleRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "START_SESSION": {
      const session = await sessionManager.startSession(message.payload);
      await redirectOpenBlockedTabs();
      return { ok: true, session };
    }
    case "UPGRADE_SESSION_INTENSITY": {
      const session = await sessionManager.upgradeIntensity(message.payload.intensity);
      await redirectOpenBlockedTabs();
      return { ok: true, session };
    }
    case "END_SESSION": {
      const session = await sessionManager.endSession(message.payload.reason);
      return { ok: true, session, emergencyDueAt: (await sessionManager.getPendingEmergency())?.dueAt };
    }
    case "GET_STATE": {
      return { ok: true, state: await sessionManager.getState() };
    }
    case "RECONCILE_PET": {
      return { ok: true, pet: await reconcilePetGamification() };
    }
    case "SET_PET_NAME": {
      return { ok: true, petState: await savePetName(message.payload.name) };
    }
    case "ACK_CELEBRATIONS": {
      await acknowledgeCelebrations(message.payload.eventIds);
      return { ok: true };
    }
    case "PATCH_SETTINGS": {
      await requireConfigUnlocked();
      const current = await getTyped("sync", STORAGE_KEYS.sync.settings);
      await setTyped("sync", STORAGE_KEYS.sync.settings, applySettingsPatch(current, message.payload.patch));
      return { ok: true };
    }
    case "CREATE_SITE_LIST": {
      await requireConfigUnlocked();
      const current = (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [];
      await setTyped("sync", STORAGE_KEYS.sync.siteLists, createSiteList(current, message.payload.siteList));
      return { ok: true };
    }
    case "UPDATE_SITE_LIST": {
      await requireConfigUnlocked();
      const current = (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [];
      await setTyped("sync", STORAGE_KEYS.sync.siteLists, updateSiteList(current, message.payload.siteList));
      return { ok: true };
    }
    case "DELETE_SITE_LIST": {
      await requireConfigUnlocked();
      const [siteLists, schedules] = await Promise.all([
        getTyped("sync", STORAGE_KEYS.sync.siteLists),
        getTyped("sync", STORAGE_KEYS.sync.schedules)
      ]);
      await setTyped(
        "sync",
        STORAGE_KEYS.sync.siteLists,
        deleteSiteList(siteLists ?? [], schedules ?? [], message.payload.siteListId)
      );
      return { ok: true };
    }
    case "CREATE_SCHEDULE": {
      await requireConfigUnlocked();
      const [schedules, siteLists] = await Promise.all([
        getTyped("sync", STORAGE_KEYS.sync.schedules),
        getTyped("sync", STORAGE_KEYS.sync.siteLists)
      ]);
      await setTyped(
        "sync",
        STORAGE_KEYS.sync.schedules,
        createSchedule(schedules ?? [], siteLists ?? [], message.payload.schedule)
      );
      return { ok: true };
    }
    case "UPDATE_SCHEDULE": {
      await requireConfigUnlocked();
      const [schedules, siteLists] = await Promise.all([
        getTyped("sync", STORAGE_KEYS.sync.schedules),
        getTyped("sync", STORAGE_KEYS.sync.siteLists)
      ]);
      await setTyped(
        "sync",
        STORAGE_KEYS.sync.schedules,
        updateSchedule(schedules ?? [], siteLists ?? [], message.payload.schedule)
      );
      return { ok: true };
    }
    case "DELETE_SCHEDULE": {
      await requireConfigUnlocked();
      const schedules = (await getTyped("sync", STORAGE_KEYS.sync.schedules)) ?? [];
      await setTyped(
        "sync",
        STORAGE_KEYS.sync.schedules,
        deleteSchedule(schedules, message.payload.scheduleId)
      );
      return { ok: true };
    }
    case "ADD_RECOMMENDATION_DOMAIN": {
      await requireConfigUnlocked();
      const siteLists = (await getTyped("sync", STORAGE_KEYS.sync.siteLists)) ?? [];
      await setTyped(
        "sync",
        STORAGE_KEYS.sync.siteLists,
        addRecommendationDomain(siteLists, message.payload.domain)
      );
      return { ok: true };
    }
    case "CLEAR_LOCAL_DATA": {
      await sessionManager.clearLocalData();
      localDataGeneration.advance();
      return { ok: true };
    }
    case "RECORD_BLOCKED_ATTEMPT": {
      await sessionManager.recordBlockedAttempt(
        message.payload.domain,
        Date.now(),
        requireTrustedBlockedPageSender(sender)
      );
      return { ok: true };
    }
    case "REQUEST_TEMP_ALLOW": {
      requireTrustedBlockedPageSender(sender);
      return { ok: true, ...(await sessionManager.requestTempAllow(message.payload)) };
    }
    default:
      return assertNever(message);
  }
}

async function requireConfigUnlocked(): Promise<void> {
  if ((await sessionManager.getState()).activeSession) {
    throw new Error("집중 세션 중에는 설정을 변경할 수 없습니다.");
  }
}

async function handleAlarmOnce(name: string): Promise<void> {
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
  await sessionManager.rejectLockedSettingChanges(changes, revertingSyncValues);
  await sessionManager.reconcile();
  await scheduleManager.reconcile();
}

function assertNever(value: never): never {
  throw new Error(`Unknown message: ${JSON.stringify(value)}`);
}
