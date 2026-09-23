import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Global, Module } from '@nestjs/common';

import { loadEnv } from '../../config/env';

import { JobsService } from './jobs.service';
import { JOB_QUEUE } from './jobs.types';
import { JobsWorker } from './jobs.worker';

/**
 * Registers BullMQ only when Redis-backed jobs are enabled; otherwise the
 * JobsService runs handlers inline. Decided at import time from the env.
 */
@Global()
@Module({})
export class JobsModule {
  static forRoot(): DynamicModule {
    const env = loadEnv();
    if (env.JOBS_INLINE) {
      return { module: JobsModule, providers: [JobsService], exports: [JobsService] };
    }
    const url = new URL(env.REDIS_URL);
    return {
      module: JobsModule,
      imports: [
        BullModule.forRoot({
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            username: url.username || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        }),
        BullModule.registerQueue({ name: JOB_QUEUE }),
      ],
      providers: [JobsService, JobsWorker],
      exports: [JobsService],
    };
  }
}
