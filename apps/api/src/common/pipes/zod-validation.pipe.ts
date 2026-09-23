import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

import { ValidationError } from '../errors/app-error';

/**
 * Validates and coerces request bodies/queries/params with a Zod schema from
 * @app/shared, so the API and the clients share one contract.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new ValidationError('Validation failed', result.error.flatten());
    }
    return result.data;
  }
}

/** Convenience factory: `@Body(zodBody(schema)) dto` */
export const zodBody = <T extends ZodTypeAny>(schema: T) => new ZodValidationPipe(schema);
