import { z } from 'zod';

/**
 * Intake form payload. Kept as a validated but flexible structure because
 * clinics customise intake questions; the AI intake-summary workflow reads
 * the well-known keys and passes the rest through as "additional answers".
 */
export const intakeAnswersSchema = z.object({
  chiefComplaint: z.string().max(2000).optional(),
  symptomDuration: z.string().max(200).optional(),
  symptoms: z.array(z.string().max(200)).max(50).optional(),
  medications: z.array(z.string().max(200)).max(100).optional(),
  allergies: z.array(z.string().max(200)).max(100).optional(),
  medicalHistory: z.string().max(5000).optional(),
  painScale: z.number().int().min(0).max(10).optional(),
  additionalAnswers: z.record(z.string().max(100), z.union([z.string().max(2000), z.number(), z.boolean()])).optional(),
});
export type IntakeAnswers = z.infer<typeof intakeAnswersSchema>;

export const submitIntakeSchema = z.object({
  answers: intakeAnswersSchema,
});
export type SubmitIntakeInput = z.infer<typeof submitIntakeSchema>;
