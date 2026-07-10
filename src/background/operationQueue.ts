export class SerialOperationQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(operationFactory: () => Promise<T>): Promise<T> {
    const operation = this.tail.then(operationFactory);
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

export class MutationGeneration {
  private generation = 0;

  capture(): number {
    return this.generation;
  }

  advance(): void {
    this.generation += 1;
  }

  isCurrent(capturedGeneration: number): boolean {
    return capturedGeneration === this.generation;
  }
}
