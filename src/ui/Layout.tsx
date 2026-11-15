import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getDb } from '@/db/repo';
import { useOnline } from '@/lib/hooks';
import { IconBack, IconDashboard, IconDefects, IconMore, IconParts, IconService } from './icons';

const TABS = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/defects', label: 'Defects', icon: IconDefects },
  { to: '/service', label: 'Service', icon: IconService },
  { to: '/parts', label: 'Parts', icon: IconParts },
  { to: '/more', label: 'More', icon: IconMore },
];

/** Synced / Offline · n pending / Syncing / Error. Sync to the cloud arrives in milestone 7. */
export function SyncIndicator() {
  const online = useOnline();
  const pending = useLiveQuery(() => getDb().outbox.count(), [], 0);
  const photos = useLiveQuery(async () => (await getDb().photos.toArray()).filter((p) => !p.deleted && p.upload_state !== 'Uploaded').length, [], 0);
  let text: string;
  let tone: string;
  if (!online) {
    text = `Offline · ${pending} pending`;
    tone = 'bg-zinc-500';
  } else if (pending === 0) {
    text = 'Synced';
    tone = 'bg-emerald-500';
  } else {
    text = `${pending} pending`;
    tone = 'bg-amber-500';
  }
  return (
    <Link
      to="/more/sync"
      className="chip"
      data-testid="sync-indicator"
      title={`${pending} changes waiting${photos ? `, ${photos} photos waiting to upload` : ''}. Cloud sync is not set up yet; everything is saved on this device.`}
    >
      <span className={`size-2 rounded-full ${tone}`} aria-hidden="true" />
      {text}
    </Link>
  );
}

export function Layout() {
  return (
    <div className="min-h-full sm:flex">
      <nav
        aria-label="Main"
        className="hidden sm:flex sm:flex-col sm:w-52 sm:shrink-0 sm:gap-1 sm:p-3 sm:border-r sm:sticky sm:top-0 sm:h-dvh"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="px-3 py-3 font-bold">R35 Log</div>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 min-h-11 text-sm font-medium ${isActive ? 'bg-amber-600/15 text-[var(--accent)]' : ''}`
            }
          >
            <t.icon className="size-5" />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-6">
        <Outlet />
      </div>
      <nav
        aria-label="Tabs"
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-14 text-[11px] font-medium ${isActive ? 'text-[var(--accent)]' : 'muted'}`
            }
          >
            <t.icon className="size-6" />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Page header with title, optional back button and actions, and the sync indicator. */
export function Page(props: { title: string; back?: boolean | string; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  const navigate = useNavigate();
  return (
    <>
      <header
        className="sticky top-0 z-20 border-b backdrop-blur pt-[env(safe-area-inset-top)]"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 min-h-14">
          {props.back && (
            <button
              type="button"
              className="btn btn-ghost -ml-3 px-2"
              aria-label="Back"
              onClick={() => (typeof props.back === 'string' ? navigate(props.back) : navigate(-1))}
            >
              <IconBack />
            </button>
          )}
          <h1 className="text-lg font-semibold truncate flex-1">{props.title}</h1>
          <SyncIndicator />
        </div>
      </header>
      <main className={`mx-auto px-4 py-4 ${props.wide === false ? 'max-w-2xl' : 'max-w-5xl'}`}>
        {props.actions && <div className="mb-4 flex flex-wrap gap-2">{props.actions}</div>}
        {props.children}
      </main>
    </>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-6 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="muted mt-1 text-sm">{children}</div>}
    </div>
  );
}
