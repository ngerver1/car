import { useEffect, useState } from 'react';
import { update } from '@/db/repo';
import type { Vehicle } from '@/domain/schemas';
import { useVehicle } from '@/lib/hooks';
import { DateField, NumberField, parseIntOrNull, TextArea, TextField } from '@/ui/fields';
import { Page } from '@/ui/Layout';

export function VehicleSettings() {
  const vehicle = useVehicle();
  const [d, setD] = useState<Vehicle | null>(null);
  const [odo, setOdo] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (vehicle && !d) {
      setD(vehicle);
      setOdo(String(vehicle.purchase_odo));
    }
  }, [vehicle, d]);
  if (!d)
    return (
      <Page title="Vehicle" back="/more">
        {null}
      </Page>
    );
  const set = <K extends keyof Vehicle>(k: K, v: Vehicle[K]) => {
    setSaved(false);
    setD({ ...d, [k]: v });
  };
  async function save() {
    if (!d) return;
    const { id, created_at, updated_at, updated_by_device, deleted, version, ...fields } = d;
    void created_at;
    void updated_at;
    void updated_by_device;
    void deleted;
    void version;
    await update('vehicle', id, { ...fields, purchase_odo: parseIntOrNull(odo) ?? d.purchase_odo });
    setSaved(true);
  }
  return (
    <Page title="Vehicle" back="/more" wide={false}>
      <div className="space-y-4">
        <TextField label="Nickname" value={d.nickname} onChange={(v) => set('nickname', v)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Model code" value={d.model_code} onChange={(v) => set('model_code', v)} />
          <TextField label="Registration" value={d.registration} onChange={(v) => set('registration', v)} />
        </div>
        <TextField label="VIN / chassis number" value={d.vin} onChange={(v) => set('vin', v.toUpperCase())} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Engine" value={d.engine} onChange={(v) => set('engine', v)} />
          <TextField label="ESM publication" value={d.esm_publication} onChange={(v) => set('esm_publication', v)} />
        </div>
        <TextField label="Transmission" value={d.transmission} onChange={(v) => set('transmission', v)} />
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Purchase date" value={d.purchase_date} onChange={(v) => set('purchase_date', v)} />
          <NumberField
            label="Purchase odometer"
            value={odo}
            onChange={(v) => {
              setSaved(false);
              setOdo(v);
            }}
            suffix="km"
          />
        </div>
        <TextArea label="Notes" value={d.notes} onChange={(v) => set('notes', v)} rows={4} />
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="muted text-sm" role="status">
              Saved
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={save}>
            Save vehicle
          </button>
        </div>
      </div>
    </Page>
  );
}
