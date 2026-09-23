import { DESIGN_TOKENS } from '@app/shared';

/** Blueprint §6.2 tokens for React Native styles. */
export const theme = {
  ...DESIGN_TOKENS.color,
  radius: DESIGN_TOKENS.radius,
  spacing: DESIGN_TOKENS.spacing,
  soft: { primary: '#E8F1FD', success: '#E7F6EC', warning: '#FBF1E2', danger: '#FBE9E9' },
  line: '#E2E8F0',
} as const;
