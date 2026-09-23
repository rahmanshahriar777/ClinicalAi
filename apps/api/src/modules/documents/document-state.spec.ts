import { isImmutable, nextDocumentStatus } from './document-state';

describe('document state machine (blueprint §4.2)', () => {
  it('follows the happy path AI Draft → Revised → Approved → Signed → Amended', () => {
    expect(nextDocumentStatus('AI_DRAFT', 'edit')).toBe('REVISED');
    expect(nextDocumentStatus('REVISED', 'approve')).toBe('APPROVED');
    expect(nextDocumentStatus('APPROVED', 'sign')).toBe('SIGNED');
    expect(nextDocumentStatus('SIGNED', 'amend')).toBe('AMENDED');
    expect(nextDocumentStatus('AMENDED', 'amend')).toBe('AMENDED');
  });

  it('supports review round-trips', () => {
    expect(nextDocumentStatus('AI_DRAFT', 'submit_for_review')).toBe('UNDER_REVIEW');
    expect(nextDocumentStatus('UNDER_REVIEW', 'edit')).toBe('REVISED');
    expect(nextDocumentStatus('REVISED', 'submit_for_review')).toBe('UNDER_REVIEW');
  });

  it('rejects invalid transitions', () => {
    expect(nextDocumentStatus('DRAFT', 'sign')).toBeNull();
    expect(nextDocumentStatus('SIGNED', 'edit')).toBeNull();
    expect(nextDocumentStatus('SIGNED', 'approve')).toBeNull();
    expect(nextDocumentStatus('AMENDED', 'sign')).toBeNull();
    expect(nextDocumentStatus('UNDER_REVIEW', 'sign')).toBeNull();
  });

  it('marks signed content immutable', () => {
    expect(isImmutable('SIGNED')).toBe(true);
    expect(isImmutable('AMENDED')).toBe(true);
    expect(isImmutable('APPROVED')).toBe(false);
  });
});
