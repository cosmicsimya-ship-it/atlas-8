// ═══════════════════════════════════════════════════════════════════════
// useArsenal Hook
//
// WHY THIS EXISTS:
// Bridges the ArsenalStoreService to React components.
// Provides search, category filtering, and usage tracking.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { arsenalStore } from '../services/arsenal-store';
import type { ArsenalAsset, ArsenalCategory } from '../types/pipeline';

export function useArsenal() {
  const [assets, setAssets] = useState<ArsenalAsset[]>(arsenalStore.getAll());

  const refresh = useCallback(() => {
    setAssets(arsenalStore.getAll());
  }, []);

  const getByCategory = useCallback((cat: ArsenalCategory) => {
    return arsenalStore.getByCategory(cat);
  }, []);

  const search = useCallback((query: string) => {
    return arsenalStore.search(query);
  }, []);

  const recordUsage = useCallback((id: string) => {
    arsenalStore.recordUsage(id);
    refresh();
  }, [refresh]);

  return { assets, getByCategory, search, recordUsage, refresh };
}
