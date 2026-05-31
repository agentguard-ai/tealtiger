export class BoundedEventQueue<T> {
  private readonly items: T[] = [];
  private dropped = 0;

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('BoundedEventQueue limit must be a positive integer');
    }
  }

  push(item: T): void {
    if (this.items.length >= this.limit) {
      this.items.shift();
      this.dropped++;
    }
    this.items.push(item);
  }

  shift(): T | undefined {
    return this.items.shift();
  }

  get length(): number {
    return this.items.length;
  }

  get droppedCount(): number {
    return this.dropped;
  }
}

