import { useId, type ReactNode } from 'react';

interface BaseProps {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
}

function Wrap({ id, label, error, hint, className, children }: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="muted text-xs mt-1">{hint}</p>}
      {error && (
        <p className="error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField(
  props: BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; type?: string; required?: boolean },
) {
  const id = useId();
  return (
    <Wrap id={id} {...props}>
      <input
        id={id}
        className="input"
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        required={props.required}
        aria-invalid={!!props.error}
        aria-describedby={props.error ? `${id}-err` : undefined}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Wrap>
  );
}

export function TextArea(props: BaseProps & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const id = useId();
  return (
    <Wrap id={id} {...props}>
      <textarea
        id={id}
        className="input"
        rows={props.rows ?? 3}
        value={props.value}
        placeholder={props.placeholder}
        aria-invalid={!!props.error}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Wrap>
  );
}

/** Whole or decimal numbers kept as text while typing; numeric keyboard on phones. */
export function NumberField(props: BaseProps & { value: string; onChange: (v: string) => void; decimal?: boolean; placeholder?: string; suffix?: string }) {
  const id = useId();
  return (
    <Wrap id={id} {...props}>
      <div className="relative">
        <input
          id={id}
          className="input"
          inputMode={props.decimal ? 'decimal' : 'numeric'}
          pattern={props.decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
          value={props.value}
          placeholder={props.placeholder}
          aria-invalid={!!props.error}
          onChange={(e) => props.onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
          style={props.suffix ? { paddingRight: '3.5rem' } : undefined}
        />
        {props.suffix && <span className="muted absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">{props.suffix}</span>}
      </div>
    </Wrap>
  );
}

export function DateField(props: BaseProps & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Wrap id={id} {...props}>
      <input id={id} className="input" type="date" value={props.value} aria-invalid={!!props.error} onChange={(e) => props.onChange(e.target.value)} />
    </Wrap>
  );
}

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SelectField(props: BaseProps & { value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <Wrap id={id} {...props}>
      <select
        id={id}
        className="input"
        value={props.value}
        disabled={props.disabled}
        aria-invalid={!!props.error}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.placeholder != null && <option value="">{props.placeholder}</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

/** Row of toggle buttons. Single-select unless `multi`. */
export function ToggleGroup<T extends string>(props: { label: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void; multi?: boolean }) {
  return (
    <fieldset>
      <legend className="label">{props.label}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => {
          const on = props.value.includes(o);
          return (
            <button
              key={o}
              type="button"
              className="toggle"
              aria-pressed={on}
              onClick={() => {
                if (props.multi) props.onChange(on ? props.value.filter((x) => x !== o) : [...props.value, o]);
                else props.onChange(on ? [] : [o]);
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 min-h-11 cursor-pointer">
      <input id={id} type="checkbox" className="size-5 accent-amber-600" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="text-sm">{props.label}</span>
    </label>
  );
}

// ---------- parsing helpers for text-backed number inputs ----------
export const parseIntOrNull = (s: string): number | null => {
  const t = s.replace(/,/g, '').trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
};
export const parseDecimalOrNull = (s: string): number | null => {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
};
export const numToText = (n: number | null | undefined): string => (n == null ? '' : String(n));
