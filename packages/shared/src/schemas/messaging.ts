import { z } from 'zod';

import { THREAD_STATUSES, URGENCY_LEVELS } from '../constants';

import { boundedText, paginationQuerySchema } from './common';

export const createThreadSchema = z.object({
  /** Staff must supply the patient; patients create threads for themselves. */
  patientId: z.string().uuid().optional(),
  subject: boundedText(200).optional(),
  body: boundedText(5000),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

export const sendMessageSchema = z.object({
  body: boundedText(5000),
  /** Staff only: attaches the approved AI draft this message was based on. */
  aiDraftId: z.string().uuid().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const listThreadsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(THREAD_STATUSES).optional(),
  urgency: z.enum(URGENCY_LEVELS).optional(),
  patientId: z.string().uuid().optional(),
  assignedToMe: z.coerce.boolean().optional(),
});
export type ListThreadsQuery = z.infer<typeof listThreadsQuerySchema>;

export const updateThreadSchema = z
  .object({
    status: z.enum(THREAD_STATUSES),
    urgency: z.enum(URGENCY_LEVELS),
    assignedToUserId: z.string().uuid().nullable(),
  })
  .partial();
