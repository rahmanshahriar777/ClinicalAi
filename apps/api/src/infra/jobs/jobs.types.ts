export const JOB_QUEUE = 'clinical-jobs';

export interface JobPayloads {
  AI_DRAFT_GENERATE: { draftId: string };
  MESSAGE_TRIAGE: { threadId: string; messageId: string };
  NOTIFICATION_DISPATCH: { notificationId: string };
}
export type JobName = keyof JobPayloads;

export type JobHandler<N extends JobName = JobName> = (payload: JobPayloads[N]) => Promise<void>;
