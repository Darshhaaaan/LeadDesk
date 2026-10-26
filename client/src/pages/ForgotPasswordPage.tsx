import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Input } from '../components/ui';
import { api, getErrorMessage } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFieldError('Enter a valid email address.');
      return;
    }

    setFieldError(undefined);
    setSubmitting(true);
    try {
      await api.forgotPassword(trimmedEmail);
      setSubmitted(true);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={submitted ? 'Check your email' : 'Reset your password'}
      subtitle={
        submitted
          ? 'If an account exists for that address, a secure reset link is on its way.'
          : 'Enter the email associated with your account and we will send a time-limited reset link.'
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {submitted ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-7 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold text-emerald-900">Reset email requested</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-emerald-800">
              For your security, we show the same response whether or not an account exists. The
              link expires after 30 minutes and can only be used once.
            </p>
          </div>
          <p className="text-center text-sm text-slate-500">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button
              type="button"
              className="font-semibold text-brand-600 hover:text-brand-700"
              onClick={() => setSubmitted(false)}
            >
              try another email
            </button>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {serverError ? (
            <Alert tone="error" onDismiss={() => setServerError(null)}>
              {serverError}
            </Alert>
          ) : null}

          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError}
            icon={<Mail className="h-4 w-4" aria-hidden="true" />}
            required
          />

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            Send reset link
          </Button>

          <p className="text-center text-xs leading-5 text-slate-400">
            We never email passwords. Reset links are single-use and expire after 30 minutes.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
