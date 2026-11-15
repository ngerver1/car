import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '@/db/repo';
import { EmptyState, Page } from '@/ui/Layout';

export function SyncLog() {
  const outbox = useLiveQuery(() => getDb().outbox.orderBy('seq').reverse().limit(200).toArray());
  const total = useLiveQuery(() => getDb().outbox.count(), [], 0);
  return (
    <Page title="Sync log" back="/more" wide={false}>
      <div className="card mb-4 p-4 text-sm">
        <p>
          Cloud sync isn't set up yet (milestone 7). Everything is saved on this device. <strong>{total}</strong> changes are waiting and will upload once sync
          is on.
        </p>
      </div>
      {outbox && outbox.length === 0 ? (
        <EmptyState title="No changes waiting" />
      ) : (
        <ul className="card divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
          {(outbox ?? []).map((o) => (
            <li key={o.seq} className="flex justify-between gap-2 px-3 py-2" style={{ borderColor: 'var(--border)' }}>
              <span>
                <span className="font-mono">{o.record_table}</span> · {o.op} · v{o.version}
              </span>
              <span className="muted">{new Date(o.queued_at).toLocaleString('en-AU')}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
