import type { Settings } from "./storage";
import type { Intensity, PetState, Schedule, Session, SiteList } from "./types";

export type EndSessionReason = "completed" | "aborted" | "emergency";

export type FocusWhaleRequest =
  | {
      type: "START_SESSION";
      payload: {
        listId: string;
        intensity: Intensity;
        durationMinutes: number;
        source?: "manual" | "schedule";
      };
    }
  | { type: "UPGRADE_SESSION_INTENSITY"; payload: { intensity: Intensity } }
  | { type: "END_SESSION"; payload: { reason: EndSessionReason } }
  | { type: "GET_STATE" }
  | { type: "RECONCILE_PET" }
  | { type: "SET_PET_NAME"; payload: { name: string } }
  | { type: "ACK_CELEBRATIONS"; payload: { eventIds: string[] } }
  | { type: "PATCH_SETTINGS"; payload: { patch: Partial<Pick<Settings, "softOverlaySeconds" | "focusHours">> } }
  | { type: "CREATE_SITE_LIST"; payload: { siteList: SiteList } }
  | { type: "UPDATE_SITE_LIST"; payload: { siteList: SiteList } }
  | { type: "DELETE_SITE_LIST"; payload: { siteListId: string } }
  | { type: "CREATE_SCHEDULE"; payload: { schedule: Schedule } }
  | { type: "UPDATE_SCHEDULE"; payload: { schedule: Schedule } }
  | { type: "DELETE_SCHEDULE"; payload: { scheduleId: string } }
  | { type: "ADD_RECOMMENDATION_DOMAIN"; payload: { domain: string } }
  | { type: "ANALYZE_HISTORY" }
  | { type: "CLEAR_LOCAL_DATA" }
  | { type: "RECORD_BLOCKED_ATTEMPT"; payload: { domain: string } }
  | { type: "REQUEST_TEMP_ALLOW"; payload: { domain: string; intent: string; sessionId: string } };

export type FocusWhaleEvent =
  | { type: "SESSION_COMPLETED"; payload: { session: Session } };

export type FocusWhaleMessage = FocusWhaleRequest | FocusWhaleEvent;

export interface FocusWhaleState {
  activeSession: Session | null;
  pendingEmergency: { sessionId: string; dueAt: number } | null;
}

type MessageFailure = { ok: false; error: string };

type MessageSuccess<T extends FocusWhaleMessage> =
  T["type"] extends "START_SESSION" | "UPGRADE_SESSION_INTENSITY" ? { ok: true; session: Session } :
  T["type"] extends "END_SESSION" ? { ok: true; session: Session | null; emergencyDueAt?: number } :
  T["type"] extends "GET_STATE" ? { ok: true; state: FocusWhaleState } :
  T["type"] extends "RECONCILE_PET" ? {
    ok: true;
    pet: { awardedXp: number; petState: PetState; streakStatus: "active" | "resting" | "fresh" };
  } :
  T["type"] extends "SET_PET_NAME" ? { ok: true; petState: PetState } :
  T["type"] extends "REQUEST_TEMP_ALLOW" ? { ok: true; nextSnoozeDelayMin: number; until: number } :
  T["type"] extends "SESSION_COMPLETED" ? { ok: true } :
  { ok: true };

export type MessageResponse<T extends FocusWhaleMessage> = MessageSuccess<T> | MessageFailure;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function sendOnce<T extends FocusWhaleMessage>(message: T): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

export async function sendMessage<T extends FocusWhaleMessage>(message: T): Promise<MessageResponse<T>> {
  try {
    return await sendOnce(message);
  } catch (error) {
    if (message.type !== "GET_STATE") {
      throw error;
    }
    await wait(50);
    return sendOnce(message);
  }
}
