import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

const STUCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface ResolutionResult {
  outcomeYes: boolean;
  priceLabel: string;
}

export interface SettlementDeps {
  showdownStore: ShowdownStore;
  resolveMarket(record: ShowdownRecord): Promise<ResolutionResult | null>;
  settleOnChain(onchainId: number, agentAWins: boolean): Promise<`0x${string}`>;
  nowMs(): number;
}

export interface SettlementResult {
  inspected: number;
  settled: number;
  stuck: number;
  errors: Array<{
    onchainId: number;
    error: string;
  }>;
}

export async function settleEligibleShowdowns(
  deps: SettlementDeps
): Promise<SettlementResult> {
  const nowMs = deps.nowMs();
  const candidates = (await deps.showdownStore.listAll()).filter(
    (record) => record.status === 'Open' && Date.parse(record.deadline) <= nowMs
  );
  let settled = 0;
  let stuck = 0;
  const errors: SettlementResult['errors'] = [];

  for (const record of candidates) {
    try {
      const resolution = await deps.resolveMarket(record);
      if (!resolution) {
        if (nowMs - Date.parse(record.deadline) > STUCK_THRESHOLD_MS) {
          stuck += 1;
          console.warn(`[showdown-settlement] showdown ${record.onchainId} stuck >24h`);
        }
        continue;
      }

      const agentAWins = mapResolutionToAgentAWins(record, resolution.outcomeYes);
      const txHash = await deps.settleOnChain(record.onchainId, agentAWins);

      await deps.showdownStore.updateOnSettle(record.onchainId, {
        status: agentAWins ? 'SettledA' : 'SettledB',
        settledAt: new Date(nowMs).toISOString(),
        settleTxHash: txHash,
        resolvedOutcome: resolution.outcomeYes ? 'YES' : 'NO',
        resolvedPriceLabel: resolution.priceLabel
      });
      settled += 1;
    } catch (error) {
      errors.push({
        onchainId: record.onchainId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    inspected: candidates.length,
    settled,
    stuck,
    errors
  };
}

export function mapResolutionToAgentAWins(
  record: ShowdownRecord,
  outcomeYes: boolean
): boolean {
  return (record.agentA.side === 'YES') === outcomeYes;
}
