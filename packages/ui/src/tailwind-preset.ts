import type { Config } from 'tailwindcss';

import { tokens } from './tokens';

/** Tailwind preset that exposes the blueprint tokens as utilities (bg-primary, rounded-md, p-md…). */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: tokens.color.primary, dark: tokens.color.primaryDark, soft: '#E8F1FD' },
        success: { DEFAULT: tokens.color.success, soft: '#E7F6EC' },
        warning: { DEFAULT: tokens.color.warning, soft: '#FBF1E2' },
        danger: { DEFAULT: tokens.color.danger, soft: '#FBE9E9' },
        background: tokens.color.background,
        surface: tokens.color.surface,
        ink: { DEFAULT: tokens.color.textPrimary, muted: tokens.color.textSecondary },
        line: '#E2E8F0',
      },
      borderRadius: { sm: `${tokens.radius.sm}px`, md: `${tokens.radius.md}px`, lg: `${tokens.radius.lg}px` },
      spacing: { xs: `${tokens.spacing.xs}px`, sm: `${tokens.spacing.sm}px`, md: `${tokens.spacing.md}px`, lg: `${tokens.spacing.lg}px`, xl: `${tokens.spacing.xl}px` },
      fontFamily: { sans: ['Inter', 'SF Pro Text', 'Roboto', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.08)' },
    },
  },
};
export default preset;
