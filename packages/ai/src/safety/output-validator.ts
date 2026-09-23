import type { AiWorkflow } from '@app/shared';

import { collectStrings } from '../util';

import { detectRedFlags } from './red-flags';

/**
 * Post-generation clinical safety checks (blueprint §15.2 stage 7).
 * These do not block — every draft is reviewed by a human — but flags are
 * surfaced prominently and routed to clinician (not nurse) review.
 */
const PATIENT_FACING: AiWorkflow[] = ['PATIENT_MESSAGE_DRAFT', 'PATIENT_EDUCATION'];

const DIAGNOSTIC_LANGUAGE = [
  /\byou (definitely |clearly |certainly )?have (a |an )?(\w+ )?(infection|cancer|diabetes|stroke|heart attack|tumou?r|fracture|pneumonia|sepsis)\b/i,
  /\b(this|it) is (definitely|certainly|clearly) (a |an )?/i,
  /\bmy diagnosis is\b/i,
];

const PRESCRIBING_LANGUAGE = [
  /\btake \d+\s?(mg|mcg|g|ml|tablets?|pills?|capsules?)\b/i,
  /\b\d+\s?(mg|mcg|ml) (every|twice|three times|once)\b/i,
  /\b(increase|double|stop taking|discontinue) your (dose|medication|tablets?)\b/i,
  /\bi('m| am) prescribing\b/i,
];

const EMERGENCY_INSTRUCTION = [/\bdo not (go to|call) (the )?(emergency|a&e|er|999|911)\b/i];

const UNSAFE_REASSURANCE = [/\b(nothing to worry about|definitely not serious|no need to see (a|the) doctor)\b/i];

export interface SafetyCheckResult {
  flags: string[];
}

export function runSafetyChecks(workflow: AiWorkflow, output: unknown): SafetyCheckResult {
  const flags = new Set<string>();
  const text = collectStrings(output).join('\n');

  if (DIAGNOSTIC_LANGUAGE.some((re) => re.test(text))) flags.add('definitive_diagnostic_language');
  if (PRESCRIBING_LANGUAGE.some((re) => re.test(text))) flags.add('prescribing_language');
  if (EMERGENCY_INSTRUCTION.some((re) => re.test(text))) flags.add('discourages_emergency_care');

  if (PATIENT_FACING.includes(workflow)) {
    if (UNSAFE_REASSURANCE.some((re) => re.test(text))) flags.add('unsafe_reassurance');
    const rf = detectRedFlags(text);
    if (rf.flags.length) flags.add('red_flag_terms_in_patient_content');
  }

  // Model-declared flags (clinical note schema carries safetyFlags).
  const declared = (output as { safetyFlags?: unknown })?.safetyFlags;
  if (Array.isArray(declared)) declared.forEach((f) => typeof f === 'string' && f && flags.add(`model:${f}`));

  return { flags: [...flags] };
}
