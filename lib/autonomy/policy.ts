import type { AgentAutonomyPolicyConfig } from '@/lib/config/env';
import type { AgentSignal } from '@/lib/polymarket/types';

export interface AutonomyBudgetUsage {
  dailyBondUsedUsdc6: number;
  signalsUsedToday: number;
  openSignals: number;
}

export interface AutonomyCandidateDecision {
  allowed: boolean;
  reason: string | null;
}

export function createEmptyAutonomyBudgetUsage(): AutonomyBudgetUsage {
  return {
    dailyBondUsedUsdc6: 0,
    signalsUsedToday: 0,
    openSignals: 0
  };
}

export function evaluateAutonomyCandidate(
  signal: AgentSignal,
  policy: AgentAutonomyPolicyConfig,
  usage: AutonomyBudgetUsage
): AutonomyCandidateDecision {
  if (signal.stakeMicroUsdc > policy.maxStakePerSignalUsdc6) {
    return {
      allowed: false,
      reason: 'max_stake_per_signal_exceeded'
    };
  }

  if (usage.openSignals >= policy.maxOpenSignals) {
    return {
      allowed: false,
      reason: 'max_open_signals_reached'
    };
  }

  if (signal.edgeBps < policy.minEdgeBps) {
    return {
      allowed: false,
      reason: 'min_edge_not_met'
    };
  }

  if (usage.signalsUsedToday >= policy.maxSignalsPerDay) {
    return {
      allowed: false,
      reason: 'max_signals_per_day_reached'
    };
  }

  if (usage.dailyBondUsedUsdc6 + signal.stakeMicroUsdc > policy.maxDailyBondUsdc6) {
    return {
      allowed: false,
      reason: 'max_daily_bond_reached'
    };
  }

  return {
    allowed: true,
    reason: null
  };
}
