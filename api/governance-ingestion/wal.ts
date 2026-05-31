import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { NormalizedGovernanceEvent, WriteAheadLog } from './types';

export class MemoryWriteAheadLog implements WriteAheadLog {
  private readonly records = new Map<string, NormalizedGovernanceEvent>();

  async append(event: NormalizedGovernanceEvent): Promise<void> {
    this.records.set(event.correlationId, event);
  }

  async remove(correlationIds: string[]): Promise<void> {
    for (const correlationId of correlationIds) {
      this.records.delete(correlationId);
    }
  }

  async recover(): Promise<NormalizedGovernanceEvent[]> {
    return [...this.records.values()];
  }
}

export class FileWriteAheadLog implements WriteAheadLog {
  private readonly records = new Map<string, NormalizedGovernanceEvent>();

  constructor(private readonly path: string) {}

  async initialize(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await this.load();
  }

  async append(event: NormalizedGovernanceEvent): Promise<void> {
    this.records.set(event.correlationId, event);
    await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
  }

  async remove(correlationIds: string[]): Promise<void> {
    let changed = false;
    for (const correlationId of correlationIds) {
      changed = this.records.delete(correlationId) || changed;
    }
    if (changed) {
      await this.rewrite();
    }
  }

  async recover(): Promise<NormalizedGovernanceEvent[]> {
    await this.load();
    return [...this.records.values()];
  }

  private async load(): Promise<void> {
    this.records.clear();
    try {
      const content = await readFile(this.path, 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) {
          continue;
        }
        const event = JSON.parse(line) as NormalizedGovernanceEvent;
        this.records.set(event.correlationId, event);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await writeFile(this.path, '', 'utf8');
        return;
      }
      throw error;
    }
  }

  private async rewrite(): Promise<void> {
    const content = [...this.records.values()]
      .map((event) => JSON.stringify(event))
      .join('\n');
    await writeFile(this.path, content ? `${content}\n` : '', 'utf8');
  }
}

