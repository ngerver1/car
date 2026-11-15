import { useEffect, useState } from 'react';
import { update } from '@/db/repo';
import { useSettings } from '@/lib/hooks';
import { NumberField, parseIntOrNull, TextField } from '@/ui/fields';
import { Page } from '@/ui/Layout';

function storageState(): 'granted' | 'refused' | 'unknown' {
  try {
    const v = localStorage.getItem('storage-persisted');
    return v === 'true' ? 'granted' : v === 'false' ? 'refused' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function GeneralSettings() {
  const settings = useSettings();
  const [km, setKm] = useState('');
  const [days, setDays] = useState('');
  const [currency, setCurrency] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<string | null>(null);
  const persisted = storageState();

  useEffect(() => {
    if (settings && !currency) {
      setKm(String(settings.due_soon_km));
      setDays(String(settings.due_soon_days));
      setCurrency(settings.default_currency);
    }
  }, [settings, currency]);
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage != null && setUsage(`${(e.usage / 1_048_576).toFixed(1)} MB used on this device`))
      .catch(() => {});
  }, []);

  async function save() {
    if (!settings) return;
    const c = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return setError('Use a 3-letter ISO code, e.g. AUD');
    setError(null);
    await update('settings', settings.id, {
      due_soon_km: parseIntOrNull(km) ?? settings.due_soon_km,
      due_soon_days: parseIntOrNull(days) ?? settings.due_soon_days,
      default_currency: c,
    });
    setSaved(true);
  }

  return (
    <Page title="Settings" back="/more" wide={false}>
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="section-title">Due soon</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Within"
              value={km}
              onChange={(v) => {
                setSaved(false);
                setKm(v);
              }}
              suffix="km"
            />
            <NumberField
              label="Or within"
              value={days}
              onChange={(v) => {
                setSaved(false);
                setDays(v);
              }}
              suffix="days"
            />
          </div>
          <TextField
            label="Default currency for new part lines"
            value={currency}
            onChange={(v) => {
              setSaved(false);
              setCurrency(v.toUpperCase());
            }}
            maxLength={3}
            error={error}
          />
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="muted text-sm" role="status">
                Saved
              </span>
            )}
            <button type="button" className="btn btn-primary" onClick={save}>
              Save settings
            </button>
          </div>
        </section>
        <section className="card p-4 space-y-1" data-testid="storage-status">
          <h2 className="section-title">Storage on this device</h2>
          {persisted === 'granted' && <p className="text-sm">Persistent storage is on: the browser will not clear your data to save space.</p>}
          {persisted === 'refused' && (
            <p className="text-sm" role="alert">
              ⚠️ The browser refused persistent storage, so it may clear this app's data when space runs low (iOS Safari does this). Add the app to your home
              screen, and keep cloud sync on once it's set up.
            </p>
          )}
          {persisted === 'unknown' && <p className="text-sm">This browser didn't report whether storage is persistent.</p>}
          {usage && <p className="muted text-sm">{usage}</p>}
        </section>
      </div>
    </Page>
  );
}
