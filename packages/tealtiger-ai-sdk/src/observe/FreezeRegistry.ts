export class FreezeRegistry {
  private readonly frozen = new Set<string>();

  freeze(agentId: string): void {
    this.frozen.add(agentId);
  }

  unfreeze(agentId: string): void {
    this.frozen.delete(agentId);
  }

  isFrozen(agentId: string): boolean {
    return this.frozen.has('*') || this.frozen.has(agentId);
  }
}
