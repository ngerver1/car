import { useEffect, useState } from 'react';
import { changeStatus } from '@/db/actions';
import { todayISO } from '@/domain/dates';
import { statusChangeError, type StatusChange } from '@/domain/issues';
import { STATUSES, type Issue, type Status } from '@/domain/schemas';
import { Sheet } from '@/ui/dialog';
import { DateField, NumberField, parseIntOrNull, TextArea, ToggleGroup } from '@/ui/fields';

export interface StatusPrefill {
  status: Status;
  note?: string;
  date?: string;
  odo?: number | null;
}

export function StatusDialog(props: {
  issue: Issue;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefill?: StatusPrefill | null;
  currentOdo: number | null;
}) {
  const { issue } = props;
  const [status, setStatus] = useState<Status>(issue.status);
  const [reason, setReason] = useState(issue.deferred_reason);
  const [note, setNote] = useState(issue.closing_note);
  const [date, setDate] = useState(todayISO());
  const [odo, setOdo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const p = props.prefill;
    setStatus(p?.status ?? issue.status);
    setReason(issue.deferred_reason);
    setNote(p?.note ?? issue.closing_note);
    setDate(p?.date ?? todayISO());
    setOdo((p?.odo ?? props.currentOdo)?.toString() ?? '');
    setError(null);
  }, [props.open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const km = parseIntOrNull(odo);
    const change: StatusChange = status === 'Deferred' ? { status, reason, date, odo: km } : status === 'Closed' ? { status, note, date, odo: km } : { status };
    const err = statusChangeError(change);
    if (err) return setError(err);
    await changeStatus(issue.id, change);
    props.onOpenChange(false);
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title="Change status">
      <div className="space-y-4">
        <ToggleGroup label="Status" options={STATUSES} value={[status]} onChange={(v) => v[0] && setStatus(v[0])} />
        {status === 'Deferred' && <TextArea label="Reason for deferring" value={reason} onChange={setReason} rows={3} error={error} />}
        {status === 'Closed' && <TextArea label="Closing note" value={note} onChange={setNote} rows={4} error={error} />}
        {(status === 'Deferred' || status === 'Closed') && (
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Date" value={date} onChange={setDate} />
            <NumberField label="Odometer" value={odo} onChange={setOdo} suffix="km" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => props.onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Save status
          </button>
        </div>
      </div>
    </Sheet>
  );
}
