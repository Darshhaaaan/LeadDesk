import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Input } from '../components/ui';
import { api, getErrorMessage } from '../lib/api';

interface ResetErrors {
  password?: string;
  confirmPassword?: string;
}

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ResetErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const nextErrors: ResetErrors = {};
    if (password.length < 8 || password.length > 72) {
      nextErrors.password = 'Password must be between 8 and 72 characters.';
    } else if (!PASSWORD_POLICY.test(password)) {
      nextErrors.password = 'Include an uppercase letter, a lowercase letter, and a number.';
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword({ token, password, confirmPassword });
      setSuccess(true);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Reset link is incomplete"
        subtitle="This password reset link is missing a token. Request a new link to continue."
        footer={
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        }
      >
        <Alert tone="error">The reset link is invalid or has expired.</Alert>
        <Button className="mt-5 w-full" size="lg" onClick={() => window.location.assign('/forgot-password')}>
          Request a new link
        </Button>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        title="Password reset complete"
        subtitle="Your password has been updated. All previous sessions were signed out for your security."
        footer={
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in with your new password
          </Link>
        }
      >
        <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-7 text-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
          <h3 className="mt-3 text-base font-semibold text-emerald-900">You&apos;re all set</h3>
          <p className="mt-1.5 max-w-sm text-sm leading-6 text-emerald-800">
            A confirmation email has been sent. If you did not make this change, reset your
            password again immediately and contact support.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Reset links are single-use and expire after 30 minutes."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError ? (
          <Alert tone="error" onDismiss={() => setServerError(null)}>
            {serverError}
          </Alert>
        ) : null}

        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="At least 8 characters with uppercase, lowercase, and a number."
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="rounded p-1.5 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Input
          label="Confirm new password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          required
        />

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
