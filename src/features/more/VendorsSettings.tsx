import { useState } from 'react';
import { create, remove, update } from '@/db/repo';
import { VENDOR_KINDS, type Vendor } from '@/domain/schemas';
import { useVendors } from '@/lib/hooks';
import { Sheet, useConfirm } from '@/ui/dialog';
import { SelectField, TextArea, TextField } from '@/ui/fields';
import { IconPlus } from '@/ui/icons';
import { Page } from '@/ui/Layout';

type Draft = Pick<Vendor, 'name' | 'kind' | 'phone' | 'email' | 'address' | 'notes' | 'review_flag'>;
const blank: Draft = { name: '', kind: 'Workshop', phone: '', email: '', address: '', notes: '', review_flag: '' };

export function VendorsSettings() {
  const vendors = useVendors() ?? [];
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id: string | null; d: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    if (!editing.d.name.trim()) return setError('Name is required');
    if (editing.id) await update('vendors', editing.id, editing.d);
    else await create('vendors', editing.d);
    setEditing(null);
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => editing && setEditing({ ...editing, d: { ...editing.d, [k]: v } });

  return (
    <Page
      title="Vendors"
      back="/more"
      wide={false}
      actions={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setError(null);
            setEditing({ id: null, d: blank });
          }}
        >
          <IconPlus className="size-5" /> Add vendor
        </button>
      }
    >
      <ul className="space-y-2">
        {vendors.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className="card w-full p-3 text-left"
              onClick={() => {
                setError(null);
                setEditing({
                  id: v.id,
                  d: { name: v.name, kind: v.kind, phone: v.phone, email: v.email, address: v.address, notes: v.notes, review_flag: v.review_flag },
                });
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{v.name}</span>
                <span className="chip">{v.kind}</span>
                {v.review_flag && <span className="chip border-amber-500">Review</span>}
              </div>
              {v.review_flag && <p className="muted mt-1 text-sm">{v.review_flag}</p>}
              {(v.phone || v.email) && <p className="muted text-sm">{[v.phone, v.email].filter(Boolean).join(' · ')}</p>}
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? 'Edit vendor' : 'Add vendor'}>
        {editing && (
          <div className="space-y-3">
            <TextField label="Name" value={editing.d.name} onChange={(v) => set('name', v)} error={error} />
            <SelectField
              label="Kind"
              value={editing.d.kind}
              onChange={(v) => set('kind', v as Vendor['kind'])}
              options={VENDOR_KINDS.map((k) => ({ value: k, label: k }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Phone" type="tel" value={editing.d.phone} onChange={(v) => set('phone', v)} />
              <TextField label="Email" type="email" value={editing.d.email} onChange={(v) => set('email', v)} />
            </div>
            <TextField label="Address" value={editing.d.address} onChange={(v) => set('address', v)} />
            <TextArea label="Notes" value={editing.d.notes} onChange={(v) => set('notes', v)} rows={2} />
            {editing.d.review_flag && (
              <div className="card p-3 text-sm">
                <p className="section-title">Needs review</p>
                <p>{editing.d.review_flag}</p>
                <button type="button" className="btn btn-ghost mt-1 px-0" onClick={() => set('review_flag', '')}>
                  Mark reviewed
                </button>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {editing.id && (
                <button
                  type="button"
                  className="btn btn-danger mr-auto"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Delete ${editing.d.name}?`,
                        message: 'Records that used this vendor keep their history but show no vendor.',
                        confirmLabel: 'Delete',
                        danger: true,
                      })
                    ) {
                      await remove('vendors', editing.id!);
                      setEditing(null);
                    }
                  }}
                >
                  Delete
                </button>
              )}
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                Save
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  );
}
