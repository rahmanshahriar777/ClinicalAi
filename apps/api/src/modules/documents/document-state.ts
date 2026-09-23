import type { DocumentStatus } from '@app/shared';

/**
 * Clinical document state machine (blueprint §4.2):
 *   Draft → AI Draft → Clinician Review → Edited/Revised → Approved → Signed → Amended
 * Expressed as (currentStatus, action) → nextStatus. Anything not listed is
 * an invalid transition and is rejected by DocumentsService.
 */
export type DocumentAction = 'edit' | 'submit_for_review' | 'approve' | 'sign' | 'amend';

const TRANSITIONS: Record<DocumentStatus, Partial<Record<DocumentAction, DocumentStatus>>> = {
  DRAFT: { edit: 'DRAFT', submit_for_review: 'UNDER_REVIEW', approve: 'APPROVED' },
  AI_DRAFT: { edit: 'REVISED', submit_for_review: 'UNDER_REVIEW', approve: 'APPROVED' },
  UNDER_REVIEW: { edit: 'REVISED', approve: 'APPROVED' },
  REVISED: { edit: 'REVISED', submit_for_review: 'UNDER_REVIEW', approve: 'APPROVED' },
  APPROVED: { sign: 'SIGNED', edit: 'REVISED' },
  SIGNED: { amend: 'AMENDED' },
  AMENDED: { amend: 'AMENDED' },
};

export function nextDocumentStatus(current: DocumentStatus, action: DocumentAction): DocumentStatus | null {
  return TRANSITIONS[current]?.[action] ?? null;
}

/** Signed/amended content is immutable except through `amend` (which appends a new signed version). */
export function isImmutable(status: DocumentStatus): boolean {
  return status === 'SIGNED' || status === 'AMENDED';
}
