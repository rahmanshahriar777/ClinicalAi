import { canReviewDraft, isAdvisoryWorkflow } from './draft-review-rules';

describe('AI draft review rules (gap analysis #26)', () => {
  it('clinicians can review every human-reviewed workflow regardless of policy', () => {
    for (const require of [true, false]) {
      expect(canReviewDraft('CLINICIAN', 'CLINICAL_NOTE', require)).toBe(true);
      expect(canReviewDraft('CLINICIAN', 'PATIENT_MESSAGE_DRAFT', require)).toBe(true);
      expect(canReviewDraft('CLINICIAN', 'INTAKE_SUMMARY', require)).toBe(true);
      expect(canReviewDraft('CLINICIAN', 'PATIENT_EDUCATION', require)).toBe(true);
    }
  });

  it('nurses may approve message drafts and intake summaries only when clinician approval is not required', () => {
    expect(canReviewDraft('NURSE', 'PATIENT_MESSAGE_DRAFT', true)).toBe(false);
    expect(canReviewDraft('NURSE', 'PATIENT_MESSAGE_DRAFT', false)).toBe(true);
    expect(canReviewDraft('NURSE', 'INTAKE_SUMMARY', false)).toBe(true);
  });

  it('nurses can never approve clinical notes or patient education', () => {
    expect(canReviewDraft('NURSE', 'CLINICAL_NOTE', false)).toBe(false);
    expect(canReviewDraft('NURSE', 'PATIENT_EDUCATION', false)).toBe(false);
  });

  it('other roles cannot review; triage is advisory only', () => {
    expect(canReviewDraft('FRONT_DESK', 'PATIENT_MESSAGE_DRAFT', false)).toBe(false);
    expect(canReviewDraft('ADMIN', 'CLINICAL_NOTE', false)).toBe(false);
    expect(canReviewDraft('PATIENT', 'PATIENT_MESSAGE_DRAFT', false)).toBe(false);
    expect(canReviewDraft('CLINICIAN', 'MESSAGE_TRIAGE', false)).toBe(false);
    expect(isAdvisoryWorkflow('MESSAGE_TRIAGE')).toBe(true);
    expect(isAdvisoryWorkflow('CLINICAL_NOTE')).toBe(false);
  });
});
