import type { UrgencyLevel } from '@app/shared';

import type { RedFlagMatch, RedFlagReport } from '../types';

/**
 * Deterministic red-flag rules (blueprint §4.4, §15.1 "Emergency detection:
 * keyword rules plus AI classification"). Rules are intentionally sensitive;
 * a simple negation window ("no chest pain", "denies ...") suppresses a
 * match but keeps it in the report for audit. Clinical governance owns this
 * list — changes must go through clinical review.
 */
interface Rule {
  category: string;
  urgency: UrgencyLevel;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    category: 'chest_pain',
    urgency: 'EMERGENCY',
    patterns: [/\bchest (pain|pressure|tightness|heaviness)\b/i, /\bcrushing (pain|sensation)\b/i, /\bheart attack\b/i],
  },
  {
    category: 'breathing_difficulty',
    urgency: 'EMERGENCY',
    patterns: [
      /\b(can'?t|cannot|unable to|struggling to|hard to) breath(e|ing)?\b/i,
      /\b(difficulty|trouble|difficulties) breathing\b/i,
      /\bshort(ness)? of breath\b/i,
      /\bgasping\b/i,
      /\b(lips|face) (are |is )?(turning |going )?blue\b/i,
    ],
  },
  {
    category: 'stroke_symptoms',
    urgency: 'EMERGENCY',
    patterns: [
      /\b(face|facial|mouth)( is| feels| has| looks)? (droop|drooping|numb|dropped)/i,
      /\bslurred speech\b/i,
      /\b(can'?t|cannot|unable to) (speak|talk|move (my )?(arm|leg))\b/i,
      /\b(weakness|numbness) (on|in|down) (one|the (left|right)) side\b/i,
      /\bstroke\b/i,
      /\bsudden(ly)? (severe|worst) headache\b/i,
    ],
  },
  {
    category: 'severe_bleeding',
    urgency: 'EMERGENCY',
    patterns: [
      /\b(severe|heavy|uncontrolled|won'?t stop|will not stop|can'?t stop) bleeding\b/i,
      /\bbleeding (heavily|won'?t stop|that won'?t stop)\b/i,
      /\b(vomiting|coughing|throwing up) blood\b/i,
    ],
  },
  {
    category: 'suicidal_ideation',
    urgency: 'EMERGENCY',
    patterns: [
      /\b(kill|hurt|harm) myself\b/i,
      /\b(end|take) my (own )?life\b/i,
      /\bsuicid(e|al)\b/i,
      /\b(want|wish|wanted) to (die|be dead|not wake up)\b/i,
      /\bself[- ]harm\b/i,
      /\bno reason to (live|go on)\b/i,
    ],
  },
  {
    category: 'anaphylaxis',
    urgency: 'EMERGENCY',
    patterns: [/\b(throat|tongue|lips) (is |are )?swelling\b/i, /\banaphyla(xis|ctic)\b/i, /\bswollen (throat|tongue)\b/i],
  },
  {
    category: 'loss_of_consciousness',
    urgency: 'EMERGENCY',
    patterns: [/\b(unconscious|unresponsive|passed out|fainted|collapsed)\b/i, /\bseizure|fitting|convuls/i],
  },
  {
    category: 'overdose',
    urgency: 'EMERGENCY',
    patterns: [/\boverdos(e|ed|ing)\b/i, /\btook (too many|all (of )?(my|the)) (pills|tablets)\b/i],
  },
  {
    category: 'severe_abdominal_pain',
    urgency: 'HIGH',
    patterns: [/\b(severe|unbearable|excruciating) (stomach|abdominal|belly|tummy) pain\b/i],
  },
  {
    category: 'high_fever',
    urgency: 'HIGH',
    patterns: [/\b(fever|temperature) (of |over |above )?(39|40|41|10[3-6])\b/i, /\bhigh fever\b/i],
  },
  {
    category: 'pregnancy_concern',
    urgency: 'HIGH',
    patterns: [/\bpregnan\w* .{0,40}\b(bleeding|cramping|severe pain)\b/i, /\b(bleeding|cramping).{0,40}\bpregnan/i],
  },
  {
    category: 'confusion',
    urgency: 'HIGH',
    patterns: [/\b(sudden|new) confusion\b/i, /\bnot making sense\b/i, /\bdisoriented\b/i],
  },
  {
    category: 'allergic_reaction',
    urgency: 'HIGH',
    patterns: [/\ballergic reaction\b/i, /\bhives all over\b/i],
  },
  {
    category: 'blood_in_stool',
    urgency: 'MEDIUM',
    patterns: [/\b(blood in|bloody) (my )?(stool|poo|urine|pee)\b/i, /\bblack (tarry )?stools?\b/i],
  },
];

const NEGATION = /\b(no|not|never|denies|denied|deny|without|doesn'?t|don'?t|isn'?t|haven'?t|hasn'?t|free of|absence of)\b/i;
const NEGATION_WINDOW_CHARS = 30;

function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - NEGATION_WINDOW_CHARS), index);
  // Only consider the last clause before the match.
  const lastClause = before.split(/[.;!?,]/).pop() ?? '';
  return NEGATION.test(lastClause);
}

const URGENCY_ORDER: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
export function maxUrgency(a: UrgencyLevel, b: UrgencyLevel): UrgencyLevel {
  return URGENCY_ORDER.indexOf(a) >= URGENCY_ORDER.indexOf(b) ? a : b;
}
export function urgencyAtLeast(level: UrgencyLevel, min: UrgencyLevel): boolean {
  return URGENCY_ORDER.indexOf(level) >= URGENCY_ORDER.indexOf(min);
}

export function detectRedFlags(text: string): RedFlagReport {
  const flags: RedFlagMatch[] = [];
  const negated: RedFlagMatch[] = [];
  if (!text) return { urgency: 'LOW', flags, negated };

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const match: RedFlagMatch = {
          category: rule.category,
          urgency: rule.urgency,
          matchedText: m[0],
          negated: isNegated(text, m.index),
        };
        (match.negated ? negated : flags).push(match);
        if (m[0].length === 0) re.lastIndex++;
      }
    }
  }

  // Deduplicate by category.
  const seen = new Set<string>();
  const unique = flags.filter((f) => (seen.has(f.category) ? false : (seen.add(f.category), true)));
  const urgency = unique.reduce<UrgencyLevel>((acc, f) => maxUrgency(acc, f.urgency), 'LOW');
  return { urgency, flags: unique, negated };
}

/** List of categories currently covered — surfaced in AI governance reports. */
export const RED_FLAG_CATEGORIES = RULES.map((r) => ({ category: r.category, urgency: r.urgency }));
