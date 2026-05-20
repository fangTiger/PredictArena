export function computeKellyBps(agentProbability: number, marketPrice: number): number {
  if (marketPrice >= 1 || agentProbability <= marketPrice) {
    return 0;
  }

  const fraction = (agentProbability - marketPrice) / (1 - marketPrice);
  return Math.max(0, Math.min(300, Math.round(fraction * 10_000)));
}
