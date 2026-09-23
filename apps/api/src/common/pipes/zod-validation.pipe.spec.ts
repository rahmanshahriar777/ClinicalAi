import { loginSchema } from '@app/shared';

import { ValidationError } from '../errors/app-error';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(loginSchema);

  it('normalises valid input', () => {
    expect(pipe.transform({ email: 'Dr.Smith@Demo-Clinic.test', password: 'secret' }, { type: 'body' })).toEqual({ email: 'dr.smith@demo-clinic.test', password: 'secret' });
  });

  it('throws a ValidationError with field details', () => {
    expect(() => pipe.transform({ email: 'nope' }, { type: 'body' })).toThrow(ValidationError);
    try {
      pipe.transform({ email: 'nope' }, { type: 'body' });
    } catch (e) {
      expect((e as ValidationError).details).toMatchObject({ fieldErrors: { email: expect.any(Array), password: expect.any(Array) } });
    }
  });
});
