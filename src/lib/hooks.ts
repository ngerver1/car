import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { getDb, live } from '@/db/repo';
import { currentOdometer } from '@/domain/odometer';
import type { Group, Section, Vendor } from '@/domain/schemas';

export function useVehicle() {
  return useLiveQuery(async () => (await getDb().vehicle.toArray()).find((v) => !v.deleted));
}
export function useSettings() {
  return useLiveQuery(async () => (await getDb().settings.toArray()).find((v) => !v.deleted));
}
export function useGroups(): Group[] | undefined {
  return useLiveQuery(async () => live(await getDb().groups.orderBy('sort').toArray()));
}
export function useSections(): Section[] | undefined {
  return useLiveQuery(async () => live(await getDb().sections.orderBy('sort').toArray()));
}
export function useVendors(): Vendor[] | undefined {
  return useLiveQuery(async () => live(await getDb().vendors.toArray()).sort((a, b) => a.name.localeCompare(b.name)));
}
export function useOdometerReadings() {
  return useLiveQuery(async () => live(await getDb().odometerReadings.toArray()));
}
export function useCurrentOdo(): number | null | undefined {
  const readings = useOdometerReadings();
  return readings === undefined ? undefined : (currentOdometer(readings)?.km ?? null);
}

export function useChapterLookup() {
  const groups = useGroups();
  const sections = useSections();
  return useMemo(() => {
    const g = new Map((groups ?? []).map((x) => [x.code, x]));
    const s = new Map((sections ?? []).map((x) => [x.code, x]));
    return { group: (c: string) => g.get(c), section: (c: string | null) => (c ? s.get(c) : undefined), ready: !!groups && !!sections };
  }, [groups, sections]);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Form state that saves to local storage as you type, so nothing is lost if the
 * app closes. Call clear() after a successful save or a cancel.
 */
export function useDraft<T>(key: string, initial: () => T) {
  const storageKey = `draft:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...initial(), ...JSON.parse(raw) } as T;
    } catch {
      /* storage unavailable: fall back to the initial value */
    }
    return initial();
  });
  const [restored] = useState(() => {
    try {
      return localStorage.getItem(storageKey) != null;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [storageKey, value]);
  const clear = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };
  return { value, setValue, clear, restored };
}

export function useObjectUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
