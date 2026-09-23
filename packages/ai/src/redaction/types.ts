import type { KnownPhiEntity } from '../types';

export interface RedactionResult {
  text: string;
  /** placeholder -> original value, used to rehydrate outputs for clinicians. */
  mapping: Record<string, string>;
  entityCount: number;
  labels: string[];
}

export interface PhiRedactor {
  readonly name: string;
  redact(text: string, known?: KnownPhiEntity[]): Promise<RedactionResult>;
}
