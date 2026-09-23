import { type CreateThreadInput, createThreadSchema, type GenerateDraftInput, generateDraftSchema, type ListThreadsQuery, listThreadsQuerySchema, type SendMessageInput, sendMessageSchema, updateThreadSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import { AiDraftsService } from '../ai/ai-drafts.service';
import type { RequestUser } from '../auth/auth.types';

import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@ApiBearerAuth()
@Controller('threads')
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly drafts: AiDraftsService,
  ) {}

  @Get()
  @RequirePermissions('message:read')
  @ApiOperation({ summary: 'Threads visible to the caller (patients: own; staff: inbox)' })
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listThreadsQuerySchema)) q: ListThreadsQuery) {
    return this.messaging.listThreads(user, q);
  }

  @Post()
  @RequirePermissions('message:send')
  @ApiOperation({ summary: 'Start a thread with a first message' })
  create(@CurrentUser() user: RequestUser, @Body(zodBody(createThreadSchema)) body: CreateThreadInput) {
    return this.messaging.createThread(user, body);
  }

  @Get(':id')
  @RequirePermissions('message:read')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.getThread(user, id);
  }

  @Patch(':id')
  @RequirePermissions('message:triage')
  @ApiOperation({ summary: 'Route/assign/close a thread (staff)' })
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(updateThreadSchema)) body: z.infer<typeof updateThreadSchema>) {
    return this.messaging.updateThread(user, id, body);
  }

  @Post(':id/messages')
  @RequirePermissions('message:send')
  @ApiOperation({ summary: 'Send a message (patient → runs red-flag rules and AI triage; staff → delivered to patient)' })
  send(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(sendMessageSchema)) body: SendMessageInput) {
    return this.messaging.sendMessage(user, id, body);
  }

  @Post(':id/read')
  @RequirePermissions('message:read')
  markRead(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.markRead(user, id);
  }

  @Post(':id/ai-drafts')
  @RequirePermissions('ai:invoke')
  @ApiOperation({ summary: 'Ask AI to draft a reply for human review' })
  requestDraft(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(generateDraftSchema)) body: GenerateDraftInput) {
    return this.drafts.requestForThread(user, id, body);
  }
}
