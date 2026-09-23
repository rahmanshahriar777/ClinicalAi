import type { KnownPhiEntity } from '../types';
import { escapeRegExp } from '../util';

import type { PhiRedactor, RedactionResult } from './types';

/**
 * Rules-based PHI redactor (blueprint §11.5 Path A, §16.3 "PHI redaction").
 * Two layers:
 *   1. Known entities from the database (names, MRN, DOB, email, phone) —
 *      deterministic and high precision.
 *   2. Generic pattern detectors for identifiers the DB does not know about.
 * For production-grade NER, swap in PresidioRedactor (same interface).
 */
const GENERIC_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'EMAIL', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { label: 'PHONE', re: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}\b/g },
  { label: 'NHS_NUMBER', re: /\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g },
  { label: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: 'DATE', re: /\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g },
  { label: 'UK_POSTCODE', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi },
  { label: 'US_ZIP_ADDRESS', re: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Close|Way)\b\.?/g },
  { label: 'MRN', re: /\bMRN[-:\s]?[A-Z0-9-]{3,}\b/gi },
  { label: 'URL', re: /https?:\/\/\S+/gi },
];

export class RulesPhiRedactor implements PhiRedactor {
  readonly name = 'rules';

  async redact(text: string, known: KnownPhiEntity[] = []): Promise<RedactionResult> {
    const mapping: Record<string, string> = {};
    const labels = new Set<string>();
    const counters: Record<string, number> = {};
    let out = text;

    const placeholderFor = (label: string, value: string): string => {
      // Reuse the same placeholder for the same value.
      const existing = Object.entries(mapping).find(([, v]) => v.toLowerCase() === value.toLowerCase());
      if (existing) return existing[0];
      counters[label] = (counters[label] ?? 0) + 1;
      const ph = counters[label] === 1 && !/^\w+_\d+$/.test(label) ? `[${label}]` : `[${label}_${counters[label]}]`;
      mapping[ph] = value;
      labels.add(label);
      return ph;
    };

    // Layer 1: known entities, longest first so "Sarah Smith" wins over "Sarah".
    const sortedKnown = [...known].filter((k) => k.value && k.value.trim().length >= 2).sort((a, b) => b.value.length - a.value.length);
    for (const entity of sortedKnown) {
      const re = new RegExp(`\\b${escapeRegExp(entity.value.trim())}\\b`, 'gi');
      if (re.test(out)) {
        const ph = placeholderFor(entity.label, entity.value.trim());
        out = out.replace(re, ph);
      }
    }

    // Layer 2: generic detectors.
    for (const { label, re } of GENERIC_PATTERNS) {
      out = out.replace(re, (m) => {
        // Skip anything that is already a placeholder.
        if (/^\[[A-Z_0-9]+\]$/.test(m)) return m;
        return placeholderFor(label, m);
      });
    }

    return { text: out, mapping, entityCount: Object.keys(mapping).length, labels: [...labels] };
  }
}

/** Replace placeholders in model output with the original values. */
export function rehydrate(text: string, mapping: Record<string, string>): string {
  let out = text;
  for (const [ph, value] of Object.entries(mapping)) {
    out = out.split(ph).join(value);
  }
  return out;
}
