import { useEffect, useId, useState, type FormEvent } from 'react';
import { AlertTriangle, Eye, EyeOff, Lock, Trash2 } from 'lucide-react';
import { Alert, Button, Input, Modal } from './ui';
import { useAuth } from '../context/AuthContext';

const DELETE_PHRASE = 'DELETE';

export function DeleteAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { deleteAccount } = useAuth();
  const formId = useId();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmationError, setConfirmationError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmation('');
      setShowPassword(false);
      setPasswordError(undefined);
      setConfirmationError(undefined);
      setServerError(null);
      setDeleting(false);
    }
  }, [open]);

  const canDelete = password.length > 0 && confirmation === DELETE_PHRASE;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    let valid = true;
    if (!password) {
      setPasswordError('Enter your current password to continue.');
      valid = false;
    } else {
      setPasswordError(undefined);
    }

    if (confirmation !== DELETE_PHRASE) {
      setConfirmationError(`Type ${DELETE_PHRASE} exactly to confirm.`);
      valid = false;
    } else {
      setConfirmationError(undefined);
    }

    if (!valid) {
      return;
    }

    setDeleting(true);
    try {
      // A successful deletion clears the session in AuthContext, which sends the
      // user back to the login screen with a confirmation notice.
      await deleteAccount(password);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Your account could not be deleted.');
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Permanently delete your account?"
      description="This action cannot be undone. Your account and every lead you own will be removed."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Keep my account
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            loading={deleting}
            disabled={!canDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete account
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1.5">
            <p className="font-semibold">Deleting your account will remove:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Your profile and sign-in credentials</li>
              <li>All leads, notes, follow-up dates, and activity history</li>
              <li>Password reset tokens and every active session</li>
            </ul>
            <p>A confirmation email is sent after the deletion completes.</p>
          </div>
        </div>

        {serverError ? (
          <Alert tone="error" onDismiss={() => setServerError(null)}>
            {serverError}
          </Alert>
        ) : null}

        <Input
          label="Current password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordError(undefined);
          }}
          error={passwordError}
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

        <Input
          label={`Type ${DELETE_PHRASE} to confirm`}
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setConfirmationError(undefined);
          }}
          error={confirmationError}
          hint={`This must match ${DELETE_PHRASE} exactly.`}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </form>
    </Modal>
  );
}
