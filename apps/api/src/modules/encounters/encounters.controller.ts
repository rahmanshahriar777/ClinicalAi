import { completeEncounterSchema, type CreateDocumentInput, createDocumentSchema, type GenerateDraftInput, generateDraftSchema, startEncounterSchema, type UpdateEncounterInput, updateEncounterSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { AiDraftsService } from '../ai/ai-drafts.service';
import type { RequestUser } from '../auth/auth.types';
import { DocumentsService } from '../documents/documents.service';

import { EncountersService } from './encounters.service';

@ApiTags('encounters')
@ApiBearerAuth()
@Controller('encounters')
export class EncountersController {
  constructor(
    private readonly encounters: EncountersService,
    private readonly documents: DocumentsService,
    private readonly drafts: AiDraftsService,
  ) {}

  @Get(':id')
  @RequirePermissions('encounter:read')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.encounters.get(user, id);
  }

  @Post(':id/start')
  @RequirePermissions('encounter:write')
  start(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(startEncounterSchema)) body: z.infer<typeof startEncounterSchema>) {
    return this.encounters.start(user, id, body.chiefComplaint);
  }

  @Patch(':id')
  @RequirePermissions('encounter:write')
  @ApiOperation({ summary: 'Update chief complaint / clinician shorthand notes' })
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(updateEncounterSchema)) body: UpdateEncounterInput) {
    return this.encounters.update(user, id, body);
  }

  @Post(':id/complete')
  @RequirePermissions('encounter:write')
  @ApiOperation({ summary: 'Complete the encounter; optionally share the approved after-visit summary' })
  complete(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(completeEncounterSchema)) body: z.infer<typeof completeEncounterSchema>) {
    return this.encounters.complete(user, id, body.sendAfterVisitSummary);
  }

  /* ---------- documents ---------- */

  @Get(':id/documents')
  @RequirePermissions('document:read')
  listDocuments(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.listForEncounter(user, id);
  }

  @Post(':id/documents')
  @RequirePermissions('document:create')
  createDocument(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(createDocumentSchema)) body: CreateDocumentInput) {
    return this.documents.create(user, id, body);
  }

  /* ---------- AI drafts (blueprint §12.2 POST /encounters/:id/ai-drafts) ---------- */

  @Get(':id/ai-drafts')
  @RequirePermissions('ai:review')
  listDrafts(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.drafts.listForEncounter(user, id);
  }

  @Post(':id/ai-drafts')
  @RequirePermissions('ai:invoke')
  @ApiOperation({ summary: 'Request an AI draft (clinical note / patient education) for review' })
  requestDraft(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(generateDraftSchema)) body: GenerateDraftInput) {
    return this.drafts.requestForEncounter(user, id, body);
  }
}
