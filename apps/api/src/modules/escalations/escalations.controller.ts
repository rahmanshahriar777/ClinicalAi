import { ESCALATION_STATUSES, paginationQuerySchema, URGENCY_LEVELS } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';

import { EscalationsService } from './escalations.service';

const listQuery = paginationQuerySchema.extend({ status: z.enum(ESCALATION_STATUSES).optional(), urgency: z.enum(URGENCY_LEVELS).optional() });
const resolveSchema = z.object({ notes: z.string().trim().min(1).max(2000), dismissed: z.boolean().default(false) });

@ApiTags('escalations')
@ApiBearerAuth()
@Controller('escalations')
export class EscalationsController {
  constructor(private readonly escalations: EscalationsService) {}

  @Get()
  @RequirePermissions('escalation:read')
  @ApiOperation({ summary: 'Human review queue for red-flag escalations' })
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.escalations.list(user, q);
  }

  @Post(':id/acknowledge')
  @RequirePermissions('escalation:manage')
  acknowledge(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.escalations.acknowledge(user, id);
  }

  @Post(':id/resolve')
  @RequirePermissions('escalation:manage')
  resolve(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(resolveSchema)) body: z.infer<typeof resolveSchema>) {
    return this.escalations.resolve(user, id, body.notes, body.dismissed);
  }
}
