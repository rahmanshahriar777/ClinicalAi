import { getQueueToken } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { ENV, type Env } from '../../config/env';

import { JOB_QUEUE, type JobHandler, type JobName, type JobPayloads } from './jobs.types';

/**
 * Background job facade. Two modes (blueprint §16.1 "BullMQ + Redis"):
 *   - queued (default): jobs go to Redis and run in the in-process worker
 *   - inline (JOBS_INLINE=true): jobs execute immediately after the caller's
 *     transaction, which keeps tests and single-container demos dependency-free
 * Handlers are registered by feature modules on startup.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<JobName, JobHandler>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(getQueueToken(JOB_QUEUE)) private readonly queue?: Queue,
  ) {}

  get inline(): boolean {
    return this.env.JOBS_INLINE || !this.queue;
  }

  register<N extends JobName>(name: N, handler: JobHandler<N>): void {
    this.handlers.set(name, handler as JobHandler);
  }

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N], opts?: { delayMs?: number }): Promise<void> {
    if (this.inline) {
      // Run on the next tick so the caller can return/commit first, but never lose the job.
      setImmediate(() => {
        this.dispatch(name, payload).catch((err) => this.logger.error({ err, name }, 'inline job failed'));
      });
      return;
    }
    await this.queue!.add(name, payload, {
      delay: opts?.delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
  }

  async dispatch(name: JobName, payload: unknown): Promise<void> {
    const handler = this.handlers.get(name);
    if (!handler) {
      this.logger.warn({ name }, 'no handler registered for job');
      return;
    }
    await handler(payload as never);
  }
}
