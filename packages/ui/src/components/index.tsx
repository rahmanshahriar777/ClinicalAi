import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ variant = 'primary', className, loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md px-md py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]';
  const styles: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-surface text-ink border border-line hover:bg-background',
    danger: 'bg-danger text-white hover:opacity-90',
    ghost: 'text-primary hover:bg-primary-soft',
  };
  return (
    <button className={clsx(base, styles[variant], className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-lg bg-surface p-lg shadow-card border border-line', className)}>
      {title ? (
        <header className="mb-md flex items-start justify-between gap-md">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const badgeTone: Record<string, string> = {
  LOW: 'bg-success-soft text-success',
  MEDIUM: 'bg-primary-soft text-primary',
  HIGH: 'bg-warning-soft text-warning',
  EMERGENCY: 'bg-danger-soft text-danger',
  APPROVED: 'bg-success-soft text-success',
  SIGNED: 'bg-success-soft text-success',
  PENDING_REVIEW: 'bg-warning-soft text-warning',
  UNDER_REVIEW: 'bg-warning-soft text-warning',
  ESCALATED: 'bg-danger-soft text-danger',
  REJECTED: 'bg-danger-soft text-danger',
  FAILED: 'bg-danger-soft text-danger',
  OPEN: 'bg-primary-soft text-primary',
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={clsx('inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold', badgeTone[tone ?? String(children)] ?? 'bg-background text-ink-muted border border-line')}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

const control = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary min-h-[44px]';
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(control, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(control, 'min-h-[120px]', props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(control, props.className)} />;
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string; children?: ReactNode }) {
  const tones = { info: 'border-primary bg-primary-soft text-ink', success: 'border-success bg-success-soft', warning: 'border-warning bg-warning-soft', danger: 'border-danger bg-danger-soft' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={clsx('rounded-md border-l-4 p-md text-sm', tones[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-xl text-center">
      <p className="font-medium text-ink">{title}</p>
      {body ? <p className="mt-1 text-sm text-ink-muted">{body}</p> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-lg flex flex-wrap items-end justify-between gap-md">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Mandatory disclosure wherever AI-generated content is shown (blueprint §15.1, §19.3). */
export function AiDisclosure({ compact = false }: { compact?: boolean }) {
  return (
    <p className={clsx('flex items-center gap-2 text-ink-muted', compact ? 'text-xs' : 'rounded-md bg-primary-soft p-sm text-xs')}>
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary" />
      AI-generated draft — requires clinician review before use.
    </p>
  );
}
