import { useGroups, useSections } from '@/lib/hooks';
import { SelectField } from '@/ui/fields';

/** Group (required) then section filtered by that group (optional). */
export function ChapterSelect(props: {
  group: string;
  section: string | null;
  onChange: (group: string, section: string | null) => void;
  groupError?: string | null;
}) {
  const groups = useGroups() ?? [];
  const sections = useSections() ?? [];
  const groupOptions = groups
    .filter((g) => g.active || g.code === props.group)
    .map((g) => ({ value: g.code, label: `${g.code} · ${g.name}${g.active ? '' : ' (legacy)'}` }));
  const sectionOptions = sections
    .filter((s) => s.group_code === props.group && (s.active || s.code === props.section))
    .map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` }));
  const legacy = groups.find((g) => g.code === props.group && !g.active);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        label="Group"
        value={props.group}
        placeholder="Pick a group"
        options={groupOptions}
        error={props.groupError}
        hint={legacy?.legacy_note}
        onChange={(g) => {
          const keep = sections.some((s) => s.code === props.section && s.group_code === g);
          props.onChange(g, keep ? props.section : null);
        }}
      />
      <SelectField
        label="Section (optional)"
        value={props.section ?? ''}
        placeholder={props.group ? (sectionOptions.length ? 'None' : 'No sections in this group') : 'Pick a group first'}
        options={sectionOptions}
        disabled={!props.group || sectionOptions.length === 0}
        onChange={(s) => props.onChange(props.group, s || null)}
      />
    </div>
  );
}
