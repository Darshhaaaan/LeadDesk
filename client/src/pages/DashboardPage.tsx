import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader, Alert, Button, Card, EmptyState, Skeleton, StatusBadge, cn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import { formatChartDate, formatDate, pluralize } from '../lib/format';
import { LEAD_STATUSES, type LeadStats, type LeadStatus } from '../lib/types';

const STATUS_COLORS: Record<LeadStatus, string> = {
  New: '#0ea5e9',
  Contacted: '#f59e0b',
  Qualified: '#8b5cf6',
  Converted: '#10b981',
  Lost: '#94a3b8',
};

const statCards = (stats: LeadStats) => [
  {
    label: 'Total leads',
    value: stats.total,
    hint: 'All leads in your workspace',
    icon: Users,
    tone: 'text-brand-600 bg-brand-50',
  },
  {
    label: 'Qualified',
    value: stats.byStatus.Qualified,
    hint: 'Ready for a focused follow-up',
    icon: Target,
    tone: 'text-violet-600 bg-violet-50',
  },
  {
    label: 'Converted',
    value: stats.byStatus.Converted,
    hint: stats.total > 0 ? `${Math.round((stats.byStatus.Converted / stats.total) * 100)}% conversion rate` : 'No conversion data yet',
    icon: CheckCircle2,
    tone: 'text-emerald-600 bg-emerald-50',
  },
  {
    label: 'Upcoming follow-ups',
    value: stats.upcomingFollowUps.count,
    hint: stats.upcomingFollowUps.count > 0 ? 'Including today and later' : 'You are all caught up',
    icon: CalendarClock,
    tone: 'text-amber-600 bg-amber-50',
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getLeadStats({ signal });
      setStats(result.stats);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        return;
      }
      setError(getErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStats(controller.signal);
    return () => controller.abort();
  }, [loadStats]);

  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';

  const pieData = useMemo(() => {
    if (!stats) {
      return [];
    }
    return LEAD_STATUSES.map((status) => ({
      name: status,
      value: stats.byStatus[status],
      color: STATUS_COLORS[status],
    }));
  }, [stats]);

  const chartData = useMemo(
    () =>
      stats?.createdOverTime.map((point) => ({
        ...point,
        label: formatChartDate(point.date),
      })) ?? [],
    [stats]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        description="A clear view of your pipeline, momentum, and the follow-ups that need your attention."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void loadStats()}
              disabled={loading}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
            <Link to="/app/leads?new=1">
              <Button>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Add a lead
              </Button>
            </Link>
          </>
        }
      />

      {error ? (
        <Alert tone="error" title="Dashboard could not load" onDismiss={() => setError(null)}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={() => void loadStats()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading && !stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-8 w-16" />
                <Skeleton className="mt-3 h-3 w-32" />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-64 w-full" />
            </Card>
            <Card className="p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-4 h-64 w-full" />
            </Card>
          </div>
        </>
      ) : null}

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards(stats).map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{card.label}</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        {card.value}
                      </p>
                    </div>
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.tone)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{card.hint}</p>
                </Card>
              );
            })}
          </div>

          {stats.total === 0 ? (
            <Card>
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" aria-hidden="true" />}
                title="Your pipeline starts here"
                description="Add your first lead to begin tracking conversations, follow-up dates, and progress."
                action={
                  <Link to="/app/leads?new=1">
                    <Button>
                      Add your first lead
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                }
              />
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Leads created</h2>
                  <p className="mt-1 text-sm text-slate-500">New leads over the last 30 days</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {pluralize(
                    stats.createdOverTime.reduce((sum, point) => sum + point.count, 0),
                    'new lead'
                  )}
                </span>
              </div>

              <div className="mt-5 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="leadArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                        boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                      }}
                      labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                      formatter={(value) => [`${value} lead${Number(value) === 1 ? '' : 's'}`, 'Created']}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      fill="url(#leadArea)"
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Pipeline breakdown</h2>
                <p className="mt-1 text-sm text-slate-500">Leads by current status</p>
              </div>

              <div className="mt-4 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [`${value} leads`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5">
                {LEAD_STATUSES.map((status) => (
                  <div key={status} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[status] }}
                        aria-hidden="true"
                      />
                      {status}
                    </span>
                    <span className="font-semibold text-slate-900">{stats.byStatus[status]}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Upcoming follow-ups</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The next conversations on your calendar.
                </p>
              </div>
              <Link to="/app/leads?sort=followup" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                View all leads
              </Link>
            </div>

            {stats.upcomingFollowUps.leads.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" aria-hidden="true" />}
                title="No upcoming follow-ups"
                description="Set a follow-up date on a lead to see it here."
                action={
                  <Link to="/app/leads">
                    <Button variant="secondary" size="sm">
                      Go to leads
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.upcomingFollowUps.leads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      to={`/app/leads/${lead.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {lead.company || lead.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={lead.status} />
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatDate(lead.followUpDate)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
