// Small inline icon set (stroke icons, 24px grid).
type P = { className?: string };
const base = (d: string) =>
  function Icon({ className = 'size-6' }: P) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    );
  };
export const IconDashboard = base('M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z');
export const IconDefects = base('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z');
export const IconService = base('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z');
export const IconParts = base('M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7 12 12l8.7-5M12 22V12');
export const IconMore = base('M5 12h.01M12 12h.01M19 12h.01');
export const IconPlus = base('M12 5v14M5 12h14');
export const IconCamera = base('M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');
export const IconImage = base('M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 19');
export const IconBack = base('M15 18l-6-6 6-6');
export const IconX = base('M18 6 6 18M6 6l12 12');
export const IconTrash = base('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6');
export const IconChevronL = base('M15 18l-6-6 6-6');
export const IconChevronR = base('M9 18l6-6-6-6');
export const IconSearch = base('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3');
