import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { getDb, live } from '@/db/repo';
import { formatDate } from '@/domain/dates';
import { formatMoney } from '@/domain/format';
import { issueRef } from '@/domain/issues';
import { EmptyState, Page } from '@/ui/Layout';

export function PartsPage() {
  const onOrder = useLiveQuery(async () => {
    const db = getDb();
    const lines = live(await db.partLines.where('order_status').anyOf('Ordered', 'Received').toArray()).filter((l) => !l.fitted);
    const steps = new Map((await db.steps.bulkGet(lines.map((l) => l.parent_id))).filter(Boolean).map((s) => [s!.id, s!]));
    const issues = new Map((await db.issues.bulkGet([...steps.values()].map((s) => s.issue_id))).filter(Boolean).map((i) => [i!.id, i!]));
    return lines
      .map((l) => {
        const step = steps.get(l.parent_id);
        return { line: l, step, issue: step ? issues.get(step.issue_id) : undefined };
      })
      .filter((r) => !r.step?.deleted && !r.issue?.deleted);
  });
  return (
    <Page title="Parts">
      <section>
        <h2 className="section-title mb-2">Parts on order</h2>
        {onOrder && onOrder.length === 0 ? (
          <EmptyState title="Nothing on order">Part lines with order status Ordered or Received show here.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {(onOrder ?? []).map(({ line, step, issue }) => (
              <li key={line.id} className="card p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {line.qty !== 1 && `${line.qty} × `}
                    {line.part_name}
                  </span>
                  <span className="chip">{line.order_status}</span>
                </div>
                <p className="muted">
                  {[line.part_number, line.brand, line.position].filter(Boolean).join(' · ')}
                  {line.cost != null && ` · ${formatMoney(line.cost * line.qty, line.currency)}`}
                </p>
                {issue && step && (
                  <Link to={`/defects/${issue.id}`} className="underline">
                    {issueRef(issue)} · {formatDate(step.date)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6">
        <h2 className="section-title mb-2">Installed parts</h2>
        <EmptyState title="The installed parts register arrives in milestone 5">Part lines marked “Fitted” are already saved and will populate it.</EmptyState>
      </section>
    </Page>
  );
}
