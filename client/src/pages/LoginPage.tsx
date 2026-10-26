import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';
import { consumeAuthNotice } from '../lib/notice';

interface LoginErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { email?: string; from?: string } | null)?.from;
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNotice(consumeAuthNotice());
  }, []);

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {};
    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Password is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setNotice(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from && from.startsWith('/app') ? from : '/app/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your leads, follow-ups, and pipeline."
      footer={
        <p>
          New to LeadDesk?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
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
          error={errors.email}
          icon={<Mail className="h-4 w-4" aria-hidden="true" />}
          required
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="rounded p-1.5 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
