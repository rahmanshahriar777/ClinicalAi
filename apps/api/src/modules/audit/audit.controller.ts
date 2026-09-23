import { auditLogQuerySchema } from '@app/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';

import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Query the audit trail (admin / compliance)' })
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(auditLogQuerySchema)) q: ReturnType<typeof auditLogQuerySchema.parse>) {
    // Audit readers only see their own organisation's trail.
    return this.audit.query(user.organizationId, q);
  }
}
