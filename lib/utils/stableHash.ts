import { keccak256, toHex } from 'viem';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

function sortValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableStringify(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

export function stableHash(value: JsonValue): `0x${string}` {
  return keccak256(toHex(stableStringify(value)));
}
