import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { addPhotos, deleteIssue, deletePhoto } from '@/db/actions';
import { getDb, live } from '@/db/repo';
import { formatDate, todayISO } from '@/domain/dates';
import { formatKm, formatMoney } from '@/domain/format';
import { daysOpen, issueRef, sortSteps, symptomSummary, totalsByCurrency } from '@/domain/issues';
import type { PartLine, Photo, Step } from '@/domain/schemas';
import { useChapterLookup, useCurrentOdo, useVendors } from '@/lib/hooks';
import { ChapterChip, ChapterFull, SeverityBadge, StatusBadge } from '@/ui/badges';
import { useConfirm } from '@/ui/dialog';
import { IconPlus } from '@/ui/icons';
import { EmptyState, Page } from '@/ui/Layout';
import { PhotoGrid, PhotoPicker } from '@/ui/photos';
import type { ClosePrefill } from './StepForm';
import { StatusDialog, type StatusPrefill } from './StatusDialog';

export function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const chapters = useChapterLookup();
  const vendors = useVendors() ?? [];
  const currentOdo = useCurrentOdo() ?? null;
  const [newestFirst, setNewestFirst] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [prefill, setPrefill] = useState<StatusPrefill | null>(null);

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const db = getDb();
    const issue = await db.issues.get(id);
    if (!issue || issue.deleted) return null;
    const steps = live(await db.steps.where('issue_id').equals(id).toArray());
    const stepIds = steps.map((s) => s.id);
    const lines = live(await db.partLines.where('parent_id').anyOf(stepIds).toArray());
    const photos = live(
      await db.photos
        .where('parent_id')
        .anyOf([id, ...stepIds])
        .toArray(),
    ).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { issue, steps, lines, photos };
  }, [id]);

  // "Fixed" outcome on a step → open the close dialog pre-filled from the step.
  useEffect(() => {
    const p = (location.state as { closePrefill?: ClosePrefill } | null)?.closePrefill;
    if (p && data?.issue) {
      setPrefill({ status: 'Closed', note: p.note, date: p.date, odo: p.odo });
      setStatusOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, data?.issue]); // eslint-disable-line react-hooks/exhaustive-deps

  const byStep = useMemo(() => {
    const lines = new Map<string, PartLine[]>();
    const photos = new Map<string, Photo[]>();
    for (const l of data?.lines ?? []) lines.set(l.parent_id, [...(lines.get(l.parent_id) ?? []), l]);
    for (const p of data?.photos ?? []) photos.set(p.parent_id, [...(photos.get(p.parent_id) ?? []), p]);
    for (const arr of lines.values()) arr.sort((a, b) => a.sort - b.sort);
    return { lines, photos };
  }, [data]);

  if (data === undefined)
    return (
      <Page title="Loading…" back="/defects">
        {null}
      </Page>
    );
  if (data === null)
    return (
      <Page title="Not found" back="/defects">
        <EmptyState title="This record does not exist or was deleted." />
      </Page>
    );

  const { issue, steps } = data;
  const vendorName = (vid: string | null) => vendors.find((v) => v.id === vid)?.name;
  const group = chapters.group(issue.group_code);
  const section = chapters.section(issue.section_code);
  const totals = totalsByCurrency(data.lines);
  const issuePhotos = byStep.photos.get(issue.id) ?? [];
  const noun = issue.kind === 'job' ? 'job' : 'defect';
  const symptoms = symptomSummary(issue.symptom);

  async function onDelete() {
    if (
      !(await confirm({
        title: `Delete ${issueRef(issue)}?`,
        message: `The ${noun}, its steps, parts and photos are removed from every device after sync.`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    await deleteIssue(issue.id);
    navigate('/defects', { replace: true });
  }

  return (
    <Page title={issueRef(issue)} back="/defects">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="space-y-4" aria-label="Summary">
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ChapterChip group={group} section={section} />
              <SeverityBadge severity={issue.severity} />
              <StatusBadge status={issue.status} />
              {issue.kind === 'job' && <span className="chip">Job</span>}
            </div>
            <h2 className="text-xl font-semibold leading-snug" data-testid="issue-title">
              {issue.title}
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Meta label="Identified">{formatDate(issue.date_identified)}</Meta>
              <Meta label="Odometer">{formatKm(issue.odo_identified)}</Meta>
              <Meta label="Chapter" wide>
                <ChapterFull group={group} section={section} />
              </Meta>
              {issue.how_found && <Meta label="How found">{issue.how_found}</Meta>}
              {issue.found_by_vendor_id && <Meta label="Found by">{vendorName(issue.found_by_vendor_id) ?? '—'}</Meta>}
              <Meta label={issue.status === 'Closed' ? 'Days to close' : 'Days open'}>{daysOpen(issue, todayISO())}</Meta>
              {issue.legacy_entry_no != null && <Meta label="Sheet entry">#{issue.legacy_entry_no}</Meta>}
            </dl>
            {issue.description && <p className="whitespace-pre-wrap text-sm">{issue.description}</p>}
            {symptoms && (
              <div>
                <h3 className="section-title">Symptom conditions</h3>
                <p className="text-sm" data-testid="symptom-summary">
                  {symptoms}
                </p>
              </div>
            )}
            {issue.dtcs.length > 0 && (
              <div>
                <h3 className="section-title mb-1">DTCs</h3>
                <ul className="flex flex-wrap gap-2" data-testid="dtc-list">
                  {issue.dtcs.map((d, i) => (
                    <li key={i} className="chip font-mono" title={d.date_read ? `Read ${formatDate(d.date_read)}` : undefined}>
                      {d.code} · {d.module} · {d.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {issue.status === 'Deferred' && issue.deferred_reason && (
              <p className="text-sm">
                <span className="section-title block">Deferred</span>
                {issue.deferred_reason}
              </p>
            )}
            {issue.status === 'Closed' && (
              <p className="text-sm" data-testid="closing-note">
                <span className="section-title block">
                  Closed {formatDate(issue.closed_date)}
                  {issue.closed_odo != null && ` · ${formatKm(issue.closed_odo)}`}
                </span>
                <span className="whitespace-pre-wrap">{issue.closing_note}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPrefill(null);
                  setStatusOpen(true);
                }}
              >
                Change status
              </button>
              <Link to={`/defects/${issue.id}/edit`} className="btn">
                Edit
              </Link>
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          </div>
          <div className="card p-4 space-y-3">
            <PhotoPicker label={`Photos of this ${noun}`} onPicked={(p) => addPhotos('issue', issue.id, p)} />
            <PhotoGrid photos={issuePhotos} onDelete={(p) => deletePhoto(p.id)} />
          </div>
        </section>

        <section aria-label="Steps" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title">Steps ({steps.length})</h2>
            <div className="flex gap-2">
              {steps.length > 1 && (
                <button type="button" className="btn btn-ghost" onClick={() => setNewestFirst((v) => !v)}>
                  {newestFirst ? 'Newest first' : 'Oldest first'}
                </button>
              )}
              <Link to={`/defects/${issue.id}/steps/new`} className="btn btn-primary">
                <IconPlus className="size-5" /> Add step
              </Link>
            </div>
          </div>
          {steps.length === 0 ? (
            <EmptyState title="No steps yet">Add troubleshooting, observations, parts orders and the fix as steps.</EmptyState>
          ) : (
            <ol className="space-y-3" data-testid="step-timeline">
              {sortSteps(steps, newestFirst).map((s) => (
                <StepCard
                  key={s.id}
                  step={s}
                  issueId={issue.id}
                  vendor={vendorName(s.vendor_id)}
                  lines={byStep.lines.get(s.id) ?? []}
                  photos={byStep.photos.get(s.id) ?? []}
                />
              ))}
            </ol>
          )}
          <div className="card p-4" data-testid="cost-totals">
            <h2 className="section-title mb-1">Total cost</h2>
            {totals.length === 0 ? (
              <p className="muted text-sm">No costs recorded.</p>
            ) : (
              <ul className="space-y-0.5">
                {totals.map((t) => (
                  <li key={t.currency} className="font-semibold tabular-nums">
                    {formatMoney(t.amount, t.currency)}
                  </li>
                ))}
              </ul>
            )}
            {totals.length > 1 && <p className="muted text-xs mt-1">Shown per currency; amounts in different currencies are never added together.</p>}
          </div>
        </section>
      </div>
      <StatusDialog issue={issue} open={statusOpen} onOpenChange={setStatusOpen} prefill={prefill} currentOdo={currentOdo} />
    </Page>
  );
}

function Meta({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="muted text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function StepCard({ step, issueId, vendor, lines, photos }: { step: Step; issueId: string; vendor?: string; lines: PartLine[]; photos: Photo[] }) {
  const totals = totalsByCurrency(lines);
  return (
    <li className="card p-4 space-y-2" data-testid="step-card">
      <div className="flex items-start gap-2 text-sm">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="chip">{step.step_type}</span>
          <span>{formatDate(step.date)}</span>
          {step.odo != null && <span className="muted">{formatKm(step.odo)}</span>}
          {vendor && <span className="muted">· {vendor}</span>}
          {step.outcome && <span className={`chip ${step.outcome === 'Fixed' ? 'border-emerald-500' : ''}`}>{step.outcome}</span>}
          {step.severe_use && <span className="chip">Track / high oil temp</span>}
        </div>
        <Link
          to={`/defects/${issueId}/steps/${step.id}`}
          className="btn btn-ghost -my-2 -mr-2 px-2 text-sm"
          aria-label={`Edit step from ${formatDate(step.date)}`}
        >
          Edit
        </Link>
      </div>
      <p className="whitespace-pre-wrap">{step.details}</p>
      {step.comments && <p className="muted whitespace-pre-wrap text-sm">💬 {step.comments}</p>}
      {lines.length > 0 && (
        <ul className="text-sm divide-y" style={{ borderColor: 'var(--border)' }}>
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-x-3 py-1">
              <span>
                {l.qty !== 1 && `${l.qty} × `}
                {l.part_name}
                {l.part_number && <span className="muted font-mono"> {l.part_number}</span>}
                {l.brand && <span className="muted"> · {l.brand}</span>}
                {l.position && <span className="muted"> · {l.position}</span>}
                <span className="muted"> · {l.fitted ? 'Fitted' : l.order_status}</span>
              </span>
              {l.cost != null && <span className="tabular-nums">{formatMoney(l.cost * l.qty, l.currency)}</span>}
            </li>
          ))}
        </ul>
      )}
      {totals.length > 1 && <p className="muted text-xs">Step total: {totals.map((t) => formatMoney(t.amount, t.currency)).join(' + ')}</p>}
      <PhotoGrid photos={photos} size="sm" />
    </li>
  );
}
