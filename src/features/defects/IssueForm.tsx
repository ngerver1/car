import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createIssue, updateIssue, type IssueFields, type ProcessedPhoto } from '@/db/actions';
import { getDb } from '@/db/repo';
import { todayISO } from '@/domain/dates';
import { issueRef } from '@/domain/issues';
import { odometerWarning } from '@/domain/odometer';
import { dtcSchema, HOW_FOUND, SEVERITIES, type Issue, type IssueKind } from '@/domain/schemas';
import { useCurrentOdo, useDraft, useOdometerReadings } from '@/lib/hooks';
import { useConfirm } from '@/ui/dialog';
import { DateField, NumberField, parseIntOrNull, SelectField, TextArea, TextField } from '@/ui/fields';
import { Page } from '@/ui/Layout';
import { PendingPhotos, PhotoPicker } from '@/ui/photos';
import { ChapterSelect } from './ChapterSelect';
import { DtcEditor, type DtcDraft } from './DtcEditor';
import { draftToSymptom, SymptomEditor, symptomToDraft, type SymptomDraft } from './SymptomEditor';
import { VendorSelect } from './VendorSelect';

interface Draft {
  kind: IssueKind;
  title: string;
  date_identified: string;
  odo: string;
  group_code: string;
  section_code: string | null;
  severity: string;
  how_found: string;
  found_by_vendor_id: string | null;
  description: string;
  symptom: SymptomDraft;
  symptomsOpen: boolean;
  dtcs: DtcDraft[];
}

function toDraft(issue: Issue): Draft {
  return {
    kind: issue.kind,
    title: issue.title,
    date_identified: issue.date_identified,
    odo: issue.odo_identified?.toString() ?? '',
    group_code: issue.group_code,
    section_code: issue.section_code,
    severity: issue.severity ?? '',
    how_found: issue.how_found ?? '',
    found_by_vendor_id: issue.found_by_vendor_id,
    description: issue.description,
    symptom: symptomToDraft(issue.symptom),
    symptomsOpen: !!issue.symptom,
    dtcs: issue.dtcs.map((d) => ({ ...d, date_read: d.date_read ?? '' })),
  };
}

export function IssueFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const currentOdo = useCurrentOdo();
  const existing = useLiveQuery(async () => (id ? ((await getDb().issues.get(id)) ?? null) : null), [id]);
  if (currentOdo === undefined || existing === undefined)
    return (
      <Page title="Loading…" back>
        {null}
      </Page>
    );
  if (id && !existing)
    return (
      <Page title="Not found" back>
        This record does not exist.
      </Page>
    );
  const kind: IssueKind = existing?.kind ?? (params.get('kind') === 'job' ? 'job' : 'defect');
  const initial = (): Draft =>
    existing
      ? toDraft(existing)
      : {
          kind,
          title: '',
          date_identified: todayISO(),
          odo: currentOdo?.toString() ?? '',
          group_code: '',
          section_code: null,
          severity: '',
          how_found: '',
          found_by_vendor_id: null,
          description: '',
          symptom: symptomToDraft(null),
          symptomsOpen: false,
          dtcs: [],
        };
  return <IssueForm key={id ?? kind} existing={existing} draftKey={id ? `issue:${id}` : `issue:new:${kind}`} initial={initial} />;
}

