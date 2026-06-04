import { createLocalShowdownStore } from '@/lib/persistence/showdownsLocal';
import { createSupabaseShowdownStore } from '@/lib/persistence/showdownsSupabase';
import type { ShowdownRecord } from '@/lib/persistence/store';

export type ShowdownSettlementPatch = Pick<
  ShowdownRecord,
  'status' | 'settledAt' | 'settleTxHash' | 'resolvedOutcome' | 'resolvedPriceLabel'
>;

export interface ShowdownStore {
  insert(record: ShowdownRecord): Promise<void>;
  updateOnSettle(onchainId: number, patch: ShowdownSettlementPatch): Promise<void>;
  listAll(): Promise<ShowdownRecord[]>;
  findByOnchainId(onchainId: number): Promise<ShowdownRecord | undefined>;
  hasOpenBetween(
    marketId: string,
    agentAAddress: string,
    agentBAddress: string
  ): Promise<boolean>;
}

let cachedStore: ShowdownStore | null = null;

export function getShowdownStore(): ShowdownStore {
  if (cachedStore) {
    return cachedStore;
  }

  cachedStore =
    process.env.SHOWDOWN_PERSISTENCE_MODE === 'supabase'
      ? createSupabaseShowdownStore()
      : createLocalShowdownStore();

  return cachedStore;
}

export function __setShowdownStoreForTests(store: ShowdownStore | null): void {
  cachedStore = store;
}
