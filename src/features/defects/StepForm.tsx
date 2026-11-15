import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addPhotos, deletePhoto, deleteStep, saveStep, type PartLineFields, type ProcessedPhoto, type StepFields } from '@/db/actions';
import { getDb, live } from '@/db/repo';
import { todayISO } from '@/domain/dates';
import { issueRef } from '@/domain/issues';
import { odometerWarning } from '@/domain/odometer';
import { OUTCOMES, STEP_TYPES, type Issue, type PartLine, type Step } from '@/domain/schemas';
import { useCurrentOdo, useDraft, useOdometerReadings, useSettings } from '@/lib/hooks';
import { useConfirm } from '@/ui/dialog';
import { Checkbox, DateField, NumberField, parseDecimalOrNull, parseIntOrNull, SelectField, TextArea } from '@/ui/fields';
import { Page } from '@/ui/Layout';
import { PendingPhotos, PhotoGrid, PhotoPicker, usePhotos } from '@/ui/photos';
import { PartLinesEditor, partLineToDraft, type PartLineDraft } from './PartLinesEditor';
import { VendorSelect } from './VendorSelect';

interface Draft {
  date: string;
  odo: string;
  step_type: Step['step_type'];
  vendor_id: string | null;
  details: string;
  outcome: string;
  comments: string;
  severe_use: boolean;
  lines: PartLineDraft[];
}

export interface ClosePrefill {
  note: string;
  date: string;
  odo: number | null;
}

export function StepFormPage() {
  const { id, stepId } = useParams();
  const currentOdo = useCurrentOdo();
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const issue = id ? await db.issues.get(id) : undefined;
    const step = stepId ? await db.steps.get(stepId) : undefined;
    const lines = stepId ? live(await db.partLines.where('parent_id').equals(stepId).toArray()).sort((a, b) => a.sort - b.sort) : [];
    return { issue: issue ?? null, step: step ?? null, lines };
  }, [id, stepId]);
  if (!data || currentOdo === undefined || !settings)
    return (
      <Page title="Loading…" back>
        {null}
      </Page>
    );
  if (!data.issue || (stepId && !data.step))
    return (
      <Page title="Not found" back>
        This record does not exist.
      </Page>
    );
  const { issue, step, lines } = data;
  const initial = (): Draft =>
    step
      ? {
          date: step.date,
          odo: step.odo?.toString() ?? '',
          step_type: step.step_type,
          vendor_id: step.vendor_id,
          details: step.details,
          outcome: step.outcome ?? '',
          comments: step.comments,
          severe_use: step.severe_use,
          lines: lines.map(partLineToDraft),
        }
      : {
          date: todayISO(),
          odo: currentOdo?.toString() ?? '',
          step_type: 'Troubleshooting',
          vendor_id: null,
          details: '',
          outcome: '',
          comments: '',
          severe_use: false,
          lines: [],
        };
  return (
    <StepForm
      key={stepId ?? 'new'}
      issue={issue}
      step={step}
      draftKey={stepId ? `step:${stepId}` : `step:new:${issue.id}`}
      initial={initial}
      defaultCurrency={settings.default_currency}
    />
  );
}

