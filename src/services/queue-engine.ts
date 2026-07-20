// ═══════════════════════════════════════════════════════════════════════
// Queue Engine
//
// WHY THIS EXISTS:
// The old QueueManager page rendered a static array.
// This engine provides real queue semantics:
//   1. FIFO with priority override
//   2. Retry with configurable max attempts
//   3. Status lifecycle: queued → running → completed/failed → retry
//   4. Observable — the Zustand store subscribes to state changes
//
// ARCHITECTURAL DECISION:
// In-memory queue for the frontend. In production, this becomes a
// thin client to a backend job queue (BullMQ, Celery, etc).
// The interface is identical either way.
// ═══════════════════════════════════════════════════════════════════════

import type { QueueJob, QueueJobStatus } from '../types/pipeline';

export type QueueEventType = 'added' | 'started' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export interface QueueEvent {
  type: QueueEventType;
  job: QueueJob;
  timestamp: number;
}

type QueueListener = (event: QueueEvent) => void;

export class QueueEngine {
  private jobs: Map<string, QueueJob> = new Map();
  private listeners: Set<QueueListener> = new Set();

  // ── Queries ─────────────────────────────────────────────────────────

  getAll(): QueueJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
  }

  getByStatus(status: QueueJobStatus): QueueJob[] {
    return this.getAll().filter((j) => j.status === status);
  }

  getByPipeline(pipelineId: string): QueueJob[] {
    return this.getAll().filter((j) => j.pipelineId === pipelineId);
  }

  get(id: string): QueueJob | undefined {
    return this.jobs.get(id);
  }

  counts(): Record<QueueJobStatus, number> {
    const result: Record<string, number> = { queued: 0, running: 0, completed: 0, failed: 0, retry: 0, cancelled: 0 };
    this.jobs.forEach((j) => { result[j.status] = (result[j.status] || 0) + 1; });
    return result as Record<QueueJobStatus, number>;
  }

  // ── Mutations ───────────────────────────────────────────────────────

  enqueue(job: Omit<QueueJob, 'id' | 'status' | 'attempts' | 'createdAt' | 'startedAt' | 'completedAt' | 'error'>): QueueJob {
    const newJob: QueueJob = {
      ...job,
      id: `qj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
    };
    this.jobs.set(newJob.id, newJob);
    this.emit({ type: 'added', job: newJob, timestamp: Date.now() });
    return newJob;
  }

  start(id: string): QueueJob | undefined {
    const job = this.jobs.get(id);
    if (!job || (job.status !== 'queued' && job.status !== 'retry')) return undefined;
    job.status = 'running';
    job.startedAt = Date.now();
    job.attempts++;
    this.emit({ type: 'started', job, timestamp: Date.now() });
    return job;
  }

  complete(id: string): QueueJob | undefined {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'running') return undefined;
    job.status = 'completed';
    job.completedAt = Date.now();
    this.emit({ type: 'completed', job, timestamp: Date.now() });
    return job;
  }

  fail(id: string, error: string): QueueJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    job.error = error;
    if (job.attempts < job.maxAttempts) {
      job.status = 'retry';
      this.emit({ type: 'retrying', job, timestamp: Date.now() });
    } else {
      job.status = 'failed';
      job.completedAt = Date.now();
      this.emit({ type: 'failed', job, timestamp: Date.now() });
    }
    return job;
  }

  cancel(id: string): QueueJob | undefined {
    const job = this.jobs.get(id);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return undefined;
    job.status = 'cancelled';
    job.completedAt = Date.now();
    this.emit({ type: 'cancelled', job, timestamp: Date.now() });
    return job;
  }

  clear(): void {
    this.jobs.clear();
  }

  // ── Observability ───────────────────────────────────────────────────

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(event: QueueEvent): void {
    this.listeners.forEach((fn) => fn(event));
  }
}

export const queueEngine = new QueueEngine();
