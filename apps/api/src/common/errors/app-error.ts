import { ERROR_CODES, type ErrorCode } from '@app/shared';
import { HttpStatus } from '@nestjs/common';

/**
 * Domain error hierarchy. Services throw these; the global exception filter
 * maps them to the standard error envelope. Never leak PHI in `message`.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(HttpStatus.BAD_REQUEST, ERROR_CODES.VALIDATION_FAILED, message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(HttpStatus.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED, message);
  }
}

export class MfaRequiredError extends AppError {
  constructor(message = 'Multi-factor authentication required') {
    super(HttpStatus.UNAUTHORIZED, ERROR_CODES.MFA_REQUIRED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super(HttpStatus.FORBIDDEN, ERROR_CODES.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    super(HttpStatus.NOT_FOUND, ERROR_CODES.NOT_FOUND, id ? `${resource} ${id} not found` : `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(HttpStatus.CONFLICT, ERROR_CODES.CONFLICT, message, details);
  }
}

export class ConsentRequiredError extends AppError {
  constructor(consentType: string) {
    super(HttpStatus.FORBIDDEN, ERROR_CODES.CONSENT_REQUIRED, `Patient consent '${consentType}' is required for this action`, { consentType });
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature: string) {
    super(HttpStatus.FORBIDDEN, ERROR_CODES.FEATURE_DISABLED, `Feature '${feature}' is disabled`, { feature });
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(entity: string, from: string, action: string) {
    super(HttpStatus.CONFLICT, ERROR_CODES.INVALID_STATE_TRANSITION, `Cannot ${action} ${entity} in state ${from}`, { entity, from, action });
  }
}

export class AiBlockedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODES.AI_BLOCKED_BY_POLICY, message, details);
  }
}

export class RateLimitedError extends AppError {
  constructor() {
    super(HttpStatus.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMITED, 'Too many requests');
  }
}
