import { describe, expect, it } from 'vitest';

import { RulesPhiRedactor, rehydrate } from '../redaction';

describe('rules PHI redactor', () => {
  const redactor = new RulesPhiRedactor();

  it('redacts known entities and generic identifiers', async () => {
    const text = 'Peter Patient (MRN-0001, DOB 14/03/1984) emailed peter@example.com from 07700 900123 about Dr Sarah Smith.';
    const r = await redactor.redact(text, [
      { value: 'Peter Patient', label: 'PATIENT_NAME' },
      { value: 'Sarah Smith', label: 'CLINICIAN_NAME' },
      { value: 'MRN-0001', label: 'MRN' },
    ]);
    expect(r.text).not.toMatch(/Peter|Sarah|example\.com|0001|1984|900123/);
    expect(r.text).toContain('[PATIENT_NAME]');
    expect(r.text).toContain('[CLINICIAN_NAME]');
    expect(r.labels).toEqual(expect.arrayContaining(['PATIENT_NAME', 'EMAIL', 'DATE']));
    expect(r.entityCount).toBeGreaterThanOrEqual(5);
  });

  it('rehydrates placeholders back into output', async () => {
    const r = await redactor.redact('Patient Peter Patient reports cough.', [{ value: 'Peter Patient', label: 'PATIENT_NAME' }]);
    const out = rehydrate(`Summary for ${'[PATIENT_NAME]'}: cough.`, r.mapping);
    expect(out).toBe('Summary for Peter Patient: cough.');
  });

  it('is case-insensitive for known names', async () => {
    const r = await redactor.redact('peter patient called', [{ value: 'Peter Patient', label: 'PATIENT_NAME' }]);
    expect(r.text).toBe('[PATIENT_NAME] called');
  });
});
