import { paginationQuerySchema, type RecordConsentInput, recordConsentSchema, type UpdatePatientProfileInput, updatePatientProfileSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AccessPolicyService } from '../../access/access-policy.service';
import { Client, type ClientInfo, CurrentUser, RequirePermissions } from '../../common/decorators';
import { NotFoundError } from '../../common/errors/app-error';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';
import { ConsentsService } from '../consents/consents.service';
import { DocumentsService } from '../documents/documents.service';

import { PatientsService } from './patients.service';

const listQuery = paginationQuerySchema.extend({ search: z.string().max(100).optional() });

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly consents: ConsentsService,
    private readonly access: AccessPolicyService,
    private readonly documents: DocumentsService,
  ) {}

  /* ---------- /patients/me (blueprint §12.2) ---------- */

  @Get('me')
  @RequirePermissions('patient:read')
  @ApiOperation({ summary: 'Own patient profile' })
  me(@CurrentUser() user: RequestUser) {
    return this.patients.getMe(user);
  }

  @Patch('me')
  @RequirePermissions('patient:write')
  @ApiOperation({ summary: 'Update own profile and notification preferences' })
  updateMe(@CurrentUser() user: RequestUser, @Body(zodBody(updatePatientProfileSchema)) body: UpdatePatientProfileInput) {
    if (!user.patientId) throw new NotFoundError('Patient profile');
    return this.patients.update(user, user.patientId, body);
  }

  @Get('me/consents')
  @RequirePermissions('consent:read')
  @ApiOperation({ summary: 'Own consent history' })
  myConsents(@CurrentUser() user: RequestUser) {
    if (!user.patientId) throw new NotFoundError('Patient profile');
    return this.consents.list(user.patientId);
  }

  @Post('me/consents')
  @RequirePermissions('consent:write')
  @ApiOperation({ summary: 'Grant, decline or revoke a consent' })
  recordConsent(@CurrentUser() user: RequestUser, @Body(zodBody(recordConsentSchema)) body: RecordConsentInput, @Client() client: ClientInfo) {
    if (!user.patientId) throw new NotFoundError('Patient profile');
    return this.consents.record(user.patientId, body, user.id, client);
  }

  /* ---------- staff endpoints ---------- */

  @Get()
  @RequirePermissions('patient:read')
  @ApiOperation({ summary: 'List patients visible to the caller (care list or organisation)' })
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.patients.list(user, q);
  }

  @Get(':id')
  @RequirePermissions('patient:read')
  @ApiOperation({ summary: 'Patient profile (row-level access enforced)' })
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.patients.getById(user, id);
  }

  @Patch(':id')
  @RequirePermissions('patient:write')
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(updatePatientProfileSchema)) body: UpdatePatientProfileInput) {
    return this.patients.update(user, id, body);
  }

  @Get(':id/documents')
  @RequirePermissions('document:read')
  @ApiOperation({ summary: 'Documents for a patient (patients: only those shared with them)' })
  documentsFor(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.listForPatient(user, id);
  }

  @Get(':id/consents')
  @RequirePermissions('consent:read')
  async consentsFor(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.access.assertPatientAccess(user, id);
    return this.consents.list(id);
  }
}
