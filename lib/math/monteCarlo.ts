import type { MarketConditionType } from '@/lib/polymarket/types';
import { createSeededRandom, randomNormal } from '@/lib/math/seededRandom';

export interface MonteCarloInput {
  S0: number;
  K: number;
  TYears: number;
  sigma: number;
  mu: number;
  conditionType: MarketConditionType;
  nPaths: number;
  nSteps: number;
  seed: string;
}

export function simulateProbability(input: MonteCarloInput): number {
  const rng = createSeededRandom(input.seed);
  const steps = Math.max(1, input.nSteps);
  const dt = Math.max(input.TYears / steps, 1 / (365 * 24));
  let successes = 0;

  for (let pathIndex = 0; pathIndex < input.nPaths; pathIndex += 1) {
    let price = input.S0;
    let touched = false;

    for (let step = 0; step < steps; step += 1) {
      const shock = randomNormal(rng);
      price *= Math.exp((input.mu - 0.5 * input.sigma ** 2) * dt + input.sigma * Math.sqrt(dt) * shock);

      if (input.conditionType === 'TOUCH_ABOVE' && price >= input.K) {
        touched = true;
      }

      if (input.conditionType === 'TOUCH_BELOW' && price <= input.K) {
        touched = true;
      }
    }

    const success =
      input.conditionType === 'TOUCH_ABOVE' || input.conditionType === 'TOUCH_BELOW'
        ? touched
        : input.conditionType === 'EXPIRY_ABOVE'
          ? price >= input.K
          : price <= input.K;

    if (success) {
      successes += 1;
    }
  }

  return successes / input.nPaths;
}
