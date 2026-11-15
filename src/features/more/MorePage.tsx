import { Link } from 'react-router-dom';
import { IconChevronR } from '@/ui/icons';
import { Page } from '@/ui/Layout';

const LINKS = [
  { to: '/more/vehicle', title: 'Vehicle', desc: 'CBA-R35 identity, VIN, purchase date and odometer' },
  { to: '/more/vendors', title: 'Vendors', desc: 'Workshops and suppliers' },
  { to: '/more/groups', title: 'Groups & sections', desc: 'ESM SM13E00-1R35E0E chapters and links to your ESM copy' },
  { to: '/more/settings', title: 'Settings', desc: 'Due-soon thresholds, default currency, storage' },
  { to: '/more/sync', title: 'Sync log', desc: 'Changes waiting to sync and conflicts' },
];

export function MorePage() {
  return (
    <Page title="More" wide={false}>
      <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {LINKS.map((l) => (
          <li key={l.to} style={{ borderColor: 'var(--border)' }}>
            <Link to={l.to} className="flex items-center gap-3 p-4 min-h-14">
              <div className="flex-1">
                <p className="font-medium">{l.title}</p>
                <p className="muted text-sm">{l.desc}</p>
              </div>
              <IconChevronR className="muted size-5" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted mt-4 text-sm">Spreadsheet import (milestone 8) and backup export (milestone 9) are coming.</p>
    </Page>
  );
}