function IssueForm({ existing, draftKey, initial }: { existing: Issue | null; draftKey: string; initial: () => Draft }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const readings = useOdometerReadings() ?? [];
  const { value: d, setValue, clear, restored } = useDraft<Draft>(draftKey, initial);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dtcErrors, setDtcErrors] = useState<(string | null)[]>([]);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setValue((p) => ({ ...p, [k]: v }));
  const isDefect = d.kind === 'defect';
  const noun = isDefect ? 'defect' : 'job';

  function validate(): IssueFields | null {
    const e: Record<string, string> = {};
    if (!d.title.trim()) e.title = 'Title is required';
    else if (d.title.trim().length > 120) e.title = 'Keep the title to 120 characters';
    if (!d.date_identified) e.date_identified = 'Date is required';
    if (!d.group_code) e.group_code = 'Pick a group';
    if (isDefect && !d.severity) e.severity = 'Pick a severity';
    if (isDefect && !d.how_found) e.how_found = 'Pick how it was found';
    const odo = parseIntOrNull(d.odo);
    if (d.odo.trim() && odo == null) e.odo = 'Enter whole km';
    const dErrs = d.dtcs.map((x) => {
      const r = dtcSchema.safeParse({ ...x, date_read: x.date_read || null });
      return r.success ? null : r.error.issues[0].message;
    });
    setDtcErrors(dErrs);
    if (dErrs.some(Boolean)) e.dtcs = 'Fix the DTC rows';
    setErrors(e);
    if (Object.keys(e).length) return null;
    return {
      kind: d.kind,
      title: d.title.trim(),
      description: d.description,
      date_identified: d.date_identified,
      odo_identified: odo,
      group_code: d.group_code,
      section_code: d.section_code,
      severity: isDefect ? (d.severity as Issue['severity']) : null,
      status: existing?.status ?? 'Open',
      how_found: isDefect ? (d.how_found as Issue['how_found']) : null,
      found_by_vendor_id: isDefect ? d.found_by_vendor_id : null,
      symptom: isDefect ? draftToSymptom(d.symptom) : null,
      dtcs: isDefect ? d.dtcs.map((x) => dtcSchema.parse({ ...x, date_read: x.date_read || null })) : [],
      deferred_reason: existing?.deferred_reason ?? '',
      closed_date: existing?.closed_date ?? null,
      closed_odo: existing?.closed_odo ?? null,
      closing_note: existing?.closing_note ?? '',
      legacy_entry_no: existing?.legacy_entry_no ?? null,
    };
  }

  async function save() {
    const fields = validate();
    if (!fields) {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center' });
      return;
    }
    const warn = odometerWarning(readings, fields.date_identified, fields.odo_identified, existing?.id);
    if (warn && !(await confirm({ title: 'Odometer lower than before', message: `${warn} Save anyway?`, confirmLabel: 'Save anyway' }))) return;
    setSaving(true);
    try {
      const saved = existing ? await updateIssue(existing.id, fields) : await createIssue(fields, photos);
      clear();
      navigate(`/defects/${saved.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    clear();
    navigate(-1);
  }

  const title = existing ? `Edit ${issueRef(existing)}` : isDefect ? 'New defect' : 'New job';

  return (
    <Page title={title} back wide={false}>
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
        <TextField label="Title" value={d.title} onChange={(v) => set('title', v)} maxLength={120} error={errors.title} required />
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Date identified" value={d.date_identified} onChange={(v) => set('date_identified', v)} error={errors.date_identified} />
          <NumberField label="Odometer" value={d.odo} onChange={(v) => set('odo', v)} suffix="km" error={errors.odo} />
        </div>
        <ChapterSelect
          group={d.group_code}
          section={d.section_code}
          groupError={errors.group_code}
          onChange={(g, s) => setValue((p) => ({ ...p, group_code: g, section_code: s }))}
        />
        {isDefect && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Severity"
              value={d.severity}
              placeholder="Pick severity"
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => set('severity', v)}
              error={errors.severity}
            />
            <SelectField
              label="How found"
              value={d.how_found}
              placeholder="Pick one"
              options={HOW_FOUND.map((s) => ({ value: s, label: s }))}
              onChange={(v) => set('how_found', v)}
              error={errors.how_found}
            />
            <VendorSelect label="Found by (optional)" value={d.found_by_vendor_id} onChange={(v) => set('found_by_vendor_id', v)} />
          </div>
        )}
        <TextArea label="Description" value={d.description} onChange={(v) => set('description', v)} rows={4} />

        {isDefect && (
          <>
            <details className="card p-3" open={d.symptomsOpen} onToggle={(e) => set('symptomsOpen', (e.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer min-h-11 flex items-center font-medium">Symptom conditions</summary>
              <div className="pt-3">
                <SymptomEditor value={d.symptom} onChange={(v) => set('symptom', v)} />
              </div>
            </details>
            <div>
              <h2 className="section-title mb-2">DTCs</h2>
              <DtcEditor value={d.dtcs} onChange={(v) => set('dtcs', v)} errors={dtcErrors} today={todayISO()} />
              {errors.dtcs && <p className="error">{errors.dtcs}</p>}
            </div>
          </>
        )}

        {!existing && (
          <div>
            <PhotoPicker onPicked={(p) => setPhotos((x) => [...x, ...p])} />
            <PendingPhotos photos={photos} onRemove={(i) => setPhotos((x) => x.filter((_, j) => j !== i))} />
          </div>
        )}

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-4 flex justify-end gap-2 pt-2">
          <button type="button" className="btn" onClick={cancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {existing ? 'Save changes' : `Save ${noun}`}
          </button>
        </div>
      </form>
    </Page>
  );
}
