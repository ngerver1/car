import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDb, live } from '@/db/repo';
import { formatDate, todayISO } from '@/domain/dates';
import { daysOpen, issueMatches, issueRef } from '@/domain/issues';
import { SEVERITIES, STATUSES, type Issue, type Status, type Step } from '@/domain/schemas';
import { useChapterLookup, useGroups, useVendors } from '@/lib/hooks';
import { ChapterChip, SeverityBadge, StatusBadge } from '@/ui/badges';
import { SelectField } from '@/ui/fields';
import { IconPlus, IconSearch } from '@/ui/icons';
import { EmptyState, Page } from '@/ui/Layout';

interface Filters {
  status: 'not-closed' | Status | 'all';
  kind: '' | 'defect' | 'job';
  severity: string;
  group: string;
  vendor: string;
}
const DEFAULT_FILTERS: Filters = { status: 'not-closed', kind: '', severity: '', group: '', vendor: '' };

function loadFilters(): Filters {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem('defects-filters') ?? '{}') };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function useIssuesWithSteps() {
  return useLiveQuery(async () => {
    const db = getDb();
    const issues = live(await db.issues.toArray());
    const steps = live(await db.steps.toArray());
    const byIssue = new Map<string, Step[]>();
    for (const s of steps) byIssue.set(s.issue_id, [...(byIssue.get(s.issue_id) ?? []), s]);
    return issues.map((issue) => ({ issue, steps: byIssue.get(issue.id) ?? [] }));
  });
}

export function DefectsList() {
  const rows = useIssuesWithSteps();
  const groups = useGroups() ?? [];
  const vendors = useVendors() ?? [];
  const chapters = useChapterLookup();
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [query, setQuery] = useState('');
  const today = todayISO();

  useEffect(() => {
    try {
      localStorage.setItem('defects-filters', JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter(({ issue, steps }) => {
        if (filters.status === 'not-closed' && issue.status === 'Closed') return false;
        if (filters.status !== 'not-closed' && filters.status !== 'all' && issue.status !== filters.status) return false;
        if (filters.kind && issue.kind !== filters.kind) return false;
        if (filters.severity && issue.severity !== filters.severity) return false;
        if (filters.group && issue.group_code !== filters.group) return false;
        if (filters.vendor && issue.found_by_vendor_id !== filters.vendor && !steps.some((s) => s.vendor_id === filters.vendor)) return false;
        return issueMatches(issue, steps, query);
      })
      .map(({ issue, steps }) => ({ issue, lastStep: steps.reduce<string | null>((m, s) => (m == null || s.date > m ? s.date : m), null) }))
      .sort((a, b) => (b.lastStep ?? b.issue.date_identified).localeCompare(a.lastStep ?? a.issue.date_identified) || b.issue.ref_no - a.issue.ref_no);
  }, [rows, filters, query]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const active = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <Page
      title="Defects & jobs"
      actions={
        <>
          <Link to="/defects/new" className="btn btn-primary">
            <IconPlus className="size-5" /> New defect
          </Link>
          <Link to="/defects/new?kind=job" className="btn">
            <IconPlus className="size-5" /> New job
          </Link>
        </>
      }
    >
      <div className="relative mb-3">
        <IconSearch className="muted absolute left-3 top-1/2 size-5 -translate-y-1/2" />
        <input
          type="search"
          className="input pl-10"
          placeholder="Search title, description, steps, DTCs"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <details className="card mb-4 p-3" open={active}>
        <summary className="min-h-11 flex cursor-pointer items-center font-medium">Filters{active && ' (on)'}</summary>
        <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-5">
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(v) => set('status', v as Filters['status'])}
            options={[{ value: 'not-closed', label: 'Not closed' }, { value: 'all', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
          />
          <SelectField
            label="Kind"
            value={filters.kind}
            placeholder="All"
            onChange={(v) => set('kind', v as Filters['kind'])}
            options={[
              { value: 'defect', label: 'Defects' },
              { value: 'job', label: 'Jobs' },
            ]}
          />
          <SelectField
            label="Severity"
            value={filters.severity}
            placeholder="All"
            onChange={(v) => set('severity', v)}
            options={SEVERITIES.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            label="Group"
            value={filters.group}
            placeholder="All"
            onChange={(v) => set('group', v)}
            options={groups.map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))}
          />
          <SelectField
            label="Vendor"
            value={filters.vendor}
            placeholder="All"
            onChange={(v) => set('vendor', v)}
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
          />
        </div>
        {active && (
          <button type="button" className="btn btn-ghost mt-2" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </button>
        )}
      </details>

      {rows === undefined ? null : filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState title="No defects or jobs yet">Log a fault with “New defect”, or planned work with “New job”.</EmptyState>
        ) : (
          <EmptyState title="Nothing matches">Try clearing the search or filters.</EmptyState>
        )
      ) : (
        <ul className="space-y-2" data-testid="issue-list">
          {filtered.map(({ issue, lastStep }) => (
            <IssueRow key={issue.id} issue={issue} lastStep={lastStep} today={today} chapters={chapters} />
          ))}
        </ul>
      )}
    </Page>
  );
}

export function IssueRow({
  issue,
  lastStep,
  today,
  chapters,
}: {
  issue: Issue;
  lastStep: string | null;
  today: string;
  chapters: ReturnType<typeof useChapterLookup>;
}) {
  return (
    <li>
      <Link to={`/defects/${issue.id}`} className="card block p-3 hover:border-[var(--accent)]" data-testid="issue-row">
        <div className="flex items-start gap-3">
          <span className="font-mono text-sm font-semibold muted shrink-0 pt-0.5">{issueRef(issue)}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">{issue.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ChapterChip group={chapters.group(issue.group_code)} section={chapters.section(issue.section_code)} plain />
              <SeverityBadge severity={issue.severity} />
              <StatusBadge status={issue.status} />
              {issue.kind === 'job' && <span className="chip">Job</span>}
            </div>
            <p className="muted mt-1.5 text-xs">
              {lastStep ? `Last step ${formatDate(lastStep)}` : 'No steps'} · {daysOpen(issue, today)} days {issue.status === 'Closed' ? 'to close' : 'open'}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