function StepForm({
  issue,
  step,
  draftKey,
  initial,
  defaultCurrency,
}: {
  issue: Issue;
  step: Step | null;
  draftKey: string;
  initial: () => Draft;
  defaultCurrency: string;
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const readings = useOdometerReadings() ?? [];
  const savedPhotos = usePhotos(step?.id) ?? [];
  const { value: d, setValue, clear, restored } = useDraft<Draft>(draftKey, initial);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<number, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setValue((p) => ({ ...p, [k]: v }));

  function validate(): { fields: StepFields; lines: PartLineFields[] } | null {
    const e: Record<string, string> = {};
    if (!d.date) e.date = 'Date is required';
    if (!d.details.trim()) e.details = 'Details are required';
    const odo = parseIntOrNull(d.odo);
    if (d.odo.trim() && odo == null) e.odo = 'Enter whole km';
    const le: Record<number, Record<string, string>> = {};
    const lines: PartLineFields[] = d.lines.map((l, i) => {
      const errs: Record<string, string> = {};
      if (!l.part_name.trim()) errs.part_name = 'Part name is required';
      const qty = parseDecimalOrNull(l.qty);
      if (qty == null || qty <= 0) errs.qty = 'Qty > 0';
      const cost = parseDecimalOrNull(l.cost);
      if (l.cost.trim() && (cost == null || cost < 0)) errs.cost = 'Invalid cost';
      if (Object.keys(errs).length) le[i] = errs;
      return {
        id: l.id,
        part_name: l.part_name.trim(),
        part_number: l.part_number.trim(),
        brand: l.brand.trim(),
        qty: qty ?? 1,
        cost,
        currency: l.currency,
        order_status: l.order_status as PartLine['order_status'],
        fitted: l.fitted,
        position: l.position.trim(),
      };
    });
    setErrors(e);
    setLineErrors(le);
    if (Object.keys(e).length || Object.keys(le).length) return null;
    return {
      fields: {
        date: d.date,
        odo,
        step_type: d.step_type,
        vendor_id: d.vendor_id,
        details: d.details.trim(),
        comments: d.comments,
        outcome: (d.outcome || null) as Step['outcome'],
        severe_use: d.severe_use,
        legacy_entry_no: step?.legacy_entry_no ?? null,
      },
      lines,
    };
  }

  async function save() {
    const v = validate();
    if (!v) {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center' });
      return;
    }
    const warn = odometerWarning(readings, v.fields.date, v.fields.odo, step?.id);
    if (warn && !(await confirm({ title: 'Odometer lower than before', message: `${warn} Save anyway?`, confirmLabel: 'Save anyway' }))) return;
    setSaving(true);
    try {
      await saveStep(issue.id, step?.id ?? null, v.fields, v.lines, photos);
      clear();
      const wasFixed = v.fields.outcome === 'Fixed' && step?.outcome !== 'Fixed';
      if (wasFixed && issue.status !== 'Closed') {
        const noun = issue.kind === 'job' ? 'job' : 'defect';
        const yes = await confirm({
          title: `Close this ${noun}?`,
          message: `The outcome is Fixed. Close ${issueRef(issue)} with this step's details as the closing note?`,
          confirmLabel: `Close ${noun}`,
          cancelLabel: 'Not yet',
        });
        if (yes) {
          const prefill: ClosePrefill = { note: v.fields.details, date: v.fields.date, odo: v.fields.odo };
          navigate(`/defects/${issue.id}`, { replace: true, state: { closePrefill: prefill } });
          return;
        }
      }
      navigate(`/defects/${issue.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!step) return;
    if (!(await confirm({ title: 'Delete this step?', message: 'Its part lines and photos are deleted too.', confirmLabel: 'Delete', danger: true }))) return;
    await deleteStep(step.id);
    clear();
    navigate(`/defects/${issue.id}`, { replace: true });
  }

  return (
    <Page title={`${step ? 'Edit step' : 'Add step'} · ${issueRef(issue)}`} back wide={false}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {restored && (
          <p className="chip" role="status">
            Draft restored
          </p>
        )}
        <p className="muted text-sm">{issue.title}</p>
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Date" value={d.date} onChange={(v) => set('date', v)} error={errors.date} />
          <NumberField label="Odometer" value={d.odo} onChange={(v) => set('odo', v)} suffix="km" error={errors.odo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Step type"
            value={d.step_type}
            onChange={(v) => set('step_type', v as Step['step_type'])}
            options={STEP_TYPES.map((s) => ({ value: s, label: s }))}
          />
          <VendorSelect label="Vendor" value={d.vendor_id} onChange={(v) => set('vendor_id', v)} />
        </div>
        <TextArea label="Details" value={d.details} onChange={(v) => set('details', v)} rows={4} error={errors.details} />
        <SelectField
          label="Outcome"
          value={d.outcome}
          placeholder="None"
          onChange={(v) => set('outcome', v)}
          options={OUTCOMES.map((s) => ({ value: s, label: s }))}
        />
        <TextArea label="Comments" value={d.comments} onChange={(v) => set('comments', v)} rows={2} />
        <Checkbox label="Track / high oil temp (uses severe-use service intervals)" checked={d.severe_use} onChange={(v) => set('severe_use', v)} />

        <div>
          <h2 className="section-title mb-2">Parts</h2>
          <PartLinesEditor value={d.lines} onChange={(v) => set('lines', v)} defaultCurrency={defaultCurrency} errors={lineErrors} />
        </div>

        <div className="space-y-3">
          <PhotoPicker onPicked={async (p) => (step ? addPhotos('step', step.id, p) : setPhotos((x) => [...x, ...p]))} />
          <PendingPhotos photos={photos} onRemove={(i) => setPhotos((x) => x.filter((_, j) => j !== i))} />
          {step && <PhotoGrid photos={savedPhotos} onDelete={(p) => deletePhoto(p.id)} />}
        </div>

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-4 flex flex-wrap justify-end gap-2 pt-2">
          {step && (
            <button type="button" className="btn btn-danger mr-auto" onClick={onDelete}>
              Delete step
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              clear();
              navigate(-1);
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Save step
          </button>
        </div>
      </form>
    </Page>
  );
}
