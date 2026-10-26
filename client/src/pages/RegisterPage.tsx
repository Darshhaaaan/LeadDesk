import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

interface RegisterErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const nextErrors: RegisterErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      nextErrors.name = 'Name must be at least 2 characters long.';
    } else if (trimmedName.length > 120) {
      nextErrors.name = 'Name must be at most 120 characters long.';
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

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
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking leads and follow-ups in a few seconds."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError ? (
          <Alert tone="error" onDismiss={() => setServerError(null)}>
            {serverError}
          </Alert>
        ) : null}

        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Alex Morgan"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          icon={<User className="h-4 w-4" aria-hidden="true" />}
          required
        />

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
          autoComplete="new-password"
          placeholder="Create a strong password"
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
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          required
        />

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Create account
        </Button>

        <p className="text-center text-xs leading-5 text-slate-400">
          By creating an account you agree to keep your login credentials private. We email a
          confirmation when your password changes or your account is deleted.
        </p>
      </form>
    </AuthLayout>
  );
}
