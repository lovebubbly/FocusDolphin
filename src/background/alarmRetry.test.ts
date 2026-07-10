import { describe, expect, it, vi } from "vitest";
import { runAlarmWithRetry } from "./alarmRetry";

describe("runAlarmWithRetry", () => {
  it("does not re-arm a successful alarm operation", async () => {
    const create = vi.fn(async () => undefined);

    await runAlarmWithRetry("session-end", async () => undefined, { create });

    expect(create).not.toHaveBeenCalled();
  });

  it("re-arms a failed one-shot alarm operation", async () => {
    const create = vi.fn(async () => undefined);

    await runAlarmWithRetry("schedule-reconcile", async () => {
      throw new Error("transient failure");
    }, { create });

    expect(create).toHaveBeenCalledWith("schedule-reconcile", { delayInMinutes: 1 });
  });

  it("retries a transient failure while creating the recovery alarm", async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new Error("alarm service waking"))
      .mockRejectedValueOnce(new Error("alarm service still waking"))
      .mockResolvedValue(undefined);

    await runAlarmWithRetry("schedule-reconcile", async () => {
      throw new Error("boundary registration failed");
    }, { create });

    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenLastCalledWith("schedule-reconcile", { delayInMinutes: 1 });
  });
});
