import { amendDocumentSchema, updateDocumentSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';

import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':id')
  @RequirePermissions('document:read')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(user, id);
  }

  @Patch(':id')
  @RequirePermissions('document:create')
  @ApiOperation({ summary: 'Edit content (creates a revision; AI Draft → Revised)' })
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(updateDocumentSchema)) body: z.infer<typeof updateDocumentSchema>) {
    return this.documents.update(user, id, body.content, body.changeSummary);
  }

  @Post(':id/submit')
  @RequirePermissions('document:create')
  submit(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.submitForReview(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions('document:approve')
  approve(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.approve(user, id);
  }

  @Post(':id/sign')
  @RequirePermissions('document:sign')
  @ApiOperation({ summary: 'Sign: freezes content and records its SHA-256' })
  sign(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.sign(user, id);
  }

  @Post(':id/amend')
  @RequirePermissions('document:sign')
  amend(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(amendDocumentSchema)) body: z.infer<typeof amendDocumentSchema>) {
    return this.documents.amend(user, id, body.content, body.reason);
  }

  @Post(':id/share')
  @RequirePermissions('document:approve')
  @ApiOperation({ summary: 'Share an approved/signed document (e.g. after-visit summary) with the patient' })
  share(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.shareWithPatient(user, id);
  }
}
