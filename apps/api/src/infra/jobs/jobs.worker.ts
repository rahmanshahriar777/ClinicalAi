import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { JobsService } from './jobs.service';
import { JOB_QUEUE, type JobName } from './jobs.types';

/** BullMQ worker that routes every job on the shared queue to its registered handler. */
@Injectable()
@Processor(JOB_QUEUE, { concurrency: 4 })
export class JobsWorker extends WorkerHost {
  private readonly logger = new Logger(JobsWorker.name);

  constructor(private readonly jobs: JobsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.debug({ id: job.id, name: job.name, attempt: job.attemptsMade }, 'job start');
    await this.jobs.dispatch(job.name as JobName, job.data);
  }
}
