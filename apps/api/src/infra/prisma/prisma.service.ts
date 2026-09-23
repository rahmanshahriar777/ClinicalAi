import { PrismaClient } from '@app/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

/**
 * Shared Prisma client. Query logging is limited to warnings/errors so that
 * PHI in query parameters never lands in application logs.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }] });
    (this as unknown as { $on: (e: string, cb: (ev: { message: string }) => void) => void }).$on('warn', (e) => this.logger.warn(e.message));
    (this as unknown as { $on: (e: string, cb: (ev: { message: string }) => void) => void }).$on('error', (e) => this.logger.error(e.message));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
