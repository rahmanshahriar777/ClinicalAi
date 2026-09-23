import { z } from 'zod';

import { AI_WORKFLOWS, APPROVAL_DECISIONS, MESSAGE_INTENTS, SUGGESTED_ROUTES, URGENCY_LEVELS } from '../constants';

import { boundedText } from './common';
import { soapNoteSchema } from './encounter';

/* ------------------------------------------------------------------ */
/* Requests                                                             */
/* ------------------------------------------------------------------ */

export const generateDraftSchema = z.object({
  workflow: z.enum(AI_WORKFLOWS),
  /** Prompt template name; defaults to the workflow's active template. */
  promptName: z.string().min(1).max(100).optional(),
  options: z
    .object({
      /** Note template, e.g. "SOAP" | "PROGRESS" */
      template: z.string().max(50).optional(),
      /** Clinician instructions for message drafting */
      instructions: z.string().max(2000).optional(),
      /** Patient education topic (Workflow 4) */
      topic: z.string().max(200).optional(),
      language: z.string().max(10).optional(),
    })
    .optional(),
});
export type GenerateDraftInput = z.infer<typeof generateDraftSchema>;

export const reviewDraftSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  comments: boundedText(2000).optional(),
  /** Required for APPROVED_WITH_EDITS — the clinician's edited output. */
  editedOutput: z.record(z.unknown()).optional(),
  /**
   * PATIENT_MESSAGE_DRAFT only: when an approval is recorded, also send the
   * (edited) reply to the patient as a staff message. Defaults to true.
   */
  sendOnApprove: z.boolean().default(true),
});
export type ReviewDraftInput = z.infer<typeof reviewDraftSchema>;

/* ------------------------------------------------------------------ */
/* AI output contracts — the single source of truth for what the LLM   */
/* must return (blueprint §13.2 and §14 unified; see gap analysis).    */
/* ------------------------------------------------------------------ */

export const clinicalNoteOutputSchema = z.object({
  soapNote: soapNoteSchema,
  structuredData: z
    .object({
      chiefComplaint: z.string().max(500).default(''),
      symptoms: z.array(z.string().max(200)).default([]),
      medications: z.array(z.string().max(200)).default([]),
      allergies: z.array(z.string().max(200)).default([]),
      followUp: z.string().max(1000).default(''),
    })
    .default({}),
  codingSuggestions: z
    .object({
      icd10: z.array(z.string().max(20)).default([]),
      snomed: z.array(z.string().max(30)).default([]),
      confidence: z.number().min(0).max(1).default(0),
    })
    .default({}),
  missingInformation: z.array(z.string().max(300)).default([]),
  uncertainty: z.string().max(2000).default(''),
  safetyFlags: z.array(z.string().max(200)).default([]),
  confidence: z.number().min(0).max(1),
});
export type ClinicalNoteOutput = z.infer<typeof clinicalNoteOutputSchema>;

export const patientMessageDraftOutputSchema = z.object({
  suggestedResponse: z.string().min(1).max(5000),
  tone: z.string().max(50).default('professional'),
  readingLevel: z.string().max(50).default('grade-6'),
  escalationRecommended: z.boolean(),
  escalationReason: z.string().max(1000).nullable().default(null),
  urgencyLevel: z.enum(URGENCY_LEVELS),
  /** Always true in the current policy; kept so policy can loosen later. */
  needsClinicianReview: z.boolean().default(true),
});
export type PatientMessageDraftOutput = z.infer<typeof patientMessageDraftOutputSchema>;

export const intakeSummaryOutputSchema = z.object({
  summary: z.string().min(1).max(5000),
  missingInformation: z.array(z.string().max(300)).default([]),
  redFlags: z.array(z.string().max(200)).default([]),
  urgencyLevel: z.enum(URGENCY_LEVELS),
  structuredFields: z
    .object({
      chiefComplaint: z.string().max(500).default(''),
      duration: z.string().max(200).default(''),
      medications: z.array(z.string().max(200)).default([]),
      allergies: z.array(z.string().max(200)).default([]),
    })
    .default({}),
});
export type IntakeSummaryOutput = z.infer<typeof intakeSummaryOutputSchema>;

export const patientEducationOutputSchema = z.object({
  title: z.string().max(200),
  explanation: z.string().max(5000),
  careInstructions: z.array(z.string().max(500)).default([]),
  warningSigns: z.array(z.string().max(500)).default([]),
  followUpGuidance: z.string().max(2000).default(''),
  disclaimer: z.string().max(1000),
  readingLevel: z.string().max(50).default('grade-6'),
});
export type PatientEducationOutput = z.infer<typeof patientEducationOutputSchema>;

export const messageTriageOutputSchema = z.object({
  intent: z.enum(MESSAGE_INTENTS),
  urgencyLevel: z.enum(URGENCY_LEVELS),
  redFlags: z.array(z.string().max(200)).default([]),
  suggestedRoute: z.enum(SUGGESTED_ROUTES),
  summary: z.string().max(1000),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'distressed']).default('neutral'),
});
export type MessageTriageOutput = z.infer<typeof messageTriageOutputSchema>;

export const AI_OUTPUT_SCHEMAS = {
  CLINICAL_NOTE: clinicalNoteOutputSchema,
  PATIENT_MESSAGE_DRAFT: patientMessageDraftOutputSchema,
  INTAKE_SUMMARY: intakeSummaryOutputSchema,
  PATIENT_EDUCATION: patientEducationOutputSchema,
  MESSAGE_TRIAGE: messageTriageOutputSchema,
} as const;

export type AiOutputFor<W extends keyof typeof AI_OUTPUT_SCHEMAS> = z.infer<(typeof AI_OUTPUT_SCHEMAS)[W]>;
