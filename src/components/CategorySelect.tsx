import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NONE = '__none__';

/**
 * Picks a gear type, bait or fishing method from the administrator's categories.
 * A value saved before these lists existed (or since retired) stays selectable,
 * so editing an old catch doesn't force a change.
 */
export function CategorySelect({
  value,
  onChange,
  options,
  placeholder = 'Not recorded',
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  const items = [{ value: NONE, label: placeholder }, ...all.map((o) => ({ value: o, label: o }))];

  return (
    <Select items={items} value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? '' : String(v))}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {all.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
