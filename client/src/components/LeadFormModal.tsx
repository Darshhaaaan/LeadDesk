import { useEffect, useId, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Alert, Button, Input, Modal, Select, Textarea } from './ui';
import { api, getErrorMessage } from '../lib/api';
import { toDateInputValue } from '../lib/format';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '../lib/types';

interface LeadFormValues {
  name: string;
  email: string;
  phoneNumber: string;
  company: string;
  serviceInterested: string;
  status: LeadStatus;
  followUpDate: string;
  notes: string;
}

type FormErrors = Partial<Record<keyof LeadFormValues, string>>;

const EMPTY_VALUES: LeadFormValues = {
  name: '',
  email: '',
  phoneNumber: '',
  company: '',
  serviceInterested: '',
  status: 'New',
  followUpDate: '',
  notes: '',
};

const toFormValues = (lead?: Lead | null): LeadFormValues =>
  lead
    ? {
        name: lead.name,
        email: lead.email,
        phoneNumber: lead.phoneNumber ?? '',
        company: lead.company ?? '',
        serviceInterested: lead.serviceInterested ?? '',
        status: lead.status,
        followUpDate: toDateInputValue(lead.followUpDate),
        notes: lead.notes ?? '',
      }
    : EMPTY_VALUES;

export function LeadFormModal({
  open,
  lead,
  onClose,
  onSaved,
}: {
  open: boolean;
  lead?: Lead | null;
  onClose: () => void;
  onSaved: (lead: Lead, mode: 'created' | 'updated') => void;
}) {
  const formId = useId();
  const [values, setValues] = useState<LeadFormValues>(toFormValues(lead));
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(toFormValues(lead));
      setErrors({});
      setServerError(null);
    }
  }, [open, lead]);

  const setField = <Key extends keyof LeadFormValues>(key: Key, value: LeadFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    const name = values.name.trim();
    const email = values.email.trim();
    const phone = values.phoneNumber.trim();

    if (name.length < 1) {
      nextErrors.name = 'Name is required.';
    } else if (name.length > 120) {
      nextErrors.name = 'Name must be at most 120 characters long.';
    }

    if (!email) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    } else if (email.length > 320) {
      nextErrors.email = 'Email must be at most 320 characters long.';
    }

    if (phone && !/^[+()\d\s.-]+$/.test(phone)) {
      nextErrors.phoneNumber = 'Use only digits, spaces, parentheses, dots, dashes, and a leading plus.';
    } else if (phone.length > 40) {
      nextErrors.phoneNumber = 'Phone number must be at most 40 characters long.';
    }

    if (values.company.length > 160) {
      nextErrors.company = 'Company must be at most 160 characters long.';
    }

    if (values.serviceInterested.length > 160) {
      nextErrors.serviceInterested = 'Service must be at most 160 characters long.';
    }

    if (values.notes.length > 5000) {
      nextErrors.notes = 'Notes must be at most 5000 characters long.';
    }

    if (values.followUpDate && Number.isNaN(new Date(`${values.followUpDate}T00:00:00Z`).getTime())) {
      nextErrors.followUpDate = 'Enter a valid follow-up date.';
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

    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      phoneNumber: values.phoneNumber.trim() || null,
      company: values.company.trim() || null,
      serviceInterested: values.serviceInterested.trim() || null,
      status: values.status,
      followUpDate: values.followUpDate || null,
      notes: values.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      if (lead) {
        const result = await api.updateLead(lead.id, payload);
        onSaved(result.lead, 'updated');
      } else {
        const result = await api.createLead(payload);
        onSaved(result.lead, 'created');
      }
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? 'Edit lead' : 'Add a new lead'}
      description={
        lead
          ? 'Update contact details, pipeline status, or the next follow-up.'
          : 'Capture the essentials now. You can refine the details later.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {lead ? 'Save changes' : 'Create lead'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError ? (
          <Alert tone="error" onDismiss={() => setServerError(null)}>
            {serverError}
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            error={errors.name}
            placeholder="Jordan Lee"
            autoComplete="off"
            required
          />
          <Input
            label="Email address"
            type="email"
            value={values.email}
            onChange={(event) => setField('email', event.target.value)}
            error={errors.email}
            placeholder="jordan@company.com"
            autoComplete="off"
            required
          />
          <Input
            label="Phone number"
            type="tel"
            value={values.phoneNumber}
            onChange={(event) => setField('phoneNumber', event.target.value)}
            error={errors.phoneNumber}
            placeholder="+1 (555) 010-2000"
            autoComplete="off"
          />
          <Input
            label="Company"
            value={values.company}
            onChange={(event) => setField('company', event.target.value)}
            error={errors.company}
            placeholder="Acme Inc."
            autoComplete="off"
          />
          <Input
            label="Service interested in"
            value={values.serviceInterested}
            onChange={(event) => setField('serviceInterested', event.target.value)}
            error={errors.serviceInterested}
            placeholder="Consulting, onboarding, ..."
          />
          <Select
            label="Status"
            value={values.status}
            onChange={(event) => setField('status', event.target.value as LeadStatus)}
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Input
            label="Follow-up date"
            type="date"
            value={values.followUpDate}
            onChange={(event) => setField('followUpDate', event.target.value)}
            error={errors.followUpDate}
          />
        </div>

        <Textarea
          label="Notes"
          value={values.notes}
          onChange={(event) => setField('notes', event.target.value)}
          error={errors.notes}
          placeholder="Context, next steps, budget, or anything useful for the next conversation."
          rows={4}
        />
      </form>
    </Modal>
  );
}
