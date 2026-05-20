export function formatBps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

export function formatMicroUsdc(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}`;
}

export function formatIsoDateTime(value: string): string {
  return value.replace('T', ' ').slice(0, 16) + ' UTC';
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}
