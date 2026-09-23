import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness' })
  live() {
    return { status: 'ok', service: 'clinical-api', time: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness: database reachable' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('database unavailable');
    }
    return { status: 'ready', jobsMode: this.env.JOBS_INLINE ? 'inline' : 'queue', aiProvider: this.env.AI_PROVIDER, authMode: this.env.AUTH_MODE };
  }
}
