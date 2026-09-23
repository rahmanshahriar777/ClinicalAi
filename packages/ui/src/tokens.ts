import { DESIGN_TOKENS } from '@app/shared';

/** Single source of truth for colours, radii and spacing (blueprint §6.2). */
export const tokens = DESIGN_TOKENS;

export const semanticColor = {
  urgency: { LOW: tokens.color.success, MEDIUM: tokens.color.primary, HIGH: tokens.color.warning, EMERGENCY: tokens.color.danger },
  status: { APPROVED: tokens.color.success, SIGNED: tokens.color.success, PENDING_REVIEW: tokens.color.warning, REJECTED: tokens.color.danger, FAILED: tokens.color.danger },
} as const;
