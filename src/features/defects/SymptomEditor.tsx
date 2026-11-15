import { ENGINE_STATES, FREQUENCIES, GEARS, LOADS, type Symptom } from '@/domain/schemas';
import { NumberField, TextArea, ToggleGroup } from '@/ui/fields';

/** Symptom block kept as text for number inputs while editing. */
export interface SymptomDraft {
  rpm_from: string;
  rpm_to: string;
  gears: Symptom['gears'];
  speed_from: string;
  speed_to: string;
  engine_state: Symptom['engine_state'];
  load: Symptom['load'];
  frequency: Symptom['frequency'];
  notes: string;
}

export const symptomToDraft = (s: Symptom | null): SymptomDraft => ({
  rpm_from: s?.rpm_from?.toString() ?? '',
  rpm_to: s?.rpm_to?.toString() ?? '',
  gears: s?.gears ?? [],
  speed_from: s?.speed_from?.toString() ?? '',
  speed_to: s?.speed_to?.toString() ?? '',
  engine_state: s?.engine_state ?? null,
  load: s?.load ?? [],
  frequency: s?.frequency ?? null,
  notes: s?.notes ?? '',
});

const int = (v: string) => (v.trim() ? Number.parseInt(v.replace(/,/g, ''), 10) : null);

export function draftToSymptom(d: SymptomDraft): Symptom | null {
  const s: Symptom = {
    rpm_from: int(d.rpm_from),
    rpm_to: int(d.rpm_to),
    gears: d.gears,
    speed_from: int(d.speed_from),
    speed_to: int(d.speed_to),
    engine_state: d.engine_state,
    load: d.load,
    frequency: d.frequency,
    notes: d.notes,
  };
  const empty =
    s.rpm_from == null &&
    s.rpm_to == null &&
    !s.gears.length &&
    s.speed_from == null &&
    s.speed_to == null &&
    !s.engine_state &&
    !s.load.length &&
    !s.frequency &&
    !s.notes.trim();
  return empty ? null : s;
}

export function SymptomEditor({ value, onChange }: { value: SymptomDraft; onChange: (v: SymptomDraft) => void }) {
  const set = <K extends keyof SymptomDraft>(k: K, v: SymptomDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="rpm from" value={value.rpm_from} onChange={(v) => set('rpm_from', v)} suffix="rpm" />
        <NumberField label="rpm to" value={value.rpm_to} onChange={(v) => set('rpm_to', v)} suffix="rpm" />
      </div>
      <ToggleGroup label="Gears" options={GEARS} value={value.gears} onChange={(v) => set('gears', v)} multi />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Speed from" value={value.speed_from} onChange={(v) => set('speed_from', v)} suffix="km/h" />
        <NumberField label="Speed to" value={value.speed_to} onChange={(v) => set('speed_to', v)} suffix="km/h" />
      </div>
      <ToggleGroup
        label="Engine state"
        options={ENGINE_STATES}
        value={value.engine_state ? [value.engine_state] : []}
        onChange={(v) => set('engine_state', v[0] ?? null)}
      />
      <ToggleGroup label="Load" options={LOADS} value={value.load} onChange={(v) => set('load', v)} multi />
      <ToggleGroup label="Frequency" options={FREQUENCIES} value={value.frequency ? [value.frequency] : []} onChange={(v) => set('frequency', v[0] ?? null)} />
      <TextArea label="Symptom notes" value={value.notes} onChange={(v) => set('notes', v)} rows={2} />
    </div>
  );
}
