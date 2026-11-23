/**
 * A monotonic generation guards client display updates from superseded
 * asynchronous requests. It never grants or validates authentication.
 */
export class RequestGeneration {
  private revision = 0;
  begin(): number { return ++this.revision; }
  invalidate(): void { this.revision++; }
  isCurrent(revision: number): boolean {
    return Number.isSafeInteger(revision) && revision > 0 && revision === this.revision;
  }
}
