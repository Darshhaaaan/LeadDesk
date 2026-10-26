import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  cn,
} from '../components/ui';
import { LeadFormModal } from '../components/LeadFormModal';
import { DeleteLeadDialog } from '../components/DeleteLeadDialog';
import { api, getErrorMessage } from '../lib/api';
import { formatDate, isOverdue, pluralize } from '../lib/format';
import { LEAD_STATUSES, type Lead, type LeadFilters, type LeadList, type LeadStatus } from '../lib/types';

type SortOption = 'createdAt:desc' | 'createdAt:asc' | 'name:asc' | 'followUpDate:asc';

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A-Z' },
  { value: 'followUpDate:asc', label: 'Follow-up date' },
];

const parseSort = (value: string): { sortBy: LeadFilters['sortBy']; sortOrder: LeadFilters['sortOrder'] } => {
  const [sortBy, sortOrder] = value.split(':') as [LeadFilters['sortBy'], LeadFilters['sortOrder']];
  return { sortBy, sortOrder };
};

const isFiltered = (
  search: string,
  status: string,
  createdFrom: string,
  createdTo: string,
  followUpFrom: string,
  followUpTo: string
): boolean =>
  Boolean(search || status || createdFrom || createdTo || followUpFrom || followUpTo);

export function LeadsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [followUpFrom, setFollowUpFrom] = useState('');
  const [followUpTo, setFollowUpTo] = useState('');
  const [sort, setSort] = useState<SortOption>('createdAt:desc');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [data, setData] = useState<LeadList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice;
    if (notice) {
      setToast(notice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    } else if (searchParams.get('sort') === 'followup') {
      setSort('followUpDate:asc');
      const next = new URLSearchParams(searchParams);
      next.delete('sort');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filters = useMemo<LeadFilters>(() => {
    const { sortBy, sortOrder } = parseSort(sort);
    return {
      page,
      pageSize,
      search,
      status,
      createdFrom,
      createdTo,
      followUpFrom,
      followUpTo,
      sortBy,
      sortOrder,
    };
  }, [page, pageSize, search, status, createdFrom, createdTo, followUpFrom, followUpTo, sort]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    api
      .listLeads(filters, { signal: controller.signal })
      .then((result) => {
        setData(result);
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages);
        }
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const hasFilters = isFiltered(search, status, createdFrom, createdTo, followUpFrom, followUpTo);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCreatedFrom('');
    setCreatedTo('');
    setFollowUpFrom('');
    setFollowUpTo('');
    setSort('createdAt:desc');
    setPage(1);
  };

  const handleSaved = (lead: Lead, mode: 'created' | 'updated') => {
    setCreateOpen(false);
    setEditingLead(null);
    setToast(mode === 'created' ? `Lead "${lead.name}" created.` : `Lead "${lead.name}" updated.`);
    setReloadKey((value) => value + 1);
  };

  const handleDeleted = (lead: Lead) => {
    setDeletingLead(null);
    setToast(`Lead "${lead.name}" deleted.`);
    if (data && data.items.length === 1 && page > 1) {
      setPage((value) => value - 1);
    } else {
      setReloadKey((value) => value + 1);
    }
  };

  const pagination = data?.pagination;
  const rangeStart = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const rangeEnd = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leads"
        title="Your pipeline"
        description="Find any lead quickly, keep statuses current, and make sure the next follow-up is never missed."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add lead
          </Button>
        }
      />

      {toast ? (
        <div
          className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg sm:left-auto sm:right-6 sm:translate-x-0"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <Input
            label="Search leads"
            type="search"
            placeholder="Search by name, email, or phone"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden="true" />}
            trailing={
              searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="rounded p-1.5 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />

          <Select
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as LeadStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>

          <Select
            label="Sort by"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortOption);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className={cn(
                (createdFrom || createdTo || followUpFrom || followUpTo) && 'border-brand-300 text-brand-700'
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Dates
            </Button>
            {hasFilters ? (
              <Button variant="ghost" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </Button>
            ) : null}
          </div>
        </div>

        {showFilters ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Created from"
              type="date"
              value={createdFrom}
              max={createdTo || undefined}
              onChange={(event) => {
                setCreatedFrom(event.target.value);
                setPage(1);
              }}
            />
            <Input
              label="Created to"
              type="date"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(event) => {
                setCreatedTo(event.target.value);
                setPage(1);
              }}
            />
            <Input
              label="Follow-up from"
              type="date"
              value={followUpFrom}
              max={followUpTo || undefined}
              onChange={(event) => {
                setFollowUpFrom(event.target.value);
                setPage(1);
              }}
            />
            <Input
              label="Follow-up to"
              type="date"
              value={followUpTo}
              min={followUpFrom || undefined}
              onChange={(event) => {
                setFollowUpTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </Card>

      {error ? (
        <Alert tone="error" title="Leads could not load" onDismiss={() => setError(null)}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Filter className="h-4 w-4" aria-hidden="true" />
            {pagination ? (
              <span>
                Showing <span className="font-semibold text-slate-900">{rangeStart}</span>-
                <span className="font-semibold text-slate-900">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-slate-900">{pagination.total}</span>{' '}
                {pagination.total === 1 ? 'lead' : 'leads'}
              </span>
            ) : (
              <span>Loading leads...</span>
            )}
          </div>
          {pagination && pagination.totalPages > 0 ? (
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
          ) : null}
        </div>

        {loading && !data ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : !loading && data && data.items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title={hasFilters ? 'No leads match these filters' : 'No leads yet'}
            description={
              hasFilters
                ? 'Try a different search term, status, or date range.'
                : 'Add your first lead to start building a reliable pipeline.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add your first lead
                </Button>
              )
            }
          />
        ) : data ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Lead
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Company
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Next follow-up
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Created
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-slate-100 bg-white', loading && 'opacity-60')}>
                  {data.items.map((lead) => {
                    const overdue = isOverdue(lead.followUpDate);
                    return (
                      <tr
                        key={lead.id}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => navigate(`/app/leads/${lead.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                              {lead.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                              <p className="truncate text-xs text-slate-500">{lead.email}</p>
                              {lead.phoneNumber ? (
                                <p className="truncate text-xs text-slate-400">{lead.phoneNumber}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          <p className="truncate">{lead.company || '—'}</p>
                          <p className="truncate text-xs text-slate-400">
                            {lead.serviceInterested || 'No service specified'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          {lead.followUpDate ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5',
                                overdue ? 'font-medium text-rose-600' : 'text-slate-600'
                              )}
                            >
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatDate(lead.followUpDate)}
                              {overdue ? <span className="text-xs">(overdue)</span> : null}
                            </span>
                          ) : (
                            <span className="text-slate-400">Not set</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-500">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingLead(lead);
                              }}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={`Edit ${lead.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeletingLead(lead);
                              }}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Delete ${lead.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-slate-100 md:hidden', loading && 'opacity-60')}>
              {data.items.map((lead) => (
                <li key={lead.id}>
                  <div className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/leads/${lead.id}`)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                        <p className="truncate text-xs text-slate-500">{lead.email}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {lead.company || 'No company'} · {lead.serviceInterested || 'No service'}
                        </p>
                      </div>
                      <StatusBadge status={lead.status} />
                    </button>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs',
                          isOverdue(lead.followUpDate) ? 'font-medium text-rose-600' : 'text-slate-500'
                        )}
                      >
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {lead.followUpDate ? formatDate(lead.followUpDate) : 'No follow-up date'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingLead(lead)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${lead.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingLead(lead)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${lead.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <label htmlFor="page-size" className="whitespace-nowrap">
                  Rows per page
                </label>
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {[10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination?.hasPreviousPage || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <span className="px-2 text-xs text-slate-500">
                  {pagination ? `${pagination.page} / ${Math.max(pagination.totalPages, 1)}` : '—'}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination?.hasNextPage || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      {hasFilters ? (
        <p className="text-center text-xs text-slate-400">
          {pluralize(data?.pagination.total ?? 0, 'lead')} matching your filters
        </p>
      ) : null}

      <LeadFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={handleSaved}
      />

      <LeadFormModal
        open={Boolean(editingLead)}
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={handleSaved}
      />

      <DeleteLeadDialog
        lead={deletingLead}
        onClose={() => setDeletingLead(null)}
        onDeleted={handleDeleted}
      />

      <div className="text-center">
        <Link to="/app/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-700">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
