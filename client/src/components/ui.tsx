import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Target, X, XCircle } from 'lucide-react';
import type { LeadStatus } from '../lib/types';

export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300',
  secondary:
    'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-brand-600 disabled:text-slate-400',
  danger:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:outline-rose-600 disabled:bg-rose-300',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-600 disabled:text-slate-300',
} as const;

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClasses = (hasError: boolean): string =>
  cn(
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
  );

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export function Input({ label, error, hint, icon, trailing, className, id, required, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            controlClasses(Boolean(error)),
            icon ? 'pl-10' : '',
            trailing ? 'pr-10' : '',
            className
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          required={required}
          {...props}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</span>
        ) : null}
      </div>
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, required, ...props }: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <textarea
        id={inputId}
        className={cn(controlClasses(Boolean(error)), 'min-h-24 resize-y', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={required}
        {...props}
      />
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Select({ label, error, hint, className, id, required, children, ...props }: SelectProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <select
        id={inputId}
        className={cn(controlClasses(Boolean(error)), 'cursor-pointer pr-8', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={required}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  New: 'bg-sky-50 text-sky-700 ring-sky-200 before:bg-sky-500',
  Contacted: 'bg-amber-50 text-amber-700 ring-amber-200 before:bg-amber-500',
  Qualified: 'bg-violet-50 text-violet-700 ring-violet-200 before:bg-violet-500',
  Converted: 'bg-emerald-50 text-emerald-700 ring-emerald-200 before:bg-emerald-500',
  Lost: 'bg-slate-100 text-slate-600 ring-slate-200 before:bg-slate-400',
};

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset before:h-1.5 before:w-1.5 before:rounded-full',
        STATUS_STYLES[status],
        className
      )}
    >
      {status}
    </span>
  );
}

const ALERT_STYLES = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
} as const;

const ALERT_ICONS = {
  error: XCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  onDismiss,
}: {
  tone?: keyof typeof ALERT_STYLES;
  title?: string;
  children?: ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  const Icon = ALERT_ICONS[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border p-3.5 text-sm', ALERT_STYLES[tone], className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-1' : undefined}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-0.5 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-10', className)} role="status">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-xl';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className={cn(
          'animate-slide-up max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-xl',
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id="modal-description" className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Target className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Lead<span className="text-brand-600">Desk</span>
        </span>
      ) : null}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700',
        className
      )}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}
