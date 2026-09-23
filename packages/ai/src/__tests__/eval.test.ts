import { describe, expect, it } from 'vitest';

import { fleschKincaidGrade, normalizedEditDistance } from '../eval/metrics';

describe('eval metrics', () => {
  it('computes normalised edit distance', () => {
    expect(normalizedEditDistance('abc', 'abc')).toBe(0);
    expect(normalizedEditDistance('', 'abcd')).toBe(1);
    expect(normalizedEditDistance('kitten', 'sitting')).toBeCloseTo(3 / 7, 5);
  });

  it('scores simple text lower than complex text', () => {
    const simple = fleschKincaidGrade('Drink water. Rest today. Call us if you feel worse.');
    const complex = fleschKincaidGrade('Pharmacological intervention necessitates comprehensive multidisciplinary reassessment of contraindications.');
    expect(simple).toBeLessThan(complex);
  });
});
