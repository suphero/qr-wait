import { LanguagesIcon } from "lucide-react";
import { lang, LANG_NAMES, LANGS, setLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Dil seçici: tanıtım sitesinin alt bilgisinde, sıraya giriş/durum sayfalarının altında ve yönetim ekranında.
// before: seçim uygulanmadan önce çalışır (yönetimde dili hesaba yazar: hesap e-postaları o dilde gelsin)
export function LangSwitch({ className, before }: { className?: string; before?: (l: Lang) => Promise<unknown> }) {
  return (
    <label className={cn("inline-flex items-center gap-1.5", className)}>
      <LanguagesIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">Language</span>
      <select className="cursor-pointer bg-transparent underline-offset-2 hover:underline" value={lang}
        onChange={async (e) => { const l = e.target.value as Lang; await before?.(l).catch(() => {}); setLang(l); }}>
        {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
