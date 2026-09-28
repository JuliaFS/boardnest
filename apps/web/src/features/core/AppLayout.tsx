import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import { getAuthErrorMessage } from '../auth/auth-errors';

const navigation = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'Projects', to: '/projects' },
  { label: 'Members', to: '/members' },
  { label: 'Notifications', to: '/notifications' },
  { label: 'Settings', to: '/settings' },
];

export function AppLayout() {
  const { signOut, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(getAuthErrorMessage(error));
    }
  }

  return (
    <div className="min-h-screen bg-[#080d19] text-slate-100">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0b1120]/95 px-4 backdrop-blur md:hidden">
        <Link
          className="font-extrabold tracking-wide text-indigo-300"
          to="/dashboard"
        >
          Boardnest
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          Menu
        </button>
      </header>

      <aside
        className={`${menuOpen ? 'flex' : 'hidden'} fixed inset-x-0 top-16 z-20 h-[calc(100vh-4rem)] flex-col border-r border-slate-800 bg-[#0b1120] p-5 md:inset-y-0 md:left-0 md:flex md:h-screen md:w-64`}
      >
        <Link
          className="hidden text-lg font-extrabold tracking-wide text-indigo-300 md:block"
          to="/dashboard"
        >
          Boardnest
        </Link>
        <nav aria-label="Main navigation" className="mt-3 grid gap-1 md:mt-10">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-400/15 text-indigo-200'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                }`
              }
              key={item.to}
              onClick={() => setMenuOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-5">
          <p className="truncate text-sm font-semibold text-slate-200">
            {user?.displayName ?? 'Boardnest user'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {user?.email ?? user?.id}
          </p>
          <button
            className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
            onClick={() => void handleSignOut()}
            type="button"
          >
            Sign out
          </button>
          {signOutError ? (
            <p className="mt-2 text-xs text-rose-300" role="alert">
              {signOutError}
            </p>
          ) : null}
        </div>
      </aside>

      <main className="min-h-screen md:pl-64">
        {user?.isAnonymous ? (
          <div className="border-b border-amber-700/60 bg-amber-950/40 px-4 py-3 text-center text-sm text-amber-100">
            Guest demo: 1 workspace, 1 project, 20 tasks, 1 invitation, and 10
            comments. Task edits and moves are unlimited. This account cannot be
            recovered after signing out.
          </div>
        ) : null}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
