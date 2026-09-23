import { AI_WORKFLOWS, paginationQuerySchema, type ReviewDraftInput, reviewDraftSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';

import { AiDraftsService } from './ai-drafts.service';

const queueQuery = paginationQuerySchema.extend({ workflow: z.enum(AI_WORKFLOWS).optional() });
const approveSchema = reviewDraftSchema.omit({ decision: true });
const rejectSchema = z.object({ comments: z.string().trim().min(1).max(2000) });

@ApiTags('ai-drafts')
@ApiBearerAuth()
@Controller('ai-drafts')
export class AiDraftsController {
  constructor(private readonly drafts: AiDraftsService) {}

  @Get()
  @RequirePermissions('ai:review')
  @ApiOperation({ summary: 'Human review queue: pending drafts the caller may act on' })
  queue(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(queueQuery)) q: z.infer<typeof queueQuery>) {
    return this.drafts.reviewQueue(user, q);
  }

  @Get(':id')
  @RequirePermissions('ai:review')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.drafts.get(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions('ai:review')
  @ApiOperation({ summary: 'Approve (optionally with edits). Message drafts are sent to the patient unless sendOnApprove=false.' })
  approve(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(approveSchema)) body: z.infer<typeof approveSchema>) {
    const decision = body.editedOutput ? 'APPROVED_WITH_EDITS' : 'APPROVED';
    return this.drafts.review(user, id, { ...body, decision });
  }

  @Post(':id/reject')
  @RequirePermissions('ai:review')
  reject(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(rejectSchema)) body: z.infer<typeof rejectSchema>) {
    return this.drafts.review(user, id, { decision: 'REJECTED', comments: body.comments, sendOnApprove: false });
  }

  @Post(':id/review')
  @RequirePermissions('ai:review')
  @ApiOperation({ summary: 'Generic review endpoint (decision in body)' })
  review(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(reviewDraftSchema)) body: ReviewDraftInput) {
    return this.drafts.review(user, id, body);
  }
}
