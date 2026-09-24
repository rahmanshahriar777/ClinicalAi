import type {
  AuthUser,
  CreateAppointmentInput,
  CreateDocumentInput,
  CreateThreadInput,
  GenerateDraftInput,
  ListAppointmentsQuery,
  ListThreadsQuery,
  LoginInput,
  LoginResponse,
  Paginated,
  RecordConsentInput,
  RegisterPatientInput,
  ReviewDraftInput,
  SendMessageInput,
  SubmitIntakeInput,
  UpdateEncounterInput,
  UpdatePatientProfileInput,
  AiConfigInput,
  CreateUserInput,
  UpsertPromptTemplateInput,
  AuditLogQuery,
  TranscribeAudioInput,
  TranscribeResponse,
  SynthesizeSpeechInput,
  SynthesizeResponse,
  VoiceStatusResponse,
} from '@app/shared';

import { HttpClient, qs } from './client';

/**
 * Resource-oriented API surface. Response shapes are loosely typed as
 * records where the API returns Prisma views; the shared Zod input types
 * keep requests strictly typed.
 */
export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export class ClinicalApi {
  constructor(public readonly http: HttpClient) {}

  auth = {
    login: (input: LoginInput) => this.http.request<LoginResponse>('POST', '/auth/login', input, { auth: false }),
    verifyMfa: (mfaToken: string, code: string) => this.http.request<{ user: AuthUser; tokens: Json }>('POST', '/auth/mfa/verify', { mfaToken, code }, { auth: false }),
    register: (input: RegisterPatientInput) => this.http.request<{ user: AuthUser; tokens: Json }>('POST', '/auth/register', input, { auth: false }),
    logout: (refreshToken?: string) => this.http.post<void>('/auth/logout', { refreshToken }),
    me: () => this.http.get<AuthUser & { permissions: string[] }>('/auth/me'),
    mfaSetup: () => this.http.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup'),
    mfaConfirm: (code: string) => this.http.post<void>('/auth/mfa/confirm', { code }),
  };

  patients = {
    me: () => this.http.get<Json>('/patients/me'),
    updateMe: (input: UpdatePatientProfileInput) => this.http.patch<Json>('/patients/me', input),
    myConsents: () => this.http.get<Json[]>('/patients/me/consents'),
    recordConsent: (input: RecordConsentInput) => this.http.post<Json>('/patients/me/consents', input),
    list: (q: { page?: number; pageSize?: number; search?: string } = {}) => this.http.get<Paginated<Json>>(`/patients${qs(q)}`),
    get: (id: string) => this.http.get<Json>(`/patients/${id}`),
    consents: (id: string) => this.http.get<Json[]>(`/patients/${id}/consents`),
  };

  clinicians = { list: () => this.http.get<Json[]>('/clinicians') };

  appointments = {
    list: (q: Partial<ListAppointmentsQuery> = {}) => this.http.get<Paginated<Json>>(`/appointments${qs(q)}`),
    create: (input: CreateAppointmentInput) => this.http.post<Json>('/appointments', input),
    get: (id: string) => this.http.get<Json>(`/appointments/${id}`),
    cancel: (id: string, reason?: string) => this.http.patch<Json>(`/appointments/${id}/cancel`, { reason }),
    checkIn: (id: string) => this.http.post<Json>(`/appointments/${id}/check-in`),
    intake: (id: string) => this.http.get<Json>(`/appointments/${id}/intake`),
    submitIntake: (id: string, input: SubmitIntakeInput) => this.http.post<Json>(`/appointments/${id}/intake`, input),
    openEncounter: (id: string) => this.http.post<Json>(`/appointments/${id}/encounter`),
  };

  encounters = {
    get: (id: string) => this.http.get<Json>(`/encounters/${id}`),
    start: (id: string, chiefComplaint?: string) => this.http.post<Json>(`/encounters/${id}/start`, { chiefComplaint }),
    update: (id: string, input: UpdateEncounterInput) => this.http.patch<Json>(`/encounters/${id}`, input),
    complete: (id: string, sendAfterVisitSummary = false) => this.http.post<Json>(`/encounters/${id}/complete`, { sendAfterVisitSummary }),
    documents: (id: string) => this.http.get<Json[]>(`/encounters/${id}/documents`),
    createDocument: (id: string, input: CreateDocumentInput) => this.http.post<Json>(`/encounters/${id}/documents`, input),
    drafts: (id: string) => this.http.get<Json[]>(`/encounters/${id}/ai-drafts`),
    requestDraft: (id: string, input: GenerateDraftInput) => this.http.post<Json>(`/encounters/${id}/ai-drafts`, input),
  };

  documents = {
    get: (id: string) => this.http.get<Json>(`/documents/${id}`),
    update: (id: string, content: unknown, changeSummary?: string) => this.http.patch<Json>(`/documents/${id}`, { content, changeSummary }),
    submit: (id: string) => this.http.post<Json>(`/documents/${id}/submit`),
    approve: (id: string) => this.http.post<Json>(`/documents/${id}/approve`),
    sign: (id: string) => this.http.post<Json>(`/documents/${id}/sign`),
    amend: (id: string, content: unknown, reason: string) => this.http.post<Json>(`/documents/${id}/amend`, { content, reason }),
    share: (id: string) => this.http.post<Json>(`/documents/${id}/share`),
  };

  drafts = {
    queue: (q: { page?: number; pageSize?: number; workflow?: string } = {}) => this.http.get<Paginated<Json>>(`/ai-drafts${qs(q)}`),
    get: (id: string) => this.http.get<Json>(`/ai-drafts/${id}`),
    approve: (id: string, body: Omit<ReviewDraftInput, 'decision'> = { sendOnApprove: true }) => this.http.post<Json>(`/ai-drafts/${id}/approve`, body),
    reject: (id: string, comments: string) => this.http.post<Json>(`/ai-drafts/${id}/reject`, { comments }),
  };

  threads = {
    list: (q: Partial<ListThreadsQuery> = {}) => this.http.get<Paginated<Json>>(`/threads${qs(q)}`),
    create: (input: CreateThreadInput) => this.http.post<Json>('/threads', input),
    get: (id: string) => this.http.get<Json>(`/threads/${id}`),
    update: (id: string, input: Json) => this.http.patch<Json>(`/threads/${id}`, input),
    send: (id: string, input: SendMessageInput) => this.http.post<Json>(`/threads/${id}/messages`, input),
    markRead: (id: string) => this.http.post<{ updated: number }>(`/threads/${id}/read`),
    requestDraft: (id: string, input: GenerateDraftInput = { workflow: 'PATIENT_MESSAGE_DRAFT' }) => this.http.post<Json>(`/threads/${id}/ai-drafts`, input),
  };

  escalations = {
    list: (q: { page?: number; pageSize?: number; status?: string; urgency?: string } = {}) => this.http.get<Paginated<Json>>(`/escalations${qs(q)}`),
    acknowledge: (id: string) => this.http.post<Json>(`/escalations/${id}/acknowledge`),
    resolve: (id: string, notes: string, dismissed = false) => this.http.post<Json>(`/escalations/${id}/resolve`, { notes, dismissed }),
  };

  notifications = {
    list: (q: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) => this.http.get<Paginated<Json>>(`/notifications${qs(q)}`),
    markRead: (id: string) => this.http.post<Json>(`/notifications/${id}/read`),
    registerDevice: (token: string, platform: 'ios' | 'android' | 'web') => this.http.post<void>('/notifications/devices', { token, platform }),
  };

  audit = { list: (q: Partial<AuditLogQuery> = {}) => this.http.get<Paginated<Json>>(`/audit-logs${qs(q)}`) };

  admin = {
    users: (q: Json = {}) => this.http.get<Paginated<Json>>(`/admin/users${qs(q)}`),
    createUser: (input: CreateUserInput) => this.http.post<Json>('/admin/users', input),
    updateUser: (id: string, input: Json) => this.http.patch<Json>(`/admin/users/${id}`, input),
    organization: () => this.http.get<Json>('/admin/organization'),
    updateOrganization: (input: Json) => this.http.patch<Json>('/admin/organization', input),
    aiConfig: () => this.http.get<Json>('/admin/ai-config'),
    updateAiConfig: (input: AiConfigInput) => this.http.put<Json>('/admin/ai-config', input),
    prompts: () => this.http.get<Json[]>('/admin/prompt-templates'),
    upsertPrompt: (input: UpsertPromptTemplateInput) => this.http.post<Json>('/admin/prompt-templates', input),
    activatePrompt: (id: string) => this.http.post<Json>(`/admin/prompt-templates/${id}/activate`),
    flags: () => this.http.get<{ rows: Json[]; effective: Record<string, boolean> }>('/admin/feature-flags'),
    setFlag: (key: string, enabled: boolean) => this.http.put<Json>('/admin/feature-flags', { key, enabled }),
    aiMetrics: (days = 30) => this.http.get<Json>(`/admin/ai-metrics${qs({ days })}`),
  };

  voice = {
    status: () => this.http.get<VoiceStatusResponse>('/voice/status'),
    transcribe: (input: TranscribeAudioInput) => this.http.post<TranscribeResponse>('/voice/transcribe', input),
    synthesize: (input: SynthesizeSpeechInput) => this.http.post<SynthesizeResponse>('/voice/synthesize', input),
  };
}

export function createApi(opts: ConstructorParameters<typeof HttpClient>[0]): ClinicalApi {
  return new ClinicalApi(new HttpClient(opts));
}
