import { Link } from 'react-router-dom';
import { daysBetween, todayISO } from '@/domain/dates';
import { formatKm } from '@/domain/format';
import { kmPerYear } from '@/domain/odometer';
import { SEVERITIES } from '@/domain/schemas';
import { useChapterLookup, useCurrentOdo, useVehicle } from '@/lib/hooks';
import { SeverityBadge } from '@/ui/badges';
import { IconPlus } from '@/ui/icons';
import { EmptyState, Page } from '@/ui/Layout';
import { IssueRow, useIssuesWithSteps } from '../defects/DefectsList';

const SEVERITY_RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

export function Dashboard() {
  const vehicle = useVehicle();
  const odo = useCurrentOdo();
  const rows = useIssuesWithSteps();
  const chapters = useChapterLookup();
  const today = todayISO();

  const open = (rows ?? []).filter((r) => r.issue.status !== 'Closed');
  const openDefects = open.filter((r) => r.issue.kind === 'defect');
  const perYear = vehicle && odo != null ? kmPerYear(odo, vehicle.purchase_odo, daysBetween(vehicle.purchase_date, today)) : null;
  const sorted = [...open].sort(
    (a, b) =>
      (SEVERITY_RANK[a.issue.severity ?? ''] ?? 9) - (SEVERITY_RANK[b.issue.severity ?? ''] ?? 9) ||
      a.issue.date_identified.localeCompare(b.issue.date_identified),
  );

  return (
    <Page title={vehicle ? `${vehicle.nickname} · ${vehicle.model_code}` : 'Dashboard'}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="section-title">Odometer</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid="tile-odometer">
            {formatKm(odo)}
          </p>
        </div>
        <div className="card p-4">
          <p className="section-title">km per year</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{perYear == null ? '—' : Math.round(perYear).toLocaleString('en-AU')}</p>
          <p className="muted text-xs">since purchase</p>
        </div>
        <div className="card col-span-2 p-4 sm:col-span-1">
          <p className="section-title">Open defects</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{openDefects.length}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {SEVERITIES.map((s) => {
              const n = openDefects.filter((r) => r.issue.severity === s).length;
              return n ? (
                <span key={s} className="inline-flex items-center gap-1 text-xs">
                  <SeverityBadge severity={s} /> {n}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="section-title mb-2">Service due</h2>
        <EmptyState title="Due list arrives in milestone 4">
          Service items are already seeded — see the{' '}
          <Link to="/service" className="underline">
            Service
          </Link>{' '}
          tab.
        </EmptyState>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Open issues ({open.length})</h2>
          <Link to="/defects/new" className="btn btn-ghost">
            <IconPlus className="size-5" /> New defect
          </Link>
        </div>
        {rows && open.length === 0 ? (
          <EmptyState title="No open defects or jobs" />
        ) : (
          <ul className="space-y-2">
            {sorted.map(({ issue, steps }) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                lastStep={steps.reduce<string | null>((m, s) => (m == null || s.date > m ? s.date : m), null)}
                today={today}
                chapters={chapters}
              />
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
