/**
 * Domain enums shared across API, web and mobile.
 * These mirror the Prisma enums in packages/db so that client apps never
 * need to depend on the Prisma client.
 */
export const USER_ROLES = ['PATIENT', 'CLINICIAN', 'NURSE', 'FRONT_DESK', 'ADMIN', 'COMPLIANCE'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Staff roles are every role that is not a patient. */
export const STAFF_ROLES: readonly UserRole[] = ['CLINICIAN', 'NURSE', 'FRONT_DESK', 'ADMIN', 'COMPLIANCE'];

export const CONSENT_TYPES = ['TREATMENT', 'DATA_PROCESSING', 'AI_PROCESSING', 'MESSAGING', 'RESEARCH'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_STATUSES = ['PENDING', 'GRANTED', 'DECLINED', 'REVOKED'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const APPOINTMENT_STATUSES = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Blueprint §4.2 document states. */
export const DOCUMENT_STATUSES = ['DRAFT', 'AI_DRAFT', 'UNDER_REVIEW', 'REVISED', 'APPROVED', 'SIGNED', 'AMENDED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_TYPES = ['SOAP_NOTE', 'PROGRESS_NOTE', 'AFTER_VISIT_SUMMARY', 'REFERRAL', 'OTHER'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Delivery status of a message (transport-level). */
export const MESSAGE_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Blueprint §4.3 message pipeline states, tracked at thread level. */
export const THREAD_STATUSES = ['OPEN', 'TRIAGING', 'ROUTED', 'AWAITING_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const SENDER_TYPES = ['PATIENT', 'STAFF', 'SYSTEM'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const AI_WORKFLOWS = [
  'CLINICAL_NOTE',
  'PATIENT_MESSAGE_DRAFT',
  'INTAKE_SUMMARY',
  'PATIENT_EDUCATION',
  'MESSAGE_TRIAGE',
] as const;
export type AiWorkflow = (typeof AI_WORKFLOWS)[number];

export const AI_DRAFT_STATUSES = ['QUEUED', 'GENERATING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED', 'SUPERSEDED'] as const;
export type AiDraftStatus = (typeof AI_DRAFT_STATUSES)[number];

export const APPROVAL_DECISIONS = ['APPROVED', 'APPROVED_WITH_EDITS', 'REJECTED'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const ESCALATION_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export const INTAKE_STATUSES = ['PENDING', 'SUBMITTED', 'SUMMARIZED', 'REVIEWED'] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'SMS'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  'APPOINTMENT_REMINDER',
  'INTAKE_REMINDER',
  'MESSAGE_REPLY',
  'FOLLOW_UP',
  'ESCALATION_ALERT',
  'DRAFT_READY',
  'DOCUMENT_AVAILABLE',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MESSAGE_INTENTS = [
  'appointment_request',
  'symptom_report',
  'medication_question',
  'billing',
  'other',
] as const;
export type MessageIntent = (typeof MESSAGE_INTENTS)[number];

export const SUGGESTED_ROUTES = ['front_desk', 'nurse', 'clinician'] as const;
export type SuggestedRoute = (typeof SUGGESTED_ROUTES)[number];

/** Feature flag keys. Environment variables provide defaults; DB rows override per org. */
export const FEATURE_FLAGS = {
  PATIENT_MESSAGING: 'FEATURE_PATIENT_MESSAGING',
  AI_NOTES: 'FEATURE_AI_NOTES',
  AI_MESSAGE_DRAFTS: 'FEATURE_AI_MESSAGE_DRAFTS',
  SPEECH_TO_TEXT: 'FEATURE_SPEECH_TO_TEXT',
  PATIENT_EDUCATION: 'FEATURE_PATIENT_EDUCATION',
} as const;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Audit actions (blueprint §11.4). Keep this list append-only. */
export const AUDIT_ACTIONS = [
  'USER_LOGIN',
  'USER_LOGIN_FAILED',
  'USER_LOGOUT',
  'TOKEN_REFRESHED',
  'MFA_ENABLED',
  'CONSENT_GRANTED',
  'CONSENT_DECLINED',
  'CONSENT_REVOKED',
  'PHI_ACCESSED',
  'PATIENT_UPDATED',
  'APPOINTMENT_CREATED',
  'APPOINTMENT_CANCELLED',
  'ENCOUNTER_STARTED',
  'ENCOUNTER_COMPLETED',
  'INTAKE_SUBMITTED',
  'DOCUMENT_CREATED',
  'DOCUMENT_UPDATED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_SIGNED',
  'DOCUMENT_AMENDED',
  'AI_DRAFT_REQUESTED',
  'AI_DRAFT_GENERATED',
  'AI_DRAFT_FAILED',
  'AI_DRAFT_EDITED',
  'AI_DRAFT_APPROVED',
  'AI_DRAFT_REJECTED',
  'AI_INVOCATION_BLOCKED',
  'MESSAGE_SENT',
  'MESSAGE_READ',
  'THREAD_CREATED',
  'ESCALATION_CREATED',
  'ESCALATION_ACKNOWLEDGED',
  'ESCALATION_RESOLVED',
  'NOTIFICATION_SENT',
  'PERMISSION_CHANGED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'EXPORT_REQUESTED',
  'AI_CONFIG_UPDATED',
  'PROMPT_TEMPLATE_UPDATED',
  'FEATURE_FLAG_UPDATED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Design tokens from blueprint §6.2 — used by web and mobile. */
export const DESIGN_TOKENS = {
  color: {
    primary: '#0F6FDE',
    primaryDark: '#0B58B0',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
  },
  radius: { sm: 6, md: 10, lg: 16 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  typography: { fontFamily: 'Inter, SF Pro, Roboto', heading: '600', body: '400' },
} as const;
