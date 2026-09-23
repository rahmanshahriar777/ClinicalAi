import { z } from 'zod';

import { APPOINTMENT_STATUSES } from '../constants';

import { boundedText, paginationQuerySchema } from './common';

export const createAppointmentSchema = z.object({
  /** Required for staff; ignored for patients (derived from the session). */
  patientId: z.string().uuid().optional(),
  clinicianId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(240).default(20),
  reason: boundedText(500).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  reason: boundedText(500).optional(),
});

export const listAppointmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  patientId: z.string().uuid().optional(),
  clinicianId: z.string().uuid().optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
