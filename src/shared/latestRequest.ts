export class LatestRequestGuard {
  private latestToken = 0;

  begin(): number {
    this.latestToken += 1;
    return this.latestToken;
  }

  isCurrent(token: number): boolean {
    return token === this.latestToken;
  }

  invalidate(): void {
    this.latestToken += 1;
  }
}
