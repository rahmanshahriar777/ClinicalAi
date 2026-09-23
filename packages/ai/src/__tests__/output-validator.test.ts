import { describe, expect, it } from 'vitest';

import { runSafetyChecks } from '../safety/output-validator';

describe('output safety validator', () => {
  it('flags prescribing language in patient messages', () => {
    const r = runSafetyChecks('PATIENT_MESSAGE_DRAFT', { suggestedResponse: 'Take 500 mg every 6 hours.' });
    expect(r.flags).toContain('prescribing_language');
  });

  it('flags definitive diagnoses', () => {
    const r = runSafetyChecks('PATIENT_MESSAGE_DRAFT', { suggestedResponse: 'You definitely have a chest infection.' });
    expect(r.flags).toContain('definitive_diagnostic_language');
  });

  it('carries model-declared safety flags', () => {
    const r = runSafetyChecks('CLINICAL_NOTE', { safetyFlags: ['medication_conflict'] });
    expect(r.flags).toContain('model:medication_conflict');
  });

  it('passes clean content', () => {
    const r = runSafetyChecks('PATIENT_MESSAGE_DRAFT', { suggestedResponse: 'Thanks for your message, the team will follow up.' });
    expect(r.flags).toEqual([]);
  });
});
