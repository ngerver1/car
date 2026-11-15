import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ensureDevice } from '@/db/repo';
import { App } from './App';
import './index.css';

async function requestPersistentStorage() {
  // Without persistent storage, iOS Safari may evict IndexedDB. The result is shown in Settings.
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      const granted = already || (await navigator.storage.persist());
      localStorage.setItem('storage-persisted', String(granted));
    }
  } catch {
    /* ignore */
  }
}

void requestPersistentStorage();
void ensureDevice().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
