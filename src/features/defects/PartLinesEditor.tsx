import { ORDER_STATUSES, type PartLine } from '@/domain/schemas';
import { Checkbox, NumberField, SelectField, TextField } from '@/ui/fields';
import { IconPlus, IconTrash } from '@/ui/icons';

export interface PartLineDraft {
  id?: string;
  part_name: string;
  part_number: string;
  brand: string;
  qty: string;
  cost: string;
  currency: string;
  order_status: PartLine['order_status'];
  fitted: boolean;
  position: string;
}

export const partLineToDraft = (l: PartLine): PartLineDraft => ({
  id: l.id,
  part_name: l.part_name,
  part_number: l.part_number,
  brand: l.brand,
  qty: String(l.qty),
  cost: l.cost == null ? '' : String(l.cost),
  currency: l.currency,
  order_status: l.order_status,
  fitted: l.fitted,
  position: l.position,
});

export const emptyPartLine = (currency: string): PartLineDraft => ({
  part_name: '',
  part_number: '',
  brand: '',
  qty: '1',
  cost: '',
  currency,
  order_status: 'Ordered',
  fitted: false,
  position: '',
});

const COMMON_CURRENCIES = ['AUD', 'JPY', 'USD', 'NZD', 'GBP', 'EUR'];

export function PartLinesEditor(props: {
  value: PartLineDraft[];
  onChange: (v: PartLineDraft[]) => void;
  defaultCurrency: string;
  errors: Record<number, Record<string, string>>;
}) {
  const set = (i: number, patch: Partial<PartLineDraft>) => props.onChange(props.value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-3">
      {props.value.map((l, i) => {
        const e = props.errors[i] ?? {};
        const currencies = COMMON_CURRENCIES.includes(l.currency) ? COMMON_CURRENCIES : [l.currency, ...COMMON_CURRENCIES];
        return (
          <fieldset key={l.id ?? `new-${i}`} className="card p-3 space-y-3" data-testid="part-line">
            <legend className="section-title px-1">Part {i + 1}</legend>
            <TextField label="Part name" value={l.part_name} onChange={(v) => set(i, { part_name: v })} error={e.part_name} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Part number" value={l.part_number} onChange={(v) => set(i, { part_number: v })} placeholder="01553-05933" />
              <TextField label="Brand" value={l.brand} onChange={(v) => set(i, { brand: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Qty" value={l.qty} onChange={(v) => set(i, { qty: v })} decimal error={e.qty} />
              <NumberField label="Cost (each)" value={l.cost} onChange={(v) => set(i, { cost: v })} decimal error={e.cost} />
              <SelectField
                label="Currency"
                value={l.currency}
                onChange={(v) => set(i, { currency: v })}
                options={currencies.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Order status"
                value={l.order_status}
                onChange={(v) => set(i, { order_status: v as PartLine['order_status'], fitted: v === 'Fitted' ? true : l.fitted })}
                options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
              />
              <TextField label="Position" value={l.position} onChange={(v) => set(i, { position: v })} placeholder="LF, RR, Both" />
            </div>
            <div className="flex items-center justify-between">
              <Checkbox
                label="Fitted to car"
                checked={l.fitted}
                onChange={(v) => set(i, { fitted: v, order_status: v ? 'Fitted' : l.order_status === 'Fitted' ? 'Received' : l.order_status })}
              />
              <button type="button" className="btn btn-ghost btn-danger px-2" onClick={() => props.onChange(props.value.filter((_, j) => j !== i))}>
                <IconTrash className="size-4" /> Remove
              </button>
            </div>
          </fieldset>
        );
      })}
      <button type="button" className="btn" onClick={() => props.onChange([...props.value, emptyPartLine(props.defaultCurrency)])}>
        <IconPlus className="size-5" /> Add part
      </button>
    </div>
  );
}
