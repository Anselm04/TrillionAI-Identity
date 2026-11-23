import { RequestGeneration } from "./request-generation";

/** Serializes account UI mutations, including before React sets disabled state. */
export class AccountOperationGate {
  private running = false;
  private readonly generation = new RequestGeneration();
  begin(): number | null {
    if (this.running) return null;
    this.running = true;
    return this.generation.begin();
  }
  current(ticket: number): boolean {
    return this.running && this.generation.isCurrent(ticket);
  }
  finish(ticket: number): boolean {
    if (!this.current(ticket)) return false;
    this.running = false;
    return true;
  }
  invalidate(): void {
    this.generation.invalidate();
    this.running = false;
  }
}
