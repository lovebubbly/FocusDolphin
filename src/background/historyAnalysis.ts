import type { RecommendationPipelineOptions } from "../analytics/history";
import type { MutationGeneration, SerialOperationQueue } from "./operationQueue";

export const HISTORY_PERMISSION_REQUIRED_ERROR = "방문 기록 권한을 허용해야 로컬 추천 분석을 시작할 수 있습니다.";
export const STALE_HISTORY_RESULT_ERROR = "로컬 기록이 지워져 방문 기록 분석 결과를 저장하지 않았습니다.";

type HistoryResultWriter = {
  set(items: object): Promise<void>;
};

export interface HistoryAnalysisContext {
  blockedDomains: string[];
  focusHours?: { startHHMM: string; endHHMM: string };
}

export interface HistoryAnalysisDependencies {
  operations: Pick<SerialOperationQueue, "run">;
  generation: Pick<MutationGeneration, "capture" | "isCurrent">;
  hasHistoryPermission(): Promise<boolean>;
  loadContext(): Promise<HistoryAnalysisContext>;
  runPipeline(
    writer: HistoryResultWriter,
    options: RecommendationPipelineOptions
  ): Promise<unknown>;
  commit(items: object): Promise<void>;
}

export class HistoryAnalysisCoordinator {
  private inFlight: Promise<{ ok: true }> | null = null;

  constructor(private readonly dependencies: HistoryAnalysisDependencies) {}

  analyze(): Promise<{ ok: true }> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const capturedGeneration = this.dependencies.generation.capture();
    const operation = this.run(capturedGeneration);
    const tracked = operation.finally(() => {
      if (this.inFlight === tracked) {
        this.inFlight = null;
      }
    });
    this.inFlight = tracked;
    return tracked;
  }

  private async run(capturedGeneration: number): Promise<{ ok: true }> {
    if (!await this.dependencies.hasHistoryPermission()) {
      throw new Error(HISTORY_PERMISSION_REQUIRED_ERROR);
    }

    const context = await this.dependencies.loadContext();
    await this.dependencies.runPipeline({
      set: (items) => this.dependencies.operations.run(async () => {
        if (!this.dependencies.generation.isCurrent(capturedGeneration)) {
          throw new Error(STALE_HISTORY_RESULT_ERROR);
        }
        await this.dependencies.commit(items);
      })
    }, {
      blockedDomains: context.blockedDomains,
      focusHours: context.focusHours,
      limit: 10
    });

    return { ok: true };
  }
}
