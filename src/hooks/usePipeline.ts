import { useState, useEffect, useCallback } from 'react';
import { pipelineEngine } from '../services/pipeline-engine';
import type { PipelineRun } from '../types/pipeline';

export function usePipeline() {
  const [run, setRun] = useState<PipelineRun | null>(pipelineEngine.getRun());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return pipelineEngine.subscribe((updatedRun) => {
      setRun({ ...updatedRun });
    });
  }, []);

  const startPipeline = useCallback(async (channelId: string, channelNiche: string) => {
    setError(null);
    try {
      await pipelineEngine.run(channelId, channelNiche);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pipeline failed to start';
      setError(msg);
    }
  }, []);

  const resetPipeline = useCallback(() => {
    pipelineEngine.reset();
    setRun(null);
    setError(null);
  }, []);

  const abortPipeline = useCallback(() => {
    pipelineEngine.abort();
  }, []);

  const status = run?.status ?? 'idle';
  const steps = run?.steps ?? [];
  const result = run?.result ?? null;
  const overallProgress = steps.length > 0
    ? Math.round((steps.filter((s) => s.status === 'completed').length / steps.length) * 100)
    : 0;

  return {
    run,
    status,
    steps,
    result,
    overallProgress,
    error,
    startPipeline,
    resetPipeline,
    abortPipeline,
  };
}
