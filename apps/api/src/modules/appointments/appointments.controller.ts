import { cancelAppointmentSchema, type CreateAppointmentInput, createAppointmentSchema, type ListAppointmentsQuery, listAppointmentsQuerySchema, type SubmitIntakeInput, submitIntakeSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../auth/auth.types';
import { EncountersService } from '../encounters/encounters.service';
import { IntakeService } from '../intake/intake.service';

import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly intake: IntakeService,
    private readonly encounters: EncountersService,
  ) {}

  @Get()
  @RequirePermissions('appointment:read')
  @ApiOperation({ summary: 'List appointments (scoped to the caller)' })
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listAppointmentsQuerySchema)) q: ListAppointmentsQuery) {
    return this.appointments.list(user, q);
  }

  @Post()
  @RequirePermissions('appointment:write')
  @ApiOperation({ summary: 'Book an appointment (patient self-service or front desk)' })
  create(@CurrentUser() user: RequestUser, @Body(zodBody(createAppointmentSchema)) body: CreateAppointmentInput) {
    return this.appointments.create(user, body);
  }

  @Get(':id')
  @RequirePermissions('appointment:read')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.get(user, id);
  }

  @Patch(':id/cancel')
  @RequirePermissions('appointment:write')
  @ApiOperation({ summary: 'Cancel an appointment (blueprint §12.2 uses PATCH)' })
  cancel(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(cancelAppointmentSchema)) body: { reason?: string }) {
    return this.appointments.cancel(user, id, body.reason);
  }

  @Post(':id/check-in')
  @RequirePermissions('appointment:write')
  checkIn(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.checkIn(user, id);
  }

  @Post(':id/no-show')
  @RequirePermissions('appointment:write')
  noShow(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.markNoShow(user, id);
  }

  /* ---------- intake (blueprint §4.2 step 1) ---------- */

  @Get(':id/intake')
  @RequirePermissions('intake:read')
  @ApiOperation({ summary: 'Pre-visit intake form for this appointment' })
  getIntake(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.intake.get(user, id);
  }

  @Post(':id/intake')
  @RequirePermissions('intake:write')
  @ApiOperation({ summary: 'Submit intake answers; runs red-flag rules and queues the AI intake summary' })
  submitIntake(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(submitIntakeSchema)) body: SubmitIntakeInput) {
    return this.intake.submit(user, id, body);
  }

  /* ---------- encounter entry point ---------- */

  @Post(':id/encounter')
  @RequirePermissions('encounter:write')
  @ApiOperation({ summary: 'Create (or return) the encounter for a checked-in appointment' })
  createEncounter(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.encounters.createForAppointment(user, id);
  }
}
