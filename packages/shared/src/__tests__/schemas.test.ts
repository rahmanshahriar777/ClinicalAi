import { describe, expect, it } from 'vitest';

import { clinicalNoteOutputSchema, patientMessageDraftOutputSchema } from '../schemas/ai';
import { loginSchema, passwordSchema } from '../schemas/auth';
import { createThreadSchema } from '../schemas/messaging';

describe('auth schemas', () => {
  it('rejects weak passwords', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase123456').success).toBe(false);
    expect(passwordSchema.safeParse('CorrectHorse1Battery').success).toBe(true);
  });

  it('normalises email casing on login', () => {
    const parsed = loginSchema.parse({ email: 'Dr.Smith@Clinic.ORG', password: 'x' });
    expect(parsed.email).toBe('dr.smith@clinic.org');
  });
});

describe('AI output contracts', () => {
  it('accepts a minimal clinical note and applies defaults', () => {
    const out = clinicalNoteOutputSchema.parse({
      soapNote: { subjective: 's', objective: 'o', assessment: 'a', plan: 'p' },
      confidence: 0.7,
    });
    expect(out.missingInformation).toEqual([]);
    expect(out.codingSuggestions.icd10).toEqual([]);
  });

  it('rejects malformed patient message drafts', () => {
    expect(
      patientMessageDraftOutputSchema.safeParse({ suggestedResponse: '', escalationRecommended: false, urgencyLevel: 'LOW' })
        .success,
    ).toBe(false);
    expect(
      patientMessageDraftOutputSchema.safeParse({
        suggestedResponse: 'Hello',
        escalationRecommended: 'yes',
        urgencyLevel: 'LOW',
      }).success,
    ).toBe(false);
  });
});

describe('messaging schemas', () => {
  it('trims and bounds message bodies', () => {
    expect(createThreadSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(createThreadSchema.safeParse({ body: 'a'.repeat(5001) }).success).toBe(false);
    expect(createThreadSchema.parse({ body: '  hi  ' }).body).toBe('hi');
  });
});
