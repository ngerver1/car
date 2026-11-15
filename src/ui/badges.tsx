import type { Group, Section, Severity, Status } from '@/domain/schemas';

const SEVERITY_STYLE: Record<Severity, string> = {
  'Safety-critical': 'bg-red-600 text-white border-red-600',
  Drivability: 'bg-amber-500 text-black border-amber-500',
  Reliability: 'bg-sky-600 text-white border-sky-600',
  Cosmetic: 'bg-zinc-500 text-white border-zinc-500',
};
export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return null;
  return <span className={`chip ${SEVERITY_STYLE[severity]}`}>{severity}</span>;
}

const STATUS_STYLE: Record<Status, string> = {
  Open: 'border-red-500 text-red-700 dark:text-red-400',
  'In progress': 'border-amber-500 text-amber-700 dark:text-amber-400',
  Deferred: 'border-zinc-400',
  Closed: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
};
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** "D › TM" chip; full "TM · Transaxle & Transmission" in the label. Opens the ESM link when one is set. */
export function ChapterChip({ group, section, plain }: { group: Group | undefined; section: Section | undefined; plain?: boolean }) {
  if (!group) return null;
  const short = section ? `${group.code} › ${section.code}` : group.code;
  const full = section ? `${section.code} · ${section.name}` : `${group.code} · ${group.name}`;
  const link = section?.esm_link || group.esm_link;
  const page = section?.esm_link ? section.esm_page : group.esm_page;
  if (link && !plain) {
    const href = page ? `${link}#page=${page}` : link;
    return (
      <a
        className="chip underline-offset-2 hover:underline"
        href={href}
        target="_blank"
        rel="noreferrer"
        title={`${full} — open ESM`}
        onClick={(e) => e.stopPropagation()}
      >
        {short}
      </a>
    );
  }
  return (
    <span className="chip" title={full}>
      {short}
    </span>
  );
}

export function ChapterFull({ group, section }: { group: Group | undefined; section: Section | undefined }) {
  if (!group) return <span>—</span>;
  return (
    <span>
      {group.code} · {group.name}
      {section && (
        <>
          {' › '}
          {section.code} · {section.name}
        </>
      )}
    </span>
  );
}
