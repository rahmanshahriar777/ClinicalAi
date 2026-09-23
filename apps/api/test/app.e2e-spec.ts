/**
 * End-to-end smoke tests. They require a real PostgreSQL database
 * (DATABASE_URL) with migrations + seed applied, e.g. via `docker compose up
 * postgres` and `pnpm db:migrate && pnpm db:seed`. They are skipped when no
 * database is configured so `pnpm test:e2e` is safe to run anywhere.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

const hasDb = Boolean(process.env.DATABASE_URL) && process.env.E2E === 'true';
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('API e2e', () => {
  let app: INestApplication;
  let clinicianToken: string;
  let patientToken: string;

  beforeAll(async () => {
    process.env.JOBS_INLINE = 'true';
    process.env.AI_PROVIDER = 'mock';
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const login = async (email: string) => (await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'ClinicalAi!2026dev' }).expect(200)).body.tokens.accessToken as string;
    clinicianToken = await login('dr.smith@demo-clinic.test');
    patientToken = await login('patient@demo-clinic.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health/ready reports ready', async () => {
    await request(app.getHttpServer()).get('/health/ready').expect(200).expect((r) => expect(r.body.status).toBe('ready'));
  });

  it('rejects unauthenticated access with the error envelope', async () => {
    const r = await request(app.getHttpServer()).get('/patients/me').expect(401);
    expect(r.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('patients see their own profile and cannot read the review queue', async () => {
    await request(app.getHttpServer()).get('/patients/me').set('Authorization', `Bearer ${patientToken}`).expect(200);
    await request(app.getHttpServer()).get('/ai-drafts').set('Authorization', `Bearer ${patientToken}`).expect(403);
  });

  it('runs the messaging red-flag → escalation path', async () => {
    const thread = await request(app.getHttpServer()).post('/threads').set('Authorization', `Bearer ${patientToken}`).send({ subject: 'Not feeling well', body: 'I have crushing chest pain and cannot breathe' }).expect(201);
    expect(thread.body.status).toBe('ESCALATED');
    expect(thread.body.messages.some((m: { senderType: string }) => m.senderType === 'SYSTEM')).toBe(true);
    const esc = await request(app.getHttpServer()).get('/escalations').set('Authorization', `Bearer ${clinicianToken}`).expect(200);
    expect(esc.body.items.length).toBeGreaterThan(0);
  });

  it('generates and approves an AI note draft through the human-in-the-loop flow', async () => {
    const appts = await request(app.getHttpServer()).get('/appointments').set('Authorization', `Bearer ${clinicianToken}`).expect(200);
    const appt = appts.body.items[0];
    const enc = await request(app.getHttpServer()).post(`/appointments/${appt.id}/encounter`).set('Authorization', `Bearer ${clinicianToken}`).expect(201);
    await request(app.getHttpServer()).patch(`/encounters/${enc.body.id}`).set('Authorization', `Bearer ${clinicianToken}`).send({ notes: 'sore throat 3d, afebrile, tonsils mildly enlarged' }).expect(200);
    const draft = await request(app.getHttpServer()).post(`/encounters/${enc.body.id}/ai-drafts`).set('Authorization', `Bearer ${clinicianToken}`).send({ workflow: 'CLINICAL_NOTE' }).expect(201);
    await new Promise((r) => setTimeout(r, 500)); // inline job
    const pending = await request(app.getHttpServer()).get(`/ai-drafts/${draft.body.id}`).set('Authorization', `Bearer ${clinicianToken}`).expect(200);
    expect(pending.body.status).toBe('PENDING_REVIEW');
    const approved = await request(app.getHttpServer()).post(`/ai-drafts/${draft.body.id}/approve`).set('Authorization', `Bearer ${clinicianToken}`).send({}).expect(201);
    expect(approved.body.status).toBe('APPROVED');
  });
});
