import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { range } from "@/lib/api";
import { cn } from "@/lib/utils";

// Grup büyüklüğü seçimi: 1..max
export function SizeSelect({ max, value, onChange, className }: { max: number; value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <NativeSelect className={className} value={Math.min(value, max)} onChange={(e) => onChange(+e.target.value)}>
      {range(max).map((n) => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
    </NativeSelect>
  );
}

// Çoklu seçim düğmeleri (onay kutulu); note: seçeneğin altında küçük açıklama
function Chips<V extends string | number>({ items, value, onChange, note }: { items: V[]; value: V[]; onChange: (a: V[]) => void; note?: (v: V) => string | null }) {
  const toggle = (v: V, on: boolean) => onChange(on ? items.filter((x) => x === v || value.includes(x)) : value.filter((x) => x !== v));
  return (
    <div className="my-2 flex flex-wrap gap-2">
      {items.map((v) => (
        <Label key={v} className={cn(
          "min-h-11 cursor-pointer rounded-lg border border-input bg-card px-4 py-1 text-base font-semibold",
          "has-data-checked:border-primary has-data-checked:bg-accent",
        )}>
          <Checkbox checked={value.includes(v)} onCheckedChange={(c) => toggle(v, c === true)} />
          <span className="flex flex-col">{v}{note?.(v) && <span className="text-xs font-normal text-muted-foreground">{note(v)}</span>}</span>
        </Label>
      ))}
    </div>
  );
}

// Esnek yer seçimi: 1..size onay kutuları
export function AcceptPicker({ size, value, onChange }: { size: number; value: number[]; onChange: (a: number[]) => void }) {
  return <Chips items={range(size)} value={value} onChange={onChange} />;
}

// Bölge seçimi: ziyaretçi kabul ettiği bölgeleri işaretler
export function ZonePicker({ zones, value, onChange, note }: { zones: string[]; value: string[]; onChange: (a: string[]) => void; note?: (z: string) => string | null }) {
  return <Chips items={zones} value={value} onChange={onChange} note={note} />;
}
