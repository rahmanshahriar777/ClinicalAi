import { describe, expect, it } from 'vitest';

import { detectRedFlags } from '../safety/red-flags';

describe('red-flag rules', () => {
  it('flags chest pain as EMERGENCY', () => {
    const r = detectRedFlags('I have had chest pain since this morning and feel sweaty');
    expect(r.urgency).toBe('EMERGENCY');
    expect(r.flags.map((f) => f.category)).toContain('chest_pain');
  });

  it('flags suicidal ideation as EMERGENCY', () => {
    const r = detectRedFlags("I don't see the point anymore and I want to end my life");
    expect(r.urgency).toBe('EMERGENCY');
    expect(r.flags.map((f) => f.category)).toContain('suicidal_ideation');
  });

  it('flags stroke symptoms and breathing difficulty', () => {
    expect(detectRedFlags('my face is drooping on one side').urgency).toBe('EMERGENCY');
    expect(detectRedFlags("I can't breathe properly").urgency).toBe('EMERGENCY');
    expect(detectRedFlags('shortness of breath when climbing stairs').urgency).toBe('EMERGENCY');
  });

  it('suppresses negated matches but records them for audit', () => {
    const r = detectRedFlags('No chest pain, no shortness of breath. Just a mild cough.');
    expect(r.urgency).toBe('LOW');
    expect(r.flags).toHaveLength(0);
    expect(r.negated.map((n) => n.category)).toEqual(expect.arrayContaining(['chest_pain', 'breathing_difficulty']));
  });

  it('does not treat negation across sentence boundaries', () => {
    const r = detectRedFlags('I have no allergies. Chest pain started an hour ago.');
    expect(r.urgency).toBe('EMERGENCY');
  });

  it('assigns HIGH for severe abdominal pain', () => {
    expect(detectRedFlags('severe abdominal pain since last night').urgency).toBe('HIGH');
  });

  it('returns LOW for benign text', () => {
    expect(detectRedFlags('Can I move my appointment to Thursday?').urgency).toBe('LOW');
  });
});
