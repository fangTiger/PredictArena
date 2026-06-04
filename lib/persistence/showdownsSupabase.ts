import type { ShowdownStore } from '@/lib/persistence/showdowns';

export function createSupabaseShowdownStore(): ShowdownStore {
  throw new Error(
    'Supabase ShowdownStore not yet implemented. Use SHOWDOWN_PERSISTENCE_MODE=local during Chunks 5-8.'
  );
}
