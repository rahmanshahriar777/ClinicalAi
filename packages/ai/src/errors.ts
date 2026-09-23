export type AiErrorCode =
  | 'AI_BLOCKED_BY_POLICY'
  | 'AI_PROVIDER_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_OUTPUT_INVALID'
  | 'AI_REFUSED'
  | 'AI_CONFIG_ERROR';

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export class AiBlockedByPolicyError extends AiError {
  constructor(message: string, details?: unknown) {
    super('AI_BLOCKED_BY_POLICY', message, details);
  }
}

export class AiOutputInvalidError extends AiError {
  constructor(message: string, details?: unknown) {
    super('AI_OUTPUT_INVALID', message, details);
  }
}
