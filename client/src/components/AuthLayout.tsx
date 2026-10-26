import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Brand } from './ui';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(circle at 15% 20%, rgba(79,70,229,0.5), transparent 45%), radial-gradient(circle at 85% 80%, rgba(14,165,233,0.25), transparent 40%)',
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <div className="[&_span.text-slate-900]:text-white">
              <Brand />
            </div>
          </div>

          <div className="relative mt-auto max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300">
              Lead management, simplified
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
              Turn conversations into a reliable pipeline.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Keep every prospect, next step, and status change in one focused workspace. No
              spreadsheets, no forgotten follow-ups.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              {[
                'Track leads from first contact to conversion',
                'See your pipeline and upcoming follow-ups at a glance',
                'Protect your account with secure sessions and email alerts',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-xs text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Password changes and account deletion are confirmed by email.
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Brand />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
                {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
              </div>
              {children}
            </div>

            {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}

            <p className="mt-8 text-center text-xs text-slate-400">
              Protected by secure, HTTP-only session cookies and CSRF validation.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
