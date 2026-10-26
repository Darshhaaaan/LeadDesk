import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, Button, Modal } from './ui';
import { api, getErrorMessage } from '../lib/api';
import type { Lead } from '../lib/types';

export function DeleteLeadDialog({
  lead,
  onClose,
  onDeleted,
}: {
  lead: Lead | null;
  onClose: () => void;
  onDeleted: (lead: Lead) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setError(null);
      setDeleting(false);
    }
  }, [lead]);

  const handleDelete = async () => {
    if (!lead) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await api.deleteLead(lead.id);
      onDeleted(lead);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={Boolean(lead)}
      onClose={onClose}
      title="Delete this lead?"
      description="This removes the lead, its notes, and its activity history from your workspace."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Keep lead
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} loading={deleting}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete lead
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">{lead?.name}</span> will be permanently removed. This
            action cannot be undone.
          </p>
        </div>
        {error ? (
          <Alert tone="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
