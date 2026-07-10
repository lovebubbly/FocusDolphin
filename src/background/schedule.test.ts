import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../shared/storage";
import type { Schedule, Session, SiteList } from "../shared/types";
import {
  findActiveScheduleWindow,
  nextScheduleBoundary,
  ScheduleManager,
  type ScheduleSessionController,
  scheduleWindowAt
} from "./schedule";
import { SCHEDULE_SUPPRESSION_KEY, type ScheduleSuppression, type StartSessionInput } from "./session";

const weekdaySchedule: Schedule = {
  id: "weekday",
  enabled: true,
  days: [1],
  startHHMM: "09:00",
  endHHMM: "10:30",
  listId: "work",
  intensity: "medium"
};
const workList: SiteList = {
  id: "work",
  name: "Work",
  mode: "blocklist",
  domains: ["example.com"]
};

describe("scheduleWindowAt", () => {
  it("includes the start boundary and excludes the end boundary", () => {
    expect(scheduleWindowAt(weekdaySchedule, new Date("2026-07-06T09:00:00"))).toMatchObject({
      start: new Date("2026-07-06T09:00:00"),
      end: new Date("2026-07-06T10:30:00")
    });
    expect(scheduleWindowAt(weekdaySchedule, new Date("2026-07-06T10:29:59"))).not.toBeNull();
    expect(scheduleWindowAt(weekdaySchedule, new Date("2026-07-06T10:30:00"))).toBeNull();
  });

  it("handles overnight schedules against the previous enabled day", () => {
    const overnight: Schedule = {
      id: "night",
      enabled: true,
      days: [1],
      startHHMM: "23:00",
      endHHMM: "02:00",
      listId: "work",
      intensity: "hard"
    };

    expect(scheduleWindowAt(overnight, new Date("2026-07-06T23:30:00"))).toMatchObject({
      start: new Date("2026-07-06T23:00:00"),
      end: new Date("2026-07-07T02:00:00")
    });
    expect(scheduleWindowAt(overnight, new Date("2026-07-07T01:59:00"))).not.toBeNull();
    expect(scheduleWindowAt(overnight, new Date("2026-07-07T02:00:00"))).toBeNull();
  });

  it("fails closed for malformed legacy schedule values without throwing", () => {
    const malformed = [
      { ...weekdaySchedule, startHHMM: "" },
      { ...weekdaySchedule, startHHMM: "9:00" },
      { ...weekdaySchedule, startHHMM: "25:00" },
      { ...weekdaySchedule, endHHMM: "09:00" },
      { ...weekdaySchedule, days: [] },
      { ...weekdaySchedule, days: [-1] },
      { ...weekdaySchedule, days: [7] },
      { ...weekdaySchedule, days: [1.5] },
      { ...weekdaySchedule, listId: " " },
      { ...weekdaySchedule, listId: undefined },
      { ...weekdaySchedule, intensity: "extreme" }
    ] as unknown as Schedule[];
    const duringWindow = new Date("2026-07-06T09:15:00");

    for (const schedule of malformed) {
      expect(() => scheduleWindowAt(schedule, duringWindow)).not.toThrow();
      expect(scheduleWindowAt(schedule, duringWindow)).toBeNull();
      expect(() => nextScheduleBoundary([schedule], duringWindow)).not.toThrow();
      expect(nextScheduleBoundary([schedule], duringWindow)).toBeNull();
    }
    expect(findActiveScheduleWindow(malformed, duringWindow)).toBeNull();
    expect(scheduleWindowAt(weekdaySchedule, new Date(Number.NaN))).toBeNull();
    expect(nextScheduleBoundary([weekdaySchedule], new Date(Number.NaN))).toBeNull();
  });

  it("keeps Sunday weekday zero valid", () => {
    const sunday = { ...weekdaySchedule, days: [0] };
    expect(scheduleWindowAt(sunday, new Date("2026-07-05T09:15:00"))).not.toBeNull();
  });
});

describe("findActiveScheduleWindow", () => {
  it("returns the first active schedule window for reconcile decisions", () => {
    const active = findActiveScheduleWindow([weekdaySchedule], new Date("2026-07-06T09:15:00"));

    expect(active?.schedule.id).toBe("weekday");
    expect(active?.end).toEqual(new Date("2026-07-06T10:30:00"));
  });
});

describe("nextScheduleBoundary", () => {
  it("finds the next start or end boundary after the current time", () => {
    expect(nextScheduleBoundary([weekdaySchedule], new Date("2026-07-06T08:59:00"))).toEqual(
      new Date("2026-07-06T09:00:00")
    );
    expect(nextScheduleBoundary([weekdaySchedule], new Date("2026-07-06T09:15:00"))).toEqual(
      new Date("2026-07-06T10:30:00")
    );
  });
});

