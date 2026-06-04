import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ShowdownSettlementPatch, ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

function defaultStoragePath(): string {
  return path.join(process.cwd(), 'data', 'runtime', 'showdowns.json');
}

function resolveStoragePath(): string {
  const configured = process.env.SHOWDOWN_LOCAL_FILE?.trim();
  return configured && configured.length > 0 ? configured : defaultStoragePath();
}

async function readRecords(storagePath: string): Promise<ShowdownRecord[]> {
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    if (raw.trim().length === 0) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ShowdownRecord[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function writeRecords(storagePath: string, records: ShowdownRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(records, null, 2), 'utf8');
}

function normalizePair(addressA: string, addressB: string): [string, string] {
  const normalized = [addressA.toLowerCase(), addressB.toLowerCase()].sort();
  return [normalized[0]!, normalized[1]!];
}

export function createLocalShowdownStore(): ShowdownStore {
  let queue = Promise.resolve();

  async function mutate<T>(updater: (records: ShowdownRecord[]) => Promise<T> | T): Promise<T> {
    const next = queue.then(async () => {
      const storagePath = resolveStoragePath();
      const records = await readRecords(storagePath);
      const result = await updater(records);
      await writeRecords(storagePath, records);
      return result;
    });

    queue = next.then(
      () => undefined,
      () => undefined
    );

    return next;
  }

  async function load(): Promise<ShowdownRecord[]> {
    return readRecords(resolveStoragePath());
  }

  return {
    async insert(record) {
      await mutate((records) => {
        if (
          records.some(
            (existing) =>
              existing.onchainId === record.onchainId || existing.externalId === record.externalId
          )
        ) {
          throw new Error(`showdown ${record.onchainId} already exists`);
        }

        records.push(record);
      });
    },

    async updateOnSettle(onchainId, patch: ShowdownSettlementPatch) {
      await mutate((records) => {
        const index = records.findIndex((record) => record.onchainId === onchainId);
        if (index === -1) {
          throw new Error(`showdown ${onchainId} not found`);
        }

        records[index] = {
          ...records[index]!,
          ...patch
        };
      });
    },

    async listAll() {
      return load();
    },

    async findByOnchainId(onchainId) {
      return (await load()).find((record) => record.onchainId === onchainId);
    },

    async hasOpenBetween(marketId, agentAAddress, agentBAddress) {
      const [left, right] = normalizePair(agentAAddress, agentBAddress);

      return (await load()).some((record) => {
        if (record.marketId !== marketId || record.status !== 'Open') {
          return false;
        }

        const [recordLeft, recordRight] = normalizePair(record.agentA.address, record.agentB.address);
        return recordLeft === left && recordRight === right;
      });
    }
  };
}
