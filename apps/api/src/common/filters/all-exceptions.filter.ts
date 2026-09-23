import { Prisma } from '@app/db';
import { type ApiError, ERROR_CODES } from '@app/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error';

/**
 * Single place that converts any thrown value into the API error envelope
 * (packages/shared apiErrorSchema). Internal errors are logged with the
 * request id but never echoed to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? req.id;

    const body = this.toEnvelope(exception, requestId);
    if (body.statusCode >= 500) {
      this.logger.error({ err: exception, requestId, path: req.url }, 'unhandled error');
    } else if (body.statusCode === 401 || body.statusCode === 403) {
      this.logger.warn({ code: body.code, requestId, path: req.url });
    }
    res.status(body.statusCode).json(body);
  }

  private toEnvelope(exception: unknown, requestId?: string): ApiError {
    const timestamp = new Date().toISOString();
    const base = { requestId, timestamp };

    if (exception instanceof AppError) {
      return { ...base, statusCode: exception.statusCode, code: exception.code, message: exception.message, details: exception.details };
    }
    if (exception instanceof ZodError) {
      return { ...base, statusCode: 400, code: ERROR_CODES.VALIDATION_FAILED, message: 'Validation failed', details: exception.flatten() };
    }
    if (exception instanceof ThrottlerException) {
      return { ...base, statusCode: 429, code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests' };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const message = typeof r === 'string' ? r : ((r as { message?: string | string[] }).message ?? exception.message);
      const code =
        status === 401 ? ERROR_CODES.UNAUTHENTICATED : status === 403 ? ERROR_CODES.FORBIDDEN : status === 404 ? ERROR_CODES.NOT_FOUND : status === 400 ? ERROR_CODES.VALIDATION_FAILED : status >= 500 ? ERROR_CODES.INTERNAL : ERROR_CODES.CONFLICT;
      return { ...base, statusCode: status, code, message: Array.isArray(message) ? message.join('; ') : message };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { ...base, statusCode: 409, code: ERROR_CODES.CONFLICT, message: 'A record with the same unique value already exists', details: { target: exception.meta?.target } };
      }
      if (exception.code === 'P2025') {
        return { ...base, statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: 'Record not found' };
      }
      if (exception.code === 'P2003') {
        return { ...base, statusCode: 400, code: ERROR_CODES.VALIDATION_FAILED, message: 'Referenced record does not exist' };
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { ...base, statusCode: 400, code: ERROR_CODES.VALIDATION_FAILED, message: 'Invalid data' };
    }
    return { ...base, statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: ERROR_CODES.INTERNAL, message: 'Internal server error' };
  }
}
