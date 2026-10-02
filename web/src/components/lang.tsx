import { LanguagesIcon } from "lucide-react";
import { lang, LANG_NAMES, LANGS, setLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Dil değişmeden önce yapılacak iş: yönetim ekranında dil hesaba yazılır (hesap e-postaları o dilde gelsin)
let beforeChange: ((l: Lang) => Promise<unknown>) | undefined;
export const onLangChange = (fn?: (l: Lang) => Promise<unknown>) => { beforeChange = fn; };

// Dil seçici: her ekranın üst çubuğunda (components/page.tsx Page, components/site.tsx Site). Seçilmezse cihazın dili.
export function LangSwitch({ className }: { className?: string }) {
  return (
    <label className={cn("inline-flex items-center gap-1.5", className)}>
      <LanguagesIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">Language</span>
      <select className="cursor-pointer bg-transparent underline-offset-2 hover:underline" value={lang}
        onChange={async (e) => { const l = e.target.value as Lang; await beforeChange?.(l).catch(() => {}); setLang(l); }}>
        {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
