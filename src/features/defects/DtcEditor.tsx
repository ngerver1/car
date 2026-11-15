import { DTC_MODULES, DTC_STATUSES, type Dtc } from '@/domain/schemas';
import { DateField, SelectField, TextField } from '@/ui/fields';
import { IconPlus, IconTrash } from '@/ui/icons';

export type DtcDraft = { code: string; module: Dtc['module']; status: Dtc['status']; date_read: string };

export function DtcEditor(props: { value: DtcDraft[]; onChange: (v: DtcDraft[]) => void; errors: (string | null)[]; today: string }) {
  const set = (i: number, patch: Partial<DtcDraft>) => props.onChange(props.value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div className="space-y-3">
      {props.value.map((d, i) => (
        <div key={i} className="card p-3" data-testid="dtc-row">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TextField
              label="Code"
              value={d.code}
              onChange={(v) => set(i, { code: v.toUpperCase() })}
              placeholder="P0300"
              maxLength={5}
              error={props.errors[i]}
            />
            <SelectField
              label="Module"
              value={d.module}
              onChange={(v) => set(i, { module: v as Dtc['module'] })}
              options={DTC_MODULES.map((m) => ({ value: m, label: m }))}
            />
            <SelectField
              label="Status"
              value={d.status}
              onChange={(v) => set(i, { status: v as Dtc['status'] })}
              options={DTC_STATUSES.map((m) => ({ value: m, label: m }))}
            />
            <DateField label="Date read" value={d.date_read} onChange={(v) => set(i, { date_read: v })} />
          </div>
          <button type="button" className="btn btn-ghost btn-danger mt-2 px-2" onClick={() => props.onChange(props.value.filter((_, j) => j !== i))}>
            <IconTrash className="size-4" /> Remove DTC
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => props.onChange([...props.value, { code: '', module: 'ECM', status: 'Current', date_read: props.today }])}
      >
        <IconPlus className="size-5" /> Add DTC
      </button>
    </div>
  );
}
