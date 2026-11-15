import { useState } from 'react';
import { update } from '@/db/repo';
import type { Group, Section } from '@/domain/schemas';
import { useGroups, useSections } from '@/lib/hooks';
import { Sheet } from '@/ui/dialog';
import { NumberField, parseIntOrNull, TextField } from '@/ui/fields';
import { Page } from '@/ui/Layout';

type Target = { table: 'groups'; row: Group } | { table: 'sections'; row: Section };

export function GroupsSettings() {
  const groups = useGroups() ?? [];
  const sections = useSections() ?? [];
  const [target, setTarget] = useState<Target | null>(null);
  const [link, setLink] = useState('');
  const [page, setPage] = useState('');

  const open = (t: Target) => {
    setTarget(t);
    setLink(t.row.esm_link);
    setPage(t.row.esm_page?.toString() ?? '');
  };
  async function save() {
    if (!target) return;
    await update(target.table, target.row.id, { esm_link: link.trim(), esm_page: parseIntOrNull(page) });
    setTarget(null);
  }
  const esmGroups = groups.filter((g) => g.source !== 'owner');
  const others = groups.filter((g) => g.source === 'owner');

  return (
    <Page title="Groups & sections" back="/more" wide={false}>
      <p className="muted mb-4 text-sm">
        From the Quick Reference Index of Nissan ESM SM13E00-1R35E0E (2013 European edition). Names are as printed. Tap a row to store a link to your own copy
        of the ESM (file path or URL, plus a page). The app never stores ESM content.
      </p>
      <p className="muted mb-4 text-sm" data-testid="group-counts">
        {esmGroups.length} ESM groups · {sections.length} sections
      </p>
      <div className="space-y-3">
        {[...esmGroups, ...others].map((g) => (
          <section key={g.id} className="card overflow-hidden" data-testid="group-card">
            <button type="button" className="flex w-full items-center gap-2 p-3 text-left" onClick={() => open({ table: 'groups', row: g })}>
              <span className="font-mono font-semibold">{g.code}</span>
              <span className="flex-1 font-medium">{g.name}</span>
              {!g.active && <span className="chip">Legacy · inactive</span>}
              {g.esm_link && <span className="chip">ESM link</span>}
            </button>
            {g.legacy_note && <p className="muted px-3 pb-3 text-sm">{g.legacy_note}</p>}
            {sections.filter((s) => s.group_code === g.code).length > 0 && (
              <ul className="border-t" style={{ borderColor: 'var(--border)' }}>
                {sections
                  .filter((s) => s.group_code === g.code)
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 min-h-11 text-left text-sm"
                        onClick={() => open({ table: 'sections', row: s })}
                      >
                        <span className="w-10 font-mono">{s.code}</span>
                        <span className="flex-1">{s.name}</span>
                        {s.esm_link && <span className="chip">p.{s.esm_page ?? '–'}</span>}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <Sheet
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? `${target.row.code} · ${target.row.name}` : ''}
        description="Link to your copy of the ESM. Chapter chips open it."
      >
        <div className="space-y-3">
          <TextField label="ESM link (URL or file path)" value={link} onChange={setLink} placeholder="file:///…/ESM/TM.pdf" />
          <NumberField label="Page" value={page} onChange={setPage} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              Save link
            </button>
          </div>
        </div>
      </Sheet>
    </Page>
  );
}
