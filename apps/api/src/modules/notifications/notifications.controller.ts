import { paginationQuerySchema } from '@app/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';

import { NotificationsService } from './notifications.service';

const listQuery = paginationQuerySchema.extend({ unreadOnly: z.coerce.boolean().optional() });
const deviceSchema = z.object({ token: z.string().min(10).max(512), platform: z.enum(['ios', 'android', 'web']) });

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notification:read')
  @ApiOperation({ summary: 'In-app notifications for the current user' })
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.notifications.list(user.id, q);
  }

  @Post(':id/read')
  @RequirePermissions('notification:read')
  markRead(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('devices')
  @HttpCode(204)
  @ApiOperation({ summary: 'Register a push token (mobile)' })
  async registerDevice(@CurrentUser() user: RequestUser, @Body(zodBody(deviceSchema)) body: z.infer<typeof deviceSchema>) {
    await this.notifications.registerDevice(user.id, body.token, body.platform);
  }

  @Delete('devices')
  @HttpCode(204)
  async removeDevice(@CurrentUser() user: RequestUser, @Body(zodBody(deviceSchema.pick({ token: true }))) body: { token: string }) {
    await this.notifications.removeDevice(user.id, body.token);
  }
}
