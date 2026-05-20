export function clampBps(value: number): number {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

export function probabilityToBps(probability: number): number {
  return clampBps(probability * 10_000);
}

export function bpsToProbability(bps: number): number {
  return bps / 10_000;
}
