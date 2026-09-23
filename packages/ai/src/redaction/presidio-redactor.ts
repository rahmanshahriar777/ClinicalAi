import type { KnownPhiEntity } from '../types';

import { RulesPhiRedactor } from './rules-redactor';
import type { PhiRedactor, RedactionResult } from './types';

/**
 * Microsoft Presidio adapter (blueprint §16.3). Runs the rules redactor first
 * for known identifiers, then Presidio NER for everything else.
 * Analyzer API: POST {analyzerUrl}/analyze  { text, language }
 * Anonymizer:   POST {anonymizerUrl}/anonymize { text, analyzer_results, anonymizers }
 */
export class PresidioPhiRedactor implements PhiRedactor {
  readonly name = 'presidio';
  private readonly rules = new RulesPhiRedactor();

  constructor(
    private readonly analyzerUrl: string,
    private readonly anonymizerUrl: string,
    private readonly language = 'en',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async redact(text: string, known: KnownPhiEntity[] = []): Promise<RedactionResult> {
    const base = await this.rules.redact(text, known);

    const analyzeRes = await this.fetchImpl(`${this.analyzerUrl}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: base.text, language: this.language }),
    });
    if (!analyzeRes.ok) throw new Error(`Presidio analyzer error ${analyzeRes.status}`);
    const results = (await analyzeRes.json()) as Array<{ entity_type: string; start: number; end: number; score: number }>;

    if (!results.length) return base;

    // Build our own placeholders so rehydration mapping stays consistent.
    const mapping = { ...base.mapping };
    const labels = new Set(base.labels);
    let out = '';
    let cursor = 0;
    const counters: Record<string, number> = {};
    const sorted = [...results].sort((a, b) => a.start - b.start);
    for (const r of sorted) {
      if (r.start < cursor) continue; // overlapping
      const original = base.text.slice(r.start, r.end);
      if (/^\[[A-Z_0-9]+\]$/.test(original)) continue;
      counters[r.entity_type] = (counters[r.entity_type] ?? 0) + 1;
      const ph = `[${r.entity_type}_${counters[r.entity_type]}]`;
      mapping[ph] = original;
      labels.add(r.entity_type);
      out += base.text.slice(cursor, r.start) + ph;
      cursor = r.end;
    }
    out += base.text.slice(cursor);

    return { text: out, mapping, entityCount: Object.keys(mapping).length, labels: [...labels] };
  }
}
