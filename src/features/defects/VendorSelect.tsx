import { useState } from 'react';
import { create } from '@/db/repo';
import { VENDOR_KINDS, type Vendor } from '@/domain/schemas';
import { useVendors } from '@/lib/hooks';
import { Sheet } from '@/ui/dialog';
import { SelectField, TextField } from '@/ui/fields';

const ADD = '__add__';

/** Vendor picker with an inline "Add vendor…" sheet. */
export function VendorSelect(props: { label: string; value: string | null; onChange: (id: string | null) => void }) {
  const vendors = useVendors() ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Vendor['kind']>('Workshop');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError('Name is required');
    const v = await create('vendors', { name: name.trim(), kind, phone: '', email: '', address: '', notes: '', review_flag: '' });
    props.onChange(v.id);
    setAdding(false);
    setName('');
    setError(null);
  }

  return (
    <>
      <SelectField
        label={props.label}
        value={props.value ?? ''}
        placeholder="None"
        options={[...vendors.map((v) => ({ value: v.id, label: v.review_flag ? `${v.name} (review)` : v.name })), { value: ADD, label: '+ Add vendor…' }]}
        onChange={(v) => (v === ADD ? setAdding(true) : props.onChange(v || null))}
      />
      <Sheet open={adding} onOpenChange={setAdding} title="Add vendor">
        <div className="space-y-3">
          <TextField label="Name" value={name} onChange={setName} error={error} maxLength={80} />
          <SelectField label="Kind" value={kind} onChange={(v) => setKind(v as Vendor['kind'])} options={VENDOR_KINDS.map((k) => ({ value: k, label: k }))} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              Add vendor
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
