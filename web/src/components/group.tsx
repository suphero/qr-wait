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

// Esnek yer seçimi: 1..size onay kutuları
export function AcceptPicker({ size, value, onChange }: { size: number; value: number[]; onChange: (a: number[]) => void }) {
  const toggle = (n: number, on: boolean) => onChange(on ? [...value, n].sort((a, b) => a - b) : value.filter((x) => x !== n));
  return (
    <div className="my-2 flex flex-wrap gap-2">
      {range(size).map((n) => (
        <Label key={n} className={cn(
          "h-11 cursor-pointer rounded-lg border border-input bg-card px-4 text-base font-semibold",
          "has-data-checked:border-primary has-data-checked:bg-accent",
        )}>
          <Checkbox checked={value.includes(n)} onCheckedChange={(c) => toggle(n, c === true)} /> {n}
        </Label>
      ))}
    </div>
  );
}
