import type { Intensity, Session } from "./types";

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
  | { type: "END_SESSION"; payload: { reason: EndSessionReason } }
  | { type: "GET_STATE" }
  | { type: "SNOOZE_REQUEST"; payload: { domain: string } }
  | { type: "TEMP_ALLOW"; payload: { domain: string; minutes: number } };

export type FocusWhaleEvent =
  | { type: "SESSION_COMPLETED"; payload: { session: Session } };

export type FocusWhaleMessage = FocusWhaleRequest | FocusWhaleEvent;

export interface FocusWhaleState {
  activeSession: Session | null;
}

export type MessageResponse<T extends FocusWhaleMessage> =
  T["type"] extends "GET_STATE" ? { ok: true; state: FocusWhaleState } :
  T["type"] extends "SNOOZE_REQUEST" ? { ok: true; nextSnoozeDelayMin: number } :
  T["type"] extends "SESSION_COMPLETED" ? { ok: true } :
  { ok: true };

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
    await wait(50);
    return sendOnce(message);
  }
}
