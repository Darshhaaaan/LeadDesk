import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, LayoutDashboard, LogIn } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          The page you are looking for may have moved, or the link is no longer valid.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {user ? (
            <Link to="/app/dashboard">
              <Button>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Go to dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in
              </Button>
            </Link>
          )}
          <Link to="/">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to start
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
