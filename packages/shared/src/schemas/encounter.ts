import { z } from 'zod';

import { DOCUMENT_TYPES } from '../constants';

import { boundedText } from './common';

export const startEncounterSchema = z.object({
  chiefComplaint: boundedText(500).optional(),
});

export const updateEncounterSchema = z
  .object({
    chiefComplaint: boundedText(500),
    /** Clinician shorthand notes — input to AI note generation. */
    notes: z.string().max(20_000),
  })
  .partial();
export type UpdateEncounterInput = z.infer<typeof updateEncounterSchema>;

export const completeEncounterSchema = z.object({
  /** When true and an APPROVED/SIGNED after-visit summary exists, it is shared with the patient. */
  sendAfterVisitSummary: z.boolean().default(false),
});

export const soapNoteSchema = z.object({
  subjective: z.string().max(10_000),
  objective: z.string().max(10_000),
  assessment: z.string().max(10_000),
  plan: z.string().max(10_000),
});
export type SoapNote = z.infer<typeof soapNoteSchema>;

export const createDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  /** Document body as structured JSON (SOAP) or plain text; both are stored as JSON. */
  content: z.union([soapNoteSchema, z.object({ text: z.string().max(50_000) })]),
  /** Optionally link to the AI draft this document was created from. */
  aiDraftId: z.string().uuid().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  content: z.union([soapNoteSchema, z.object({ text: z.string().max(50_000) })]),
  changeSummary: boundedText(500).optional(),
});

export const amendDocumentSchema = z.object({
  content: z.union([soapNoteSchema, z.object({ text: z.string().max(50_000) })]),
  reason: boundedText(500),
});
