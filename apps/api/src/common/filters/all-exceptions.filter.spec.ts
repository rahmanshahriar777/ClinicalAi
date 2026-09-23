import { Prisma } from '@app/db';
import { NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import { ConsentRequiredError, InvalidStateTransitionError } from '../errors/app-error';

import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ headers: { 'x-request-id': 'req-1' }, url: '/x' }) }) } as never;
  new AllExceptionsFilter().catch(exception, host);
  return { status: (status.mock.calls[0] as unknown[])[0] as number, body: json.mock.calls[0]![0] as Record<string, unknown> };
}

describe('AllExceptionsFilter', () => {
  it('maps domain errors to the envelope', () => {
    const r = run(new ConsentRequiredError('AI_PROCESSING'));
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ statusCode: 403, code: 'CONSENT_REQUIRED', requestId: 'req-1', details: { consentType: 'AI_PROCESSING' } });
  });

  it('maps state transition errors to 409', () => {
    expect(run(new InvalidStateTransitionError('document', 'SIGNED', 'edit')).body).toMatchObject({ statusCode: 409, code: 'INVALID_STATE_TRANSITION' });
  });

  it('maps Zod and Nest HTTP exceptions', () => {
    const zerr = z.object({ a: z.string() }).safeParse({});
    expect(run(zerr.success ? null : zerr.error).body).toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    expect(run(new NotFoundException('nope')).body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404, message: 'nope' });
  });

  it('maps Prisma unique violations to 409 and hides internals', () => {
    const p = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target: ['email'] } });
    expect(run(p).body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    const r = run(new Error('database password is hunter2'));
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ code: 'INTERNAL', message: 'Internal server error' });
    expect(JSON.stringify(r.body)).not.toContain('hunter2');
  });
});
