import type { AiWorkflow, UserRole } from '@app/shared';

/**
 * Who may approve which AI draft (blueprint §11.2 "Nurse: review AI drafts if
 * permitted", §15.1 "Human-in-the-loop"; see gap analysis #26).
 *
 *   CLINICAL_NOTE         → CLINICIAN only, always
 *   PATIENT_EDUCATION     → CLINICIAN only, always (patient-facing clinical content)
 *   PATIENT_MESSAGE_DRAFT → CLINICIAN; NURSE only when requireClinicianApproval=false
 *   INTAKE_SUMMARY        → CLINICIAN; NURSE only when requireClinicianApproval=false
 *   MESSAGE_TRIAGE        → advisory metadata, auto-approved; never reviewed by humans
 * Rejection follows the same rules (a reviewer who cannot approve cannot reject).
 */
export function canReviewDraft(role: UserRole, workflow: AiWorkflow, requireClinicianApproval: boolean): boolean {
  if (role === 'CLINICIAN') return workflow !== 'MESSAGE_TRIAGE';
  if (role === 'NURSE') return !requireClinicianApproval && (workflow === 'PATIENT_MESSAGE_DRAFT' || workflow === 'INTAKE_SUMMARY');
  return false;
}

/** Workflows that are never shown in the human review queue. */
export function isAdvisoryWorkflow(workflow: AiWorkflow): boolean {
  return workflow === 'MESSAGE_TRIAGE';
}
