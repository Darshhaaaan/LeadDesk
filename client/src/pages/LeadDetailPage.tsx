import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  Clock,
  Mail,
  Pencil,
  Phone,
  PlusCircle,
  RefreshCw,
  SearchX,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
  cn,
} from '../components/ui';
import { LeadFormModal } from '../components/LeadFormModal';
import { DeleteLeadDialog } from '../components/DeleteLeadDialog';
import { ApiError, api, getErrorMessage } from '../lib/api';
import { formatDate, formatDateTime, getInitials, isOverdue } from '../lib/format';
import type { Lead, LeadActivity } from '../lib/types';

const ACTIVITY_ICONS = {
  Created: PlusCircle,
  Updated: Pencil,
  StatusChanged: RefreshCw,
} as const;

const ACTIVITY_TONES = {
  Created: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  Updated: 'bg-sky-50 text-sky-600 ring-sky-100',
  StatusChanged: 'bg-violet-50 text-violet-600 ring-violet-100',
} as const;

const DetailRow = ({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
      {icon}
    </span>
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children}</dd>
    </div>
  </div>
);

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const [leadResult, activityResult] = await Promise.all([
          api.getLead(id, { signal }),
          api.getLeadActivities(id, { signal }),
        ]);
        setLead(leadResult.lead);
        setActivities(activityResult.activities);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        if (
          requestError instanceof ApiError &&
          (requestError.status === 404 || requestError.code === 'LEAD_NOT_FOUND')
        ) {
          setNotFound(true);
        } else {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSaved = (updatedLead: Lead) => {
    setEditing(false);
    setLead(updatedLead);
    setToast('Lead details updated.');
    setReloadKey((value) => value + 1);
  };

  const handleDeleted = (deletedLead: Lead) => {
    setDeleting(false);
    navigate('/app/leads', {
      replace: true,
      state: { notice: `Lead "${deletedLead.name}" was deleted.` },
    });
  };

  if (loading && !lead) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link
          to="/app/leads"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to leads
        </Link>
        <Card>
          <EmptyState
            icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
            title="Lead not found"
            description="This lead does not exist, or it belongs to a different account."
            action={
              <Button onClick={() => navigate('/app/leads')}>
                Back to your leads
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="space-y-6">
        <Link
          to="/app/leads"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to leads
        </Link>
        <Alert tone="error" title="This lead could not load">
          <div className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
              Try again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const overdue = isOverdue(lead.followUpDate);

  return (
    <div className="space-y-6">
      <Link
        to="/app/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to leads
      </Link>

      {toast ? (
        <div
          className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg sm:left-auto sm:right-6 sm:translate-x-0"
          role="status"
        >
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {error ? (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <PageHeader
        eyebrow={lead.company || 'Lead'}
        title={lead.name}
        description={`Created ${formatDateTime(lead.createdAt)} · Last updated ${formatDateTime(lead.updatedAt)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit lead
            </Button>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                  {getInitials(lead.name)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-slate-900">{lead.name}</h2>
                  <p className="truncate text-sm text-slate-500">
                    {lead.company || 'No company'} · {lead.serviceInterested || 'No service specified'}
                  </p>
                </div>
              </div>
              <StatusBadge status={lead.status} />
            </div>

            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <DetailRow icon={<Mail className="h-4 w-4" aria-hidden="true" />} label="Email">
                <a href={`mailto:${lead.email}`} className="text-brand-600 hover:text-brand-700">
                  {lead.email}
                </a>
              </DetailRow>
              <DetailRow icon={<Phone className="h-4 w-4" aria-hidden="true" />} label="Phone">
                {lead.phoneNumber ? (
                  <a href={`tel:${lead.phoneNumber}`} className="text-brand-600 hover:text-brand-700">
                    {lead.phoneNumber}
                  </a>
                ) : (
                  <span className="text-slate-400">Not provided</span>
                )}
              </DetailRow>
              <DetailRow icon={<Building2 className="h-4 w-4" aria-hidden="true" />} label="Company">
                {lead.company || <span className="text-slate-400">Not provided</span>}
              </DetailRow>
              <DetailRow icon={<Briefcase className="h-4 w-4" aria-hidden="true" />} label="Service interested in">
                {lead.serviceInterested || <span className="text-slate-400">Not specified</span>}
              </DetailRow>
              <DetailRow icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />} label="Next follow-up">
                {lead.followUpDate ? (
                  <span className={cn(overdue ? 'font-medium text-rose-600' : 'text-slate-800')}>
                    {formatDate(lead.followUpDate)}
                    {overdue ? ' (overdue)' : ''}
                  </span>
                ) : (
                  <span className="text-slate-400">Not scheduled</span>
                )}
              </DetailRow>
              <DetailRow icon={<Clock className="h-4 w-4" aria-hidden="true" />} label="Created">
                {formatDateTime(lead.createdAt)}
              </DetailRow>
            </dl>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">Notes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Context for your next conversation, stored securely with this lead.
            </p>
            {lead.notes ? (
              <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {lead.notes}
              </p>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                No notes yet. Edit this lead to add context, next steps, or budget details.
              </p>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Activity</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">The most recent changes to this lead.</p>

          {activities.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              No activity recorded yet.
            </p>
          ) : (
            <ol className="mt-5 space-y-4">
              {activities.map((activity) => {
                const type = activity.type as keyof typeof ACTIVITY_ICONS;
                const Icon = ACTIVITY_ICONS[type] ?? UserRound;
                const tone = ACTIVITY_TONES[type] ?? 'bg-slate-100 text-slate-500 ring-slate-100';

                return (
                  <li key={activity.id} className="flex gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1',
                        tone
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{activity.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(activity.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <LeadFormModal
        open={editing}
        lead={lead}
        onClose={() => setEditing(false)}
        onSaved={handleSaved}
      />

      <DeleteLeadDialog lead={deleting ? lead : null} onClose={() => setDeleting(false)} onDeleted={handleDeleted} />
    </div>
  );
}
