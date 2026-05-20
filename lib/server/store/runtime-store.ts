import { createPrismaStore } from '@/lib/server/store/prisma-store';
import type { PredictArenaStore } from '@/lib/server/store/types';

declare global {
  // eslint-disable-next-line no-var
  var __predictArenaStore__: PredictArenaStore | undefined;
}

export function getRuntimeStore(): PredictArenaStore {
  if (!globalThis.__predictArenaStore__) {
    globalThis.__predictArenaStore__ = createPrismaStore();
  }

  return globalThis.__predictArenaStore__;
}
