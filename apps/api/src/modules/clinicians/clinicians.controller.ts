import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';

@ApiTags('clinicians')
@ApiBearerAuth()
@Controller('clinicians')
export class CliniciansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('appointment:read')
  @ApiOperation({ summary: 'Clinicians in the caller\'s organisation (for booking)' })
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.clinician.findMany({
      where: { organizationId: user.organizationId, user: { isActive: true } },
      select: { id: true, specialty: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { lastName: 'asc' } },
    });
  }
}
