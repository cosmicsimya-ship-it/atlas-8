// ═══════════════════════════════════════════════════════════════════════
// useQueue Hook
//
// WHY THIS EXISTS:
// Bridges the QueueEngine service to React components.
// Provides reactive access to queue state + mutation methods.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { queueEngine } from '../services/queue-engine';
import type { QueueJob, QueueJobStatus } from '../types/pipeline';

export function useQueue() {
  const [jobs, setJobs] = useState<QueueJob[]>(queueEngine.getAll());
  const [counts, setCounts] = useState(queueEngine.counts());

  useEffect(() => {
    return queueEngine.subscribe(() => {
      setJobs(queueEngine.getAll());
      setCounts(queueEngine.counts());
    });
  }, []);

  const cancel = useCallback((id: string) => queueEngine.cancel(id), []);

  const getByStatus = useCallback((status: QueueJobStatus) => {
    return jobs.filter((j) => j.status === status);
  }, [jobs]);

  return { jobs, counts, cancel, getByStatus };
}