describe("ScheduleManager occurrence suppression", () => {
  let localStore: Record<string, unknown>;
  let syncStore: Record<string, unknown>;
  let controller: ScheduleSessionController;
  let startSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStore = {};
    syncStore = {
      [STORAGE_KEYS.sync.schedules]: [weekdaySchedule],
      [STORAGE_KEYS.sync.siteLists]: [workList]
    };
    const makeArea = (store: Record<string, unknown>) => ({
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      remove: vi.fn(async (key: string) => {
        delete store[key];
      })
    });
    startSession = vi.fn(async (input: StartSessionInput, now = Date.now()): Promise<Session> => ({
      id: "started-schedule-session",
      source: "schedule",
      scheduleId: input.scheduleId,
      scheduleWindowEnd: input.scheduleWindowEnd,
      listId: input.listId,
      intensity: input.intensity,
      startedAt: now,
      endsAt: input.scheduleWindowEnd ?? now + input.durationMinutes * 60_000,
      status: "active",
      snoozeCount: 0,
      nextSnoozeDelayMin: 15
    }));
    controller = {
      getActiveSession: vi.fn(async () => null),
      startSession,
      finalizeScheduleSession: vi.fn(async () => null)
    };

    vi.stubGlobal("chrome", {
      storage: {
        sync: makeArea(syncStore),
        local: makeArea(localStore)
      },
      alarms: {
        create: vi.fn(async () => undefined)
      }
    });
  });

  it("does not immediately restart an aborted schedule occurrence inside its window", async () => {
    const windowEnd = new Date("2026-07-06T10:30:00").getTime();
    localStore[SCHEDULE_SUPPRESSION_KEY] = {
      scheduleId: weekdaySchedule.id,
      listId: weekdaySchedule.listId,
      windowEnd,
      sessionId: "aborted-session"
    } satisfies ScheduleSuppression;

    await new ScheduleManager(controller).reconcile(new Date("2026-07-06T09:45:00").getTime());

    expect(startSession).not.toHaveBeenCalled();
    expect(chrome.alarms.create).toHaveBeenCalledWith("focuswhale:schedule-reconcile", { when: windowEnd });
  });

  it("surfaces a boundary-alarm creation failure so the retry wrapper can recover", async () => {
    vi.mocked(chrome.alarms.create).mockRejectedValueOnce(new Error("alarm unavailable"));

    await expect(new ScheduleManager(controller).reconcile(new Date("2026-07-06T08:00:00").getTime()))
      .rejects.toThrow("alarm unavailable");
  });

  it("expires suppression at the window end and allows the next occurrence to start", async () => {
    const firstWindowEnd = new Date("2026-07-06T10:30:00").getTime();
    localStore[SCHEDULE_SUPPRESSION_KEY] = {
      scheduleId: weekdaySchedule.id,
      listId: weekdaySchedule.listId,
      windowEnd: firstWindowEnd,
      sessionId: "aborted-session"
    } satisfies ScheduleSuppression;
    const manager = new ScheduleManager(controller);

    await manager.reconcile(firstWindowEnd);
    expect(localStore[SCHEDULE_SUPPRESSION_KEY]).toBeUndefined();
    expect(startSession).not.toHaveBeenCalled();

    const nextStart = new Date("2026-07-13T09:00:00").getTime();
    await manager.reconcile(nextStart);

    expect(startSession).toHaveBeenCalledOnce();
    expect(startSession).toHaveBeenCalledWith({
      listId: "work",
      intensity: "medium",
      durationMinutes: 90,
      source: "schedule",
      scheduleId: "weekday",
      scheduleWindowEnd: new Date("2026-07-13T10:30:00").getTime()
    }, nextStart);
  });

  it("uses scheduleId to distinguish overlapping overnight occurrences on the same list", async () => {
    const overnight: Schedule = {
      id: "night",
      enabled: true,
      days: [1],
      startHHMM: "23:00",
      endHHMM: "02:00",
      listId: "work",
      intensity: "hard"
    };
    syncStore[STORAGE_KEYS.sync.schedules] = [overnight];
    const now = new Date("2026-07-07T01:00:00").getTime();
    localStore[SCHEDULE_SUPPRESSION_KEY] = {
      scheduleId: "different-schedule",
      listId: overnight.listId,
      windowEnd: new Date("2026-07-07T02:00:00").getTime(),
      sessionId: "other-aborted-session"
    } satisfies ScheduleSuppression;

    await new ScheduleManager(controller).reconcile(now);

    expect(startSession).toHaveBeenCalledWith({
      listId: "work",
      intensity: "hard",
      durationMinutes: 60,
      source: "schedule",
      scheduleId: "night",
      scheduleWindowEnd: new Date("2026-07-07T02:00:00").getTime()
    }, now);
  });

  it("uses the exact window end when reconcile starts after a millisecond offset", async () => {
    const now = new Date("2026-07-06T09:00:00.123").getTime();
    const exactEnd = new Date("2026-07-06T10:30:00.000").getTime();

    await new ScheduleManager(controller).reconcile(now);

    expect(startSession).toHaveBeenCalledWith(expect.objectContaining({
      durationMinutes: 90,
      scheduleId: "weekday",
      scheduleWindowEnd: exactEnd
    }), now);
  });

  it("ignores malformed legacy schedules during reconcile", async () => {
    syncStore[STORAGE_KEYS.sync.schedules] = [
      { ...weekdaySchedule, startHHMM: "" },
      { ...weekdaySchedule, id: "equal", startHHMM: "09:00", endHHMM: "09:00" },
      { ...weekdaySchedule, id: "no-days", days: [] },
      { ...weekdaySchedule, id: "no-list", listId: "" }
    ];

    await expect(new ScheduleManager(controller).reconcile(
      new Date("2026-07-06T09:15:00").getTime()
    )).resolves.toBeUndefined();

    expect(startSession).not.toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it("does not start a schedule whose site list was deleted", async () => {
    syncStore[STORAGE_KEYS.sync.siteLists] = [];

    await new ScheduleManager(controller).reconcile(new Date("2026-07-06T09:15:00").getTime());

    expect(startSession).not.toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });
});
