import { describe, expect, it } from "vitest";
import type { Schedule } from "../shared/types";
import { findActiveScheduleWindow, nextScheduleBoundary, scheduleWindowAt } from "./schedule";

const weekdaySchedule: Schedule = {
  id: "weekday",
  enabled: true,
  days: [1],
  startHHMM: "09:00",
  endHHMM: "10:30",
  listId: "work",
  intensity: "medium"
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
