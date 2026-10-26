import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Alert, Avatar, Button, Card, Input, PageHeader } from '../components/ui';
import { DeleteAccountDialog } from '../components/DeleteAccountDialog';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../lib/format';

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export function AccountSettingsPage() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validate = (): boolean => {
    const nextErrors: PasswordErrors = {};

    if (!currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      nextErrors.newPassword = 'New password must be between 8 and 72 characters.';
    } else if (!PASSWORD_POLICY.test(newPassword)) {
      nextErrors.newPassword = 'Include an uppercase letter, a lowercase letter, and a number.';
    } else if (newPassword === currentPassword) {
      nextErrors.newPassword = 'Choose a password different from your current one.';
    }

    if (confirmPassword !== newPassword) {
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
      // Success invalidates every session, clears the local user, and redirects
      // to the login page with a confirmation notice.
      await changePassword({ currentPassword, newPassword, confirmPassword });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Your password could not be changed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account settings"
        title="Profile and security"
        description="Review your account details, update your password, or permanently remove your account and data."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit p-5 sm:p-6 lg:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <p className="mt-1 text-sm text-slate-500">Your account identity and membership details.</p>

          <div className="mt-5 flex items-center gap-3">
            <Avatar name={user?.name ?? 'User'} className="h-12 w-12 text-base" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Full name</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{user?.name}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
                <dd className="mt-0.5 break-all text-sm text-slate-800">{user?.email}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Member since</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{formatDateTime(user?.createdAt)}</dd>
              </div>
            </div>
          </dl>
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Change password</h2>
          <p className="mt-1 text-sm text-slate-500">
            For your security, changing your password signs you out of all devices.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 max-w-xl space-y-4" noValidate>
            {serverError ? (
              <Alert tone="error" onDismiss={() => setServerError(null)}>
                {serverError}
              </Alert>
            ) : null}

            <Input
              label="Current password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setErrors((current) => ({ ...current, currentPassword: undefined }));
              }}
              error={errors.currentPassword}
              icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              required
            />

            <Input
              label="New password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setErrors((current) => ({ ...current, newPassword: undefined }));
              }}
              error={errors.newPassword}
              hint="At least 8 characters with uppercase, lowercase, and a number."
              icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPasswords((visible) => !visible)}
                  className="rounded p-1.5 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Input
              label="Confirm new password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({ ...current, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              required
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" loading={submitting}>
                Update password
              </Button>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                You will be asked to sign in again.
              </span>
            </div>
          </form>
        </Card>
      </div>

      <Card className="border-rose-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Danger zone</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Permanently delete your account, leads, activity history, and password reset
                tokens. This cannot be undone, and a confirmation email is sent after deletion.
              </p>
            </div>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete account
          </Button>
        </div>
      </Card>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
