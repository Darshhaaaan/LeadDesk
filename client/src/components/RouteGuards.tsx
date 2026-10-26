import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from './ui';
import { useAuth } from '../context/AuthContext';

const FullPageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <Spinner />
  </div>
);

/** Protects the authenticated application and remembers where the user was headed. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

/** Keeps signed-in users out of the login, registration, and reset screens. */
export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

/** Sends visitors to the right starting point based on their session. */
export function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  return <Navigate to={user ? '/app/dashboard' : '/login'} replace />;
}
