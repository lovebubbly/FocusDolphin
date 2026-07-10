import { describe, expect, it } from "vitest";
import { MutationGeneration, SerialOperationQueue } from "./operationQueue";

describe("SerialOperationQueue", () => {
  it("does not start a later operation until the current operation settles", async () => {
    const queue = new SerialOperationQueue();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = queue.run(async () => {
      order.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push("first:end");
    });
    const second = queue.run(async () => {
      order.push("second");
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("continues after a rejected operation", async () => {
    const queue = new SerialOperationQueue();
    const failure = queue.run(async () => {
      throw new Error("expected failure");
    });
    const next = queue.run(async () => "recovered");

    await expect(failure).rejects.toThrow("expected failure");
    await expect(next).resolves.toBe("recovered");
  });
});

describe("MutationGeneration", () => {
  it("invalidates a long-running writer after a clear boundary", () => {
    const generation = new MutationGeneration();
    const captured = generation.capture();

    expect(generation.isCurrent(captured)).toBe(true);
    generation.advance();
    expect(generation.isCurrent(captured)).toBe(false);
    expect(generation.isCurrent(generation.capture())).toBe(true);
  });
});
