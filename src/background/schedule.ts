import { STORAGE_KEYS, getTyped } from "../shared/storage";
import type { Schedule, Session } from "../shared/types";
import type { StartSessionInput } from "./session";

export const SCHEDULE_RECONCILE_ALARM = "focuswhale:schedule-reconcile";

export interface ScheduleSessionController {
  getActiveSession(): Promise<Session | null>;
  startSession(input: StartSessionInput, now?: number): Promise<Session>;
  finalizeScheduleSession(now?: number): Promise<Session | null>;
}

export class ScheduleManager {
  constructor(private readonly sessions: ScheduleSessionController) {}

  async reconcile(now = Date.now()): Promise<void> {
    const schedules = (await getTyped("sync", STORAGE_KEYS.sync.schedules)) ?? [];
    const activeWindow = findActiveScheduleWindow(schedules, new Date(now));
    const activeSession = await this.sessions.getActiveSession();

    if (activeWindow) {
      if (!activeSession) {
        await this.sessions.startSession(
          {
            listId: activeWindow.schedule.listId,
            intensity: activeWindow.schedule.intensity,
            durationMinutes: Math.max(1, Math.ceil((activeWindow.end.getTime() - now) / 60_000)),
            source: "schedule"
          },
          now
        );
      }
    } else if (activeSession?.source === "schedule") {
      await this.sessions.finalizeScheduleSession(now);
    }

    this.registerNextBoundaryAlarm(schedules, new Date(now));
  }

  private registerNextBoundaryAlarm(schedules: Schedule[], now: Date): void {
    const nextBoundary = nextScheduleBoundary(schedules, now);
    if (nextBoundary) {
      chrome.alarms.create(SCHEDULE_RECONCILE_ALARM, { when: nextBoundary.getTime() });
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
  if (!schedule.enabled) {
    return null;
  }

  const startMinute = parseHHMM(schedule.startHHMM);
  const endMinute = parseHHMM(schedule.endHHMM);
  if (startMinute === endMinute) {
    return null;
  }

  const currentMinute = at.getHours() * 60 + at.getMinutes();
  const currentDay = at.getDay();

  if (startMinute < endMinute) {
    if (!schedule.days.includes(currentDay) || currentMinute < startMinute || currentMinute >= endMinute) {
      return null;
    }

    return {
      start: dateAtMinute(at, startMinute),
      end: dateAtMinute(at, endMinute)
    };
  }

  if (currentMinute >= startMinute && schedule.days.includes(currentDay)) {
    return {
      start: dateAtMinute(at, startMinute),
      end: dateAtMinute(addDays(at, 1), endMinute)
    };
  }

  const previousDay = wrapWeekday(currentDay - 1);
  if (currentMinute < endMinute && schedule.days.includes(previousDay)) {
    return {
      start: dateAtMinute(addDays(at, -1), startMinute),
      end: dateAtMinute(at, endMinute)
    };
  }

  return null;
}

export function nextScheduleBoundary(schedules: Schedule[], after: Date): Date | null {
  const candidates: Date[] = [];
  for (const schedule of schedules.filter((candidate) => candidate.enabled)) {
    const startMinute = parseHHMM(schedule.startHHMM);
    const endMinute = parseHHMM(schedule.endHHMM);
    if (startMinute === endMinute) {
      continue;
    }

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

function parseHHMM(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid HH:MM value: ${value}`);
  }

  return hours * 60 + minutes;
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
