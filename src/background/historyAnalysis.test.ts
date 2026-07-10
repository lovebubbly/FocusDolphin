import { describe, expect, it, vi } from "vitest";
import { HistoryAnalysisCoordinator, HISTORY_PERMISSION_REQUIRED_ERROR, STALE_HISTORY_RESULT_ERROR } from "./historyAnalysis";
import { MutationGeneration, SerialOperationQueue } from "./operationQueue";

describe("HistoryAnalysisCoordinator", () => {
  it("deduplicates concurrent requests and commits the current result exactly once", async () => {
    const computation = deferred<void>();
    const commit = vi.fn(async () => undefined);
    const runPipeline = vi.fn(async (writer: { set(items: object): Promise<void> }) => {
      await computation.promise;
      await writer.set({ recommendations: [{ domain: "example.com" }] });
    });
    const coordinator = makeCoordinator({ runPipeline, commit });

    const first = coordinator.analyze();
    const second = coordinator.analyze();

    expect(second).toBe(first);
    computation.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(runPipeline).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith({ recommendations: [{ domain: "example.com" }] });
  });

  it("keeps pipeline computation off the operation queue", async () => {
    const pipelineStarted = deferred<void>();
    const computation = deferred<void>();
    const operations = new SerialOperationQueue();
    const coordinator = makeCoordinator({
      operations,
      runPipeline: async (writer) => {
        pipelineStarted.resolve();
        await computation.promise;
        await writer.set({ recommendations: [] });
      }
    });

    const analysis = coordinator.analyze();
    await pipelineStarted.promise;

    const dueOperation = vi.fn(async () => "due-completed");
    await expect(operations.run(dueOperation)).resolves.toBe("due-completed");
    expect(dueOperation).toHaveBeenCalledOnce();

    computation.resolve();
    await expect(analysis).resolves.toEqual({ ok: true });
  });

  it("rejects a stale result when clear advances the generation before commit", async () => {
    const pipelineStarted = deferred<void>();
    const computation = deferred<void>();
    const operations = new SerialOperationQueue();
    const generation = new MutationGeneration();
    const commit = vi.fn(async () => undefined);
    const coordinator = makeCoordinator({
      operations,
      generation,
      commit,
      runPipeline: async (writer) => {
        pipelineStarted.resolve();
        await computation.promise;
        await writer.set({ recommendations: [{ domain: "stale.example" }] });
      }
    });

    const analysis = coordinator.analyze();
    await pipelineStarted.promise;
    await operations.run(async () => {
      generation.advance();
    });
    computation.resolve();

    await expect(analysis).rejects.toThrow(STALE_HISTORY_RESULT_ERROR);
    expect(commit).not.toHaveBeenCalled();
  });

  it("fails permission denial before loading context or starting analysis", async () => {
    const loadContext = vi.fn(async () => ({ blockedDomains: [] }));
    const runPipeline = vi.fn(async () => undefined);
    const commit = vi.fn(async () => undefined);
    const coordinator = makeCoordinator({
      hasHistoryPermission: async () => false,
      loadContext,
      runPipeline,
      commit
    });

    await expect(coordinator.analyze()).rejects.toThrow(HISTORY_PERMISSION_REQUIRED_ERROR);
    expect(loadContext).not.toHaveBeenCalled();
    expect(runPipeline).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});

function makeCoordinator(overrides: Partial<ConstructorParameters<typeof HistoryAnalysisCoordinator>[0]> = {}) {
  const operations = overrides.operations ?? new SerialOperationQueue();
  const generation = overrides.generation ?? new MutationGeneration();
  return new HistoryAnalysisCoordinator({
    operations,
    generation,
    hasHistoryPermission: async () => true,
    loadContext: async () => ({
      blockedDomains: ["blocked.example"],
      focusHours: { startHHMM: "09:00", endHHMM: "18:00" }
    }),
    runPipeline: async (writer) => {
      await writer.set({ recommendations: [] });
    },
    commit: async () => undefined,
    ...overrides
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
