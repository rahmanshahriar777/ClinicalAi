import type { ClinicalDocument, DocumentRevision, Prisma } from '@app/db';
import type { CreateDocumentInput, DocumentStatus } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { AccessPolicyService } from '../../access/access-policy.service';
import { ForbiddenError, InvalidStateTransitionError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { sha256, stableStringify } from '../../common/utils/crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';

import { type DocumentAction, isImmutable, nextDocumentStatus } from './document-state';

type DocWithRevisions = ClinicalDocument & { revisions: DocumentRevision[] };

/**
 * Clinical documents with a full revision trail. Only clinicians create,
 * approve and sign; signing freezes the content hash. Patients may read
 * documents that were explicitly shared with them (after-visit summaries).
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
  ) {}

  async listForEncounter(user: RequestUser, encounterId: string): Promise<ClinicalDocument[]> {
    await this.access.assertEncounterAccess(user, encounterId);
    return this.prisma.clinicalDocument.findMany({
      where: { encounterId, ...(user.role === 'PATIENT' ? { sharedWithPatientAt: { not: null } } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForPatient(user: RequestUser, patientId: string): Promise<ClinicalDocument[]> {
    await this.access.assertPatientAccess(user, patientId);
    return this.prisma.clinicalDocument.findMany({
      where: { encounter: { appointment: { patientId } }, ...(user.role === 'PATIENT' ? { sharedWithPatientAt: { not: null } } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { encounter: { select: { id: true, appointment: { select: { scheduledAt: true } } } } },
    });
  }

  async get(user: RequestUser, id: string): Promise<DocWithRevisions> {
    const doc = await this.load(user, id);
    await this.audit.log({ action: 'PHI_ACCESSED', resource: 'ClinicalDocument', resourceId: id, patientId: await this.patientIdOf(doc) });
    return doc;
  }

  async create(user: RequestUser, encounterId: string, input: CreateDocumentInput): Promise<ClinicalDocument> {
    const enc = await this.access.assertEncounterAccess(user, encounterId);
    if (input.aiDraftId) {
      const draft = await this.prisma.aiDraft.findUnique({ where: { id: input.aiDraftId } });
      if (!draft || draft.encounterId !== encounterId) throw new ValidationError('aiDraftId does not belong to this encounter');
      if (draft.status !== 'APPROVED') throw new ValidationError('Only approved AI drafts can seed a document');
    }
    const doc = await this.prisma.clinicalDocument.create({
      data: {
        encounterId,
        type: input.type,
        status: input.aiDraftId ? 'AI_DRAFT' : 'DRAFT',
        content: input.content as Prisma.InputJsonValue,
        createdById: user.id,
        aiDraftId: input.aiDraftId,
        revisions: { create: { version: 1, content: input.content as Prisma.InputJsonValue, status: input.aiDraftId ? 'AI_DRAFT' : 'DRAFT', editedById: user.id, changeSummary: input.aiDraftId ? 'Created from approved AI draft' : 'Created' } },
      },
    });
    await this.audit.log({ action: 'DOCUMENT_CREATED', resource: 'ClinicalDocument', resourceId: doc.id, patientId: enc.appointment.patientId, metadata: { type: doc.type, fromAiDraft: Boolean(input.aiDraftId) } });
    return doc;
  }

  async update(user: RequestUser, id: string, content: unknown, changeSummary?: string): Promise<ClinicalDocument> {
    const doc = await this.load(user, id);
    this.assertStaffCanEdit(user);
    return this.transition(user, doc, 'edit', { content, changeSummary: changeSummary ?? 'Edited' }, 'DOCUMENT_UPDATED');
  }

  async submitForReview(user: RequestUser, id: string): Promise<ClinicalDocument> {
    const doc = await this.load(user, id);
    this.assertStaffCanEdit(user);
    return this.transition(user, doc, 'submit_for_review', { changeSummary: 'Submitted for review' }, 'DOCUMENT_UPDATED');
  }

  async approve(user: RequestUser, id: string): Promise<ClinicalDocument> {
    const doc = await this.load(user, id);
    if (user.role !== 'CLINICIAN') throw new ForbiddenError('Only clinicians can approve clinical documents');
    return this.transition(user, doc, 'approve', { changeSummary: 'Approved', extra: { approvedById: user.id, approvedAt: new Date() } }, 'DOCUMENT_APPROVED');
  }

  async sign(user: RequestUser, id: string): Promise<ClinicalDocument> {
    const doc = await this.load(user, id);
    if (user.role !== 'CLINICIAN') throw new ForbiddenError('Only clinicians can sign clinical documents');
    const contentHash = sha256(stableStringify(doc.content));
    return this.transition(user, doc, 'sign', { changeSummary: 'Signed', extra: { signedAt: new Date(), contentHash, approvedById: doc.approvedById ?? user.id, approvedAt: doc.approvedAt ?? new Date() } }, 'DOCUMENT_SIGNED');
  }

  async amend(user: RequestUser, id: string, content: unknown, reason: string): Promise<ClinicalDocument> {
    const doc = await this.load(user, id);
    if (user.role !== 'CLINICIAN') throw new ForbiddenError('Only clinicians can amend signed documents');
    const contentHash = sha256(stableStringify(content));
    return this.transition(user, doc, 'amend', { content, changeSummary: `Amended: ${reason}`, extra: { contentHash, signedAt: new Date() } }, 'DOCUMENT_AMENDED');
  }

  async shareWithPatient(user: RequestUser, id: string): Promise<ClinicalDocument> {
    const doc = await this.load(user, id);
    if (user.role !== 'CLINICIAN') throw new ForbiddenError();
    if (doc.status !== 'APPROVED' && doc.status !== 'SIGNED' && doc.status !== 'AMENDED') throw new InvalidStateTransitionError('document', doc.status, 'share');
    return this.prisma.clinicalDocument.update({ where: { id }, data: { sharedWithPatientAt: doc.sharedWithPatientAt ?? new Date() } });
  }

  /* ---------- internals ---------- */

  private async transition(
    user: RequestUser,
    doc: DocWithRevisions,
    action: DocumentAction,
    opts: { content?: unknown; changeSummary: string; extra?: Prisma.ClinicalDocumentUncheckedUpdateInput },
    auditAction: 'DOCUMENT_UPDATED' | 'DOCUMENT_APPROVED' | 'DOCUMENT_SIGNED' | 'DOCUMENT_AMENDED',
  ): Promise<ClinicalDocument> {
    const next = nextDocumentStatus(doc.status as DocumentStatus, action);
    if (!next) throw new InvalidStateTransitionError('document', doc.status, action.replace('_', ' '));
    if (opts.content !== undefined && isImmutable(doc.status as DocumentStatus) && action !== 'amend') throw new InvalidStateTransitionError('document', doc.status, 'edit');

    const version = (doc.revisions[0]?.version ?? 0) + 1;
    const content = (opts.content ?? doc.content) as Prisma.InputJsonValue;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.clinicalDocument.update({ where: { id: doc.id }, data: { status: next, content, ...opts.extra } });
      await tx.documentRevision.create({ data: { documentId: doc.id, version, content, status: next, editedById: user.id, changeSummary: opts.changeSummary } });
      return u;
    });
    await this.audit.log({ action: auditAction, resource: 'ClinicalDocument', resourceId: doc.id, patientId: await this.patientIdOf(doc), metadata: { from: doc.status, to: next, version, contentHash: updated.contentHash } });
    return updated;
  }

  private async load(user: RequestUser, id: string): Promise<DocWithRevisions> {
    const doc = await this.prisma.clinicalDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { version: 'desc' } } } });
    if (!doc) throw new NotFoundError('Document', id);
    await this.access.assertEncounterAccess(user, doc.encounterId);
    if (user.role === 'PATIENT' && !doc.sharedWithPatientAt) throw new ForbiddenError('This document has not been shared with you');
    return doc;
  }

  private assertStaffCanEdit(user: RequestUser): void {
    if (!user.permissions.includes('document:create')) throw new ForbiddenError('Only clinicians can edit clinical documents');
  }

  private async patientIdOf(doc: ClinicalDocument): Promise<string | undefined> {
    const enc = await this.prisma.encounter.findUnique({ where: { id: doc.encounterId }, select: { appointment: { select: { patientId: true } } } });
    return enc?.appointment.patientId;
  }
}
