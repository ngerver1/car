import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, live } from '@/db/repo';
import { useChapterLookup } from '@/lib/hooks';
import { ChapterChip } from '@/ui/badges';
import { Page } from '@/ui/Layout';

function interval(km: number | null, months: number | null) {
  const parts = [km != null && `${km.toLocaleString('en-AU')} km`, months != null && `${months} months`].filter(Boolean);
  return parts.length ? parts.join(' or ') : null;
}

export function ServicePage() {
  const items = useLiveQuery(async () => live(await getDb().serviceItems.orderBy('sort').toArray()));
  const chapters = useChapterLookup();
  return (
    <Page title="Service">
      <p className="muted mb-4 text-sm">Service records, due calculation and interval editing arrive in milestone 4. The seeded schedule is shown below.</p>
      <ul className="space-y-2" data-testid="service-items">
        {(items ?? []).map((i) => {
          const current = interval(i.interval_km, i.interval_months);
          const seed = interval(i.seed_km, i.seed_months);
          const overridden = current !== seed;
          return (
            <li key={i.id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.name}</span>
                <ChapterChip group={chapters.group(i.group_code)} section={chapters.section(i.section_code)} />
              </div>
              <p className="mt-1 text-sm">
                {current ? (
                  <>
                    Every <strong>{current}</strong>, whichever first{overridden && <span className="chip ml-2">Owner override</span>}
                  </>
                ) : (
                  <span className="chip border-amber-500">Set interval</span>
                )}
              </p>
              <p className="muted mt-1 text-xs">
                Seed: {seed ?? 'blank'} — {i.seed_source}
                {i.seed_source_url && (
                  <>
                    {' '}
                    (
                    <a className="underline" href={i.seed_source_url} target="_blank" rel="noreferrer">
                      source
                    </a>
                    )
                  </>
                )}
              </p>
              {i.spec && <p className="muted text-xs">Spec: {i.spec}</p>}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
