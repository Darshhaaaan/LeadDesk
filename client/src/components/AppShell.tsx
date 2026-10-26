import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, Settings, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar, Brand, Button, cn } from './ui';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/leads', label: 'Leads', icon: Users },
  { to: '/app/settings', label: 'Account settings', icon: Settings },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const navigation = (
    <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <Brand />
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="py-5">{navigation}</div>

      <div className="mt-auto border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.name ?? 'User'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start"
          onClick={handleLogout}
          loading={loggingOut}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="animate-fade-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <Brand />
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
