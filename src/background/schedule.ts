import { STORAGE_KEYS, getTyped } from "../shared/storage";
import type { Schedule, Session } from "../shared/types";
import {
  SCHEDULE_SUPPRESSION_KEY,
  type ScheduleSuppression,
  type StartSessionInput
} from "./session";

export const SCHEDULE_RECONCILE_ALARM = "focuswhale:schedule-reconcile";

export interface ScheduleSessionController {
  getActiveSession(): Promise<Session | null>;
  startSession(input: StartSessionInput, now?: number): Promise<Session>;
  finalizeScheduleSession(now?: number): Promise<Session | null>;
}

export class ScheduleManager {
  constructor(private readonly sessions: ScheduleSessionController) {}

  async reconcile(now = Date.now()): Promise<void> {
    const [storedSchedules, storedSiteLists, storedSuppression] = await Promise.all([
      getTyped("sync", STORAGE_KEYS.sync.schedules),
      getTyped("sync", STORAGE_KEYS.sync.siteLists),
      getTyped<ScheduleSuppression>("local", SCHEDULE_SUPPRESSION_KEY)
    ]);
    const schedules = schedulesForExistingLists(storedSchedules, storedSiteLists);
    const activeWindow = findActiveScheduleWindow(schedules, new Date(now));
    const activeSession = await this.sessions.getActiveSession();
    const suppression = storedSuppression && storedSuppression.windowEnd > now
      ? storedSuppression
      : null;
    if (storedSuppression && !suppression) {
      await chrome.storage.local.remove(SCHEDULE_SUPPRESSION_KEY);
    }

    if (activeWindow) {
      const occurrenceSuppressed = Boolean(
        suppression
        && suppression.windowEnd === activeWindow.end.getTime()
        && (
          suppression.scheduleId === activeWindow.schedule.id
          || (!suppression.scheduleId && suppression.listId === activeWindow.schedule.listId)
        )
      );
      if (!activeSession && !occurrenceSuppressed) {
        await this.sessions.startSession(
          {
            listId: activeWindow.schedule.listId,
            intensity: activeWindow.schedule.intensity,
            durationMinutes: Math.max(1, Math.ceil((activeWindow.end.getTime() - now) / 60_000)),
            source: "schedule",
            scheduleId: activeWindow.schedule.id,
            scheduleWindowEnd: activeWindow.end.getTime()
          },
          now
        );
      }
    } else if (activeSession?.source === "schedule") {
      await this.sessions.finalizeScheduleSession(now);
    }

    await this.registerNextBoundaryAlarm(schedules, new Date(now));
  }

  private async registerNextBoundaryAlarm(schedules: Schedule[], now: Date): Promise<void> {
    const nextBoundary = nextScheduleBoundary(schedules, now);
    if (nextBoundary) {
      await chrome.alarms.create(SCHEDULE_RECONCILE_ALARM, { when: nextBoundary.getTime() });
    }
  }
}

export function findActiveScheduleWindow(
  schedules: Schedule[],
  at: Date
): { schedule: Schedule; start: Date; end: Date } | null {
  for (const schedule of schedules) {
    const window = scheduleWindowAt(schedule, at);
    if (window) {
      return { schedule, ...window };
    }
  }

  return null;
}

export function scheduleWindowAt(schedule: Schedule, at: Date): { start: Date; end: Date } | null {
  const parsed = parseSchedule(schedule);
  if (!parsed || !parsed.schedule.enabled || !isValidDate(at)) {
    return null;
  }

  const { schedule: validSchedule, startMinute, endMinute } = parsed;

  const currentMinute = at.getHours() * 60 + at.getMinutes();
  const currentDay = at.getDay();

  if (startMinute < endMinute) {
    if (!validSchedule.days.includes(currentDay) || currentMinute < startMinute || currentMinute >= endMinute) {
      return null;
    }

    return {
      start: dateAtMinute(at, startMinute),
      end: dateAtMinute(at, endMinute)
    };
  }

  if (currentMinute >= startMinute && validSchedule.days.includes(currentDay)) {
    return {
      start: dateAtMinute(at, startMinute),
      end: dateAtMinute(addDays(at, 1), endMinute)
    };
  }

  const previousDay = wrapWeekday(currentDay - 1);
  if (currentMinute < endMinute && validSchedule.days.includes(previousDay)) {
    return {
      start: dateAtMinute(addDays(at, -1), startMinute),
      end: dateAtMinute(at, endMinute)
    };
  }

  return null;
}

export function nextScheduleBoundary(schedules: Schedule[], after: Date): Date | null {
  if (!isValidDate(after)) {
    return null;
  }

  const candidates: Date[] = [];
  for (const candidate of schedules) {
    const parsed = parseSchedule(candidate);
    if (!parsed || !parsed.schedule.enabled) {
      continue;
    }
    const { schedule, startMinute, endMinute } = parsed;

    for (let offset = -1; offset <= 8; offset += 1) {
      const date = addDays(after, offset);
      if (!schedule.days.includes(date.getDay())) {
        continue;
      }

      const start = dateAtMinute(date, startMinute);
      const end = dateAtMinute(startMinute < endMinute ? date : addDays(date, 1), endMinute);
      candidates.push(start, end);
    }
  }

  const futureCandidates = candidates
    .filter((candidate) => candidate.getTime() > after.getTime())
    .sort((left, right) => left.getTime() - right.getTime());

  return futureCandidates[0] ?? null;
}

type ParsedSchedule = { schedule: Schedule; startMinute: number; endMinute: number };

function schedulesForExistingLists(storedSchedules: unknown, storedSiteLists: unknown): Schedule[] {
  if (!Array.isArray(storedSchedules) || !Array.isArray(storedSiteLists)) {
    return [];
  }

  const listIds = new Set(storedSiteLists.flatMap((value) => {
    if (!isRecord(value) || typeof value.id !== "string" || value.id.trim() === "") {
      return [];
    }
    return [value.id];
  }));

  return storedSchedules.flatMap((value) => {
    const parsed = parseSchedule(value);
    return parsed && listIds.has(parsed.schedule.listId) ? [parsed.schedule] : [];
  });
}

function parseSchedule(value: unknown): ParsedSchedule | null {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || value.id.trim() === ""
    || typeof value.enabled !== "boolean"
    || !Array.isArray(value.days)
    || value.days.length === 0
    || !value.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    || typeof value.listId !== "string"
    || value.listId.trim() === ""
    || (value.intensity !== "soft" && value.intensity !== "medium" && value.intensity !== "hard")) {
    return null;
  }

  const startMinute = parseHHMM(value.startHHMM);
  const endMinute = parseHHMM(value.endHHMM);
  if (startMinute === null || endMinute === null || startMinute === endMinute) {
    return null;
  }

  return { schedule: value as unknown as Schedule, startMinute, endMinute };
}

function parseHHMM(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function dateAtMinute(date: Date, minuteOfDay: number): Date {
  const next = new Date(date);
  next.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function wrapWeekday(day: number): number {
  return (day + 7) % 7;
}

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
